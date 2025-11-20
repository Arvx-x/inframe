import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Image as FabricImage } from 'fabric';

interface SmartEditProps {
    selectedObject: any;
    onImageEdit: (imageUrl: string) => void;
    smartEditSelection: {
        type: "rectangle";
        imageSize: { width: number; height: number };
        rect: { x: number; y: number; width: number; height: number };
        normalized: { x: number; y: number; width: number; height: number };
    } | null;
    setSmartEditSelection: (selection: any) => void;
}

export const SmartEdit: React.FC<SmartEditProps> = ({
    selectedObject,
    onImageEdit,
    smartEditSelection,
    setSmartEditSelection
}) => {
    const [prompt, setPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const sanitizeSelection = (sel: typeof smartEditSelection, imgElement: HTMLImageElement) => {
        if (!sel || !sel.rect || !imgElement.naturalWidth || !imgElement.naturalHeight) return null;

        const width = Math.max(1, Math.min(sel.rect.width, imgElement.naturalWidth));
        const height = Math.max(1, Math.min(sel.rect.height, imgElement.naturalHeight));
        if (width < 1 || height < 1) return null;

        const x = Math.max(0, Math.min(sel.rect.x, imgElement.naturalWidth - width));
        const y = Math.max(0, Math.min(sel.rect.y, imgElement.naturalHeight - height));

        const normalized = {
            x: Math.min(1, Math.max(0, x / imgElement.naturalWidth)),
            y: Math.min(1, Math.max(0, y / imgElement.naturalHeight)),
            width: Math.min(1, Math.max(0, width / imgElement.naturalWidth)),
            height: Math.min(1, Math.max(0, height / imgElement.naturalHeight)),
        };

        return {
            type: sel.type ?? "rectangle",
            imageSize: {
                width: imgElement.naturalWidth,
                height: imgElement.naturalHeight,
            },
            rect: { x, y, width, height },
            normalized,
        };
    };

    const loadImageElement = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("Failed to load image"));
            image.src = src;
        });

    const computeChangeBounds = async (
        baseImg: HTMLImageElement,
        editedImg: HTMLImageElement
    ): Promise<{ x: number; y: number; width: number; height: number } | null> => {
        const baseWidth = baseImg.naturalWidth || baseImg.width;
        const baseHeight = baseImg.naturalHeight || baseImg.height;
        const editWidth = editedImg.naturalWidth || editedImg.width;
        const editHeight = editedImg.naturalHeight || editedImg.height;

        if (baseWidth === 0 || baseHeight === 0 || editWidth === 0 || editHeight === 0) {
            return null;
        }

        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = baseWidth;
        baseCanvas.height = baseHeight;
        const baseCtx = baseCanvas.getContext('2d');
        if (!baseCtx) return null;
        baseCtx.drawImage(baseImg, 0, 0, baseWidth, baseHeight);

        const editedCanvas = document.createElement('canvas');
        editedCanvas.width = baseWidth;
        editedCanvas.height = baseHeight;
        const editedCtx = editedCanvas.getContext('2d');
        if (!editedCtx) return null;
        editedCtx.drawImage(editedImg, 0, 0, baseWidth, baseHeight);

        const baseData = baseCtx.getImageData(0, 0, baseWidth, baseHeight).data;
        const editedData = editedCtx.getImageData(0, 0, baseWidth, baseHeight).data;

        let minX = baseWidth;
        let minY = baseHeight;
        let maxX = -1;
        let maxY = -1;
        const threshold = 12;

        for (let i = 0; i < baseData.length; i += 4) {
            const diff =
                Math.abs(baseData[i] - editedData[i]) +
                Math.abs(baseData[i + 1] - editedData[i + 1]) +
                Math.abs(baseData[i + 2] - editedData[i + 2]) +
                Math.abs(baseData[i + 3] - editedData[i + 3]);

            if (diff > threshold) {
                const idx = i / 4;
                const x = idx % baseWidth;
                const y = Math.floor(idx / baseWidth);
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < minX || maxY < minY) {
            return null;
        }

        const padding = 12;
        const rectX = Math.max(0, minX - padding);
        const rectY = Math.max(0, minY - padding);
        const rectWidth = Math.min(baseWidth - rectX, maxX - minX + 1 + padding * 2);
        const rectHeight = Math.min(baseHeight - rectY, maxY - minY + 1 + padding * 2);

        return { x: rectX, y: rectY, width: rectWidth, height: rectHeight };
    };

    const detectTextIntent = (prompt: string) => {
        const normalizedPrompt = prompt.toLowerCase();
        const mentionsText =
            /\btext\b/.test(normalizedPrompt) ||
            /\btitle\b/.test(normalizedPrompt) ||
            /\bword\b/.test(normalizedPrompt) ||
            /\bsubtitle\b/.test(normalizedPrompt) ||
            /\bcaption\b/.test(normalizedPrompt) ||
            /\blettering\b/.test(normalizedPrompt) ||
            /\bheadline\b/.test(normalizedPrompt) ||
            /['"][^'"]+['"]/.test(prompt) ||
            /\breplace\b.+\bwith\b/.test(normalizedPrompt) ||
            /\bchange\b.+\bto\b/.test(normalizedPrompt) ||
            /\bwrite\b/.test(normalizedPrompt) ||
            /\badd\b.+\btext\b/.test(normalizedPrompt);

        if (!mentionsText) return null;

        const allowFontChange =
            /\bfont\b/.test(normalizedPrompt) ||
            /\btypeface\b/.test(normalizedPrompt) ||
            /\bstyle\b/.test(normalizedPrompt) ||
            /\bitalic\b/.test(normalizedPrompt) ||
            /\bbold\b/.test(normalizedPrompt);

        const allowSizeChange =
            /\bsize\b/.test(normalizedPrompt) ||
            /\bbigger\b/.test(normalizedPrompt) ||
            /\blarger\b/.test(normalizedPrompt) ||
            /\bsmaller\b/.test(normalizedPrompt) ||
            /\bscale\b/.test(normalizedPrompt);

        const allowPositionChange =
            /\bposition\b/.test(normalizedPrompt) ||
            /\bmove\b/.test(normalizedPrompt) ||
            /\balign\b/.test(normalizedPrompt) ||
            /\bcenter\b/.test(normalizedPrompt) ||
            /\balignment\b/.test(normalizedPrompt);

        return {
            intent: "text" as const,
            allowFontChange,
            allowSizeChange,
            allowPositionChange,
        };
    };

    const handleApplyEdit = async () => {
        if (!selectedObject || !(selectedObject instanceof FabricImage)) {
            toast.error("Please select an image first");
            return;
        }

        if (!smartEditSelection) {
            toast.error("Please draw a selection on the canvas");
            return;
        }

        if (!prompt.trim()) {
            toast.error("Please enter an edit description");
            return;
        }

        const imgElement = (selectedObject as FabricImage).getElement() as HTMLImageElement;
        if (!imgElement) {
            toast.error("Invalid image element");
            return;
        }

        setIsProcessing(true);

        try {
            const clampedSelection = sanitizeSelection(smartEditSelection, imgElement);
            if (!clampedSelection) {
                throw new Error("Invalid selection");
            }

            // Create canvas with current image
            const canvasEl = document.createElement('canvas');
            canvasEl.width = imgElement.naturalWidth;
            canvasEl.height = imgElement.naturalHeight;
            const ctx = canvasEl.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");
            ctx.drawImage(imgElement, 0, 0);
            const currentImageUrl = canvasEl.toDataURL('image/png');

            // Extract selection crop
            const selectionImageUrl = (() => {
                try {
                    if (!clampedSelection?.rect) return null;
                    const { x, y, width, height } = clampedSelection.rect;
                    const off = document.createElement('canvas');
                    const MAX_SIDE = 1536;
                    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
                    off.width = Math.max(1, Math.round(width * scale));
                    off.height = Math.max(1, Math.round(height * scale));
                    const c = off.getContext('2d');
                    if (!c) return null;
                    c.imageSmoothingEnabled = true;
                    c.imageSmoothingQuality = 'high';
                    c.drawImage(
                        imgElement,
                        x, y, width, height,
                        0, 0, off.width, off.height
                    );
                    return off.toDataURL('image/png');
                } catch {
                    return null;
                }
            })();

            const textIntent = detectTextIntent(prompt);

            // Call Smart Edit API
            const res = await fetch('/api/smart-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    currentImageUrl,
                    selection: clampedSelection,
                    selectionImageUrl,
                    editIntent: textIntent?.intent ?? null,
                    textEditOptions: textIntent ? {
                        allowFontChange: textIntent.allowFontChange,
                        allowSizeChange: textIntent.allowSizeChange,
                        allowPositionChange: textIntent.allowPositionChange,
                    } : null,
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || `Request failed with status ${res.status}`);
            }

            const data = await res.json();

            if (!data.success || !data.imageUrl) {
                throw new Error(data.error || "No image URL returned");
            }

            // Composite the edited region back onto the original image
            let finalImageUrl = data.imageUrl;

            if (clampedSelection) {
                try {
                    const [baseImage, editedImage] = await Promise.all([
                        loadImageElement(currentImageUrl),
                        loadImageElement(data.imageUrl),
                    ]);

                    const baseWidth = baseImage.naturalWidth || baseImage.width;
                    const baseHeight = baseImage.naturalHeight || baseImage.height;
                    const editWidth = editedImage.naturalWidth || editedImage.width;
                    const editHeight = editedImage.naturalHeight || editedImage.height;

                    const changeBounds = await computeChangeBounds(baseImage, editedImage);
                    const patch = changeBounds || clampedSelection.rect;
                    const { x, y, width, height } = patch;

                    if (baseWidth > 0 && baseHeight > 0 && width > 0 && height > 0) {
                        const compositeCanvas = document.createElement('canvas');
                        compositeCanvas.width = baseWidth;
                        compositeCanvas.height = baseHeight;
                        const compositeCtx = compositeCanvas.getContext('2d');

                        if (compositeCtx) {
                            compositeCtx.drawImage(baseImage, 0, 0, baseWidth, baseHeight);
                            const ratioX = editWidth / baseWidth || 1;
                            const ratioY = editHeight / baseHeight || 1;
                            const srcX = Math.max(0, Math.round(x * ratioX));
                            const srcY = Math.max(0, Math.round(y * ratioY));
                            const srcW = Math.max(1, Math.round(width * ratioX));
                            const srcH = Math.max(1, Math.round(height * ratioY));
                            const safeSrcW = Math.max(1, Math.min(srcW, editWidth - srcX));
                            const safeSrcH = Math.max(1, Math.min(srcH, editHeight - srcY));
                            const destW = Math.max(1, Math.min(width, baseWidth - x));
                            const destH = Math.max(1, Math.min(height, baseHeight - y));

                            compositeCtx.drawImage(
                                editedImage,
                                srcX, srcY, safeSrcW, safeSrcH,
                                x, y, destW, destH
                            );

                            finalImageUrl = compositeCanvas.toDataURL('image/png');
                        }
                    }
                } catch (err) {
                    console.error("Smart edit compositing failed:", err);
                }
            }

            onImageEdit(finalImageUrl);
            setSmartEditSelection(clampedSelection);
            toast.success("Smart Edit applied successfully!");
            setPrompt("");

        } catch (error) {
            console.error("Smart Edit failed:", error);
            toast.error(error instanceof Error ? error.message : "Smart Edit failed. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="pt-2 px-3 pb-3 space-y-2">
            <div>
                <p className="text-[11px] text-[#6E6E6E] mb-1.5">Describe your edit</p>
                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Make the background warmer..."
                    className="min-h-[96px] pt-3 resize-none text-[11px] border border-[#E5E5E5] bg-white rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isProcessing}
                />
            </div>
            <Button
                onClick={handleApplyEdit}
                disabled={isProcessing || !prompt.trim() || !smartEditSelection}
                className="w-full h-8 text-[11px] rounded-lg gap-1.5"
                size="sm"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Applying...
                    </>
                ) : (
                    <>
                        <Wand2 className="w-3 h-3" />
                        Apply Edit
                    </>
                )}
            </Button>
            {!smartEditSelection && (
                <div className="text-[10px] text-[#9E9E9E]">
                    Tip: Drag on the canvas to select a region.
                </div>
            )}
        </div>
    );
};
