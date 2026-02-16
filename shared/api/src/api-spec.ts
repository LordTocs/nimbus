import Type, { Static, StaticDecode, TAny, TNumber, TObject, TProperties, TSchema, TString } from "typebox"
import TypeCompiler, { Compile, Validator } from "typebox/compile"
import { CType } from "@nimbus/util-shared"

/*
Utilities for generating type safe api route definitions. TypeBox is used for type definition and validation.
*/


/////////////BORROWED FROM express-serve-static-core types/////////////////////////

type RemoveTail<S extends string, Tail extends string> = S extends `${infer P}${Tail}` ? P : S
type GetRouteParameter<S extends string> = RemoveTail<
	RemoveTail<RemoveTail<S, `/${string}`>, `-${string}`>,
	`.${string}`
>

export interface ParamsDictionary {
	[key: string]: string
}

// prettier-ignore
export type RouteParameters<Route extends string> = Route extends `${infer Required}{${infer Optional}}${infer Next}`
    ? ParseRouteParameters<Required> & Partial<ParseRouteParameters<Optional>> & RouteParameters<Next>
    : ParseRouteParameters<Route>;

type ParseRouteParameters<Route extends string> = string extends Route
	? ParamsDictionary
	: Route extends `${string}(${string}`
	? ParamsDictionary // TODO: handling for regex parameters
	: Route extends `${string}:${infer Rest}`
	? (GetRouteParameter<Rest> extends never
			? ParamsDictionary
			: GetRouteParameter<Rest> extends `${infer ParamName}?`
			? { [P in ParamName]?: string } // TODO: Remove old `?` handling when Express 5 is promoted to "latest"
			: { [P in GetRouteParameter<Rest>]: string }) &
			(Rest extends `${GetRouteParameter<Rest>}${infer Next}` ? RouteParameters<Next> : unknown)
	: {}

/////////////////////////////
type TQueryParameter = TString | TNumber

export interface QuerySchemaBase {
	[key: string | symbol]: TQueryParameter //We shouldn't need symbol here but TypeScript complains incorrectly
}


export type RouteMethod = "all" | "get" | "head" | "patch" | "options" | "connect" | "delete" | "trace" | "post" | "put"

export interface PublicRouteOperation<
	OperationId extends string = string,
	QuerySchema extends QuerySchemaBase | undefined = QuerySchemaBase | undefined,
	BodySchema extends TSchema | undefined = TSchema | undefined,
	ResponseSchema extends TSchema | undefined = TSchema | undefined,
> {
	id: OperationId
	query?: QuerySchema
	body?: BodySchema
	responseCode?: number
	response?: ResponseSchema
}

export type PublicPathSchema<TPath extends string = string, TOps extends string = string> = Partial<{
	[TMethod in RouteMethod]: PublicRouteOperation<
		TOps,
		QuerySchemaBase | undefined,
		TSchema | undefined,
		TSchema | undefined
	>
}>

export type PublicRoutesSchema<TOps extends string = string, TPaths extends string = string> = {
	[TPath in TPaths]: PublicPathSchema<TPath, TOps>
}

type IsEmptyObject<Obj extends Record<string, unknown>> = [keyof Obj] extends [never] ? true : false

type SafeStaticDecode<T extends TSchema | undefined, TFallback = never> = unknown extends T
	? TFallback
	: T extends TSchema
	? StaticDecode<T>
	: TFallback

// IsEmptyObject<RouteParameters<TPath>> extends true ? never : RouteParameters<TPath>

export type HasParams<TPath extends string> = IsEmptyObject<RouteParameters<TPath>> extends true ? false : true

/**
 * Returns true if the route string contains at least one URL param
 * @param path 
 * @returns 
 */
export function hasUrlParams(path: string) {
    return path.match(/:[\w]+/g) != null
}

export type RouteParamType<TPath extends string> = HasParams<TPath> extends true ? RouteParameters<TPath> : never
export type RouteResponseType<TOp extends PublicRouteOperation> = SafeStaticDecode<TOp["response"], void>
export type RouteBodyType<TOp extends PublicRouteOperation> = SafeStaticDecode<TOp["body"]>
export type RouteQueryType<TOp extends PublicRouteOperation> = unknown extends TOp["query"]
	? never
	: TOp["query"] extends QuerySchemaBase
	? StaticDecode<TObject<TOp["query"]>>
	: never

type SafeValidator<
	T extends TSchema | undefined,
	TProps extends TProperties = {},
	TFallback = never
> = unknown extends T ? TFallback : T extends TSchema ? Validator<TProps, T> : TFallback

export type RouteBodyValidator<TOp extends PublicRouteOperation, TProps extends TProperties = {}> = SafeValidator<
	TOp["body"],
	TProps
>
export type RouteResponseValidator<TOp extends PublicRouteOperation, TProps extends TProperties = {}> = SafeValidator<
	TOp["response"],
	TProps
>

export type RouteQueryValidator<
	TOp extends PublicRouteOperation,
	TProps extends TProperties = {}
> = unknown extends TOp["query"]
	? never
	: TOp["query"] extends TSchema
	? Validator<TProps, TObject<TOp["query"]>>
	: never


export interface RouteOperationValidators<TOp extends PublicRouteOperation> {
	body?: RouteBodyValidator<TOp>
	query?: RouteQueryValidator<TOp>
	response?: RouteResponseValidator<TOp>
}

export function compileValidators<TOp extends PublicRouteOperation>(operation: TOp): RouteOperationValidators<TOp> {
	const result: Record<string, any> = {}

	if (operation.body != null) {
		operation.body = Compile(operation.body)
	}
	if (operation.response) {
		operation.response = Compile(operation.response)
	}

	if (operation.query) {
		operation.query
	}

	return result as RouteOperationValidators<TOp>
}

/**
 * Creates a route definition object with type validation
 * @param routes 
 * @returns 
 */
export function defineRoutes<TOps extends string, TPaths extends string,  TRoutes extends PublicRoutesSchema<TOps, TPaths>>(routes: TRoutes) {
	return routes
}
