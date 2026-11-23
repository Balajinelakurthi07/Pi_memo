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

// Helper: creates a standard error AgentToolResult
function errorResult(message: string): AgentToolResult {
	return { content: [{ type: "text", text: message }], isError: true };
}

// Helper: converts a FinalizedToolCall into a ToolResultMessage for context.messages
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

// 1. Pre-flight check: abort, lookup, arg prep/validation, and beforeToolCall hook
async function prepareToolCall(
	context: AgentContext,
	assistantMessage: AssistantMessage,
	toolCall: ToolCall,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
): Promise<PreparationOutcome> {
	// TODO:
	// 1. If signal?.aborted -> return { kind: "immediate", result: errorResult("Operation aborted"), isError: true }
	// 2. If toolCall.argumentsError -> return immediate errorResult(toolCall.argumentsError)
	// 3. Find tool in context.tools by toolCall.name; if missing -> immediate errorResult(`Tool ${toolCall.name} not found`)
	// 4. Run tool.prepareArguments?.(toolCall.arguments) and check required fields in tool.parameters
	// 5. If config.beforeToolCall exists:
	//      const hookRes = await config.beforeToolCall({ assistantMessage, toolCall, args, context }, signal)
	//      if signal?.aborted -> immediate aborted error
	//      if hookRes?.block -> return immediate errorResult(hookRes.reason || "Blocked") with terminate: hookRes.terminate
	// 6. Return { kind: "prepared", tool, args }
     if(signal?.aborted){

        return { kind: "immediate", result: errorResult("Operation aborted"), isError: true }
     }

     if(toolCall.argumentsError){
        return { kind: "immediate", result: errorResult(toolCall.argumentsError), isError: true }
     }
     
     const tool=context.tools?.find((t) => t.name === toolCall.name);
     if(!tool){
        return { kind: "immediate", result: errorResult(`Tool ${toolCall.name} not found`), isError: true }
     }

     tool.prepareArguments?.(toolCall.arguments);
     if(!tool.parameters){
        return { kind: "immediate", result: errorResult(`Tool ${toolCall.name} not found`), isError: true }
     }


     if(config.beforeToolCall){
        const hookRes = await config.beforeToolCall({ assistantMessage, toolCall, args: toolCall.arguments, context }, signal)

        if(signal?.aborted){
            return { kind: "immediate", result: errorResult("Operation aborted"), isError: true }
        }
        
        if(hookRes?.block){
            return { kind: "immediate", result: errorResult(hookRes.reason || "Blocked"), isError: true, terminate: hookRes.terminate }
        }
     }




	throw new Error("Not implemented");
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
	// TODO:
	// 1. Record startedAt = performance.now()
	// 2. Inside try/catch:
	//      await tool.execute(toolCall.id, args, signal, (partialResult) => {
	//          void emit({ type: "tool_execution_update", toolCallId: toolCall.id, toolName: toolCall.name, args, partialResult });
	//      })
	//    If it throws, catch error and build errorResult(err.message), isError = true
	// 3. Compute durationMs = Math.round(performance.now() - startedAt)
	// 4. If config.afterToolCall exists:
	//      call it inside try/catch and merge any returned overrides (content, details, isError, terminate)
	// 5. Return { toolCall, result, isError, durationMs }



    const startedAt = performance.now();
    let result: AgentToolResult = { content: [], isError: false };
    let isError = false;
    let durationMs: number | undefined;

    try {
        await tool.execute(toolCall.id, args, signal, (partialResult) => {
            void emit({ type: "tool_execution_update", toolCallId: toolCall.id, toolName: toolCall.name, args, partialResult });
        });
    } catch (err) {
        isError = true;
        result = errorResult(err instanceof Error ? err.message : String(err));
    }

    durationMs = Math.round(performance.now() - startedAt);

    if (config.afterToolCall) {
        const hookRes = await config.afterToolCall({ assistantMessage, toolCall, args, result, isError, durationMs, context }, signal);

        if (signal?.aborted) {
            return { toolCall, result: errorResult("Operation aborted"), isError: true, durationMs };
        }

        if (hookRes) {
            if (hookRes.content) result.content = hookRes.content;
            if (hookRes.details) result.details = hookRes.details;
            isError = hookRes.isError ?? isError;
            if (hookRes.terminate !== undefined) {
                return { toolCall, result, isError, durationMs, terminate: hookRes.terminate };
            }
        }
    }

    return { toolCall, result, isError, durationMs };
	
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
	// TODO:
	// For each toolCall:
	// 1. await emit({ type: "tool_execution_start", toolCallId: toolCall.id, toolName: toolCall.name, args: toolCall.arguments })
	// 2. const prep = await prepareToolCall(...)
	// 3. If prep.kind === "immediate" -> build FinalizedToolCall directly
	//    Else -> await executeSingleTool(...)
	// 4. await emit({ type: "tool_execution_end", ... })
	// 5. Convert via toToolResultMessage(finalized), emit message_start + message_end, push to messages[]
	// 6. Return { messages, terminate: finalizedList.length > 0 && finalizedList.every((f) => f.result.terminate === true) }
	
   
    for(const toolCall of toolCalls){

        await emit({
            type: "tool_execution_start",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            args: toolCall.arguments,
        })
        const prep = await prepareToolCall(context, assistantMessage, toolCall, config, signal, emit);
        
        if(prep.kind === "immediate"){
            await emit({
                type: "tool_execution_end",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                args: toolCall.arguments,
                result: prep.result,
                isError: prep.isError,
            });
            continue;
        }
        else{
            const finalized = await executeSingleTool(
                context,
                assistantMessage,
                toolCall,
                prep.tool,
                prep.args,
                config,
                signal,
                emit,
            );
        }

        const toolResultMessage = toToolResultMessage(finalized);
        
    }

    
  
}

// 4. Parallel runner: runs tools concurrently via Promise.all, emits results in original order
async function executeParallel(
	context: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: ToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolBatch> {
	// TODO:
	// 1. Map each toolCall to a Promise<FinalizedToolCall>:
	//      emit tool_execution_start -> prepareToolCall -> if immediate emit tool_execution_end & return;
	//      else await executeSingleTool -> emit tool_execution_end & return.
	// 2. const finalizedList = await Promise.all(promises)
	// 3. Loop through finalizedList in order: create ToolResultMessage, emit message_start + message_end, push to messages[]
	// 4. Return { messages, terminate: finalizedList.length > 0 && finalizedList.every((f) => f.result.terminate === true) }
	for(const toolcall in toolCalls){

    }
    
    
    
    
    throw new Error("Not implemented");
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