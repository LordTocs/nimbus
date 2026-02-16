import {
	PublicRoutesSchema,
	PublicRouteOperation,
	RouteParamType,
	RouteQueryType,
	RouteBodyType,
	RouteResponseType,
	compileValidators,
	hasUrlParams,
} from "@nimbus/api-shared"

type RouteMethodCaller<TPath extends string, TOp extends PublicRouteOperation> =
	RouteParamType<TPath> extends never
		? RouteQueryType<TOp> extends never
			? RouteBodyType<TOp> extends never
				? () => Promise<RouteResponseType<TOp>>
				: (body: RouteBodyType<TOp>) => Promise<RouteResponseType<TOp>>
			: RouteBodyType<TOp> extends never
				? (query: RouteQueryType<TOp>) => Promise<RouteResponseType<TOp>>
				: (query: RouteQueryType<TOp>, body: RouteBodyType<TOp>) => Promise<RouteResponseType<TOp>>
		: RouteQueryType<TOp> extends never
			? RouteBodyType<TOp> extends never
				? (params: RouteParamType<TPath>) => Promise<RouteResponseType<TOp>>
				: (params: RouteParamType<TPath>, body: RouteBodyType<TOp>) => Promise<RouteResponseType<TOp>>
			: RouteBodyType<TOp> extends never
				? (params: RouteParamType<TPath>, query: RouteQueryType<TOp>) => Promise<RouteResponseType<TOp>>
				: (
						params: RouteParamType<TPath>,
						query: RouteQueryType<TOp>,
						body: RouteBodyType<TOp>,
					) => Promise<RouteResponseType<TOp>>

type PathOperation<TPath extends string, TOp extends PublicRouteOperation> = RouteMethodCaller<TPath, TOp>
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

// type DoTheThing<T extends Record<PropertyKey, Record<PropertyKey, { id: string }>>> = UnionToIntersection<
// 	{
// 		[K1 in keyof T]: {
// 			[K2 in keyof T[K1] as T[K1][K2]["id"]]: () => unknown
// 		}
// 	}[keyof T]
// >

// type Input = {
// 	"/test": {
// 		get: {
// 			id: "getTest"
// 		}
// 		post: {
// 			id: "postTest"
// 		}
// 	}
// 	"/somethingElse": {
// 		put: {
// 			id: "foo"
// 		}
// 	}
// }

// type Output = DoTheThing<Input>

type RouteOperations<TRoutes extends Record<PropertyKey, Record<PropertyKey, { id: string }>>> = UnionToIntersection<
	{
		[TPath in keyof TRoutes]: {
			[TMethod in keyof TRoutes[TPath] as TRoutes[TPath][TMethod]["id"]]: TPath extends string
				? PathOperation<TPath, TRoutes[TPath][TMethod]>
				: never
		}
	}[keyof TRoutes]
>

export function applyParams<TPath extends string>(path: TPath, params: RouteParamType<TPath>): string {
	if (!hasUrlParams(path)) return path

	//TODO: Do this better, this could potentially break with odd strings
	let result = path as string
	for (const key in params) {
		result = result.replace(`:${key}`, params[key])
	}

	return result
}

interface ApiInit {
	apiBase?: string
	headers?: HeadersInit | (() => HeadersInit)
}

export function useRoutes<TOps extends string, TRoutes extends PublicRoutesSchema<TOps>>(
	routes: TRoutes,
	init?: ApiInit,
): RouteOperations<TRoutes> {
	const result: Record<string, (paramOrBodyOrQuery: any, bodyOrQuery: any, maybeBody: any) => any> = {}

	for (const path in routes) {
		const pathSpec = routes[path]
		const hasParams = hasUrlParams(path)
		for (const method in pathSpec) {
			const methodSpec = pathSpec[method] as PublicRouteOperation

			const validators = compileValidators(methodSpec)
			const hasQuery = methodSpec.query != null
			const hasBody = methodSpec.body != null
			const hasResponse = methodSpec.response != null

			const sender = async (paramOrBodyOrQuery: any, bodyOrQuery: any, maybeBody: any) => {
				const params = hasParams ? paramOrBodyOrQuery : undefined
				const query = hasQuery ? (!hasParams ? paramOrBodyOrQuery : bodyOrQuery) : undefined
				const body = hasBody
					? !hasParams
						? !hasQuery
							? paramOrBodyOrQuery
							: bodyOrQuery
						: !hasQuery
							? bodyOrQuery
							: maybeBody
					: undefined

				const urlPath = applyParams(path, params)

				const url = new URL(urlPath, init?.apiBase)

				if (hasQuery) {
					if (!validators.query) throw new Error("Missing Query Validator")
					//@ts-ignore
					const queryEncoded = validators.query.Encode(query)

					for (const key in queryEncoded) {
						//@ts-ignore
						url.searchParams.set(key, queryEncoded[key])
					}
				}

				let bodyData: any = undefined

				if (hasBody) {
					if (!validators.body) throw new Error("Missing Body Validator")
					//@ts-ignore
					bodyData = validators.body.Encode(body)
				}

				const resp = await fetch(url, {
					method,
					headers: init?.headers ? (typeof init.headers == "function" ? init.headers() : init.headers) : {},
					body: hasBody ? JSON.stringify(bodyData) : undefined,
				})

				if (!resp.ok) {
					const respText = await resp.text().catch(() => "")
					throw new Error(`${resp.status} ${resp.statusText}: ${respText}`)
				}

				//TODO: Validate response code?

				if (hasResponse) {
					if (!validators.response) throw new Error("Missing Response Validator")

					const responseData = await resp.json()
					//@ts-ignore
					const response = validators.response.Decode(responseData)
					return response
				}
			}

			result[methodSpec.id] = sender
		}
	}

	return result as RouteOperations<TRoutes>
}

// const client = useRoutes(testRoutes)
// client.getTests({})
// client.getTest({ id: "blahblah" })
// client.createTest({ foo: "YO"})
// client.deleteTest({ id: "blahblah" })
// client.createTest({ foo: "hello" })
