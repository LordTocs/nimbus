
import { logger, requiredEnv } from "@nimbus/util-backend"
import { MongoClient } from "mongodb"

let globalMongoClient : MongoClient | undefined = undefined
let connected = false
let mongoInitFunctions = new Array<() => any>()

/*
TODO: Do we ever need to support *multiple* mongo connections??
*/

const MONGO_CONNECTION_STRING = requiredEnv("MONGO_CONNECTION_STRING")

export function getMongoConnection() {
    if (globalMongoClient != null) {
        return globalMongoClient
    }

    globalMongoClient = new MongoClient(MONGO_CONNECTION_STRING)

    return globalMongoClient
}

export async function initializeMongo() {
    const client = getMongoConnection()
    await client.connect()
    connected = true
    logger.log("Mongo Connected")
    await Promise.allSettled(mongoInitFunctions.map(i => i()))
    logger.log("Mongo Initialized")

}

export async function addMongoInit(func: () => any) {
    if (!connected) {
        mongoInitFunctions.push(func)
    } else {
        await func()
    }
}