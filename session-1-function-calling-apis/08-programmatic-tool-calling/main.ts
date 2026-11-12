import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";

// This demo talks to OpenAI directly, because OpenRouter removes `allowed_callers`.
const MODEL = "gpt-6-luna";
const MAX_STEPS = 30;

const client = new OpenAI(); // Reads OPENAI_API_KEY.

const CITIES = [
  "Linz", "Graz", "Wien", "Salzburg", "Innsbruck", "Klagenfurt",
  "Villach", "Wels", "Steyr", "Dornbirn", "Bregenz", "Eisenstadt",
];

const QUESTION = `Which of these cities has the highest average temperature over the next 24 hours? Give the city and the average with two decimals. Cities: ${CITIES.join(", ")}`;

// Fixed fake data: 24 values per city, so the model can't answer without the tool.
function getForecast(city: string) {
  const seed = [...city].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hourly = Array.from({ length: 24 }, (_, hour) =>
    Number((6 + (seed % 7) / 3 + 4 * Math.sin((hour + seed) / 3.8)).toFixed(1)),
  );
  return { city, hourly };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function correctAnswer() {
  const ranked = CITIES.map((city) => ({ city, avg: average(getForecast(city).hourly) }))
    .sort((a, b) => b.avg - a.avg);
  return `${ranked[0].city}, ${ranked[0].avg.toFixed(2)}`;
}

function buildTools(mode: "direct" | "programmatic"): OpenAI.Responses.Tool[] {
  const forecast: OpenAI.Responses.FunctionTool = {
    type: "function",
    name: "get_forecast",
    description: "Return an object with city (string) and hourly (24 numbers, degrees Celsius).",
    strict: true,
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
      additionalProperties: false,
    },
  };
  if (mode === "direct") {
    return [forecast];
  }
  return [
    {
      ...forecast,
      // The two lines that matter: only generated code may call this tool...
      allowed_callers: ["programmatic"],
      // ...and the code has to know what comes back before it sees a result.
      output_schema: {
        type: "object",
        properties: {
          city: { type: "string" },
          hourly: { type: "array", items: { type: "number" } },
        },
        required: ["city", "hourly"],
        additionalProperties: false,
      },
    },
    { type: "programmatic_tool_calling" },
  ];
}

async function run(mode: "direct" | "programmatic") {
  console.log(`\n########## ${mode} ##########\n`);

  const tools = buildTools(mode);
  const input: OpenAI.Responses.ResponseInput = [{ role: "user", content: QUESTION }];
  let requests = 0;
  let toolCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await client.responses.create({ model: MODEL, store: false, input, tools });
    requests++;
    inputTokens += response.usage?.input_tokens ?? 0;
    outputTokens += response.usage?.output_tokens ?? 0;

    if (response.status !== "completed") {
      throw new Error(`Response ended with status ${response.status}`);
    }

    // Program items have to go back too, or the service can't resume the program.
    input.push(...toResponseInputItems(response.output));

    // Breakpoint 8.1 (condition: mode === "programmatic"): output item types and usage.
    for (const item of response.output) {
      if (item.type === "program") {
        console.log(`Program the model wrote:\n\n${item.code}\n`);
      }
      if (item.type === "program_output") {
        console.log(`Program status: ${item.status}`);
      }
    }

    const calls = response.output.filter((item) => item.type === "function_call");
    if (calls.length === 0 && response.output_text) {
      console.log(`Final answer: ${response.output_text}`);
      break;
    }

    for (const call of calls) {
      toolCalls++;
      const result = getForecast(JSON.parse(call.arguments).city);
      // Breakpoint 8.2: call.caller names the paused program.
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
        // `caller` tells the service which paused program gets this result.
        ...(call.caller ? { caller: call.caller } : {}),
      });
    }
  }

  console.log(`Correct answer: ${correctAnswer()}`);
  console.log(`Requests: ${requests}, tool calls: ${toolCalls}, input tokens: ${inputTokens}, output tokens: ${outputTokens}`);
}

// `npm run 08:ptc -- programmatic` runs only one of the two modes.
const MODES = ["direct", "programmatic"] as const;
const selected = MODES.find((mode) => mode === process.argv[2]);

for (const mode of selected ? [selected] : MODES) {
  await run(mode);
}
