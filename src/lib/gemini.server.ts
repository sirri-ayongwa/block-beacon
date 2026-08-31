function getServerEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function parseJsonContent<T>(content: string): T {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced.trim()) as T;
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("Gemini returned invalid JSON");
  }
}

export async function geminiJson<T>(input: {
  system: string;
  prompt: string;
  files?: Array<{ mimeType: string; data: string }>;
  schema?: Record<string, unknown>;
  fallback: T;
}): Promise<T> {
  const apiKey = getServerEnv("GEMINI_API_KEY") || getServerEnv("GOOGLE_API_KEY");
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY");
    return input.fallback;
  }

  const generationConfig = {
    temperature: 0.1,
    responseMimeType: "application/json",
    ...(input.schema ? { responseSchema: input.schema } : {}),
  };
  const contents = [{
    role: "user",
    parts: [
      { text: input.prompt },
      ...(input.files ?? []).map((file) => ({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data,
        },
      })),
    ],
  }];
  const fallbackContents = [{
    role: "user",
    parts: [
      { text: input.prompt },
      ...(input.files ?? []).map((file) => ({
        inline_data: {
          mime_type: file.mimeType,
          data: file.data,
        },
      })),
    ],
  }];
  const payloads = [
    {
      systemInstruction: { parts: [{ text: input.system }] },
      generationConfig,
      contents,
    },
    {
      system_instruction: { parts: [{ text: input.system }] },
      generation_config: {
        temperature: 0.1,
        response_mime_type: "application/json",
        ...(input.schema ? { response_schema: input.schema } : {}),
      },
      contents: fallbackContents,
    },
  ];

  for (const payload of payloads) {
    try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Gemini failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    const json = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!content) throw new Error("Gemini returned no content");
    return parseJsonContent<T>(content);
    } catch (error) {
      console.error("Gemini request failed", error);
    }
  }

  return input.fallback;
}
