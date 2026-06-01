import { scanProject } from "@nimbus/scanner"


async function main() {
    await scanProject("../../example/example-backend")
}

main()