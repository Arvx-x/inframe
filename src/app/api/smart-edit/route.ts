import { NextRequest, NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            prompt,
            currentImageUrl,
            selection,
            selectionImageUrl,
            editIntent,
            textEditOptions
        } = body;

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json(
                { success: false, error: "Prompt is required" },
                { status: 400 }
            );
        }

        if (!currentImageUrl) {
            return NextResponse.json(
                { success: false, error: "Current image URL is required" },
                { status: 400 }
            );
        }

        if (!INFRAME_API_KEY) {
            return NextResponse.json(
                { success: false, error: "API key not configured" },
                { status: 500 }
            );
        }

        // Build enhanced prompt with selection awareness
        let enhancedPrompt = prompt;
        if (selection?.normalized) {
            const { normalized } = selection;
            const posDesc = [];

            if (normalized.x < 0.2) posDesc.push("left side");
            else if (normalized.x > 0.6) posDesc.push("right side");
            else posDesc.push("center");

            if (normalized.y < 0.2) posDesc.push("top");
            else if (normalized.y > 0.6) posDesc.push("bottom");
            else posDesc.push("middle");

            const position = posDesc.join(" ");
            const area = normalized.width * normalized.height;
            const sizeDesc = area > 0.5 ? "large" : area > 0.15 ? "medium" : "small";

            enhancedPrompt = `You are editing a ${sizeDesc} region in the ${position} of the image. ${prompt}. IMPORTANT: Keep all changes strictly localized to the selected area and ensure seamless blending with surrounding pixels. Maintain the original image's overall composition and style.`;
        }

        // Add text editing context if applicable
        if (editIntent === "text" && textEditOptions) {
            const constraints = [];
            if (!textEditOptions.allowFontChange) constraints.push("keep the same font");
            if (!textEditOptions.allowSizeChange) constraints.push("maintain the same size");
            if (!textEditOptions.allowPositionChange) constraints.push("keep in the same position");

            if (constraints.length > 0) {
                enhancedPrompt += ` When editing text, ${constraints.join(", ")}.`;
            }
        }

        // Build request parts for Gemini API
        const parts: any[] = [{ text: enhancedPrompt }];

        // Add the full image for context
        if (currentImageUrl) {
            const imageData = currentImageUrl.includes(",")
                ? currentImageUrl.split(",")[1]
                : currentImageUrl;

            parts.push({
                inline_data: {
                    mime_type: "image/png",
                    data: imageData
                }
            });
        }

        // Add selection crop for focused editing
        if (selectionImageUrl) {
            const selectionData = selectionImageUrl.includes(",")
                ? selectionImageUrl.split(",")[1]
                : selectionImageUrl;

            parts.push({
                inline_data: {
                    mime_type: "image/png",
                    data: selectionData
                }
            });
        }

        // Call Gemini 3 Pro Image Preview with retry logic
        let response: Response | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 60000);

                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${INFRAME_API_KEY}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ role: "user", parts }],
                            safetySettings: [
                                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                            ]
                        }),
                        signal: controller.signal,
                    }
                );

                clearTimeout(timeout);

                if (response.ok) break;

                const text = await response.text().catch(() => "");
                console.error(`Gemini 3 Pro API error (attempt ${attempt}):`, response.status, text);

                if (response.status === 429 || response.status >= 500) {
                    await new Promise((r) => setTimeout(r, attempt * 1000));
                    continue;
                }

                return NextResponse.json(
                    { success: false, error: `Image editing failed: ${response.status}`, details: text },
                    { status: 502 }
                );
            } catch (e) {
                console.error(`Request error (attempt ${attempt}):`, e);
                if (attempt < 3) {
                    await new Promise((r) => setTimeout(r, attempt * 1000));
                }
            }
        }

        if (!response || !response.ok) {
            return NextResponse.json(
                { success: false, error: "Image editing failed after retries" },
                { status: 502 }
            );
        }

        const data = await response.json().catch((e) => {
            console.error("Failed to parse response:", e);
            return null;
        });

        if (!data) {
            return NextResponse.json(
                { success: false, error: "Invalid response from API" },
                { status: 502 }
            );
        }

        // Extract image from response
        const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
        let base64Data: string | null = null;
        let mime: string | null = null;

        for (const p of partsOut) {
            const d1 = p?.inline_data?.data as string | undefined;
            const d2 = p?.inlineData?.data as string | undefined;

            if (d1 || d2) {
                base64Data = d1 || d2 || null;
                mime = (p?.inline_data?.mime_type as string | undefined) ||
                    (p?.inlineData?.mimeType as string | undefined) ||
                    "image/png";
                break;
            }
        }

        if (!base64Data) {
            return NextResponse.json(
                { success: false, error: "No image data in response", raw: data },
                { status: 502 }
            );
        }

        const imageUrl = `data:${mime};base64,${base64Data}`;

        return NextResponse.json({
            success: true,
            imageUrl,
            selection
        });

    } catch (error) {
        console.error("Smart Edit API error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
