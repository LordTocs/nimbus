import opentelemetry, { Attributes, Span, SpanOptions, SpanStatusCode } from "@opentelemetry/api"
import { CompositePropagator, W3CTraceContextPropagator, W3CBaggagePropagator } from "@opentelemetry/core"
import {
	BasicTracerProvider,
	BatchSpanProcessor,
	ConsoleSpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"

import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
//import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb"
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici"

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api"
import { useLogger } from "./naive-logging"
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)

/*
TODO: How to wire this up properly, the auto instrumtentations need a weird import order.

Additionally the trace provider needs configuration to emit data
*/

const logger = useLogger("telemetry")

export function initializeTelemetry() {
	logger.log("Initialize Telemetry")
	const provider = new NodeTracerProvider({
		// spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter()),]
	})

	const contextManager = new AsyncLocalStorageContextManager()

	provider.register({
		contextManager,
		propagator: new CompositePropagator({
			propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
		}),
	})

	registerInstrumentations({
		instrumentations: [
			//new MongoDBInstrumentation({ requireParentSpan: false}),
			new UndiciInstrumentation(),
		],
	})
}
//Do here to force it to run in import order!
initializeTelemetry()

export function forceLoad() {}

//TODO: What do we put in here, do we only need one?
const globalTracer = opentelemetry.trace.getTracer("castmate-backend")

export function getTracer() {
	return globalTracer
}

/**
 * Puts a telemetry span around an optionally async function. If an error is thrown it will mark the span as an error span, and attach the error message.
 * @param name
 * @param func
 * @param options
 * @returns
 */
export async function withSpan<T extends (span: Span) => any>(
	name: string,
	func: T,
	options?: SpanOptions,
): Promise<Awaited<ReturnType<T>>> {
	return await globalTracer.startActiveSpan(name, options ?? {}, async (span) => {
		try {
			return await func(span)
		} catch (err) {
			span.setStatus({ code: SpanStatusCode.ERROR, message: (err as any).toString() })
			throw err
		} finally {
			span.end()
		}
	})
}
