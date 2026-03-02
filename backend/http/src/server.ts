import { Protocol, Request, Response, Server, IRouter, RequestHandler, StepFunction } from "0http/common"
import createHttpError, { isHttpError } from "http-errors"
import zero from "0http"
import sequential from "0http/lib/router/sequential"
import findMyWay from "find-my-way"

import { addBootTask, getTracer, useLogger } from "@nimbus/util-backend"
import { Span, SpanStatusCode } from "@opentelemetry/api"

/*
 * TODO: Perhaps don't expose 0http directly?
 *
 */

export type InternalProtocolType = Protocol
export type InternalHTTPServerType = Server<InternalProtocolType>
export type InternalRouterType = IRouter<InternalProtocolType>

export interface NimbusHttpServer {
	port: number
	internalServer: InternalHTTPServerType
	internalRouter: InternalRouterType
}

export type Request0Http<P extends Protocol> = Request<P> & {
	path: string
	query: Record<string, string | string[]>
	params: Record<string, string>
	body: any
	span?: Span
}

export type RequestHandler0HTTP<P extends Protocol> = (
	req: Request0Http<P>,
	res: Response<P>,
	next: (error?: unknown) => void,
) => void | Promise<unknown>

declare module "0http" {
	interface IBuildServerAndRouterConfig<P extends Protocol, S extends Server<P>, R extends IRouter<P>> {
		defaultRoute?: (req: Request<P>, res: Response<P>) => any
		errorHandler?: (err: Error, req: Request<P>, res: Response<P>) => any
		cacheSize?: number
		id?: string
	}
}

const logger = useLogger("http")

const omittedHttpHeaders = ["authorization"]

function createTelemetryMiddleware<P extends Protocol>(server: NimbusHttpServer) {
	return function telemetryMiddleware(req: Request0Http<P>, res: Response<P>, next: StepFunction) {
		const method = req.method?.toUpperCase() ?? "UNKNOWN"
		getTracer().startActiveSpan(`${method} ${req.url}`, (span) => {
			req.span = span

			span.setAttribute("http.request.method", method)
			span.setAttribute("server.address", server.port)

			for (const key in req.headers) {
				if (omittedHttpHeaders.includes(key.toLowerCase())) continue
				const value = req.headers[key]
				if (value == null) continue

				span.setAttribute(`http.request.header.${key}`, value)
			}

			res.on("finish", () => {
				span.setAttribute("http.response.status_code", res.statusCode)

				if (req.headers["content-length"] != null) {
					span.setAttribute("http.response.body.size", req.headers["content-length"])
				}

				if (res.headersSent) {
					const headers = res.getHeaders()
					for (const key in headers) {
						const value = headers[key]
						if (value == null) continue
						span.setAttribute(`http.response.header.${key}`, value)
					}
				}

				span.end()
			})

			return next()
		})
	}
}

function errorHandler<P extends Protocol>(err: any, req: Request<P>, res: Response<P>) {
	if (isHttpError(err)) {
		res.statusCode = err.statusCode
	} else {
		res.statusCode = 500
	}

	const span = (req as Request0Http<P>).span

	if (span) {
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message: err.toString(),
		})
	}

	res.end(err.message)
}



export function useHttpServer(port: number = 80): NimbusHttpServer {
	const { router, server } = zero({
		router: sequential(), 
		errorHandler: errorHandler,
	})

	const nimbusHttp = {
		port,
		internalRouter: router,
		internalServer: server,
	} as NimbusHttpServer

	router.use(createTelemetryMiddleware(nimbusHttp) as RequestHandler<InternalProtocolType>)

	addBootTask(`Booting Http Server on ${port}`, () => {
		return new Promise<number>((resolve, reject) => {
			if (Number.isNaN(port)) {
				reject(new Error(`Invalid Port! "${port}"`))
			}

			server.listen(port, () => {
				logger.log("Started Server on Port", port)
				resolve(Number(port))
			})
		})
	})

	return nimbusHttp
}
