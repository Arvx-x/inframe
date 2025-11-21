import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

if (!INFRAME_API_KEY) {
    throw new Error("Missing INFRAME_API_KEY environment variable.");
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { image, artboardObjects, artboardDimensions } = body;

        if (!image) {
            return NextResponse.json({ success: false, error: "Image is required" }, { status: 400 });
        }

        if (!artboardObjects || !Array.isArray(artboardObjects)) {
            return NextResponse.json({ success: false, error: "Artboard objects are required" }, { status: 400 });
        }

        // NEW: Extract design system and reusable elements
        const systemPrompt = `You are an expert Design Director AI that extracts reusable design systems and elements from reference images.

Your task is to analyze an uploaded design image and extract:
1. **Color Palette**: All significant colors used
2. **Typography**: Font families, weights, and usage patterns
3. **Reusable Elements**: Shapes, text styles, and decorative objects that can be reused

DO NOT try to modify existing artboard objects. Instead, extract standalone, reusable design elements.

RESPONSE FORMAT (JSON only, no markdown):
{
  "designType": "poster|logo|ui|card|banner|illustration|document|other",
  "isPhotorealistic": boolean,
  "colors": {
    "palette": ["#hex1", "#hex2", ...],  // All significant colors (max 8)
    "primary": "#hex",
    "secondary": "#hex", 
    "background": "#hex",
    "text": "#hex"
  },
  "typography": {
    "fonts": [
      {"family": "Arial|Helvetica|Georgia|serif|sans-serif|monospace", "weight": "normal|bold|600|700", "usage": "heading|body|caption"},
      ...
    ],
    "primaryFont": "FontName",
    "secondaryFont": "FontName"
  },
  "elements": [
    {
      "id": "elem-1",
      "name": "Descriptive name (e.g., 'Large Circle Badge', 'Heading Text Style')",
      "type": "rect|circle|ellipse|triangle|line|text|polygon",
      "width": number,
      "height": number,
      "properties": {
        // For shapes: fill, stroke, strokeWidth, radius, borderRadius, opacity
        // For text: text, fontSize, fontFamily, fontWeight, fill, textAlign
        // All properties needed to recreate this element
      }
    }
  ]
}

ELEMENT EXTRACTION GUIDELINES:
- Extract 5-10 reusable elements from the design
- PRIORITIZE: Vector paths, geometric shapes, and distinctive text styles
- Include a mix of:
  * Basic shapes (circles, rects, triangles)
  * Complex shapes (polygons, stars)
  * Text styles (headings, quotes)
  * Decorative elements (lines, dividers, badges)
- Each element should be standalone and reusable
- Include exact properties needed to recreate the element
- For text elements, use representative sample text like "Headline" or "Body Text"
- Make elements canvas-ready (100-300px in size typically)

COLOR EXTRACTION:
- Extract main colors (not every single color)
- Identify primary (most prominent), secondary, background, and text colors
- Return hex format only (#RRGGBB)

TYPOGRAPHY EXTRACTION:
- Identify font categories (serif, sans-serif, monospace, display)
- Note weight and typical usage (heading vs body)
- If you can identify specific fonts (Arial, Helvetica, Georgia), include them

CRITICAL:
- Return ONLY valid JSON
- No markdown, no code blocks, no explanations
- All elements must be self-contained and reusable
`;

        const prompt = `
Analyze this reference image and extract:
1. The color palette (primary, secondary, background, text colors)
2. Typography system (fonts and their usage)
3. 5-10 reusable design elements (focus on vector paths, shapes, and text styles)

Each element should be a standalone, reusable component that a designer can add to their canvas.

Return the JSON response with colors, typography, and elements arrays.
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
