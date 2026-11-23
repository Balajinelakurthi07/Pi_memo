import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentTool } from "../core/types.js";

export function createEditTool(rootDir: string): AgentTool {
	return {
		name: "edit",
		description: "Replace an exact unique substring in a file.",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string" },
				oldText: { type: "string" },
				newText: { type: "string" },
			},
			required: ["path", "oldText", "newText"],
		},
		executionMode: "sequential",
		async execute(_id, args) {
			// TODO:
			// 1. Read file safely inside rootDir
			// 2. Count occurrences of String(args.oldText) in content
			//    - If 0 matches -> return { content: [{ type: "text", text: "oldText not found" }], isError: true }
			//    - If > 1 matches -> return { content: [{ type: "text", text: "oldText matched multiple times; provide more context" }], isError: true }
			// 3. Replace exact match, write file back, and return confirmation message

            const resolvedpath=fs.resolve(path.join(rootDir,String(args.path)))
            if(!resolvedpath)
            {
                throw new Error("Cannot resolve the file path");
            }
            let count=0;
            let fileContent=await fs.readFile(resolvedpath,"utf-8")
            for (const line of fileContent.split("\n")) {
                if (line.includes(String(args.oldText))) {
                    count++;
                }
            }   
            if (count === 0) {
                return { content: [{ type: "text", text: "oldText not found" }], isError: true };
            }
            if (count > 1) {
                return { content: [{ type: "text", text: "oldText matched multiple times; provide more context" }], isError: true };
            }
            await fs.writeFile(resolvedpath, fileContent.replace(String(args.oldText),String(args.newText)), "utf-8");
            return { content: [{ type: "text", text: "File updated successfully" }], isError: false };
		},
	};
}