import { Protocol, Request, Response, Server, IRouter, RequestHandler, StepFunction } from "0http/common"
import createHttpError, { isHttpError } from "http-errors"
import zero, { IBuildServerAndRouterConfig } from "0http"

import sequential from "0http/lib/router/sequential"
import { getTracer, useLogger } from "@nimbus/util-backend"
import { Span, SpanStatusCode } from "@opentelemetry/api"

/*
 * TODO: Perhaps don't expose 0http directly?
 * 
 */


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

function telemetryMiddleware<P extends Protocol>(req: Request0Http<P>, res: Response<P>, next: StepFunction) {
	const method = req.method?.toUpperCase() ?? "UNKNOWN"
	getTracer().startActiveSpan(`${method} ${req.url}`, (span) => {
		req.span = span

		span.setAttribute("http.request.method", method)
		span.setAttribute("server.address", port)

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

export function createHttpServer() {
	const { router, server } = zero({
		router: sequential(), //TODO replace with find-my-way
		errorHandler: errorHandler,
	})

	router.use(telemetryMiddleware as RequestHandler<Protocol>)

	return { router, server }
}

export function createRouter() {
	return sequential()
}

const port = Number(process.env.PORT ?? "80")

export function startHttpServer<P extends Protocol>(server: Server<P>) {
	return new Promise<number>((resolve, reject) => {
		if (Number.isNaN(port)) {
			reject(new Error(`Invalid Port! "${process.env.PORT}"`))
		}

		server.listen(port, () => {
			logger.log("Started Server on Port", port)
			resolve(Number(port))
		})
	})
}
