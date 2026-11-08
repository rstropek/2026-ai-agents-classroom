import {
  TEMPLATE_URLS,
  downloadTemplate,
  renderPrompt,
} from "../04-chat-templates/render.ts";

type ToolCall = { name: string; args: Record<string, string> };

// A model comes as a pair: the template that writes its prompt,
// and the parser that reads its answer. Neither one works for the other model.
type Model = {
  id: string;
  provider: string; // These hosts return the raw text. Others parse it first.
  templateUrl: string;
  parseToolCall: (text: string) => ToolCall | undefined;
  finalAnswer: (text: string) => string;
};

const gptOss: Model = {
  id: "openai/gpt-oss-20b",
  provider: "deepinfra",
  templateUrl: TEMPLATE_URLS.gptOss,
  parseToolCall(text) {
    const call = text.match(/to=functions\.(\w+).*?<\|message\|>(.*?)(?:<\|call\|>|$)/s);
    return call ? { name: call[1], args: JSON.parse(call[2]) } : undefined;
  },
  finalAnswer(text) {
    return text.match(/<\|channel\|>final<\|message\|>(.*?)(?:<\|return\|>|$)/s)?.[1] ?? text;
  },
};

const qwen: Model = {
  id: "qwen/qwen3.5-27b",
  provider: "siliconflow",
  templateUrl: TEMPLATE_URLS.qwen,
  parseToolCall(text) {
    const call = text.match(/<function=(\w+)>(.*?)<\/function>/s);
    if (!call) {
      return undefined;
    }
    const parameters = call[2].matchAll(/<parameter=(\w+)>\n?(.*?)\n?<\/parameter>/gs);
    return {
      name: call[1],
      args: Object.fromEntries([...parameters].map(([, key, value]) => [key, value])),
    };
  },
  finalAnswer(text) {
    return text.trim();
  },
};

const tools = [
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
  return { city, temperature: 7, condition: "fog" };
}

// No `tools` and no `messages`: the prompt is one string, and so is the answer.
async function complete(model: Model, prompt: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model.id,
      provider: { only: [model.provider], allow_fallbacks: false },
      prompt,
      max_tokens: 500,
      temperature: 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices[0].text;
}

// gpt-oss is the live demo. `npm run 05:raw:qwen` records the output for Qwen.
const models = process.argv[2] === "qwen" ? [qwen] : [gptOss];

for (const model of models) {
  console.log(`\n########## ${model.id} ##########`);

  const template = await downloadTemplate(model.templateUrl);
  const messages: object[] = [{ role: "user", content: "What is the weather in Linz?" }];

  console.log("\n=== Turn 1: what the model writes ===\n");
  const first = await complete(model, renderPrompt(template, messages, tools));
  console.log(first);

  const call = model.parseToolCall(first);
  if (!call) {
    throw new Error("The model did not call a tool.");
  }
  console.log(`\n=== Parsed tool call: ${call.name}(${JSON.stringify(call.args)}) ===`);

  messages.push(
    {
      role: "assistant",
      content: "",
      tool_calls: [{ function: { name: call.name, arguments: call.args } }],
    },
    { role: "tool", content: JSON.stringify(getWeather(call.args.city)) },
  );

  console.log("\n=== Turn 2: what the model writes after the tool result ===\n");
  const second = await complete(model, renderPrompt(template, messages, tools));
  console.log(second);

  console.log(`\n=== Final answer ===\n\n${model.finalAnswer(second)}`);
}
