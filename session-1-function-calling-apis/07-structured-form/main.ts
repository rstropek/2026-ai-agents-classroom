import OpenAI from "openai";
import { z } from "zod";
import { categorize } from "./jev.ts";

// A fixed date keeps the demo reproducible. A real app uses the current date.
const TODAY = "2026-11-12";

// OpenRouter
const MODEL = "openai/gpt-5.4-mini";
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// OpenAI: comment out the lines above and uncomment these two. Jev still needs OpenRouter.
// const MODEL = "gpt-5.4-mini";
// const client = new OpenAI(); // Reads OPENAI_API_KEY.

// One schema for both directions: what the UI sends and what the UI gets back.
const TripForm = z.object({
  destination: z.string().nullable().describe("City of the business trip"),
  departureDate: z.string().nullable().describe("Format YYYY-MM-DD"),
  returnDate: z.string().nullable().describe("Format YYYY-MM-DD"),
  transport: z.enum(["train", "car", "plane"]).nullable(),
  hotelNeeded: z.boolean().nullable(),
  budgetEuros: z.number().nullable(),
});
type TripForm = z.infer<typeof TripForm>;

const AgentResponse = z.object({
  form: TripForm,
  reply: z.string().describe("One short sentence for the user, shown next to the form"),
});

const jsonSchema = z.toJSONSchema(AgentResponse);

const SYSTEM = `You help a user fill in a business trip request form.
Today is ${TODAY}.
You receive the current form and what the user typed.
Return the complete form. Change only the fields the user talked about.
If a request does not fit the form, leave the form as it is and say so in the reply.`;

async function updateForm(form: TripForm, userInput: string) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      // Structured input: the UI state goes in as JSON next to the free text.
      { role: "user", content: JSON.stringify({ currentForm: form, userInput }) },
    ],
    // Structured output: the answer has to match this schema.
    response_format: {
      type: "json_schema",
      json_schema: { name: "form_update", strict: true, schema: jsonSchema },
    },
  });

  const text = response.choices[0].message.content ?? "";
  console.log(`Model text: ${text}`);

  // The answer is still text that the model wrote, so parse and validate it.
  // Breakpoint 7.1: the whole response, and the text inside it.
  return AgentResponse.parse(JSON.parse(text));
}

function printChanges(before: TripForm, after: TripForm) {
  const keys = Object.keys(before) as (keyof TripForm)[];
  const changed = keys.filter((key) => before[key] !== after[key]);
  if (changed.length === 0) {
    console.log("Changed fields: none");
  }
  for (const key of changed) {
    console.log(`Changed field: ${key}: ${JSON.stringify(before[key])} -> ${JSON.stringify(after[key])}`);
  }
}

const SCRIPTED_INPUTS = [
  "I need to go to Vienna next Tuesday for two days, by train, and I'll need a hotel.",
  "Make that one day longer. My budget is 400 euros.",
  "Could I take a helicopter instead?",
  "What's a good recipe for apple strudel?",
];

// Jev's confidence is a number your code can branch on.
const UNRELATED_THRESHOLD = 0.8;

// `npm run 07:form -- "your text"` replaces the scripted inputs.
const inputs = process.argv.length > 2 ? process.argv.slice(2) : SCRIPTED_INPUTS;

console.log(`=== JSON schema sent to the API ===\n\n${JSON.stringify(jsonSchema, null, 2)}`);

let form: TripForm = {
  destination: null,
  departureDate: null,
  returnDate: null,
  transport: null,
  hotelNeeded: null,
  budgetEuros: null,
};

for (const input of inputs) {
  console.log(`\n=== User types: ${input} ===\n`);

  const jevStart = performance.now();
  const { answer } = await categorize(input);
  const jevMs = Math.round(performance.now() - jevStart);
  console.log(`Jev (${jevMs} ms): ${answer.choice}, confidence ${answer.confidence}, ${JSON.stringify(answer.probabilities)}`);

  // Breakpoint 7.3: edit answer.confidence here to send the input to the LLM anyway.
  if (answer.choice === "unrelated" && answer.confidence >= UNRELATED_THRESHOLD) {
    console.log("No LLM call. The UI shows a fixed hint.");
    continue;
  }

  const llmStart = performance.now();
  const update = await updateForm(form, input);
  console.log(`LLM (${Math.round(performance.now() - llmStart)} ms)`);
  printChanges(form, update.form);
  console.log(`Reply: ${update.reply}`);
  form = update.form;
}

console.log(`\n=== Form the UI renders now ===\n\n${JSON.stringify(form, null, 2)}`);
