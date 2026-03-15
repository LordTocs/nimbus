import assert from "node:assert"
import dotenv from "dotenv"
import Type, { TSchema, TOptional } from "typebox"
import Value, { Parser } from "typebox/value"
import { IsDefault } from "typebox/schema"

let loadedEnv = false
export function ensureEnvLoaded() {
	if (!loadedEnv) {
		loadedEnv = true
		dotenv.configDotenv()
	}
}

type TEnvResult<T extends TSchema> = T extends TOptional<TSchema> ? Type.StaticDecode<T> | undefined : Type.StaticDecode<T>

export function useEnvVariable(envName: string) : string
export function useEnvVariable<T extends TSchema>(envName: string, type: T): TEnvResult<T> 
export function useEnvVariable<T extends TSchema>(envName: string, type?: T): TEnvResult<T> {
	ensureEnvLoaded()

    const resolveType = type ?? Type.String()

	const rawValue = process.env[envName]

	if (rawValue == null) {
		if (IsDefault(resolveType)) {
			return Value.Default(resolveType, rawValue) as TEnvResult<T>
		} else if (Type.IsOptional(resolveType)) {
            return undefined as TEnvResult<T>
        } else {
            throw new Error(`Missing Required Environment Variable "${envName}"`)
        }
	} else {
		//Do we need a decode?? A Check?
		return Parser(resolveType, rawValue) as TEnvResult<T>
	}
}
