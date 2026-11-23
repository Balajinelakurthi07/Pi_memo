
import AgentMessage = require("./types");

import { EventStream } from "./event-stream.js";
import { streamAssistantResponse } from "./llm-boundary.js";
import { executeToolCalls } from "./tool-runner.js";
import type {
	AgentContext,
	AgentEvent,
	AgentEventSink,
	AgentLoopConfig,
	AgentMessage,
	StreamFn,
	ToolCall,
	ToolResultMessage,
	TurnSnapshot,
} from "./types.js";

function createAgentStream(): EventStream<AgentEvent, AgentMessage[]> {
	return new EventStream<AgentEvent, AgentMessage[]>(
		(event) => event.type === "agent_end",
		(event) => (event.type === "agent_end" ? event.messages : []),
	);
}

// 1. Public entrypoint: starts a new run with prompt message(s)
export function agentLoop(
	prompts: AgentMessage[],
	context: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): EventStream<AgentEvent, AgentMessage[]> {
	const stream = createAgentStream();

	void runAgentLoop(
		prompts,
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	).then((messages) => {
		stream.end(messages);
	});

	return stream;
}

// 2. Public entrypoint: continues from existing context (for retries / resumption)
export function agentLoopContinue(
	context: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): EventStream<AgentEvent, AgentMessage[]> {
	if (context.messages.length === 0) {
		throw new Error("Cannot continue: no messages in context");
	}
	if (context.messages[context.messages.length - 1].role === "assistant") {
		throw new Error("Cannot continue from message role: assistant");
	}

	const stream = createAgentStream();
	void runAgentLoopContinue(
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	).then((messages) => {
		stream.end(messages);
	});

	return stream;
}

export async function runAgentLoop(
	prompts: AgentMessage[],
	context: AgentContext,
	config: AgentLoopConfig,
	emit: AgentEventSink,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): Promise<AgentMessage[]> {
	// TODO:
	// 1. Clone newMessages = [...prompts] and currentContext = { ...context, messages: [...context.messages, ...prompts] }
	// 2. Emit { type: "agent_start" }, { type: "turn_start" }, and message_start/message_end for each prompt
	// 3. Await runLoop(currentContext, newMessages, config, signal, emit, streamFn)
	// 4. Return newMessages
	throw new Error("Not implemented");
}

export async function runAgentLoopContinue(
	context: AgentContext,
	config: AgentLoopConfig,
	emit: AgentEventSink,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): Promise<AgentMessage[]> {
	// TODO:
	// 1. Create newMessages: AgentMessage[] = [] and currentContext = { ...context }
	// 2. Emit { type: "agent_start" } and { type: "turn_start" }
	// 3. Await runLoop(currentContext, newMessages, config, signal, emit, streamFn)
	// 4. Return newMessages
	throw new Error("Not implemented");
}

async function runLoop(
	initialContext: AgentContext,
	newMessages: AgentMessage[],
	initialConfig: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
	streamFn: StreamFn,
): Promise<void> {
	let currentContext = initialContext;
	let config = initialConfig;
	let lastCompletedTurn: TurnSnapshot | undefined;
	let explicitContinuation = false;
	let pendingMessages: AgentMessage[] = (await config.getSteeringMessages?.()) || [];

	// Outer loop: checks follow-ups & explicit continuations when inner loop finishes
	while (true) {
		let hasMoreToolCalls = true;

		// Inner loop: runs turns while tool calls or steering messages exist
		while (hasMoreToolCalls || pendingMessages.length > 0) {
			// TODO Step 1 (Turn 2+ prep):
			// If lastCompletedTurn exists:
			//   - Call await config.prepareNextTurn?.(lastCompletedTurn) -> update currentContext, preparedMessages, config
			//   - If pendingMessages.length === 0, poll await config.getSteeringMessages?.()
			//   - Emit { type: "turn_start" }

			// TODO Step 2 (Flush prepared + steering messages):
			// For each msg in [...preparedMessages, ...pendingMessages]:
			//   emit message_start + message_end, push to currentContext.messages and newMessages
			// Reset pendingMessages = []

			// TODO Step 3 (Request hook & LLM call):
			// - Call await config.prepareRequest?.({ context: currentContext, model: config.model, thinkingLevel: config.reasoning ?? "off" }, signal)
			// - const message = await streamAssistantResponse(currentContext, config, signal, emit, streamFn)
			// - Push message to newMessages
			// - If message.stopReason === "error" || message.stopReason === "aborted":
			//     call finishTurn, emit turn_end + agent_end, and return;

			// TODO Step 4 (Tool calls):
			// - Filter toolCalls from message.content
			// - Reset hasMoreToolCalls = false
			// - If toolCalls.length > 0:
			//     if message.stopReason === "length", create error ToolResultMessages for each call
			//     else call const batch = await executeToolCalls(currentContext, message, config, signal, emit)
			//     push toolResults to currentContext.messages and newMessages
			//     set hasMoreToolCalls = !batch.terminate

			// TODO Step 5 (Finish turn & route):
			// - Update lastCompletedTurn = { message, toolResults, context: currentContext, newMessages }
			// - const decision = await config.finishTurn?.(lastCompletedTurn, signal)
			// - Emit { type: "turn_end", message, toolResults }
			// - If decision?.action === "end" -> emit agent_end and return
			// - Set explicitContinuation = decision?.action === "continue"
			// - Poll pendingMessages = (await config.getSteeringMessages?.()) || []
			// - If hasMoreToolCalls || pendingMessages.length > 0 -> explicitContinuation = false
			break; // remove this break once implemented!
		}

		// TODO Step 6 (Outer loop checks):
		// - Poll followUps = (await config.getFollowUpMessages?.()) || []
		// - If followUps.length > 0 -> set pendingMessages = followUps, explicitContinuation = false, continue
		// - If explicitContinuation -> set explicitContinuation = false, continue
		break;
	}

	await emit({ type: "agent_end", messages: newMessages });
}