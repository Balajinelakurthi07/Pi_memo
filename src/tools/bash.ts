import { spawn } from "node:child_process";
import type { AgentTool } from "../core/types.js";

export function createBashTool(rootDir: string): AgentTool {
	return {
		name: "bash",
		description: "Run a shell command in the workspace directory.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string" },
				timeoutMs: { type: "number" },
			},
			required: ["command"],
		},
		executionMode: "sequential",
		async execute(_id, args, signal, onUpdate) {
			// TODO:
			// 1. Spawn `sh -c <command>` with { cwd: rootDir, signal }
			// 2. Collect stdout + stderr chunks (cap at e.g. 16_000 chars so huge logs don't overflow context)
			//    Optionally call onUpdate?.({ content: [{ type: "text", text: combined }] }) as chunks arrive
			// 3. Set a timeout timer (default 15_000ms) that kills the child process
			// 4. On 'close' (exit code): return { content: [{ type: "text", text: `Exit code: ${code}\n${output}` }], isError: code !== 0 }
			const command = `sh -c ${args.command}`;
            console.log(command);   
            const child = spawn(command, { cwd: rootDir, shell: true, stdio: ["ignore", "pipe", "pipe"], signal });
            let output = "";
            child.stdout?.on("data", (chunk) => {
                output += chunk;
                onUpdate?.({ content: [{ type: "text", text: chunk.toString() }] });
            });
            child.stderr?.on("data", (chunk) => {
                output += chunk;
                onUpdate?.({ content: [{ type: "text", text: chunk.toString() }] });
            });
            child.on("close", (code) => {
                onUpdate?.({ content: [{ type: "text", text: `Exit code: ${code}\n${output}` }], isError: code !== 0 });
            });
            
            
            throw new Error("Not implemented");

		},
	};
}