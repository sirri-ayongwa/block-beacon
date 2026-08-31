function getServerEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

export async function ollamaJson<T>(input: {
  model?: string;
  system: string;
  prompt: string;
  images?: string[];
  format: Record<string, unknown>;
  fallback: T;
}): Promise<T> {
  const apiKey = getServerEnv("OLLAMA_API_KEY");
  const baseUrl = (getServerEnv("OLLAMA_BASE_URL") || (apiKey ? "https://ollama.com/api" : "http://localhost:11434/api")).replace(/\/$/, "");
  const model = input.model || getServerEnv("OLLAMA_MODEL") || "llava";

  try {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: false,
        format: input.format,
        options: { temperature: 0.1 },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt, ...(input.images?.length ? { images: input.images } : {}) },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Ollama failed (${response.status})`);
    const json = (await response.json()) as { message?: { content?: string } };
    const content = json.message?.content;
    if (!content) throw new Error("Ollama returned no content");
    return JSON.parse(content) as T;
  } catch (error) {
    console.error("Ollama request failed", error);
    return input.fallback;
  }
}
