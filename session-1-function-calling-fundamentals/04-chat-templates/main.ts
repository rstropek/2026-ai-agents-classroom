import { TEMPLATE_URLS, downloadTemplate, renderPrompt } from "./render.ts";

// The same tool definition you send to the Chat Completions API.
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a city.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name, e.g. Linz" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["city"],
      },
    },
  },
];

const question = [
  { role: "system", content: "You are a concise weather assistant." },
  { role: "user", content: "What is the weather in Linz?" },
];

// Unlike the wire format, these templates expect arguments as an object.
// Passing the JSON string from the API would encode it a second time.
const roundTrip = [
  ...question,
  {
    role: "assistant",
    content: "",
    tool_calls: [{ function: { name: "get_weather", arguments: { city: "Linz" } } }],
  },
  { role: "tool", content: JSON.stringify({ temperature: 7, condition: "fog" }) },
];

// Colors the special tokens and tags, so they stand out on the projector.
const highlight = (prompt: string) =>
  prompt.replace(
    /<\|[a-z_]+\|>|<\/?(?:tools|tool_call|tool_response|think)>|<\/?(?:function|parameter)(?:=\w+)?>/g,
    (token) => `\x1b[1;33m${token}\x1b[0m`,
  );

for (const [name, url] of Object.entries(TEMPLATE_URLS)) {
  const template = await downloadTemplate(url);

  // Breakpoint 4.1: the Jinja source. Call renderPrompt from the Debug Console.
  console.log(`\n########## ${name} ##########`);

  console.log("\n=== Turn 1: the model decides whether to call a tool ===\n");
  console.log(highlight(renderPrompt(template, question, tools)));

  console.log("\n=== Turn 2: the tool result is back in the prompt ===\n");
  console.log(highlight(renderPrompt(template, roundTrip, tools)));
}
