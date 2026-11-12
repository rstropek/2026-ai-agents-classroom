import OpenAI from "openai";

// OpenRouter
const MODEL = "openai/gpt-oss-20b";
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// OpenAI: comment out the lines above and uncomment these two.
// const MODEL = "gpt-5.4-mini";
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

function getWeather(city: string) {
  // Breakpoint 1.2: your code runs the tool, the model isn't involved.
  return { city, temperature: 7, condition: "fog" };
}

const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
  { role: "system", content: "Answer in one friendly sentence." },
  { role: "user", content: "What is the weather in Linz?" },
];

// Turn 1: the model sees the question and the tool, and asks for a call.
const first = await client.chat.completions.create({ model: MODEL, messages, tools });
// Breakpoint 1.1: the raw turn 1 response.
const assistantMessage = first.choices[0].message;
const toolCall = assistantMessage.tool_calls?.[0];
if (toolCall?.type !== "function") {
  throw new Error("The model did not call a tool. Run it again.");
}
console.log(`Model asks for: ${toolCall.function.name}(${toolCall.function.arguments})`);

// The model can't run anything. Your code runs the function.
const { city } = JSON.parse(toolCall.function.arguments);
const result = getWeather(city);
console.log(`Our code returns: ${JSON.stringify(result)}`);

// Turn 2: the API is stateless, so the whole conversation goes back.
messages.push(assistantMessage, {
  role: "tool",
  tool_call_id: toolCall.id,
  content: JSON.stringify(result),
});
// Breakpoint 1.3: the complete history that goes out in turn 2.
const second = await client.chat.completions.create({ model: MODEL, messages, tools });
console.log(`Final answer: ${second.choices[0].message.content}`);
