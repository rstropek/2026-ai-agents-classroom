import OpenAI from "openai";
import { z } from "zod";
import { CATEGORIES, categorize, type Category } from "./jev.ts";

const MODEL = "openai/gpt-5.4-mini";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const names = Object.keys(CATEGORIES) as [Category, ...Category[]];
const Answer = z.object({
  category: z.enum(names),
  confidence: z.number().describe("Your confidence in the category, from 0 to 1"),
});

async function categorizeWithLlm(text: string) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `Categorize what the user is doing in a business trip request form.\n${JSON.stringify(CATEGORIES)}`,
      },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "category", strict: true, schema: z.toJSONSchema(Answer) },
    },
  });
  const usage = response.usage as OpenAI.CompletionUsage & { cost: number };
  return { answer: Answer.parse(JSON.parse(response.choices[0].message.content ?? "")), cost: usage.cost };
}

async function timed<T>(call: () => Promise<T>) {
  const start = performance.now();
  const result = await call();
  return { ...result, ms: Math.round(performance.now() - start) };
}

const INPUTS = [
  "Send me to Paris by plane on December 1st",
  "Does the budget include meals?",
  "What's a good recipe for apple strudel?",
  "Could I take a helicopter instead?",
  "Vienna",
  "Ugh, this trip is getting expensive.",
];

const totals = { jevMs: 0, jevCost: 0, llmMs: 0, llmCost: 0 };

for (const input of INPUTS) {
  const jev = await timed(() => categorize(input as string));
  const llm = await timed(() => categorizeWithLlm(input));
  totals.jevMs += jev.ms;
  totals.jevCost += jev.cost;
  totals.llmMs += llm.ms;
  totals.llmCost += llm.cost;

  console.log(`\n"${input}"`);
  console.log(`  Jev ${String(jev.ms).padStart(5)} ms: ${jev.answer.choice}, confidence ${jev.answer.confidence}, ${JSON.stringify(jev.answer.probabilities)}`);
  console.log(`  LLM ${String(llm.ms).padStart(5)} ms: ${llm.answer.category}, says confidence ${llm.answer.confidence}`);
}

console.log(`\nJev total: ${totals.jevMs} ms, $${totals.jevCost.toFixed(6)}`);
console.log(`LLM total: ${totals.llmMs} ms, $${totals.llmCost.toFixed(6)}`);
