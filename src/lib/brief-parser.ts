const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const BRIEF_EXTRACT_PROMPT = `You are analyzing a product or campaign brief document. Read and understand the full document, then extract and summarize the key information that would be useful for creating marketing visuals (images, videos, ads). Include:
- Brand/product name and key messaging
- Target audience and tone
- Visual style preferences (colors, mood, aesthetic)
- Key features or selling points to highlight
- Any specific requirements or constraints

Return a concise, structured summary (2-4 paragraphs max) that can be used as context when generating creative assets.`;

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};

export async function parseBriefWithGemini(
  file: File
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.INFRAME_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or INFRAME_API_KEY must be set.");
  }

  const model =
    process.env.GEMINI_BRIEF_MODEL ?? "gemini-2.5-flash";

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const mimeType = MIME_TYPES[ext] ?? "application/pdf";

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
              {
                text: BRIEF_EXTRACT_PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini brief parsing failed: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return text.trim();
}
