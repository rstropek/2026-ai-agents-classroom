import { runAgent } from "../shared/agent.ts";
import { callFunction, describeFunction, searchFunctions } from "../shared/erp.ts";

// Stage 3: three fixed tools, no matter how many functions the ERP has.
await runAgent(
  [
    {
      type: "function",
      name: "search_functions",
      description: "Find ERP functions by keywords. Returns names and short descriptions.",
      strict: true,
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Keywords in English" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "describe_function",
      description: "Get the parameters of one ERP function. Do this before calling it.",
      strict: true,
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "call_function",
      description: "Call one ERP function with the arguments that describe_function lists.",
      // Not strict: `args` differs per function, so the provider can't check it.
      strict: false,
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, args: { type: "object" } },
        required: ["name", "args"],
      },
    },
  ],
  {
    search_functions: ({ query }) => searchFunctions(query),
    describe_function: ({ name }) => describeFunction(name),
    call_function: ({ name, args }) => callFunction(name, args),
  },
);
