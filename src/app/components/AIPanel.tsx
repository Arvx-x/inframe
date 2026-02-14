'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Image,
    Video,
    Loader2,
    ArrowUp,
    ChevronDown,
    Plus,
    X,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';

// ── Types ──────────────────────────────────────────────────────

export type AIPanelMode = 'image' | 'product-video' | 'advert' | 'listing';

export type VideoTabType = 'product-video' | 'advert' | 'listing';

interface AIPanelProps {
    onCanvasCommand?: (command: string) => Promise<string>;
    onImageGenerated?: (imageUrlOrUrls: string | string[]) => void;
    onVideoGenerated?: (videoUrl: string) => void;
    onImageGenerationPending?: (pending: boolean, options?: { ratio?: string }) => void;
    getCanvasSnapshot?: () => string | null;
    getSelectedImageSnapshot?: () => string | null;
    campaignBrief?: string | null;
    brandSummary?: string | null;
    formatLabel?: string | null;
    formatDimensions?: { width: number; height: number } | null;
    className?: string;
    /** When true, only show video modes (Product Video, Advert, Listing) and default to product-video */
    videoOnly?: boolean;
}

// ── Mode definitions ───────────────────────────────────────────

const modes: { id: AIPanelMode; label: string; icon: React.ElementType; placeholder: string }[] = [
    {
        id: 'image',
        label: 'Image',
        icon: Image,
        placeholder: 'Describe a design — "Product showcase with gradient background"',
    },
    {
        id: 'product-video',
        label: 'Product Video',
        icon: Video,
        placeholder: 'Describe the video — "Product closeup with gentle rotation" or "Showcase product details"',
    },
    {
        id: 'advert',
        label: 'Advert',
        icon: Video,
        placeholder: 'Describe the ad — "Dynamic ad with lifestyle shots" or "Commercial-style reveal"',
    },
    {
        id: 'listing',
        label: 'Listing',
        icon: Video,
        placeholder: 'Describe the listing video — "360° product view for e-commerce" or "Quick product highlights"',
    },
];

// ── Helper: build contextual prompt with brief ─────────────────

function buildContextualPrompt(
    userPrompt: string,
    campaignBrief?: string | null,
    brandSummary?: string | null,
    formatLabel?: string | null,
): string {
    const contextParts: string[] = [];
    if (campaignBrief) {
        contextParts.push(`Campaign Brief: ${campaignBrief}`);
    }
    if (brandSummary) {
        contextParts.push(`Brand Guidelines: ${brandSummary}`);
    }
    if (formatLabel) {
        contextParts.push(`Target Format: ${formatLabel}`);
    }
    if (contextParts.length > 0) {
        return `${contextParts.join('. ')}.\n\nDesign request: ${userPrompt}`;
    }
    return userPrompt;
}

// ── Component ──────────────────────────────────────────────────

