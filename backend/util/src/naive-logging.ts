import winston from "winston"
import util from "util"
import fs from "fs"
import colors from "@colors/colors"
import path from "path"
import { addBootTask } from "./boot"

const fileLogFormat = winston.format.printf((info) => {
	const timestamp = info.timestamp
	const plugin = info.plugin
	const level = info.level
	const message = info.message

	return `${timestamp} [${plugin}] ${level}: ${message}`
})

const shortHands: Record<string, string> = {
	info: colors.blue("log"),
	error: colors.red("err"),
}
function padLines(str: string, padding: number) {
	return str.replaceAll("\n", "\n" + " ".repeat(padding))
}
const consoleLogFormat = winston.format.printf((info) => {
	const plugin: string = info.plugin as string
	const level = info.level
	const message = info.messageColored as string

	return `${plugin.padStart(11, " ")}:${shortHands[level]}: ${padLines(message, 17)}`
})

export let winstonLogger: winston.Logger

export async function initializeLogging() {
	const logDir = "./logs"
	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir)
	}

	const initTime = Date.now()

	const logFileName = `castmate-log-${initTime}.log`

	//Delete oldest log if there's more than 10
	const logFiles = fs.readdirSync(logDir)
	if (logFiles.length >= 10) {
		logFiles.sort()
		fs.rmSync(path.join("logs", logFiles[0]))
	}

	winstonLogger = winston.createLogger({
		level: "info",
		defaultMeta: {
			plugin: "",
		},
		transports: [
			new winston.transports.Console({
				format: winston.format.combine(consoleLogFormat),
			}),
			new winston.transports.File({
				filename: path.join("logs", logFileName),
				format: winston.format.combine(winston.format.timestamp(), fileLogFormat),
			}),
		],
	})
}
addBootTask("Init Logging", initializeLogging)


export interface Logger {
	log(...args: any[]): void
	error(...args: any[]): void
}

function logArg(arg: any) {
	if (typeof arg == "string") return arg
	return util.inspect(arg)
}

function logArgColored(arg: any) {
	if (typeof arg == "string") return arg
	return util.inspect(arg, false, 2, true)
}

export const logger: Logger = {
	log(...args: any[]) {
		winstonLogger?.log("info", args.map(logArg).join(" "), { messageColored: args.map(logArgColored).join(" ") })
	},
	error(...args: any[]) {
		winstonLogger?.log("error", args.map(logArg).join(" "), { messageColored: args.map(logArgColored).join(" ") })
	},
}

export function useLogger(loggerId: string) {
	const scopeLogger: Logger = {
		log(...args) {
			winstonLogger?.log("info", args.map(logArg).join(" "), {
				plugin: loggerId,
				messageColored: args.map(logArgColored).join(" "),
			})
		},
		error(...args) {
			winstonLogger?.log("error", args.map(logArg).join(" "), {
				plugin: loggerId,
				messageColored: args.map(logArgColored).join(" "),
			})
		},
	}

	return scopeLogger
}

/*
export function expressLogging(req: Request, res: Response, next: NextFunction) {
	if (process.env.DEBUG_BUILD) {
		logger.log(req.method, req.url, req.query, req.body, req.headers)
	}
	next()
}*/
