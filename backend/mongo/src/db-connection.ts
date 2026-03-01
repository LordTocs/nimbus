import { addBootTask, logger, requiredEnv } from "@nimbus/util-backend"
import { MongoClient } from "mongodb"

export interface NimbusMongoDB {
	internalClient: MongoClient
	connected: boolean
	initTasks: (() => any)[]
}

export async function addMongoInit(server: NimbusMongoDB, func: () => any) {
	if (!server.connected) {
		server.initTasks.push(func)
	} else {
		await func()
	}
}

//TODO: ConnectionString should be inferred by the deployment system generator thingy

/**
 * Declares a mongo server
 * @param connectionString
 * @returns
 */
export function useMongoDB(connectionString: string): NimbusMongoDB {
	const client = new MongoClient(connectionString)

	const result = { internalClient: client, connected: false, initTasks: [] } as NimbusMongoDB

	addBootTask(`Setting Up Mongo Server`, async () => {
		await result.internalClient.connect()

		await Promise.allSettled(result.initTasks)

        result.connected = true
	})

	return result
}
