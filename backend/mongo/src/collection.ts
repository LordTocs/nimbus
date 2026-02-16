import Type, { Static, StaticDecode, TArray, TObject, TProperties, TSchema, StaticObject, TOptional } from "typebox"
import {
	CreateIndexesOptions,
	IndexDescriptionInfo,
	IndexDirection,
	IndexSpecification,
	Collection as MCollection,
	ObjectId,
} from "mongodb"
import { addMongoInit, getMongoConnection } from "./db-connection"
import { CType, MaybePromise, TObjectId } from "@nimbus/util-shared"
import { useLogger } from "@nimbus/util-backend"
import _isEqual from "lodash/isEqual"
import assert from "node:assert"

export type TMongoDocument<T extends TProperties = TProperties> = TObject<T & { _id: TObjectId }>

export type StaticMongo<T extends TMongoDocument> = Static<T>

type TDeepMongoTypes = TObject | TArray

type ExcludeSymbols<T extends PropertyKey> = Exclude<T, Symbol>

type PathJoin<K, P> = K extends string | number
	? P extends string | number
		? `${K}${"" extends P ? "" : "."}${P}`
		: never
	: never

//Can't separate out types into helpers, Typescript compiler is too stupid to count the recursive stop
type TMongoIndexObjKeys<T extends TProperties> = {
	[K in keyof T]: TShedOptional<T[K]> extends TDeepMongoTypes
		? ExcludeSymbols<K> | PathJoin<ExcludeSymbols<K>, TMongoIndexKeys<T[K]>>
		: K
}[keyof T]

type TShedOptional<T extends TSchema> = T extends TOptional<infer Inner> ? Inner : T

type TMongoIndexKeys<T extends TSchema> = T extends TObject<infer TProps>
	? TMongoIndexObjKeys<TProps>
	: T extends TArray<infer ItemSchema>
	? TMongoIndexKeys<ItemSchema>
	: never

const logger = useLogger("mongo")

type TypedIndexKey<T extends TMongoDocument> = {
	[key in TMongoIndexObjKeys<T["properties"]>]?: IndexDirection
}

type GenericIndexKey = {
	[key: string]: IndexDirection | undefined
}

type TypedIndexSpec<T extends TMongoDocument> = {
	key: TypedIndexKey<T>
	options?: CreateIndexesOptions
}

type GenericIndexSpec = {
	key: GenericIndexKey
	options?: CreateIndexesOptions
}

//TODO: VALIDATORS
//updating a validator https://stackoverflow.com/questions/44318188/add-new-validator-to-existing-collection

function isIndexKeyMatch(requestedIndex: GenericIndexSpec, existingIndex: IndexDescriptionInfo) {
	if (!_isEqual(requestedIndex.key, existingIndex.key)) return false
	return true
}

/**
 *
 * @param requestedIndex
 * @param existingIndex
 * @returns false if the index cannot be updated to match the request and must be receated
 */
function isIndexUpdateCompatible(requestedIndex: GenericIndexSpec, existingIndex: IndexDescriptionInfo): boolean {
	//See here for defaults https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/

	if (!isIndexKeyMatch(requestedIndex, existingIndex)) return false

	if ((existingIndex.background ?? false) != (requestedIndex.options?.background ?? false)) {
		return false
	}

	if ((existingIndex.sparse ?? false) != (requestedIndex.options?.sparse ?? false)) {
		return false
	}

	if ((existingIndex.unique ?? false) && !(requestedIndex.options?.unique ?? false)) {
		//Mongo cannot convert a unique index to a non-unique index. Force a drop
		return false
	}

	if (!_isEqual(existingIndex.partialFilterExpression, requestedIndex.options?.partialFilterExpression)) {
		return false
	}

	if (!_isEqual(existingIndex.storageEngine, requestedIndex.options?.storageEngine)) {
		return false
	}

	//Text options
	if (!_isEqual(existingIndex.collation, requestedIndex.options?.collation)) {
		return false
	}

	if (existingIndex["2dsphereIndexVersion"] != requestedIndex.options?.["2dsphereIndexVersion"]) {
		//2d Sphere Options
		return false
	}

	//2d Index Options
	if ((existingIndex.bits ?? 26) != (requestedIndex.options?.bits ?? 26)) {
		return false
	}

	if ((existingIndex.min ?? -180.0) != (requestedIndex.options?.min ?? -180.0)) {
		return false
	}

	if ((existingIndex.max ?? -180.0) != (requestedIndex.options?.min ?? -180.0)) {
		return false
	}

	//Wildcard
	if (!_isEqual(existingIndex.wildcardProjection, requestedIndex.options?.wildcardProjection)) {
		return false
	}

	return true
}

export async function ensureIndexSettings(
	collectionName: string,
	requestedIndex: GenericIndexSpec,
	existingIndex: IndexDescriptionInfo
) {
	const changes: Record<string, any> = {}

	if ((requestedIndex.options?.hidden ?? false) != (existingIndex.hidden ?? false)) {
		changes.hidden = requestedIndex.options?.hidden ?? false
	}

	if (requestedIndex.options?.unique == true && !(existingIndex.unique ?? false)) {
		//We can convert a non-unique to unique index
		changes.unique = true
	}

	if (requestedIndex.options?.expireAfterSeconds != existingIndex.expireAfterSeconds) {
		changes.expireAfterSeconds = requestedIndex.options?.expireAfterSeconds ?? null
	}

	if (Object.keys(changes).length > 0) {
		await getMongoConnection()
			.db()
			.command({
				collMod: collectionName,
				index: {
					keyPattern: requestedIndex.key,
					...changes,
				},
			})
	}
}

export function defineCollection<T extends TMongoDocument>(
	name: string,
	schema: T,
	indices: Array<TypedIndexSpec<T>> = []
): MCollection<StaticMongo<T>> {
	const collection = getMongoConnection().db().collection<StaticMongo<T>>(name)

	const init = async () => {
		const existingIndices = await collection.indexes({ full: true })
		const unmatchedIndices = new Array<IndexDescriptionInfo>()

		for (const existingIndex of existingIndices) {
			const requestedIndex = indices.find((i) => isIndexUpdateCompatible(i, existingIndex))

			if (requestedIndex) {
				await ensureIndexSettings(name, requestedIndex, existingIndex)
			} else {
				unmatchedIndices.push(existingIndex)
			}
		}

		for (const unmatchedIndex of unmatchedIndices) {
			assert(unmatchedIndex.name, "Indicies have names, how did this happen?")
			await collection.dropIndex(unmatchedIndex.name)
		}

		for (const requestedIndex of indices) {
			const existingIndex = existingIndices.find((i) => isIndexUpdateCompatible(requestedIndex, i))
			if (existingIndex) continue

			await collection.createIndex(requestedIndex.key as IndexSpecification, requestedIndex.options)
		}

		//TODO: Add BSON validator
	}

	addMongoInit(async () => {
		try {
			await init()
			logger.log("Initialized mongo collection", name)
		} catch (err) {
			logger.error("Failed to init mongo collection", name)
			logger.error(err)
		}
	})

	return collection
}

const NestTest = Type.Object({
	d: Type.Number(),
	e: Type.String(),
})

const TestDocument = Type.Object({
	_id: CType.ObjectId(),
	a: Type.String(),
	b: Type.Optional(NestTest),
})
type TestDocument = StaticDecode<typeof TestDocument>
type TestDocSchema = typeof TestDocument
type TestDocKeys = TMongoIndexObjKeys<TestDocSchema["properties"]>

// defineCollection("testdocuments", TestDocument, [
// 	{
// 		key: { "b.d": 1 },
// 	},
// ])
