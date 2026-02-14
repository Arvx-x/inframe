// app/api/plan-chat/route.ts
// Chat-only assistant for planning/whiteboarding ADs and visual campaigns.
// No image generation. PDFs sent directly to Gemini; Word/txt extracted server-side.
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
      return result?.value?.trim() || "[Could not extract text from Word document]";
    } catch (e) {
      console.error("Mammoth parse error:", e);
      return `[Error extracting Word doc "${name}": ${(e as Error).message}]`;
    }
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      messages,
      attachmentFiles,
    } = body as {
      messages?: Array<{ role: string; content: string }>;
      attachmentFiles?: AttachmentInput[];
    };

    if (!messages?.length) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    // Extract text from Word/txt attachments (PDFs go directly to Gemini as inlineData)
    let documentContext = "";
    const pdfAttachments: AttachmentInput[] = [];
    if (attachmentFiles?.length) {
      const extracted: string[] = [];
      for (const att of attachmentFiles) {
        if (isPdf(att.type, att.name)) {
          pdfAttachments.push(att);
        } else {
          const text = await extractTextFromWordOrTxt(att.base64, att.type, att.name);
          if (text) extracted.push(`--- ${att.name} ---\n${text}\n`);
        }
      }
      if (extracted.length) {
        documentContext = `\n\nAttached documents (text):\n${extracted.join("\n")}\n\n`;
      }
    }

    const systemPrompt = `You are a helpful planning assistant for creative and marketing teams. You help users plan ADs, visual campaigns, and branding—brainstorming ideas, understanding briefs, and suggesting next steps. You do NOT generate images.

Keep responses SHORT and conversational (2–4 paragraphs max). Use bullet points for lists. Be direct and actionable. Reference attached documents when relevant. Ask one clarifying question at a time if needed. Never offer to generate images.
${documentContext}`;

    const messageList: Array<{ role: string; content: string }> = [...messages];
    const contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = [];
    let pdfsAdded = false;

    for (const m of messageList) {
      if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
      const role = m.role === "assistant" ? "model" : "user";
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      if (m.role === "user" && pdfAttachments.length > 0 && !pdfsAdded) {
        for (const pdf of pdfAttachments) {
          parts.push({
            inlineData: { mimeType: "application/pdf", data: pdf.base64 },
          });
        }
        pdfsAdded = true;
      }
      const text = typeof m.content === "string" ? m.content.trim() : "";
      if (text) {
        parts.push({ text });
      } else if (m.role === "user" && pdfAttachments.length > 0 && pdfsAdded) {
        parts.push({ text: "Please analyze the attached document(s)." });
      }
      if (parts.length) contents.push({ role, parts });
    }

    if (contents.length === 0) {
      return NextResponse.json(
        { error: "No valid messages to process" },
        { status: 400 }
      );
    }

    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${INFRAME_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
              },
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);
        if (res.ok) break;
        const text = await res.text().catch(() => "");
        console.error("Plan chat API error:", res.status, text);
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 700));
          continue;
        }
        return NextResponse.json(
          {
            success: false,
            error: `AI error: ${res.status}`,
            details: text,
          },
          { status: 502 }
        );
      } catch (e) {
        await new Promise((r) => setTimeout(r, attempt * 700));
      }
    }

    if (!res || !res.ok) {
      return NextResponse.json(
        {
          success: true,
          message:
            "I'm experiencing heavy load right now. Please try again in a moment.",
        },
        { status: 200 }
      );
    }

    const data = await res.json().catch(() => null);
    const content = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text)
      .filter(Boolean)
      .join("\n");

    if (!content) {
      return NextResponse.json(
        { success: false, error: "No content in AI response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: content });
  } catch (err: unknown) {
    console.error("Plan chat error:", err);
    return NextResponse.json(
      {
        success: false,
        error: (err as Error)?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
