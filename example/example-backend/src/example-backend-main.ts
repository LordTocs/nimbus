import { useHttpServer } from "@nimbus/http";
import { boot, requiredEnv, requireEnvNumber } from "@nimbus/util-backend";
import { defineCollection, useMongoDB} from "@nimbus/mongo"
import { ExamplePost, exampleRoutes, ExampleUser } from "@nimbus/example-shared";
import { implementRoutes } from "@nimbus/api-backend"
import { ObjectId } from "bson";
import { toObjectId } from "@nimbus/util-shared";



//TODO: Should this be a typebox type?
const port = requireEnvNumber("PORT", 80)
const mongoString = requiredEnv("MONGO_CONNECTION_STRING")

//A more robust settings/secrets system would be great that way the infra compiler can fetch/insert/generate these
const httpServer = useHttpServer(port)
const mongo = useMongoDB(mongoString)

const Users = defineCollection(mongo, "Users", ExampleUser)
// The notation for indices is kinda terrible.
const Posts = defineCollection(mongo, "Posts", ExamplePost, [
    { key: {"poster": 1 } }
])

implementRoutes(exampleRoutes, {
    router: httpServer.internalRouter
}, {
    "/posts": {
        get: {
            async handle(req) {
                const result = await Posts.find({}).toArray()
                return result
            },
        },
        post: {
            async handle(req) {
                const toInsert = {
                    poster: new ObjectId(), //TODO: Auth stuff
                    ...req.body
                }

                const insertResult = await Posts.insertOne(toInsert)

                //Should we have some sort of insertion helper function this was a lot of lines.
                return {
                    _id: insertResult.insertedId,
                    ...toInsert
                }
                
            },
        }
    },
    "/posts/:id": {
        get: {
            async handle(req) {
                //TODO: we should be able to typebox params
                const post = await Posts.findOne({ _id: toObjectId(req.params.id) })
                if (!post) {
                    throw new Error("AHHH") //TODO: Type and Status with createHttpError
                }
                return post
            },
        },
        delete: {
            async handle(req) {
                
            },
        }
    },
    "/users": {
        get: {
            async handle(req) {
                const result = await Users.find({}).toArray()
                return result
            },
        },
    },
    "/users/:id": {
        get: {
            async handle(req) {
                //TODO: we should be able to typebox params
                const user = await Users.findOne({ _id: toObjectId(req.params.id) })
                if (!user) {
                    throw new Error("AHHH") //TODO: Type and Status with createHttpError
                }
                return user
            },
        },
    }
})


async function main() {
    await boot()
}

main()
 

