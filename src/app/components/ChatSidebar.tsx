'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
    Sparkles, Loader2, ArrowUp, Plus, RotateCcw, ChevronDown,
    Copy, MessageSquare, Palette, GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { InspectorSidebar } from "@/app/components/InspectorSidebar";

interface Message {
    role: "user" | "assistant";
    content: string;
    imageUrl?: string;
    timestamp?: number;
    id?: string;
    pendingImage?: boolean;
}

type ChatMode = "canvas" | "design" | "chat";

interface ImageGenerationPendingOptions {
    ratio?: string;
}

interface ChatSidebarProps {
    width: number;
    minWidth?: number;
    maxWidth?: number;
    onWidthChange: (width: number) => void;
    onImageGenerated: (imageUrl: string) => void;
    onImageGenerationPending?: (pending: boolean, options?: ImageGenerationPendingOptions) => void;
    currentImageUrl: string | null;
    onCanvasCommand?: (command: string) => Promise<string>;
    onProjectNameUpdate?: (name: string) => void;
    selectedObject?: any;
    fabricCanvas?: any;
}

// Helper functions
type GenerationCategory = "logo" | "poster" | "image";

const classifyIdea = (idea: string): GenerationCategory => {
    const text = idea.toLowerCase();
    if (/(logo|brand|wordmark|monogram|icon)/.test(text)) return "logo";
    if (/(poster|flyer|banner|cover|thumbnail|ad|social)/.test(text)) return "poster";
    return "image";
};

const extractKeywords = (idea: string): string[] => {
    const stopwords = new Set([
        "the", "a", "an", "and", "or", "of", "for", "to", "with", "in", "on", "at", "by", "from", "is", "are", "be", "make", "create", "design", "image", "poster", "logo", "please", "can", "you"
    ]);
    const words = idea
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w));
    const unique: string[] = [];
    for (const w of words) if (!unique.includes(w)) unique.push(w);
    return unique.slice(0, 15);
};

const buildRefinedPrompt = (
    idea: string,
    category: GenerationCategory,
    keywords: string[],
    isEdit: boolean,
    excludeText?: string,
    colors?: string[]
): string => {
    const role = category === "logo" ? "Logo design" : category === "poster" ? "Poster graphic" : "Image";
    const goal = isEdit ? "Refine the existing visual" : "Generate a new visual";
    const kw = keywords.length ? `Keywords: ${keywords.join(", ")}.` : "";
    const colorGuidance = colors && colors.length > 0 ? `Preferred color palette: ${colors.join(", ")}.` : "";
    const exclusions = excludeText && excludeText.trim() ? `Avoid including: ${excludeText.trim()}.` : "";
    return [
        `${role} — ${goal}.`,
        `Idea: ${idea}.`,
        kw,
        colorGuidance,
        exclusions,
        "Use balanced composition, coherent color harmony, and crisp details.",
    ].filter(Boolean).join("\n");
};

