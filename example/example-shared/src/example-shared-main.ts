import { defineRoutes } from "@nimbus/api-shared";
import { CType } from "@nimbus/util-shared";
import Type, { StaticDecode} from "typebox"

export const ExampleUser = Type.Object({
    _id: CType.ObjectId(),
    displayName: Type.String(),
})
export type ExampleUser = StaticDecode<typeof ExampleUser>


export const ExamplePostData = Type.Object({
    title: Type.String(),
    message: Type.String(),
})
export type ExamplePostData = StaticDecode<typeof ExamplePostData>

export const ExamplePost = Type.Interface([ExamplePostData], {
    _id: CType.ObjectId(),
    poster: CType.ObjectId(),
})
export type ExamplePost = StaticDecode<typeof ExamplePost>

export const exampleRoutes = defineRoutes({
    "/posts": {
        get: {
            id: "getPosts",
            response: Type.Array(ExamplePost)
        },
        post: {
            id: "createPost",
            body: ExamplePostData,
            response: ExamplePost
        }
    },
    "/posts/:id": {
        get: {
            id: "getPostById",
            response: ExamplePost
        },
        delete: {
            id: "deletePostById",
        }
    },
    "/users": {
        get: {
            id: "getUsers",
            response: Type.Array(ExampleUser)
        }
    },
    "/users/:id": {
        get: {
            id: "getUserById",
            response: ExampleUser
        }
    }
})
