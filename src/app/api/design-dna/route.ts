import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

if (!INFRAME_API_KEY) {
    throw new Error("Missing INFRAME_API_KEY environment variable.");
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { image, artboardObjects } = body;

        if (!image) {
            return NextResponse.json({ success: false, error: "Image is required" }, { status: 400 });
        }

        if (!artboardObjects || !Array.isArray(artboardObjects)) {
            return NextResponse.json({ success: false, error: "Artboard objects are required" }, { status: 400 });
        }

        // System prompt for Design DNA extraction and application
        const systemPrompt = `You are an expert Design Director AI. Analyze the uploaded design image (which could be a UI, logo, poster, or graphic design) to extract its 'Design DNA'. This includes the color palette, typography style (serif/sans/display), layout structure, visual hierarchy, spacing, and decorative elements.

Then, apply this Design DNA to the provided list of artboard objects.

- For Logos: Focus on shape simplification, bold typography, and iconic color usage.
- For Posters: Focus on strong hierarchy, dramatic typography, and balanced composition.
- For UI: Focus on consistency, readability, and grid alignment.

Input Data:
- Image: The visual reference.
- Artboard Objects: A JSON list of current objects on the canvas (rectangles, text, etc.) with their properties.

Your Task:
1. Analyze the image style.
2. Map this style to the provided artboard objects.
3. Return a JSON object with:
   - modifications: An array of updates for existing objects. Each update must include the 'id' of the object and the properties to change (e.g., fill, stroke, fontFamily, fontSize, left, top, width, height, opacity).
   - additions: An array of new objects to add to complete the design (e.g., decorative shapes, background elements). Each addition should have a 'type' (rect, text, circle, etc.) and all necessary properties including 'id' (generate a new unique id).
   - isPhotorealistic: Boolean, true if the image is a raw photo (e.g. nature, people) rather than a design artifact.
   - designSystem: Object describing the extracted style (colors, fonts, mood).

IMPORTANT:
- Do not change the 'id' of existing objects.
- Ensure text is readable against the background.
- Maintain the relative content of text objects unless it's clearly placeholder.
- Return ONLY valid JSON.
`;

        const prompt = `
Artboard Objects:
${JSON.stringify(artboardObjects, null, 2)}

Analyze the image and apply its design DNA to these objects.
`;

        // Call Gemini API (gemini-3-pro-preview)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${INFRAME_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: "image/png",
                                    data: image.split(",")[1] || image
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("Gemini API error:", response.status, text);
            return NextResponse.json({ success: false, error: `Gemini API error: ${response.status}`, details: text }, { status: 502 });
        }

        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            return NextResponse.json({ success: false, error: "No content in AI response" }, { status: 502 });
        }

        try {
            const parsed = JSON.parse(content);
            return NextResponse.json({ success: true, data: parsed });
        } catch (e) {
            console.error("Failed to parse JSON:", e);
            return NextResponse.json({ success: false, error: "Failed to parse AI response", raw: content }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Design DNA API error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
