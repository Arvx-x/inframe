const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const DESIGN_ANALYSIS_SYSTEM =
  "DESIGN REFERENCE IMAGE ANALYSIS: Carefully analyze the following reference image for its design elements including: color palette and color harmony, typography style and font choices, layout and composition, visual style (minimalist, bold, vintage, modern, etc.), mood and atmosphere, textures and patterns, spacing and proportions.";

const REFERENCE_MODE_BRANDING =
  "Use these design elements as inspiration. FOR BRANDING AND ADS: Strictly use the reference object/product shown in the attached image—it must appear identically in your output. The product, logo, or branded object must be reproduced with exact fidelity.";

const REFERENCE_MODE_INSPIRATION =
  "Use these design elements as inspiration. FOR REFERENCE AND LIKENESS: Take creative inspiration from the reference image—match the style, mood, and aesthetic, but you may interpret and adapt freely. Do not require exact reproduction of objects.";

const CREATION_INSTRUCTION = (prompt: string, strictRef: boolean) =>
  `Now, using the design elements and guidance above, create a new image based on this prompt: ${prompt}. The new image should feel cohesive with the reference. ${strictRef ? "IMPORTANT: The product/object in the reference must appear identically—maintain strict consistency across all variations." : "Match the visual style and aesthetic while creating a unique interpretation."}`;

export type ImagenReferenceImage = {
  bytesBase64Encoded: string;
  mimeType: string;
};

export type ReferenceMode = "branding" | "inspiration";

export async function generateImageWithGemini(options: {
  prompt: string;
  referenceImage?: ImagenReferenceImage;
  referenceMode?: ReferenceMode;
  briefContext?: string;
  nanoBananaOnly?: boolean;
}): Promise<{ imageBase64: string; mimeType: string }> {
  const {
    prompt,
    referenceImage,
    referenceMode = "branding",
    briefContext,
    nanoBananaOnly = false,
  } = options;

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.INFRAME_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or INFRAME_API_KEY must be set.");
  }

  const primaryModel =
    process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image-preview";
  const fallbackModel = "gemini-2.5-flash-image";

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  const modeInstruction =
    referenceMode === "branding" ? REFERENCE_MODE_BRANDING : REFERENCE_MODE_INSPIRATION;
  const strictRef = referenceMode === "branding";

  if (briefContext) {
    parts.push({
      text: `PRODUCT/CAMPAIGN BRIEF CONTEXT (use when relevant to the user's request):\n${briefContext}\n\n`,
    });
  }

  if (referenceImage) {
    parts.push({ text: `${DESIGN_ANALYSIS_SYSTEM}\n\n${modeInstruction}\n\n` });
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.bytesBase64Encoded,
      },
    });
    parts.push({ text: `\n\n${CREATION_INSTRUCTION(prompt, strictRef)}` });
  } else {
    const basePrompt = briefContext
      ? `Using the brief context above when relevant, generate an image based on: ${prompt}`
      : `Generate an image based on this prompt: ${prompt}`;
    parts.push({ text: basePrompt });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const tryModel = async (model: string): Promise<{ imageBase64: string; mimeType: string }> => {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini image generation failed: ${response.status} - ${text}`);
    }

    type GeminiImageResponse = {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
      }>;
    };
    const data = (await response.json()) as GeminiImageResponse;

    const candidates = data.candidates ?? [];
    const firstCandidate = candidates[0];
    const contentParts = firstCandidate?.content?.parts ?? [];

    const imagePart = contentParts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const textPart = contentParts.find((p) => p.text)?.text ?? "";
      throw new Error(
        `No image in response. Model may not support image generation or returned text only: ${textPart.slice(0, 200)}`
      );
    }

    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  };

  try {
    return await tryModel(primaryModel);
  } catch (err) {
    if (!nanoBananaOnly && primaryModel !== fallbackModel) {
      return await tryModel(fallbackModel);
    }
    throw err;
  }
}