export default function ChatSidebar({
    width,
    minWidth = 280,
    maxWidth = 500,
    onWidthChange,
    onImageGenerated,
    onImageGenerationPending,
    currentImageUrl,
    onCanvasCommand,
    onProjectNameUpdate,
    selectedObject,
    fabricCanvas,
}: ChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [mode, setMode] = useState<ChatMode>("design");
    const [activeTab, setActiveTab] = useState<"chat" | "styles">("chat");
    const [hasSetProjectName, setHasSetProjectName] = useState(false);
    const [selectedRatio, setSelectedRatio] = useState<string>("1×1");
    const [selectedModel, setSelectedModel] = useState<string>("DALL-E 3");
    const [excludeText, setExcludeText] = useState<string>("");
    const [selectedColors, setSelectedColors] = useState<string[]>([]);

    // Resize state
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartX = useRef<number>(0);
    const resizeStartWidth = useRef<number>(0);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const pendingMessageIdsRef = useRef<Set<string>>(new Set());

    const generateMessageId = () =>
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const updatePendingStatus = (options?: ImageGenerationPendingOptions) => {
        if (onImageGenerationPending) {
            onImageGenerationPending(pendingMessageIdsRef.current.size > 0, options);
        }
    };

    const addPendingImageMessage = () => {
        const id = generateMessageId();
        pendingMessageIdsRef.current.add(id);
        updatePendingStatus({ ratio: selectedRatio });
        const pendingMessage: Message = {
            id,
            role: "assistant",
            content: "",
            pendingImage: true,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, pendingMessage]);
        return id;
    };

    const resolvePendingImageMessage = (id: string, imageUrl: string) => {
        setMessages(prev =>
            prev.map(msg =>
                msg.id === id ? { ...msg, imageUrl, pendingImage: false } : msg
            )
        );
        if (pendingMessageIdsRef.current.delete(id)) {
            updatePendingStatus();
        }
    };

    const removePendingImageMessage = (id: string) => {
        setMessages(prev => prev.filter(msg => msg.id !== id));
        if (pendingMessageIdsRef.current.delete(id)) {
            updatePendingStatus();
        }
    };

    const extractProjectName = (message: string): string => {
        const cleaned = message.trim();
        const words = cleaned.split(/\s+/).slice(0, 5);
        let name = words.join(' ');
        if (name.length > 50) {
            name = name.substring(0, 47) + '...';
        }
        name = name.charAt(0).toUpperCase() + name.slice(1);
        return name || "Untitled Project";
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = width;
    }, [width]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const deltaX = resizeStartX.current - e.clientX;
            const newWidth = Math.min(maxWidth, Math.max(minWidth, resizeStartWidth.current + deltaX));
            onWidthChange(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, minWidth, maxWidth, onWidthChange]);

    const handleSend = async () => {
        if (!input.trim()) {
            toast.error("Please enter a message");
            return;
        }

        const userMessage: Message = { role: "user", content: input, timestamp: Date.now() };

        if (!hasSetProjectName && onProjectNameUpdate) {
            const projectName = extractProjectName(input);
            onProjectNameUpdate(projectName);
            setHasSetProjectName(true);
        }

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsGenerating(true);

        try {
            if (mode === "canvas" && onCanvasCommand) {
                const response = await onCanvasCommand(userMessage.content);
                const assistantMessage: Message = {
                    role: "assistant",
                    content: response,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, assistantMessage]);
            } else {
                const res = await fetch('/api/design-wizard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phase: 'chat',
                        messages: messages.concat(userMessage),
                        preferences: {
                            exclude: (excludeText || "").trim() || undefined,
                            colors: selectedColors,
                        }
                    })
                });

                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();

                if (data.success && data.shouldGenerate) {
                    const pendingId = addPendingImageMessage();

                    try {
                        const category = classifyIdea(data.finalPrompt || userMessage.content);
                        const keywords = extractKeywords(data.finalPrompt || userMessage.content);
                        const refinedPrompt = buildRefinedPrompt(
                            data.finalPrompt || userMessage.content,
                            category,
                            keywords,
                            false,
                            excludeText,
                            selectedColors
                        );

                        const genRes = await fetch('/api/design-wizard', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                phase: 'chatImage',
                                prompt: refinedPrompt
                            })
                        });

                        if (!genRes.ok) {
                            removePendingImageMessage(pendingId);
                            throw new Error(await genRes.text());
                        }

                        const genData = await genRes.json();

                        if (genData?.imageUrl) {
                            resolvePendingImageMessage(pendingId, genData.imageUrl);
                            onImageGenerated(genData.imageUrl);
                            const confirmMessage: Message = {
                                role: "assistant",
                                content: "✨ Image created successfully! I've added it to your canvas.",
                                timestamp: Date.now()
                            };
                            setMessages(prev => [...prev, confirmMessage]);
                            toast.success("Image generated!");
                        } else {
                            removePendingImageMessage(pendingId);
                            throw new Error("No image URL in generation response");
                        }
                    } catch (err) {
                        if (pendingId) {
                            removePendingImageMessage(pendingId);
                        }
                        throw err;
                    }
                } else {
                    const assistantMessage: Message = {
                        role: "assistant",
                        content: data.message || "Tell me more about what you'd like to create.",
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            toast.error("Failed to process message");
            const errorMessage: Message = {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setInput("");
        setHasSetProjectName(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <div
            className="h-full flex flex-col bg-white/95 backdrop-blur-xl rounded-t-xl border border-gray-200/60 shadow-lg relative overflow-hidden"
            style={{ width: `${width}px` }}
        >
            {/* Resize Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[hsl(var(--sidebar-ring))]/30 transition-colors z-10 group rounded-l-xl"
                onMouseDown={handleResizeStart}
            >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-3 h-3 text-[hsl(var(--sidebar-ring))]" />
                </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100/80 bg-gray-50/30">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab("chat")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "chat"
                                ? "bg-white text-gray-900 shadow-sm border border-gray-200/60"
                                : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                            }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat
                    </button>
                    <button
                        onClick={() => setActiveTab("styles")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "styles"
                                ? "bg-white text-gray-900 shadow-sm border border-gray-200/60"
                                : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                            }`}
                    >
                        <Palette className="w-3.5 h-3.5" />
                        Styles
                    </button>
                </div>

                <div className="flex items-center gap-0.5">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-500 hover:text-gray-900 hover:bg-white/60 rounded-lg"
                        onClick={handleNewChat}
                        title="New chat"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-500 hover:text-gray-900 hover:bg-white/60 rounded-lg"
                        title="Refresh"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === "chat" ? (
                <>
                    <ScrollArea className="flex-1 px-4 py-4">
                        <div className="space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--sidebar-ring))]/10 to-[hsl(var(--sidebar-ring))]/5 flex items-center justify-center mb-4">
                                        <Sparkles className="w-5 h-5 text-[hsl(var(--sidebar-ring))]/60" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 mb-1">Start a conversation</p>
                                    <p className="text-xs text-gray-500">Ask me to create designs, images, or modify your canvas</p>
                                </div>
                            ) : (
                                messages.map((message, index) => (
                                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {message.role === 'user' ? (
                                            <div className="max-w-[85%] space-y-2">
                                                {message.imageUrl && (
                                                    <div className="rounded-lg border border-border overflow-hidden">
                                                        <img src={message.imageUrl} alt="Uploaded" className="w-full h-auto" />
                                                    </div>
                                                )}
                                                {message.content && (
                                                    <div className="rounded-xl px-3.5 py-2 bg-gray-200 text-gray-900 text-sm shadow-sm">
                                                        {message.content}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="max-w-[90%] space-y-2">
                                                {message.pendingImage && (
                                                    <div className="rounded-lg border border-border overflow-hidden bg-muted">
                                                        <Skeleton className="h-40 w-full" />
                                                    </div>
                                                )}
                                                {message.imageUrl && !message.pendingImage && (
                                                    <div className="rounded-lg border border-border overflow-hidden">
                                                        <img src={message.imageUrl} alt="Generated" className="w-full h-auto" />
                                                    </div>
                                                )}
                                                {message.content && (
                                                    <div className="space-y-2">
                                                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{message.content}</div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => copyToClipboard(message.content)}
                                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                                            >
                                                                <Copy className="w-3 h-3" />
                                                                Copy
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={bottomRef} />
                        </div>
                    </ScrollArea>

                    <div className="px-2 pb-4 pt-8">
                        <div className="rounded-xl border border-gray-200/60 bg-white shadow-sm overflow-hidden flex flex-col">
                            <div className="flex-1 relative">
                                <Textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="What would you like to create?"
                                    className="min-h-[72px] max-h-[180px] resize-none bg-transparent border-0 focus-visible:ring-0 focus:ring-0 focus-visible:ring-offset-0 focus:ring-offset-0 focus-visible:outline-none focus:outline-none focus:border-0 focus-visible:border-0 px-4 pt-3 pb-0 text-sm text-gray-900 placeholder:text-gray-400 w-full"
                                    disabled={isGenerating}
                                />
                                <div className="flex items-center justify-between px-4 pb-2.5 pt-1">
                                    <div className="flex items-center gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-xs rounded-lg"
                                                >
                                                    {mode === "design" ? "Design" : mode === "canvas" ? "Canvas" : "Chat"}
                                                    <ChevronDown className="w-3 h-3 ml-1" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={() => setMode("design")}>
                                                    Design Mode
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setMode("canvas")}>
                                                    Canvas Mode
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setMode("chat")}>
                                                    Chat Mode
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-xs rounded-lg"
                                                >
                                                    {selectedModel}
                                                    <ChevronDown className="w-3 h-3 ml-1" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={() => setSelectedModel("DALL-E 3")}>
                                                    DALL-E 3
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setSelectedModel("DALL-E 2")}>
                                                    DALL-E 2
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setSelectedModel("Stable Diffusion")}>
                                                    Stable Diffusion
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <Button
                                        onClick={handleSend}
                                        disabled={isGenerating || !input.trim()}
                                        size="icon"
                                        className="h-8 w-8 rounded-full bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ArrowUp className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-hidden relative">
                    {selectedObject && fabricCanvas ? (
                        <div className="h-full overflow-y-auto [&>*]:!fixed [&>*]:!top-auto [&>*]:!right-auto [&>*]:!left-auto [&>*]:!bottom-auto [&>*]:!relative [&>*]:!w-full [&>*]:!h-full [&>*]:!shadow-none [&>*]:!border-0">
                            <InspectorSidebar
                                selectedObject={selectedObject}
                                canvas={fabricCanvas}
                                onClose={() => {
                                    if (fabricCanvas) {
                                        fabricCanvas.discardActiveObject();
                                        fabricCanvas.requestRenderAll();
                                    }
                                }}
                                isClosing={false}
                                onImageEdit={() => {}}
                                onEnterPathEditMode={() => {}}
                                onExitPathEditMode={() => {}}
                                onCanvasCommand={onCanvasCommand || (async () => "")}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full p-4">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center mb-4 mx-auto">
                                    <Palette className="w-5 h-5 text-purple-600/60" />
                                </div>
                                <p className="text-sm font-medium text-gray-900 mb-1">Select an object to edit styles</p>
                                <p className="text-xs text-gray-500">Click on any object on the canvas</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
