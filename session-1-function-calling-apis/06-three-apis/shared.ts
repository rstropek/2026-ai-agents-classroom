// One model, reached through three APIs. Only the code around it changes.
export const MODEL = "anthropic/claude-haiku-5.5";
// OpenAI: use this model in openai.ts, mastra.ts, and mastra-subagent.ts.
// anthropic.ts needs OpenRouter or an Anthropic key.
// export const MODEL = "gpt-5.4-mini";
export const SYSTEM = "Answer in one friendly sentence.";
export const QUESTION = "Is it warmer in Linz or in Graz right now?";
export const MAX_STEPS = 5;

export function getWeather(city: string) {
  // startsWith, because a model may write "Graz, Austria".
  return city.startsWith("Graz")
    ? { city, temperature: 11, condition: "sun" }
    : { city, temperature: 7, condition: "fog" };
}
