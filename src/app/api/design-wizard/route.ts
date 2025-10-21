// app/api/design-wizard/route.ts
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

if (!INFRAME_API_KEY) {
  throw new Error("Missing INFRAME_API_KEY environment variable.");
}

// Note: client will call POST /api/design-wizard with JSON body matching the original WizardRequest
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      phase,
      messages,
      userInput,
      selectedDirections,
      selectedImages,
      prompt,
      spec,
      direction,
      basePrompt,
    } = body as {
      phase?: string;
      messages?: Array<{ role: string; content: string }>;
      userInput?: string;
      selectedDirections?: string[];
      selectedImages?: string[];
      prompt?: string;
      spec?: any;
      direction?: { id: string; name: string; compositionRules?: string; moodKeywords?: string[] };
      basePrompt?: string;
    };

    if (!phase) {
      return NextResponse.json({ success: false, error: "phase is required" }, { status: 400 });
    }

    // Helper: Build an image prompt string from a structured spec JSON
    const buildImagePromptFromSpec = (s: any): string => {
      if (!s || typeof s !== "object") return "";
      const parts: string[] = [];
      if (s.useCase) parts.push(`Use case: ${s.useCase}`);
      if (Array.isArray(s.tone) && s.tone.length) parts.push(`Tone/mood: ${s.tone.join(", ")}`);
      if (s.audience) parts.push(`Audience: ${s.audience}`);
      if (Array.isArray(s.elements) && s.elements.length) parts.push(`Must-have elements: ${s.elements.join(", ")}`);
      if (Array.isArray(s.constraints) && s.constraints.length) parts.push(`Constraints: ${s.constraints.join(", ")}`);
      if (Array.isArray(s.styleHints) && s.styleHints.length) parts.push(`Style hints: ${s.styleHints.join(", ")}`);
      if (s.compositionRules) parts.push(`Composition: ${s.compositionRules}`);
      if (s.updatedPrompt) parts.push(`Guidance: ${s.updatedPrompt}`);
      const header = "Create a high-quality, professional image with coherent composition and crisp details.";
      return [header, ...parts].filter(Boolean).join("\n");
    };

    // Quick generation mode (direct prompt to image)
    if (phase === "quick") {
      if (!prompt || typeof prompt !== "string") {
        return NextResponse.json({ success: false, error: "Prompt required for quick generation" }, { status: 400 });
      }

      const refinedPrompt = `High quality professional image: ${prompt}. Ultra high resolution, balanced composition, coherent colors, crisp details.`;

      let response: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000);
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${INFRAME_API_KEY}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: refinedPrompt }] }]
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (response.ok) break;
          const text = await response.text().catch(() => "");
          console.error("Gemini image API error:", response.status, text);
          if (response.status === 429 || response.status >= 500) {
            await new Promise((r) => setTimeout(r, attempt * 600));
            continue;
          }
          return NextResponse.json({ success: false, error: `Image generation failed: ${response.status}`, details: text }, { status: 502 });
        } catch (e) {
          await new Promise((r) => setTimeout(r, attempt * 600));
        }
      }
      if (!response || !response.ok) {
        return NextResponse.json({ success: false, error: "Image generation failed after retries" }, { status: 502 });
      }

      const data = await response.json().catch((e) => {
        console.error("Failed to parse image generation response:", e);
        return null;
      });

      const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      let base64Data: string | null = null;
      let mime: string | null = null;
      for (const p of partsOut) {
        const d1 = p?.inline_data?.data as string | undefined;
        const d2 = p?.inlineData?.data as string | undefined;
        if (d1 || d2) {
          base64Data = d1 || d2 || null;
          mime = (p?.inline_data?.mime_type as string | undefined) || (p?.inlineData?.mimeType as string | undefined) || "image/png";
          break;
        }
      }
      const imageUrl = base64Data ? `data:${mime};base64,${base64Data}` : null;

      if (!imageUrl) {
        return NextResponse.json({ success: false, error: "No image URL in response", raw: data }, { status: 502 });
      }

      return NextResponse.json({ success: true, imageUrl });
    }

    // Generate phase: consume structured JSON spec (or prompt) and call image model
    if (phase === "generate") {
      const imagePrompt = spec ? buildImagePromptFromSpec(spec) : (typeof prompt === "string" ? prompt : "");
      if (!imagePrompt || imagePrompt.trim() === "") {
        return NextResponse.json({ success: false, error: "Missing spec or prompt for image generation" }, { status: 400 });
      }

      let response: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000);
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${INFRAME_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: imagePrompt }] }]
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (response.ok) break;
          const text = await response.text().catch(() => "");
          console.error("Gemini image API error:", response.status, text);
          if (response.status === 429 || response.status >= 500) {
            await new Promise((r) => setTimeout(r, attempt * 600));
            continue;
          }
          return NextResponse.json({ success: false, error: `Image generation failed: ${response.status}`, details: text }, { status: 502 });
        } catch (e) {
          await new Promise((r) => setTimeout(r, attempt * 600));
        }
      }
      if (!response || !response.ok) {
        return NextResponse.json({ success: false, error: "Image generation failed after retries" }, { status: 502 });
      }

      const data = await response.json().catch((e) => {
        console.error("Failed to parse image generation response:", e);
        return null;
      });

      const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      let base64Data2: string | null = null;
      let mime2: string | null = null;
      for (const p of partsOut) {
        const d1 = p?.inline_data?.data as string | undefined;
        const d2 = p?.inlineData?.data as string | undefined;
        if (d1 || d2) {
          base64Data2 = d1 || d2 || null;
          mime2 = (p?.inline_data?.mime_type as string | undefined) || (p?.inlineData?.mimeType as string | undefined) || "image/png";
          break;
        }
      }
      const imageUrl = base64Data2 ? `data:${mime2};base64,${base64Data2}` : null;
      if (!imageUrl) {
        return NextResponse.json({ success: false, error: "No image URL in response", raw: data }, { status: 502 });
      }

      return NextResponse.json({ success: true, imageUrl });
    }

    // Generate image(s) from a chosen direction using simple generate-image API
    if (phase === "generateFromDirection") {
      if (!direction || !direction.id) {
        return NextResponse.json({ success: false, error: "Missing direction" }, { status: 400 });
      }
      if (!basePrompt || typeof basePrompt !== "string") {
        return NextResponse.json({ success: false, error: "Missing basePrompt" }, { status: 400 });
      }

      const fullPrompt = `${basePrompt}\n\nStyle direction: ${direction.name}\nComposition: ${direction.compositionRules ?? ""}\nMood: ${(direction.moodKeywords || []).join(", ")}\n\nCreate a high-quality, professional image following these guidelines precisely.`;

      const origin = new URL(request.url).origin;
      const resp = await fetch(`${origin}/api/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return NextResponse.json({ success: false, error: `Image generation failed: ${resp.status}`, details: text }, { status: 502 });
      }
      const data = await resp.json().catch(() => null);
      const imageUrl = data?.imageUrl || null;
      if (!imageUrl) {
        return NextResponse.json({ success: false, error: "No image URL returned" }, { status: 502 });
      }
      return NextResponse.json({ success: true, variants: [{ imageUrl }] }, { status: 200 });
    }

    // Build system prompt and response format depending on phase
    let systemPrompt = "";
    let responseFormat: any = undefined;

    if (phase === "chat") {
      // Simplified conversational mode for chat UI
      systemPrompt = `You are a friendly design assistant helping users create images. 

Your goal: Have a natural conversation to understand what they want to create.

Ask about (casually, not formally):
- What they want to create (e.g., poster, logo, illustration, social media post)
- The style/mood they prefer (e.g., minimal, bold, playful, professional)
- Target audience or purpose
- Any specific elements they want included

Rules:
- Be conversational and friendly, not robotic
- Ask ONE question at a time naturally
- After gathering enough info (usually 2-3 questions), or when the user explicitly asks to generate/create, return a JSON object
- If you have enough information to create the image, OR if the user says things like "create it", "generate", "make it", "yes create", "go ahead", return ONLY this JSON: {"shouldGenerate": true, "finalPrompt": "detailed descriptive prompt based on the conversation"}
- The finalPrompt should be detailed and incorporate all information gathered from the conversation
- Otherwise, respond with normal conversational text asking your next question
- NEVER explain the JSON format to users, just return the raw JSON when ready
- Keep questions natural and brief
- Even if you only have minimal information, if the user asks to generate, you MUST return the JSON with shouldGenerate: true

Message count: ${messages?.length || 0}`;

      const messageList: Array<{ role: string; content: string }> = [...(messages || [])];
      const contents = messageList
        .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      // Retry logic for transient overloads (429/5xx)
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000);
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${INFRAME_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) break;
          const text = await res.text().catch(() => "");
          console.error("AI Gateway error:", res.status, text);
          if (res.status === 429 || res.status >= 500) {
            await new Promise((r) => setTimeout(r, attempt * 700));
            continue;
          }
          return NextResponse.json({ success: false, error: `AI Gateway error: ${res.status}`, details: text }, { status: 502 });
        } catch (e) {
          await new Promise((r) => setTimeout(r, attempt * 700));
        }
      }

      if (!res || !res.ok) {
        // Graceful degrade: continue chat with a polite message rather than erroring out
        return NextResponse.json({ success: true, shouldGenerate: false, message: "I’m experiencing heavy load right now. Please try again in a moment." });
      }

      const data = await res.json().catch(() => null);
      const content = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n");

      if (!content) {
        return NextResponse.json({ success: false, error: "No content in AI response" }, { status: 502 });
      }

      console.log('Chat phase AI response:', content);

      // Try to parse as JSON first (in case AI is ready to generate)
      try {
        const parsed = JSON.parse(content);
        console.log('Parsed JSON from AI:', parsed);
        if (parsed.shouldGenerate) {
          console.log('Should generate image with prompt:', parsed.finalPrompt);
          return NextResponse.json({ success: true, shouldGenerate: true, finalPrompt: parsed.finalPrompt });
        }
      } catch (e) {
        // Try extracting JSON from code fences or substrings
        let jsonCandidate: string | null = null;
        const fenceStart = content.indexOf('```');
        const fenceEnd = fenceStart >= 0 ? content.indexOf('```', fenceStart + 3) : -1;
        if (fenceStart >= 0 && fenceEnd > fenceStart) {
          let inside = content.slice(fenceStart + 3, fenceEnd).trim();
          if (inside.toLowerCase().startsWith('json')) {
            inside = inside.slice(4).trimStart();
          }
          jsonCandidate = inside;
        } else {
          const firstBrace = content.indexOf('{');
          const lastBrace = content.lastIndexOf('}');
          if (firstBrace >= 0 && lastBrace > firstBrace) {
            jsonCandidate = content.slice(firstBrace, lastBrace + 1);
          }
        }
        if (jsonCandidate) {
          try {
            const parsed2 = JSON.parse(jsonCandidate);
            console.log('Parsed JSON from extracted block:', parsed2);
            if (parsed2.shouldGenerate) {
              return NextResponse.json({ success: true, shouldGenerate: true, finalPrompt: parsed2.finalPrompt });
            }
          } catch {}
        }
        // Not JSON, just a regular conversational response
        console.log('AI response is not JSON, continuing conversation');
      }

      return NextResponse.json({ success: true, shouldGenerate: false, message: content });
    } else if (phase === "interview") {
      systemPrompt = `You are a design consultant conducting a brief interview to understand the user's design needs. 

Your goal: Ask 3-4 smart, targeted questions to clarify:
1. Use case (poster, logo, image, social media, etc.)
2. Tone/mood (playful, professional, minimal, bold, etc.)
3. Target audience
4. Must-have elements or constraints

Rules:
- Ask ONE question at a time
- Be conversational and friendly
- After 3-4 questions, say "Got it! Let me analyze your needs." to signal completion
- Keep questions short and clear
- Don't ask more than 4 questions total

Current conversation count: ${messages?.length || 0}`;
    } else if (phase === "extract") {
      systemPrompt = `You are a design analyst. Extract and normalize keywords from the interview conversation.

Output a JSON object with:
- useCase: string (e.g., "poster", "logo", "social-media")
- tone: array of mood keywords (e.g., ["minimal", "modern", "playful"])
- audience: string (e.g., "young professionals", "families")
- elements: array of must-have elements (e.g., ["mountain", "sunrise", "text-overlay"])
- constraints: array of constraints (e.g., ["portrait-orientation", "high-contrast"])

Be concise. Max 5 keywords per category.
Return only a valid JSON object as the entire response (no prose, no code fences).`;
      responseFormat = { type: "json_object" };
    } else if (phase === "directions") {
      systemPrompt = `You are a creative director. Based on the extracted keywords, synthesize 3-4 distinct design directions.

Each direction should be significantly different in style and approach.

Output a JSON object with a "directions" property containing an array of direction objects.

Each direction must have:
- id: string (e.g., "direction-1", "direction-2", etc.)
- name: string (creative name, e.g., "Minimal Horizon")
- rationale: string (1-2 sentences explaining the concept)
- moodKeywords: array of 3-5 mood words
- compositionRules: string (detailed prompt guidance for image generation)
- styleHints: array of visual style keywords

Make them diverse: one minimal, one bold, one artistic, etc.
Return only a valid JSON object as the entire response (no prose, no code fences).`;
      responseFormat = { type: "json_object" };
    } else if (phase === "refine") {
      systemPrompt = `You are a design consultant analyzing user feedback on generated images.

Based on which directions/images the user liked, suggest:
1. What they seem to prefer (style, composition, mood)
2. 2-3 specific refinement suggestions
3. Updated prompt guidance for next generation

Be specific and actionable. Output as JSON with:
- analysis: string (what they liked)
- suggestions: array of strings
- updatedPrompt: string (refined prompt for regeneration)`;
      responseFormat = { type: "json_object" };
    } else {
      // Unknown phase
      return NextResponse.json({ success: false, error: `Unknown phase: ${phase}` }, { status: 400 });
    }

    // Prepare contents with valid roles for Gemini (only 'user' and 'model')
    const messageList: Array<{ role: string; content: string }> = [...(messages || [])];
    if (userInput) messageList.push({ role: "user", content: userInput });
    const contents = messageList
      .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${INFRAME_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        ...(responseFormat ? { generationConfig: { response_mime_type: "application/json" } } : {}),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("AI Gateway error:", res.status, errorText);
      if (res.status === 429) {
        return NextResponse.json({ success: false, error: "Rate limit exceeded. Please try again in a moment." }, { status: 429 });
      }
      return NextResponse.json({ success: false, error: `AI Gateway error: ${res.status}`, details: errorText }, { status: 502 });
    }

    const data = await res.json().catch((e) => {
      console.error("Failed to parse AI response JSON:", e);
      return null;
    });

    const content = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n");

    if (!content) {
      return NextResponse.json({ success: false, error: "No content in AI response", raw: data }, { status: 502 });
    }

    // For JSON phases, try to parse and return structured data
    if (phase === "extract" || phase === "directions" || phase === "refine") {
      try {
        const parsed = JSON.parse(content);
        return NextResponse.json({ success: true, data: parsed });
      } catch (e) {
        console.error("Failed to parse JSON response:", e, "raw:", content);
        return NextResponse.json({ success: false, error: "Failed to parse AI response", raw: content });
      }
    }

    // For interview phase, return plain text message
    return NextResponse.json({ success: true, message: content });
  } catch (err: any) {
    console.error("Design wizard error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
