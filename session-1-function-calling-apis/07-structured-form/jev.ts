// Jev is a System One model: it writes no text and picks from options you define.
export const CATEGORIES = {
  fill_form: "The user enters or changes trip details",
  question: "The user asks something about the trip or the form",
  unrelated: "The message has nothing to do with a business trip",
};
export type Category = keyof typeof CATEGORIES;

type ChoiceAnswer = {
  choice: Category;
  confidence: number;
  probabilities: Record<Category, number>;
};

export async function categorize(text: string) {
  const response = await fetch("https://openrouter.ai/api/v1/systemone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "~typesafe/jev-latest",
      state: text,
      questions: {
        category: {
          type: "choice",
          instructions: "What is the user doing in a business trip request form?",
          criteria: CATEGORIES,
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return { answer: data.answers.category as ChoiceAnswer, cost: data.usage.cost as number };
}
