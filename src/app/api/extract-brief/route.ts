// app/api/extract-brief/route.ts
// Extracts text from uploaded briefs (PDF, Word, txt) for immediate context storage.
// Called on file upload so context is available before user sends a message.
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

if (!INFRAME_API_KEY) {
  throw new Error("Missing INFRAME_API_KEY environment variable.");
}

interface AttachmentInput {
  name: string;
  type: string;
  base64: string;
}

function isPdf(mimeType: string, name: string): boolean {
  return mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

function isWord(mimeType: string, name: string): boolean {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    name.toLowerCase().endsWith(".docx") ||
    name.toLowerCase().endsWith(".doc")
  );
}

async function extractTextFromWordOrTxt(
  base64: string,
  mimeType: string,
  name: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  if (mimeType === "text/plain" || name.toLowerCase().endsWith(".txt")) {
    return buffer.toString("utf-8").trim();
  }
  if (isWord(mimeType, name)) {
    try {
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({ buffer });
      return result?.value?.trim() || "";
    } catch (e) {
      console.error("Mammoth parse error:", e);
      return "";
    }
  }
  return "";
}

async function extractTextFromPdf(base64: string, name: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${INFRAME_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: "application/pdf", data: base64 } },
                { text: "Extract and return the full text of this document. Return only the extracted text, nothing else. Preserve structure (paragraphs, lists) where possible." },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini PDF extraction error:", res.status, err);
      return "";
    }
    const data = await res.json().catch(() => null);
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    return text || "";
  } catch (e) {
    console.error("PDF extraction error:", e);
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { attachmentFiles } = body as { attachmentFiles?: AttachmentInput[] };

    if (!attachmentFiles?.length) {
      return NextResponse.json(
        { error: "attachmentFiles array is required" },
        { status: 400 }
      );
    }

    const parts: string[] = [];
    for (const att of attachmentFiles) {
      if (att.type.startsWith("image/")) continue;
      let text = "";
      if (isPdf(att.type, att.name)) {
        text = await extractTextFromPdf(att.base64, att.name);
      } else {
        text = await extractTextFromWordOrTxt(att.base64, att.type, att.name);
      }
      if (text) {
        parts.push(`--- ${att.name} ---\n${text}`);
      }
    }

    const extractedText = parts.length > 0 ? parts.join("\n\n") : null;
    return NextResponse.json({ success: true, text: extractedText });
  } catch (err: unknown) {
    console.error("Extract brief error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
