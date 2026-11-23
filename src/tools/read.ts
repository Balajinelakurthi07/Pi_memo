import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentTool } from "../core/types.js";

export function createReadTool(rootDir: string): AgentTool {
	return {
		name: "read",
		description: "Read file contents with line numbers. Supports optional 1-based offset and limit.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string" },
				offset: { type: "number" },
				limit: { type: "number" },
			},
			required: ["path"],
		},
		executionMode: "parallel",
		async execute(_id, args) {
			// TODO:
			// 1. Resolve targetPath = path.resolve(rootDir, String(args.path))
			//    Guard against path traversal: if (!targetPath.startsWith(path.resolve(rootDir))) return isError: true
			// 2. Read UTF-8 file, split into lines
			// 3. Slice using offset (default 1) and limit (default 200)
			// 4. Format each line as `${lineNum} | ${line}` and return { content: [{ type: "text", text }] }
            
            const resolvedPath = path.resolve(rootDir, String(args.path))
            
            //3. 
            if(!resolvedPath.startsWith(path.resolve(rootDir))){
                return { content: [], isError: true }
            }
            
            const fileContent = await fs.readFile(resolvedPath, "utf-8");
            const lines = fileContent.split("\n");
            const offset = args.offset ? Math.max(1, Number(args.offset)) : 1;
            const limit = args.limit ? Math.min(200, Number(args.limit)) : 200;
            const sliced = lines.slice(offset - 1, offset + limit - 1);
            const formatted = sliced.map((line, index) => `${offset + index} | ${line}`).join("\n");
            return { content: [{ type: "text", text: formatted }], isError: false };


			throw new Error("Not implemented");
		},
	};
}