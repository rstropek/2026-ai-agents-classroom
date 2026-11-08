import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";

// The same question for both examples, so that only the tools differ.
export const QUESTION =
  "Which customer has the highest total overdue amount? " +
  "Please issue a credit note of 500 EUR on that customer's largest overdue invoice.";

const MODEL = "gpt-6-luna";
const MAX_STEPS = 15;

const client = new OpenAI(); // Reads OPENAI_API_KEY.

type Handlers = Record<string, (args: any) => unknown>;

// The agent loop from the earlier steps. It knows nothing about the ERP.
export async function runAgent(tools: OpenAI.Responses.Tool[], handlers: Handlers) {
  const input: OpenAI.Responses.ResponseInput = [{ role: "user", content: QUESTION }];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await client.responses.create({ model: MODEL, store: false, input, tools });
    input.push(...toResponseInputItems(response.output));

    const calls = response.output.filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      console.log(`\nFinal answer: ${response.output_text}`);
      return;
    }

    for (const call of calls) {
      let output: string;
      try {
        const result = await handlers[call.name](JSON.parse(call.arguments));
        output = typeof result === "string" ? result : JSON.stringify(result);
      } catch (error) {
        // A broken call is one more thing the model can correct, so it gets the message.
        output = `Error: ${(error as Error).message}`;
      }
      console.log(`\n${call.name} ${call.arguments}\n  -> ${output}`);
      input.push({ type: "function_call_output", call_id: call.call_id, output });
    }
  }

  console.log("\nStopped: step limit reached.");
}
