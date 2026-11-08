import Anthropic from "@anthropic-ai/sdk";
import { MAX_STEPS, MODEL, QUESTION, SYSTEM, getWeather } from "./shared.ts";

const client = new Anthropic({
  baseURL: "https://openrouter.ai/api",
  apiKey: null,
  authToken: process.env.OPENROUTER_API_KEY,
});

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

const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];

for (let step = 1; step <= MAX_STEPS; step++) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM,
    messages,
    tools,
  });
  console.log(`Step ${step}: stop_reason = ${response.stop_reason}`);

  if (response.stop_reason !== "tool_use") {
    const text = response.content.find((block) => block.type === "text");
    console.log(`Final answer: ${text?.text}`);
    break;
  }

  messages.push({ role: "assistant", content: response.content });

  // `input` is already an object. All results share one `user` message.
  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const block of response.content) {
    if (block.type !== "tool_use") {
      continue;
    }
    const { city } = block.input as { city: string };
    const result = getWeather(city);
    console.log(`  ${block.name}(${JSON.stringify(block.input)}) -> ${JSON.stringify(result)}`);
    results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
  }
  messages.push({ role: "user", content: results });
}