export function AIPanel({
    onCanvasCommand,
    onImageGenerated,
    onVideoGenerated,
    onImageGenerationPending,
    getCanvasSnapshot,
    getSelectedImageSnapshot,
    campaignBrief,
    brandSummary,
    formatLabel,
    formatDimensions,
    className,
    videoOnly = false,
}: AIPanelProps) {
    // ── State ──
    const [activeMode, setActiveMode] = useState<AIPanelMode>(videoOnly ? 'product-video' : 'image');
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);

    // ── Refs ──
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentMode = modes.find((m) => m.id === activeMode) || modes[0];

    // ── Focus textarea on mount ──
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);

    // ── Auto-resize textarea ──
    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, []);

    useEffect(() => {
        resizeTextarea();
    }, [input, resizeTextarea]);

    const handleReferenceFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setReferenceImageUrl(dataUrl);
            toast.success('Reference image added');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, []);

    // ── Submit handler ──
    const handleSubmit = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();
            const trimmed = input.trim();
            if (!trimmed || isProcessing) return;

            setInput('');
            setIsProcessing(true);

            try {
                switch (activeMode) {
                    // ── IMAGE: generate image via /api/generate-image, add to canvas ──
                    case 'image': {
                        onImageGenerationPending?.(true, formatDimensions ? { ratio: `${formatDimensions.width}x${formatDimensions.height}` } : undefined);
                        const toastId = toast.loading('Generating image...');
                        const contextualPrompt = buildContextualPrompt(trimmed, campaignBrief, brandSummary, formatLabel);
                        const res = await fetch('/api/generate-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                prompt: contextualPrompt,
                                ...(referenceImageUrl && { referenceImageUrl }),
                            }),
                        });
                        if (res.ok) {
                            const { imageUrl, imageUrls } = await res.json();
                            const urls = imageUrls ?? (imageUrl ? [imageUrl] : []);
                            if (urls.length > 0 && onImageGenerated) {
                                onImageGenerated(urls);
                                toast.success(urls.length > 1 ? `${urls.length} images added to canvas` : 'Image added to canvas', { id: toastId });
                            } else {
                                toast.error('No image was generated. Try a different prompt.', { id: toastId });
                            }
                        } else {
                            const errData = await res.json().catch(() => ({}));
                            toast.error(errData.error || 'Failed to generate image', { id: toastId });
                        }
                        onImageGenerationPending?.(false);
                        break;
                    }

                    // ── VIDEO TABS: Creative director enhances prompt, then Veo 3.1 generates video ──
                    case 'product-video':
                    case 'advert':
                    case 'listing': {
                        // Primary: canvas design or selected image (what we animate). Reference: product image (optional).
                        const primaryImage = getSelectedImageSnapshot?.() || getCanvasSnapshot?.() || referenceImageUrl;
                        if (!primaryImage) {
                            toast.error('Select an image on the canvas, add one with +, or add a design first.');
                            break;
                        }
                        const toastId = toast.loading('Enhancing prompt with creative director...');
                        const contextualPrompt = buildContextualPrompt(trimmed, campaignBrief, brandSummary);
                        const primaryBase64 = primaryImage.includes(',') ? primaryImage.split(',')[1] : primaryImage;
                        const referenceBase64 = referenceImageUrl && referenceImageUrl !== primaryImage
                            ? (referenceImageUrl.includes(',') ? referenceImageUrl.split(',')[1] : referenceImageUrl)
                            : undefined;

                        // Creative director: Gemini thinking model enhances prompt for Veo
                        const enhanceRes = await fetch('/api/enhance-video-prompt', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sourceImageBase64: primaryBase64,
                                userPrompt: contextualPrompt,
                                videoType: activeMode,
                            }),
                        });
                        let enhancedPrompt = contextualPrompt;
                        if (enhanceRes.ok) {
                            const enhanceData = await enhanceRes.json();
                            if (enhanceData?.enhancedPrompt) {
                                enhancedPrompt = enhanceData.enhancedPrompt;
                            }
                        }

                        toast.loading('Generating video — this may take 1-2 minutes...', { id: toastId });
                        const videoRes = await fetch('/api/generate-video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sourceImageBase64: primaryBase64,
                                referenceImageBase64: referenceBase64,
                                prompt: enhancedPrompt,
                                videoType: activeMode,
                                aspectRatio: '16:9',
                            }),
                        });
                        if (!videoRes.ok) {
                            const errData = await videoRes.json().catch(() => ({}));
                            toast.error(errData.error || 'Failed to generate video', { id: toastId });
                            break;
                        }
                        const videoData = await videoRes.json();

                        if (videoData.status === 'completed' && videoData.videoUrl) {
                            onVideoGenerated?.(videoData.videoUrl);
                            toast.success('Video added to canvas!', { id: toastId });
                            break;
                        }

                        if (videoData.status === 'processing' && videoData.operationName) {
                            const operationName = videoData.operationName;
                            const MAX_POLLS = 60;
                            let pollCount = 0;

                            const poll = async (): Promise<void> => {
                                pollCount++;
                                if (pollCount > MAX_POLLS) {
                                    toast.error('Video generation timed out. Please try again.', { id: toastId });
                                    return;
                                }
                                try {
                                    const statusRes = await fetch(`/api/generate-video?operation=${encodeURIComponent(operationName)}`);
                                    if (!statusRes.ok) {
                                        toast.error('Failed to check video status', { id: toastId });
                                        return;
                                    }
                                    const statusData = await statusRes.json();

                                    if (statusData.status === 'completed') {
                                        if (statusData.videoUrl) {
                                            onVideoGenerated?.(statusData.videoUrl);
                                            toast.success('Video added to canvas!', { id: toastId });
                                        } else {
                                            toast.error(statusData.error || 'Video completed but no URL returned', { id: toastId });
                                        }
                                        return;
                                    }

                                    if (statusData.status === 'processing') {
                                        const progress = statusData.progress ? ` (${Math.round(statusData.progress * 100)}%)` : '';
                                        toast.loading(`Generating video${progress}...`, { id: toastId });
                                        await new Promise(r => setTimeout(r, 5000));
                                        return poll();
                                    }

                                    toast.error(statusData.error || 'Video generation failed', { id: toastId });
                                } catch (pollErr) {
                                    console.error('Poll error:', pollErr);
                                    toast.error('Lost connection while checking video status', { id: toastId });
                                }
                            };

                            await new Promise(r => setTimeout(r, 5000));
                            await poll();
                        } else {
                            toast.info(videoData.message || 'Video generation initiated', { id: toastId });
                        }
                        break;
                    }

                }
            } catch (err) {
                console.error('AI Panel error:', err);
                toast.error('Something went wrong. Please try again.');
                if (activeMode === 'image') onImageGenerationPending?.(false);
            } finally {
                setIsProcessing(false);
            }
        },
        [input, isProcessing, activeMode, onCanvasCommand, onImageGenerated, onVideoGenerated, onImageGenerationPending, getCanvasSnapshot, getSelectedImageSnapshot, campaignBrief, brandSummary, formatLabel, formatDimensions, referenceImageUrl]
    );

    const hasContext = !!(campaignBrief || brandSummary || formatLabel);

    // ── Render ──

    return (
        <div ref={panelRef} className={cn('w-full', className)}>
            <div
                className={cn(
                    'relative rounded-2xl border',
                    'bg-white/95 backdrop-blur-xl',
                    'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)] border-gray-200/80',
                )}
            >
                {/* Top bar: + button + Mode tabs + Context */}
                <div className="flex items-center justify-between px-1.5 pt-1.5 pb-0">
                    <div className="flex items-center gap-2">
                        {/* + Reference image button (top left) */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleReferenceFileChange}
                            className="hidden"
                            aria-label="Add reference image"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-dashed border-gray-300 flex-shrink-0"
                            title={activeMode !== 'image' ? 'Add source image for video' : 'Add reference image for generation'}
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                        {/* Mode tabs */}
                        <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-gray-50/80">
                        {modes.filter((m) => !videoOnly || m.id !== 'image').map((mode) => {
                            const Icon = mode.icon;
                            const isActive = activeMode === mode.id;
                            return (
                                <button
                                    key={mode.id}
                                    onClick={() => setActiveMode(mode.id)}
                                    className={cn(
                                        'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300',
                                        isActive
                                            ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] mode-indicator-active'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-white/50',
                                    )}
                                >
                                    <Icon className={cn('h-3 w-3 transition-colors duration-300', isActive && 'text-violet-600')} />
                                    {mode.label}
                                </button>
                            );
                        })}
                        </div>
                    </div>

                    {/* Right side: Context */}
                    <div className="flex items-center gap-1 pr-1">
                        {hasContext && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors">
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400 ai-orb-pulse" />
                                        Context
                                        <ChevronDown className="h-2.5 w-2.5" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-w-xs rounded-xl border-gray-200/80 shadow-lg">
                                    {formatLabel && (
                                        <DropdownMenuItem disabled className="text-xs opacity-100">
                                            <span className="text-gray-400 mr-1.5">Format:</span> {formatLabel}
                                        </DropdownMenuItem>
                                    )}
                                    {brandSummary && (
                                        <DropdownMenuItem disabled className="text-xs opacity-100 whitespace-normal">
                                            <span className="text-gray-400 mr-1.5">Brand:</span> {brandSummary.slice(0, 80)}...
                                        </DropdownMenuItem>
                                    )}
                                    {campaignBrief && (
                                        <DropdownMenuItem disabled className="text-xs opacity-100 whitespace-normal">
                                            <span className="text-gray-400 mr-1.5">Brief:</span> {campaignBrief.slice(0, 80)}...
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* Reference images area (below top bar, only when image added) */}
                {referenceImageUrl && (
                    <div className="px-3 pt-2 pb-2">
                        <div className="relative inline-block">
                            <img
                                src={referenceImageUrl}
                                alt="Reference"
                                className="h-10 w-10 rounded-lg object-cover border border-gray-200 shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setReferenceImageUrl(null)}
                                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 shadow-sm"
                                aria-label="Remove reference"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Input Area ── */}
                <form
                    onSubmit={handleSubmit}
                    className="flex items-end gap-2 px-3 py-3"
                >
                    <div className="flex-1 relative">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={currentMode.placeholder}
                            disabled={isProcessing}
                            rows={1}
                            className="w-full resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none scrollbar-hide min-h-[36px] max-h-[160px] py-2"
                            style={{ overflow: 'hidden' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                        />
                    </div>

                    {/* Send button */}
                    <button
                        type="submit"
                        disabled={isProcessing || !input.trim()}
                        className={cn(
                            'flex items-center justify-center h-8 w-8 rounded-xl flex-shrink-0 mb-0.5',
                            'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                            input.trim() && !isProcessing
                                ? 'bg-gray-900 text-white shadow-sm hover:bg-gray-800 hover:shadow-md scale-100'
                                : 'bg-gray-100 text-gray-400 scale-95',
                        )}
                    >
                        {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ArrowUp className="h-3.5 w-3.5" />
                        )}
                    </button>
                </form>

                {/* Subtle shimmer line at the top */}
                <div className="absolute top-0 left-4 right-4 h-[1px] ai-shimmer-border rounded-full" />
            </div>
        </div>
    );
}
