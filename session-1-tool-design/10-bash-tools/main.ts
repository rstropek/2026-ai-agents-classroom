import { Bash } from "just-bash";
import { runAgent } from "../shared/agent.ts";
import { erp } from "./erp-command.ts";

const MAX_OUTPUT = 4000;

const bash = new Bash({ customCommands: [erp] });

// Stage 4: one tool. The ERP is a command inside a language the model already knows.
await runAgent(
  [
    {
      type: "function",
      name: "bash",
      description:
        "Run a command in a sandboxed Bash with jq, grep, awk, and sort. " +
        "The ERP is available as the command `erp`. Start with `erp --help`. " +
        "Combine commands with pipes and print only what you need.",
      strict: true,
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
        additionalProperties: false,
      },
    },
  ],
  {
    bash: async ({ command }) => {
      const { stdout, stderr, exitCode } = await bash.exec(command);
      // Breakpoint 10.3: stdout, stderr, and exit code of the model's command.
      const output = `${stdout}${stderr}`;
      // The tool result needs a limit too, and it has to say that it cut something.
      const shown =
        output.length > MAX_OUTPUT
          ? `${output.slice(0, MAX_OUTPUT)}\n[Output cut at ${MAX_OUTPUT} characters. Filter with jq or head.]\n`
          : output;
      return `${shown}[exit code ${exitCode}]`;
    },
  },
);
