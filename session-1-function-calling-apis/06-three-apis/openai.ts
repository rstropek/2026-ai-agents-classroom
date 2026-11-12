import OpenAI from "openai";
import { MAX_STEPS, MODEL, QUESTION, SYSTEM, getWeather } from "./shared.ts";

// OpenRouter
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// OpenAI: comment out the lines above, uncomment this one, and switch MODEL in shared.ts.
// const client = new OpenAI(); // Reads OPENAI_API_KEY.

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a city.",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "City name" } },
        required: ["city"],
      },
    },
  },
];

const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
  { role: "system", content: SYSTEM },
  { role: "user", content: QUESTION },
];

for (let step = 1; step <= MAX_STEPS; step++) {
  const response = await client.chat.completions.create({ model: MODEL, messages, tools });
  const { message, finish_reason } = response.choices[0];
  console.log(`Step ${step}: finish_reason = ${finish_reason}`);

  if (finish_reason !== "tool_calls") {
    console.log(`Final answer: ${message.content}`);
    break;
  }

  messages.push(message);
  for (const call of message.tool_calls ?? []) {
    if (call.type !== "function") {
      continue;
    }
    // `arguments` is a JSON string. One `tool` message per call.
    const result = getWeather(JSON.parse(call.function.arguments).city);
    console.log(`  ${call.function.name}(${call.function.arguments}) -> ${JSON.stringify(result)}`);
    messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
  }
}
