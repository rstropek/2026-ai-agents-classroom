// Shows the request body OpenRouter sends to the provider behind each model.
// The debug option needs streaming, and it's meant for development only.
const MODELS = ["openai/gpt-oss-20b", "anthropic/claude-haiku-5.5"];

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

const messages = [
  { role: "system", content: "You are a concise weather assistant." },
  { role: "user", content: "What is the weather in Linz?" },
];

for (const model of MODELS) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      max_tokens: 100,
      stream: true,
      debug: { echo_upstream_body: true },
    }),
  });
  if (!response.ok) {
    throw new Error(`${model}: HTTP ${response.status}: ${await response.text()}`);
  }

  // The first chunk that carries a `debug` property holds the upstream body.
  const chunks = (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: {"))
    .map((line) => JSON.parse(line.slice("data: ".length)));
  const debugChunk = chunks.find((chunk) => chunk.debug);

  // Breakpoint 3.1: the stream chunks and the upstream body for this model.
  console.log(`\n===== ${model}, served by ${debugChunk?.provider ?? "unknown"} =====\n`);
  console.log(JSON.stringify(debugChunk?.debug.echo_upstream_body ?? null, null, 2));
}
