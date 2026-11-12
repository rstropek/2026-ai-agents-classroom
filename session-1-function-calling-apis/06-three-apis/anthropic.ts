// The same loop as openai.ts, written against the Anthropic Messages API.
// Read openai.ts first. Every "vs. openai.ts" comment marks a difference.
import Anthropic from "@anthropic-ai/sdk";
import { MAX_STEPS, MODEL, QUESTION, SYSTEM, getWeather } from "./shared.ts";

// vs. openai.ts: the base URL has no /v1, because the SDK adds /v1/messages itself.
// The SDK sends `x-api-key` by default. OpenRouter wants a Bearer token, so the key
// goes into `authToken`, and `apiKey: null` stops the SDK from looking for one.
const client = new Anthropic({
  baseURL: "https://openrouter.ai/api",
  apiKey: null,
  authToken: process.env.OPENROUTER_API_KEY,
});

// vs. openai.ts: no `type: "function"` wrapper and no nested `function` object.
// The JSON schema is called `input_schema` instead of `parameters`.
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a city.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string", description: "City name" } },
      required: ["city"],
    },
  },
];

// vs. openai.ts: no system message in the history. The system prompt is a
// separate `system` parameter on every request, see below.
const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];

for (let step = 1; step <= MAX_STEPS; step++) {
  const response = await client.messages.create({
    model: MODEL,
    // vs. openai.ts: `max_tokens` is required here.
    max_tokens: 500,
    system: SYSTEM,
    messages,
    tools,
  });
  // vs. openai.ts: no `choices` array. The response is the assistant message itself.
  // Breakpoint 6.4: the content blocks of the response.
  console.log(`Step ${step}: stop_reason = ${response.stop_reason}`);

  // vs. openai.ts: `stop_reason` is "tool_use" where `finish_reason` was "tool_calls".
  if (response.stop_reason !== "tool_use") {
    // vs. openai.ts: `content` is an array of blocks, not a string, so find the text block.
    const text = response.content.find((block) => block.type === "text");
    console.log(`Final answer: ${text?.text}`);
    break;
  }

  // vs. openai.ts: the history gets the content blocks, tool_use blocks included.
  messages.push({ role: "assistant", content: response.content });

  const results: Anthropic.ToolResultBlockParam[] = [];
  // vs. openai.ts: no `tool_calls` array. The calls are `tool_use` blocks in `content`,
  // next to any text the model wrote before calling.
  for (const block of response.content) {
    if (block.type !== "tool_use") {
      continue;
    }
    // vs. openai.ts: `input` is already an object, so there's no JSON.parse.
    const { city } = block.input as { city: string };
    const result = getWeather(city);
    console.log(`  ${block.name}(${JSON.stringify(block.input)}) -> ${JSON.stringify(result)}`);
    // vs. openai.ts: `tool_use_id` where Chat Completions has `tool_call_id`.
    results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
  }
  // vs. openai.ts: there's no "tool" role. All results of one step go into a single
  // `user` message, where Chat Completions wants one `tool` message per call.
  // Breakpoint 6.5: all tool results go into one user message.
  messages.push({ role: "user", content: results });
}
