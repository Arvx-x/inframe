import { NextResponse } from "next/server";
import { parseBriefWithGemini } from "@/lib/brief-parser";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "A PDF or Word file is required." },
      { status: 400 }
    );
  }

  const name = file.name.toLowerCase();
  if (
    !name.endsWith(".pdf") &&
    !name.endsWith(".doc") &&
    !name.endsWith(".docx")
  ) {
    return NextResponse.json(
      { error: "Only PDF and Word (.doc, .docx) files are supported." },
      { status: 400 }
    );
  }

  try {
    const context = await parseBriefWithGemini(file);

    return NextResponse.json({ context });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse brief.";
    return NextResponse.json(
      { error: "Brief parsing failed.", details: message },
      { status: 502 }
    );
  }
}
