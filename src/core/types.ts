// 1. Primitives & Content Blocks
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = Record<string, JsonValue>;

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "max";
export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

export interface TextContent {
	type: "text";
	text: string;
}

export interface ThinkingContent {
	type: "thinking";
	thinking: string;
	signature?: string;
}

export interface ToolCall {
	type: "toolCall";
	id: string;
	name: string;
	arguments: JsonObject;
	argumentsError?: string;
}

export interface Usage {
	input: number;
	output: number;
	cacheRead?: number;
	cacheWrite?: number;
	totalTokens: number;
}













// 2. LLM Boundary Messages (sent to providers)
export interface SystemMessage {
	role: "system";
	content: string;
	timestamp: number;
}

export interface UserMessage {
	role: "user";
	content: string | TextContent[];
	timestamp: number;
}

export interface AssistantMessage {
	role: "assistant";
	content: (TextContent | ThinkingContent | ToolCall)[];
	provider: string;
	model: string;
	thinkingLevel?: ThinkingLevel;
	usage: Usage;
	stopReason: StopReason;
	errorMessage?: string;
	timestamp: number;
	durationMs?: number;
}

export interface ToolResultMessage {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: TextContent[];
	details?: JsonObject;
	isError: boolean;
	timestamp: number;
	durationMs?: number;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage;









// 3. Harness Messages (extends Message for compaction/memory entries in Phase 2 & 3)
export interface CustomHarnessMessage {
	role: "compaction" | "memory";
	content: string;
	metadata?: JsonObject;
	timestamp: number;
}

export type AgentMessage = Message | CustomHarnessMessage;









// 4. Streaming & Loop Lifecycle Events
export type AssistantMessageEvent =
	| { type: "start"; partial: AssistantMessage }
	| { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
	| { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: AssistantMessage }
	| { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage };

export type AgentEvent =
	| { type: "agent_start" }
	| { type: "agent_end"; messages: AgentMessage[] }
	| { type: "turn_start" }
	| { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
	| { type: "message_start"; message: AgentMessage }
	| { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
	| { type: "message_end"; message: AgentMessage }
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: JsonObject }
	| { type: "tool_execution_update"; toolCallId: string; toolName: string; args: JsonObject; partialResult: AgentToolResult }
	| {
			type: "tool_execution_end";
			toolCallId: string;
			toolName: string;
			result: AgentToolResult;
			isError: boolean;
			durationMs?: number;
	  };

export type AgentEventSink = (event: AgentEvent) => Promise<void> | void;



// 5. Tools & Execution Context
export interface AgentToolResult {
	content: TextContent[];
	details?: JsonObject;
	isError?: boolean;
	terminate?: boolean;
}

export interface AgentTool {
	name: string;
	description: string;
	parameters: JsonObject; // JSON Schema object
	executionMode?: "parallel" | "sequential";
	prepareArguments?: (args: JsonObject) => JsonObject;
	execute: (
		toolCallId: string,
		args: JsonObject,
		signal: AbortSignal | undefined,
		onUpdate?: (partialResult: AgentToolResult) => void,
	) => Promise<AgentToolResult>;
}

export interface AgentContext {
	systemPrompt: string;
	messages: AgentMessage[];
	tools?: AgentTool[];
}

// 6. Model, Stream Function & Loop Hooks
export interface ModelConfig {
	provider: string;
	id: string;
}

export type StreamFn = (
	model: ModelConfig,
	context: { systemPrompt: string; messages: Message[]; tools?: AgentTool[] },
	options: { apiKey?: string; reasoning?: ThinkingLevel; signal?: AbortSignal },
) => Promise<AsyncIterable<AssistantMessageEvent> & { result: () => Promise<AssistantMessage> }>;

export interface TurnSnapshot {
	message: AssistantMessage;
	toolResults: ToolResultMessage[];
	context: AgentContext;
	newMessages: AgentMessage[];
}

export interface AgentLoopConfig {
	model: ModelConfig;
	apiKey?: string;
	reasoning?: ThinkingLevel;
	toolExecution?: "parallel" | "sequential";

	// Boundary converters
	transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]> | AgentMessage[];
	convertToLlm: (messages: AgentMessage[]) => Promise<Message[]> | Message[];

	// Turn & Request lifecycle hooks (Phase 2 compaction & verification plug in here)
	prepareNextTurn?: (lastTurn: TurnSnapshot) => Promise<{
		context?: AgentContext;
		messages?: AgentMessage[];
		model?: ModelConfig;
		thinkingLevel?: ThinkingLevel;
	} | void>;
	prepareRequest?: (
		req: { context: AgentContext; model: ModelConfig; thinkingLevel: ThinkingLevel },
		signal?: AbortSignal,
	) => Promise<{ context?: AgentContext; model?: ModelConfig; thinkingLevel?: ThinkingLevel } | void>;
	finishTurn?: (
		lastTurn: TurnSnapshot,
		signal?: AbortSignal,
	) => Promise<{ action?: "continue" | "end" } | void>;

	// Tool interception hooks (Phase 2 loop-detector & Phase 3 episode logger plug in here)
	beforeToolCall?: (
		input: { assistantMessage: AssistantMessage; toolCall: ToolCall; args: JsonObject; context: AgentContext },
		signal?: AbortSignal,
	) => Promise<{ block?: boolean; reason?: string; terminate?: boolean } | void>;
	afterToolCall?: (
		input: {
			assistantMessage: AssistantMessage;
			toolCall: ToolCall;
			args: JsonObject;
			result: AgentToolResult;
			isError: boolean;
			context: AgentContext;
		},
		signal?: AbortSignal,
	) => Promise<Partial<AgentToolResult> | void>;

	// Interruption & follow-up queues
	getSteeringMessages?: () => Promise<AgentMessage[]> | AgentMessage[];
	getFollowUpMessages?: () => Promise<AgentMessage[]> | AgentMessage[];
}