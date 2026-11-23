import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentTool } from "../core/types.js";

export function createWriteTool(rootDir: string): AgentTool {
	return {
		name: "write",
		description: "Create or overwrite a file with the given content.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string" },
				content: { type: "string" },
			},
			required: ["path", "content"],
		},
		executionMode: "sequential",
		async execute(_id, args) {
			// TODO:
			// 1. Resolve targetPath safely inside rootDir
			// 2. await fs.mkdir(path.dirname(targetPath), { recursive: true })
			// 3. await fs.writeFile(targetPath, String(args.content), "utf-8")
			// 4. Return confirmation TextContent
            const resolvedpath=fs.resolve(path.join(rootDir,String(args.path)))
            if(!resolvedpath)
            {
                throw new Error("Cannot resolve the file path");
            }
            await fs.mkdir(path.dirname(resolvedpath),{recursive:true})
            await fs.writeFile(resolvedpath,String(args.content),"utf-8")
            return TextContent(`File at ${resolvedpath} has been written successfully`)


			throw new Error("Not implemented");
		},
	};
}