import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MAX_STEPS, MODEL, QUESTION, SYSTEM, getWeather } from "./shared.ts";

const weatherTool = createTool({
  id: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string().describe("City name") }),
  execute: async ({ city }) => getWeather(city),
});

const agent = new Agent({
  id: "weather-agent",
  name: "Weather agent",
  instructions: SYSTEM,
  model: `openrouter/${MODEL}`,
  // OpenAI: use this line instead, and switch MODEL in shared.ts.
  // model: `openai/${MODEL}`, // Reads OPENAI_API_KEY.
  tools: { get_weather: weatherTool },
});

// The loop from the other two files runs inside this call.
const response = await agent.generate(QUESTION, { maxSteps: MAX_STEPS });

// Breakpoint 6.6: response.steps, the loop Mastra ran for you.
response.steps.forEach((step, index) => {
  console.log(`Step ${index + 1}: finishReason = ${step.finishReason}`);
  for (const { payload } of step.toolResults) {
    console.log(`  ${payload.toolName}(${JSON.stringify(payload.args)}) -> ${JSON.stringify(payload.result)}`);
  }
});
console.log(`Final answer: ${response.text}`);
