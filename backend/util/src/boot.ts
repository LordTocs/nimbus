import { withSpan } from "./telemetry"

export type BootTask = () => any

const bootTasks = new Array<BootTask>()

export function addBootTask(name: string, task: () => any) {
    bootTasks.push(async () => {
        withSpan(`Booting ${name}`, async (span) => {
            await task()
        })
    })
}

export async function boot() {
    for (const t of bootTasks) {
        await t()
    }
}