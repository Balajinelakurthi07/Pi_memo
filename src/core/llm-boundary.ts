import { EventStream } from "./event-stream.js";
import type {
	AgentContext,
	AgentEventSink,
	AgentLoopConfig,
	AgentMessage,
	AssistantMessage,
	AssistantMessageEvent,
	Message,
	StreamFn,
} from "./types.js";

// 1. Border filter: strips harness-only messages before sending to provider
export function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
	return messages.filter((m): m is Message => m.role !== "compaction" && m.role !== "memory");
}

// 2. Main boundary function called once per turn by runLoop
export async function streamAssistantResponse(
	context: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
	streamFn: StreamFn,
): Promise<AssistantMessage> {
	// Step A: Transform & convert context at the LLM boundary (without mutating context.messages)
	let rawMessages = context.messages;
	if (config.transformContext) {
		rawMessages = await config.transformContext(rawMessages, signal);
	}
	const messages = await config.convertToLlm(rawMessages);

	// Step B: Call streamFn and await the stream handle
	const response = await streamFn(
		config.model,
		{ systemPrompt: context.systemPrompt, messages, tools: context.tools? },
		{ apiKey: config.apiKey, reasoning: config.reasoning, signal },
	);

	// Step C: Track partial streaming state
	let addedPartial = false;
	let partialMessage: AssistantMessage | null = null;

	const finalize = async (): Promise<AssistantMessage> => {
		const finalMessage = await response.result();
		finalMessage.thinkingLevel = config.reasoning ?? "off";
		if (addedPartial) {
			context.messages[context.messages.length - 1] = finalMessage;
		} else {
			context.messages.push(finalMessage);
			await emit({ type: "message_start", message: finalMessage });
		}
		await emit({ type: "message_end", message: finalMessage });
		return finalMessage;
	};

	// Step D: Consume live chunks from the provider stream
	for await (const event of response) {
		switch (event.type) {
			case "start":
				addedPartial = true;
				partialMessage = { ...event.partial };
				context.messages.push(partialMessage);
				await emit({ type: "message_start", message: partialMessage });
				break;
			case "text_delta":
			case "thinking_delta":
			case "toolcall_delta":
			case "toolcall_end":
				if (partialMessage) {
					partialMessage = { ...event.partial };
					context.messages[context.messages.length - 1] = partialMessage;
					await emit({ type: "message_update", assistantMessageEvent: event, message: partialMessage });
				}
				break;
			case "done":
			case "error":
				return finalize();
		}
	}

	// Step E: Fallback if stream closed without emitting "done" or "error"
	return finalize();
}

// 3. Deterministic mock StreamFn for Phase 1 smoke tests (no API key needed)
export function createMockStreamFn(scriptedTurns: AssistantMessage[]): StreamFn {
	let turnIndex = 0;

	return async (_model, _llmContext, _options) => {
		const reply = scriptedTurns[turnIndex++] ?? scriptedTurns[scriptedTurns.length - 1];

		const stream = new EventStream<AssistantMessageEvent, AssistantMessage>(
			(ev) => ev.type === "done" || ev.type === "error",
			(ev) => (ev.type === "done" ? ev.message : ev.error),
		);

		stream.push({ type: "start", partial: reply });
		if (reply.stopReason === "error" || reply.stopReason === "aborted") {
			stream.push({ type: "error", reason: reply.stopReason, error: reply });
		} else {
			stream.push({
				type: "done",
				reason: reply.stopReason === "toolUse" ? "toolUse" : "stop",
				message: reply,
			});
		}
		stream.end(reply);

		return stream;
	};
}