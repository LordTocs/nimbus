import Type, { Static, StaticDecode, TNumber, TObject, TSchema, TString } from "typebox"

import createHttpError, { isHttpError } from "http-errors"

import { IRouter, Protocol, RequestHandler, Response } from "0http/common"
import { IncomingHttpHeaders } from "http"
import { Request0Http, RequestHandler0HTTP } from "@nimbus/http"
import {
	MaybePromise
} from "@nimbus/util-shared"

import {
	PublicRoutesSchema,
	PublicPathSchema,
	PublicRouteOperation,
	RouteResponseType,
	RouteQueryType,
	RouteBodyType,
	compileValidators,
	RouteMethod,
	RouteParamType,
} from "@nimbus/api-shared"
import assert from "node:assert"

import { withSpan } from "@nimbus/util-backend"

type RequestExtension = object

type QueryData<TOp extends PublicRouteOperation> =
	RouteQueryType<TOp> extends never ? {} : { query: RouteQueryType<TOp> }
type BodyData<TOp extends PublicRouteOperation> = RouteBodyType<TOp> extends never ? {} : { body: RouteBodyType<TOp> }
type ParamsData<TPath extends string> = RouteParamType<TPath> extends never ? {} : { params: RouteParamType<TPath> }

interface RequestBase {
	headers: IncomingHttpHeaders
}

export type ApiRequestData<
	TPath extends string,
	TOp extends PublicRouteOperation,
	Extension extends RequestExtension = {},
> = ParamsData<TPath> & QueryData<TOp> & BodyData<TOp> & RequestBase & Extension

export interface AuthenticationHandler<AuthenticationData extends object, P extends Protocol> {
	name: string
	checkAuthentication(req: Request0Http<P>): Promise<AuthenticationData | undefined | string>
}

type RouteOpImplementation<
	TPath extends string = string,
	TOp extends PublicRouteOperation = PublicRouteOperation,
	Extension extends object = {},
> = {
	handle(req: ApiRequestData<TPath, TOp, Extension>): MaybePromise<RouteResponseType<TOp>>
}

type RoutePathImplementation<
	TPath extends string = string,
	TPathSchema extends PublicPathSchema = PublicPathSchema,
	Extension extends object = {},
> = {
	[TMethod in string & keyof TPathSchema]: TPathSchema[TMethod] extends PublicRouteOperation
		? RouteOpImplementation<TPath, TPathSchema[TMethod], Extension>
		: never
}

type RouteImplementationSpec<TRoutes extends PublicRoutesSchema, Extension extends object = {}> = {
	[TPath in string & keyof TRoutes]: RoutePathImplementation<TPath, TRoutes[TPath], Extension>
}

export interface RouteImplementationOptions<P extends Protocol, AuthExtension extends object> {
	router: IRouter<P>
	authentication?: AuthenticationHandler<AuthExtension, P>
}

export function implementRoutes<
	TRoutes extends PublicRoutesSchema,
	P extends Protocol,
	AuthExtension extends object = {},
>(
	routes: TRoutes,
	options: RouteImplementationOptions<P, AuthExtension>,
	implementation: RouteImplementationSpec<TRoutes, AuthExtension>,
) {
	const authenticationSpanName = `http.auth.${options.authentication?.name}`

	for (const path in implementation) {
		const pathImpl = implementation[path]
		const publicPathSpec = routes[path]

		if (!publicPathSpec) throw new Error("Implementing route not in the spec.")

		for (const method in pathImpl) {
			const methodImpl = pathImpl[method as keyof typeof pathImpl]
			const publicMethodSpec = publicPathSpec[method as keyof typeof publicPathSpec]

			if (!publicMethodSpec) throw new Error("Implementing method not in the spec")

			const validators = compileValidators(publicMethodSpec)

			const requestData: Record<string, any> = {}

			const handler: RequestHandler0HTTP<P> = async (req: Request0Http<P>, res, next) => {
				try {
					let authResult: AuthExtension | string | undefined = undefined
					if (req.span) {
						req.span.setAttribute("http.route", path)
						req.span.updateName(`${method} ${path}`)
					}

					if (options.authentication) {
						authResult = await withSpan(authenticationSpanName, () =>
							options.authentication?.checkAuthentication(req),
						)
						if (!authResult || typeof authResult == "string") {
							const authFailReason = authResult ?? "Not Authorized"
							throw createHttpError.Unauthorized(authFailReason)
						}
					}

					await withSpan("http.request.validation", () => {
						if (validators.query) {
							try {
								//@ts-ignore-error
								requestData.query = validators.query.Decode(req.query)
							} catch (err) {
								//@ts-ignore
								const errors = validators.query.Errors(req.query)
								throw createHttpError.BadRequest(`Query Error ${errors}`)
							}
						}

						if (validators.body) {
							try {
								//@ts-ignore-error
								requestData.body = validators.body.Decode(req.body)
							} catch (err) {
								//@ts-ignore-error
								const errors = validators.body.Errors(req.body)
								throw createHttpError.BadRequest(`Body Error ${errors}`)
							}
						}

						requestData.params = req.params
					})

					if (options.authentication) {
						assert(authResult)
						Object.assign(requestData, authResult)
					}

					//TODO: Authorization handler of some form

					//@ts-ignore
					const responseData = await methodImpl.handle(requestData)

					//TODO: Make better
					res.statusCode = publicMethodSpec.responseCode ?? (validators.response && responseData ? 200 : 204)

					await withSpan("http.request.response", () => {
						if (validators.response) {
							try {
								//@ts-ignore
								const json = JSON.stringify(validators.response.Encode(responseData))
								res.end(json)
							} catch (err) {
								//@ts-ignore-error
								const errors = validators.response.Errors(responseData)
								//TODO: ???
								throw createHttpError.InternalServerError()
							}
						} else {
							res.end()
						}
					})
				} catch (err) {
					next(err)
				}
			}

			options.router[method as RouteMethod](path, handler as RequestHandler<P>)
		}
	}
}
