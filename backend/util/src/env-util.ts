import assert from "node:assert"


export function requiredEnv(varName: string, err?: string) {
    const value = process.env[varName]
    assert(value, err ?? `${varName} env var is missing`)
    return value
}

//Thanks Gavin
export function optionalEnv(varName: string) {
    return process.env[varName]
}