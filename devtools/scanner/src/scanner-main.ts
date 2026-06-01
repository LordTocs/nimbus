import * as ts from "typescript"
import fs from "fs/promises"
import path from "path"
import { dumpTree, iterateUsingStatements } from "./ast-utils"

async function loadPackageJson(projectPath: string) {
    const jsonPath = path.join(projectPath, "package.json")
    const jsonStr = await fs.readFile(jsonPath, "utf-8")
    const packageJson = JSON.parse(jsonStr)
    return packageJson
}

async function scanFile(projectPath: string, file: string) {
    const filePath = path.join(projectPath, file)
    const fileStr = await fs.readFile(filePath, "utf-8")

    const sourceFile = ts.createSourceFile(file, fileStr, ts.ScriptTarget.ESNext)

    dumpTree(sourceFile)

    console.log("----------------------")

    iterateUsingStatements(sourceFile)
}

export async function scanProject(projectPath: string) {
    const packageJson = await loadPackageJson(projectPath)

    const entryFile = packageJson.main
    if (!entryFile) throw new Error ("No Package Entry")

    await scanFile(projectPath, entryFile)
}