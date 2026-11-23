import type {
	AgentContext,
	AgentEventSink,
	AgentLoopConfig,
	AgentTool,
	AgentToolResult,
	AssistantMessage,
	JsonObject,
	ToolCall,
	ToolResultMessage,
} from "./types.js";

export interface ExecutedToolBatch {
	messages: ToolResultMessage[];
	terminate: boolean;
}

interface FinalizedToolCall {
	toolCall: ToolCall;
	result: AgentToolResult;
	isError: boolean;
	durationMs?: number;
}

type PreparationOutcome =
	| { kind: "immediate"; result: AgentToolResult; isError: boolean }
	| { kind: "prepared"; tool: AgentTool; args: JsonObject };

function errorResult(message: string, terminate?: boolean): AgentToolResult {
	return {
		content: [{ type: "text", text: message }],
		isError: true,
		...(terminate ? { terminate: true } : {}),
	};
}

function toToolResultMessage(finalized: FinalizedToolCall): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: finalized.toolCall.id,
		toolName: finalized.toolCall.name,
		content: finalized.result.content ?? [],
		details: finalized.result.details,
		isError: finalized.isError,
		timestamp: Date.now(),
		...(finalized.durationMs === undefined ? {} : { durationMs: finalized.durationMs }),
	};
}

// 1. Pre-flight check: abort, lookup, arg prep, and beforeToolCall hook
async function prepareToolCall(
	context: AgentContext,
	assistantMessage: AssistantMessage,
	toolCall: ToolCall,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
): Promise<PreparationOutcome> {
	if (signal?.aborted) {
		return { kind: "immediate", result: errorResult("Operation aborted"), isError: true };
	}

	if (toolCall.argumentsError) {
		return { kind: "immediate", result: errorResult(toolCall.argumentsError), isError: true };
	}

	const tool = context.tools?.find((t) => t.name === toolCall.name);
	if (!tool) {
		return { kind: "immediate", result: errorResult(`Tool ${toolCall.name} not found`), isError: true };
	}

	const args = tool.prepareArguments ? tool.prepareArguments(toolCall.arguments) : toolCall.arguments;

	// Validate required parameters from JSON schema if present
	const required = Array.isArray(tool.parameters?.required) ? (tool.parameters.required as string[]) : [];
	for (const key of required) {
		if (args[key] === undefined) {
			return { kind: "immediate", result: errorResult(`Missing required argument: ${key}`), isError: true };
		}
	}

	if (config.beforeToolCall) {
		const hookRes = await config.beforeToolCall({ assistantMessage, toolCall, args, context }, signal);
		if (signal?.aborted) {
			return { kind: "immediate", result: errorResult("Operation aborted"), isError: true };
		}
		if (hookRes?.block) {
			return {
				kind: "immediate",
				result: errorResult(hookRes.reason || "Tool execution blocked", hookRes.terminate),
				isError: true,
			};
		}
	}

	return { kind: "prepared", tool, args };
}

// 2. Executes one prepared tool + runs afterToolCall hook
async function executeSingleTool(
	context: AgentContext,
	assistantMessage: AssistantMessage,
	toolCall: ToolCall,
	tool: AgentTool,
	args: JsonObject,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<FinalizedToolCall> {
	const startedAt = performance.now();
	let result: AgentToolResult;
	let isError = false;

	try {
		result = await tool.execute(toolCall.id, args, signal, (partialResult) => {
			void emit({
				type: "tool_execution_update",
				toolCallId: toolCall.id,
				toolName: toolCall.name,
				args,
				partialResult,
			});
		});
		isError = Boolean(result.isError);
	} catch (err) {
		isError = true;
		result = errorResult(err instanceof Error ? err.message : String(err));
	}

	const durationMs = Math.round(performance.now() - startedAt);

	if (config.afterToolCall) {
		try {
			const hookRes = await config.afterToolCall(
				{ assistantMessage, toolCall, args, result, isError, context },
				signal,
			);
			if (hookRes) {
				if (hookRes.content !== undefined) result.content = hookRes.content;
				if (hookRes.details !== undefined) result.details = hookRes.details;
				if (hookRes.isError !== undefined) {
					isError = hookRes.isError;
					result.isError = hookRes.isError;
				}
				if (hookRes.terminate !== undefined) result.terminate = hookRes.terminate;
			}
		} catch (err) {
			isError = true;
			result = errorResult(err instanceof Error ? err.message : String(err));
		}
	}

	return { toolCall, result, isError, durationMs };
}

// Helper: converts FinalizedToolCall -> ToolResultMessage and emits message_start/end
async function emitToolResult(finalized: FinalizedToolCall, emit: AgentEventSink): Promise<ToolResultMessage> {
	const message = toToolResultMessage(finalized);
	await emit({ type: "message_start", message });
	await emit({ type: "message_end", message });
	return message;
}

// 3. Sequential runner: runs tools one by one
async function executeSequential(
	context: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: ToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolBatch> {
	const messages: ToolResultMessage[] = [];
	const finalizedList: FinalizedToolCall[] = [];

	for (const toolCall of toolCalls) {
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		const prep = await prepareToolCall(context, assistantMessage, toolCall, config, signal);
		const finalized: FinalizedToolCall =
			prep.kind === "immediate"
				? { toolCall, result: prep.result, isError: prep.isError }
				: await executeSingleTool(context, assistantMessage, toolCall, prep.tool, prep.args, config, signal, emit);

		await emit({
			type: "tool_execution_end",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			result: finalized.result,
			isError: finalized.isError,
			durationMs: finalized.durationMs,
		});

		finalizedList.push(finalized);
		messages.push(await emitToolResult(finalized, emit));
	}

	return {
		messages,
		terminate: finalizedList.length > 0 && finalizedList.every((f) => f.result.terminate === true),
	};
}

// 4. Parallel runner: runs tools concurrently via Promise.all, emits ToolResultMessages in original order
async function executeParallel(
	context: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: ToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolBatch> {
	const promises = toolCalls.map(async (toolCall): Promise<FinalizedToolCall> => {
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		const prep = await prepareToolCall(context, assistantMessage, toolCall, config, signal);
		const finalized: FinalizedToolCall =
			prep.kind === "immediate"
				? { toolCall, result: prep.result, isError: prep.isError }
				: await executeSingleTool(context, assistantMessage, toolCall, prep.tool, prep.args, config, signal, emit);

		await emit({
			type: "tool_execution_end",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			result: finalized.result,
			isError: finalized.isError,
			durationMs: finalized.durationMs,
		});

		return finalized;
	});

	const finalizedList = await Promise.all(promises);
	const messages: ToolResultMessage[] = [];
	for (const finalized of finalizedList) {
		messages.push(await emitToolResult(finalized, emit));
	}

	return {
		messages,
		terminate: finalizedList.length > 0 && finalizedList.every((f) => f.result.terminate === true),
	};
}

// 5. Entrypoint called by runLoop
export async function executeToolCalls(
	context: AgentContext,
	assistantMessage: AssistantMessage,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolBatch> {
	const toolCalls = assistantMessage.content.filter((c): c is ToolCall => c.type === "toolCall");
	const hasSequentialTool = toolCalls.some(
		(tc) => context.tools?.find((t) => t.name === tc.name)?.executionMode === "sequential",
	);

	if (config.toolExecution === "sequential" || hasSequentialTool) {
		return executeSequential(context, assistantMessage, toolCalls, config, signal, emit);
	}
	return executeParallel(context, assistantMessage, toolCalls, config, signal, emit);
}