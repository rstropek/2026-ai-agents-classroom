import { Template } from "@huggingface/jinja";

// Open-weight models publish the template that turns chat messages into their prompt.
export const TEMPLATE_URLS = {
  gptOss: "https://huggingface.co/openai/gpt-oss-20b/resolve/main/chat_template.jinja",
  qwen: "https://huggingface.co/Qwen/Qwen3.5-27B/resolve/main/chat_template.jinja",
};

export async function downloadTemplate(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Template download failed: HTTP ${response.status}`);
  }
  return response.text();
}

export function renderPrompt(
  templateSource: string,
  messages: object[],
  tools: object[],
): string {
  return new Template(templateSource).render({
    messages,
    tools,
    add_generation_prompt: true,
    // Only Qwen reads this. It pre-fills an empty <think> block to skip reasoning.
    enable_thinking: false,
  });
}
