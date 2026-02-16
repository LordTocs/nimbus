import Type, { TObject, TSchema } from "typebox"
import { ObjectId } from "bson"
import { base64 } from "./base64"

export function toObjectId(id: ObjectId | string) {
	if (id instanceof ObjectId) return id
	if (typeof id == "string") {
		return new ObjectId(id)
	}
	throw new Error("Cannot convert to mongo id!")
}

export function newObjectId() {
	return new ObjectId()
}

export { ObjectId }

export const TObjectId = Type.Codec(Type.String())
	.Decode((str: string) => toObjectId(str))
	.Encode((oid: ObjectId) => oid.toString())

export type TObjectId = typeof TObjectId

//Taken from the legacy types in typebox
export class TDate extends Type.Base<globalThis.Date> {
	public override Check(value: unknown): value is globalThis.Date {
		return value instanceof globalThis.Date
	}
	public override Errors(value: unknown): object[] {
		return this.Check(value) ? [] : [{ message: "must be Date" }]
	}
	public override Create(): globalThis.Date {
		return new globalThis.Date(0)
	}
}

export const CType = {
	ObjectId(): TObjectId {
		return TObjectId
	},
	Date(): TDate {
		return new TDate()
	},
}

export type TStaticDecodeArgs<TArgs extends Type.TSchema[]> = TArgs extends [
	infer TFirst extends Type.TSchema,
	...infer TRest extends Type.TSchema[]
]
	? [Type.StaticDecode<TFirst>, ...TStaticDecodeArgs<TRest>]
	: []


///////////////////////////////
////Typebox Minification
///////////////////////////////

export function getMinificationKey<T extends TObject>(schema: T, key: keyof T["properties"]) {
	if (!schema) throw new Error("Missing Minify Schema")

	const keys = Object.keys(schema.properties)
	const idx = keys.findIndex(k => k == key)

	if (idx < 0) return undefined

	return base64.fromNumber(idx)
}

/**
 * Minifies an object using it's typebox schema. Used to reduce transport size.
 * @param schema 
 * @param value 
 * @returns Version of the object with it's keys replaced to reduce the text size of it's JSON.
 */
export function minify<T extends TSchema>(schema: T, value: Type.StaticEncode<T>): any {
	if (!schema) throw new Error("Missing Minify Schema")

	if (Type.IsObject(schema)) {
		const result = {} as Record<string, any>
		const keys = Object.keys(schema.properties)
		for (let i = 0; i < keys.length; ++i) {
			const key = keys[i]
			if (!(key in value)) continue

			result[`${base64.fromNumber(i)}`] = minify(schema.properties[key], value[key])
		}
		return result
	} else if (Type.IsArray(schema)) {
		const valArray = value as Array<any>
		return valArray.map((v) => minify(schema.items, v))
	} else {
		return value
	}
}

/**
 * Maxifies an object that has been minified using it's schema. Restoring all of it's keys to their original names.
 * @param schema 
 * @param minValue 
 * @returns 
 */
export function maxify<T extends TSchema>(schema: T, minValue: any): Type.StaticEncode<T> {
	if (!schema) throw new Error("Missing Maxify Schema")
	if (Type.IsObject(schema)) {
		const result = {} as Record<string, any>
		const keys = Object.keys(schema.properties)

		for (const b64Key in minValue) {
			const idx = base64.toNumber(b64Key)
			const key = keys[idx]
			result[key] = maxify(schema.properties[key], minValue[b64Key])
		}
		return result as Type.StaticEncode<T>
	} else if (Type.IsArray(schema)) {
		const valArray = minValue as Array<any>
		return valArray.map((v) => maxify(schema.items, v)) as Type.StaticEncode<T>
	} else {
		return minValue as Type.StaticEncode<T>
	}
}


