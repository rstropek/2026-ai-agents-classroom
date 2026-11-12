import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MAX_STEPS, MODEL, QUESTION, SYSTEM, getWeather } from "./shared.ts";

const weatherTool = createTool({
  id: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string().describe("City name") }),
  execute: async ({ city }) => {
    const result = getWeather(city);
    console.log(`  Inside the subagent: get_weather(${JSON.stringify({ city })}) -> ${JSON.stringify(result)}`);
    return result;
  },
});

const weatherAgent = new Agent({
  id: "weather-agent",
  name: "Weather agent",
  // The supervisor's model reads this like the description of any other tool.
  description: "Answers questions about the current weather in one or more cities.",
  instructions: "Look up the weather and report the temperature and condition for each city.",
  model: `openrouter/${MODEL}`,
  // OpenAI: use this line instead, and switch MODEL in shared.ts.
  // model: `openai/${MODEL}`, // Reads OPENAI_API_KEY.
  tools: { get_weather: weatherTool },
});

const supervisor = new Agent({
  id: "supervisor",
  name: "Supervisor",
  instructions: SYSTEM,
  model: `openrouter/${MODEL}`,
  // OpenAI: use this line instead, and switch MODEL in shared.ts.
  // model: `openai/${MODEL}`, // Reads OPENAI_API_KEY.
  // This line turns the agent into a tool called agent-weather.
  agents: { weather: weatherAgent },
});

const response = await supervisor.generate(QUESTION, { maxSteps: MAX_STEPS });

response.steps.forEach((step, index) => {
  console.log(`Step ${index + 1}: finishReason = ${step.finishReason}`);
  for (const { payload } of step.toolResults) {
    // The supervisor's model gets only this text, not the subagent's tool calls.
    const { text } = payload.result as { text: string };
    console.log(`  ${payload.toolName}(${JSON.stringify(payload.args)}) -> ${text}`);
  }
});
console.log(`Final answer: ${response.text}`);
