import assert from "node:assert"


export function requiredEnv(varName: string, err?: string) {
    const value = process.env[varName]
    assert(value, err ?? `${varName} env var is missing`)
    return value
}

//Should this be a typebox type??


export function requireEnvNumber(varName: string, defaultValue?: number, err?: string) {
    const value = process.env[varName]

    if (value == null && defaultValue != null) {
        return defaultValue
    }

    assert(value != null, err ?? `${varName} env var (number) is missing`)
    const numValue = Number(value)
    assert(!isNaN(numValue), `${varName} is expected to be a number`)

    return numValue
}

//Thanks Gavin
export function optionalEnv(varName: string) {
    return process.env[varName]
}