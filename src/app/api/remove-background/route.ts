import { NextResponse } from "next/server";
import sharp from "sharp";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

/**
 * Post-processes an image to remove the specific gray background color that Gemini added.
 * Uses intelligent color detection and comprehensive scanning for reliable background removal.
 */
async function removeGrayBackground(base64Image: string): Promise<string> {
  try {
    console.log("=== Starting gray background removal ===");
    
    // Decode base64 image
    const imageBuffer = Buffer.from(base64Image, "base64");
    
    // Load image with Sharp
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    console.log(`Image dimensions: ${width}x${height}`);
    
    if (width === 0 || height === 0) {
      throw new Error("Invalid image dimensions");
    }
    
    // Get raw pixel data in RGBA format
    const { data } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Create a new buffer for the processed image
    const processedData = Buffer.from(data);
    
    // Expected target gray (RGB: 200, 200, 200)
    const TARGET_GRAY_R = 200;
    const TARGET_GRAY_G = 200;
    const TARGET_GRAY_B = 200;
    
    // First, detect the actual gray color used by sampling edge pixels
    const edgeSamples: Array<{ r: number; g: number; b: number }> = [];
    const sampleCount = Math.min(100, Math.floor((width + height) * 2));
    
    // Sample edge pixels to detect actual background color
    for (let i = 0; i < sampleCount; i++) {
      let x = 0, y = 0;
      if (i < width) {
        x = i;
        y = 0; // Top edge
      } else if (i < width + height) {
        x = width - 1;
        y = i - width; // Right edge
      } else if (i < width * 2 + height) {
        x = (i - width - height);
        y = height - 1; // Bottom edge
      } else {
        x = 0;
        y = (i - width * 2 - height); // Left edge
      }
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        if (idx >= 0 && idx < processedData.length) {
          edgeSamples.push({
            r: processedData[idx],
            g: processedData[idx + 1],
            b: processedData[idx + 2]
          });
        }
      }
    }
    
    // Find the most common gray color in edges (likely the background)
    const colorCounts = new Map<string, number>();
    for (const sample of edgeSamples) {
      // Check if it's a gray color (R, G, B are similar)
      const max = Math.max(sample.r, sample.g, sample.b);
      const min = Math.min(sample.r, sample.g, sample.b);
      const diff = max - min;
      
      // If RGB values are similar (within 20), it's gray
      if (diff <= 20) {
        // Round to nearest 5 to group similar grays
        const roundedR = Math.round(sample.r / 5) * 5;
        const roundedG = Math.round(sample.g / 5) * 5;
        const roundedB = Math.round(sample.b / 5) * 5;
        const key = `${roundedR},${roundedG},${roundedB}`;
        colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
      }
    }
    
    // Find the most common gray color
    let detectedGray = { r: TARGET_GRAY_R, g: TARGET_GRAY_G, b: TARGET_GRAY_B };
    let maxCount = 0;
    for (const [key, count] of colorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        const [r, g, b] = key.split(',').map(Number);
        detectedGray = { r, g, b };
      }
    }
    
    console.log(`Detected background gray: RGB(${detectedGray.r}, ${detectedGray.g}, ${detectedGray.b}) from ${maxCount} edge samples`);
    
    // Use detected gray or fallback to target gray
    const GRAY_R = detectedGray.r;
    const GRAY_G = detectedGray.g;
    const GRAY_B = detectedGray.b;
    
    // Tolerance for matching (±20 to be more forgiving)
    const COLOR_TOLERANCE = 20;
    
    // Helper to get pixel index
    const getPixelIndex = (x: number, y: number): number => {
      if (x < 0 || x >= width || y < 0 || y >= height) return -1;
      return (y * width + x) * 4;
    };
    
    // Check if pixel matches the detected gray color
    const matchesGray = (idx: number): boolean => {
      if (idx < 0 || idx >= processedData.length - 3) return false;
      
      const r = processedData[idx];
      const g = processedData[idx + 1];
      const b = processedData[idx + 2];
      const a = processedData[idx + 3];
      
      if (a === 0) return false; // Skip already transparent
      
      // Check if RGB values match detected gray within tolerance
      const rDiff = Math.abs(r - GRAY_R);
      const gDiff = Math.abs(g - GRAY_G);
      const bDiff = Math.abs(b - GRAY_B);
      
      // All channels must be within tolerance
      return rDiff <= COLOR_TOLERANCE && 
             gDiff <= COLOR_TOLERANCE && 
             bDiff <= COLOR_TOLERANCE;
    };
    
    // Simple and effective: Remove all gray pixels that match the detected background color
    // Use flood-fill from edges to identify background regions
    const backgroundPixels = new Set<number>();
    const visited = new Set<number>();
    
    // Flood-fill from edges
    const floodFill = (startX: number, startY: number): void => {
      const stack: Array<[number, number]> = [[startX, startY]];
      
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const idx = getPixelIndex(x, y);
        
        if (idx < 0 || visited.has(idx)) continue;
        if (!matchesGray(idx)) continue;
        
        visited.add(idx);
        backgroundPixels.add(idx);
        
        // Add 8 neighbors
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        stack.push([x + 1, y + 1], [x - 1, y + 1], [x + 1, y - 1], [x - 1, y - 1]);
      }
    };
    
    // Start flood-fill from all edges
    console.log("Starting flood-fill from edges...");
    for (let y = 0; y < height; y++) {
      floodFill(0, y);
      floodFill(width - 1, y);
    }
    for (let x = 0; x < width; x++) {
      floodFill(x, 0);
      floodFill(x, height - 1);
    }
    
    let removedCount = backgroundPixels.size;
    console.log(`Flood-fill removed ${removedCount} pixels`);
    
    // If not enough removed, do comprehensive scan of edge zones
    if (removedCount < width * height * 0.1) {
      console.log("Doing comprehensive edge zone scan...");
      const edgeZone = 0.2; // 20% edge zone
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = getPixelIndex(x, y);
          if (backgroundPixels.has(idx)) continue;
          
          if (matchesGray(idx)) {
            const inEdgeZone = 
              x < width * edgeZone || 
              x > width * (1 - edgeZone) || 
              y < height * edgeZone || 
              y > height * (1 - edgeZone);
            
            if (inEdgeZone) {
              backgroundPixels.add(idx);
            }
          }
        }
      }
      removedCount = backgroundPixels.size;
      console.log(`Edge zone scan removed ${removedCount} pixels total`);
    }
    
    // Final pass: remove all remaining gray pixels in outer regions
    if (removedCount < width * height * 0.15) {
      console.log("Doing final comprehensive scan...");
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = getPixelIndex(x, y);
          if (backgroundPixels.has(idx)) continue;
          
          if (matchesGray(idx)) {
            // Check if in outer 30% of image
            const inOuterRegion = 
              x < width * 0.3 || 
              x > width * 0.7 || 
              y < height * 0.3 || 
              y > height * 0.7;
            
            if (inOuterRegion) {
              backgroundPixels.add(idx);
            }
          }
        }
      }
      removedCount = backgroundPixels.size;
      console.log(`Final scan removed ${removedCount} pixels total`);
    }
    
    // Apply transparency
    console.log(`Applying transparency to ${removedCount} pixels...`);
    for (const idx of backgroundPixels) {
      processedData[idx + 3] = 0; // Set alpha to 0
    }
    
    const percentage = Math.round((removedCount / (width * height)) * 100);
    console.log(`=== Background removal complete: ${removedCount} pixels (${percentage}%) ===`);
    
    // Convert back to PNG with transparency
    const outputBuffer = await sharp(processedData, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
    
    // Return as base64
    return outputBuffer.toString("base64");
  } catch (error) {
    console.error("Error removing gray background:", error);
    // If processing fails, return original image
    return base64Image;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      image,
      mode = "quick",
      mask,
      context
    }: {
      image?: string;
      mode?: "quick" | "select";
      mask?: string | null;
      context?: string;
    } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: "Image is required" }, { status: 400 });
    }

    if (!INFRAME_API_KEY) {
      return NextResponse.json({ success: false, error: "API key not configured" }, { status: 500 });
    }

    const baseImage = image.includes(",") ? image.split(",")[1] : image;
    // Use a specific, uncommon gray color (RGB: 200, 200, 200) that's easy to identify and remove
    // This light gray is less likely to appear in natural images, making it safe to remove
    const TARGET_GRAY_COLOR = "RGB: 200, 200, 200";
    const userInstruction = [
      "Remove the background from the provided image while keeping the subject perfectly intact.",
      `CRITICAL: Replace the background with EXACTLY this gray color: ${TARGET_GRAY_COLOR}. The background must be a uniform solid gray using exactly RGB(200, 200, 200), not transparent and not any other shade of gray.`,
      "Keep the subject intact and place it on this specific gray background. Match the original resolution exactly and keep edges crisp, free of halos or artifacts.",
      mode === "select"
        ? `Only keep the regions highlighted by the mask image. Treat the mask as the foreground to preserve. Replace all non-masked areas with the exact gray background color ${TARGET_GRAY_COLOR}.`
        : `Automatically identify and keep the single most prominent subject (person, product, logo, or main object). Remove everything else and replace the background with the exact gray color ${TARGET_GRAY_COLOR}.`
    ]
      .filter(Boolean)
      .join(" ");

    const parts: any[] = [
      { text: `${userInstruction} ${context ?? ""}`.trim() },
      {
        inline_data: {
          mime_type: "image/png",
          data: baseImage
        }
      }
    ];

    if (mode === "select" && mask) {
      const maskData = mask.includes(",") ? mask.split(",")[1] : mask;
      parts.push({
        text: `A mask image is attached where painted pixels represent the content to KEEP. Remove everything else and replace all non-masked areas with the exact gray background color RGB(200, 200, 200).`
      });
      parts.push({
        inline_data: {
          mime_type: "image/png",
          data: maskData
        }
      });
    }

    let response: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${INFRAME_API_KEY}`,
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
            signal: controller.signal
          }
        );

        clearTimeout(timeout);

        if (response.ok) break;

        const text = await response.text().catch(() => "");
        console.error(`Remove background API error (attempt ${attempt}):`, response.status, text);
        if (response.status === 429 || response.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 800));
          continue;
        }
        return NextResponse.json({ success: false, error: text || "Gemini API error" }, { status: response.status });
      } catch (error) {
        console.error("Remove background request error:", error);
        if (attempt === 3) {
          return NextResponse.json({ success: false, error: "Failed to contact Gemini API" }, { status: 502 });
        }
        await new Promise((r) => setTimeout(r, attempt * 800));
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json({ success: false, error: "Image editing failed after retries" }, { status: 502 });
    }

    const data = await response.json().catch((err) => {
      console.error("Failed to parse remove background response:", err);
      return null;
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Invalid response from Gemini" }, { status: 502 });
    }

    const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    let base64Data: string | null = null;
    let mime: string | null = null;
    for (const p of partsOut) {
      const inline = p?.inline_data || p?.inlineData;
      if (inline?.data) {
        base64Data = inline.data;
        mime = inline.mime_type || inline.mimeType || "image/png";
        break;
      }
    }

    if (!base64Data) {
      return NextResponse.json({ success: false, error: "No image returned", raw: data }, { status: 502 });
    }

    // Post-process the image to remove any gray backgrounds
    // This is critical - we MUST remove the gray background before returning
    console.log("Starting post-processing to remove gray background...");
    try {
      const processedBase64 = await removeGrayBackground(base64Data);
      console.log("Post-processing completed successfully");
      const imageUrl = `data:${mime};base64,${processedBase64}`;
      return NextResponse.json({ success: true, imageUrl });
    } catch (error) {
      console.error("Post-processing error:", error);
      // Try one more time with error recovery
      try {
        console.log("Retrying post-processing...");
        const processedBase64 = await removeGrayBackground(base64Data);
        const imageUrl = `data:${mime};base64,${processedBase64}`;
        return NextResponse.json({ success: true, imageUrl });
      } catch (retryError) {
        console.error("Post-processing failed on retry:", retryError);
        // Even if processing fails, we should still try to return something
        // But log a warning that the background might still be gray
        console.warn("WARNING: Post-processing failed, returning image which may still have gray background");
        const imageUrl = `data:${mime};base64,${base64Data}`;
        return NextResponse.json({ success: true, imageUrl, warning: "Post-processing failed, image may still have gray background" });
      }
    }
  } catch (error) {
    console.error("Remove background route error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

