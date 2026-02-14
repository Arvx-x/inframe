'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
    Sparkles, Loader2, ArrowUp, Plus, RotateCcw, ChevronDown,
    Copy, MessageSquare, Palette, GripVertical, PenTool, Link2, Play, Paperclip, FileText
} from "lucide-react";
import { toast } from "sonner";

// Helper function to parse asterisk-wrapped text into bold JSX
const parseBoldText = (text: string): (string | JSX.Element)[] => {
    if (!text) return [];
    const parts: (string | JSX.Element)[] = [];
    const regex = /\*([^*]+)\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        // Add bold text
        parts.push(<strong key={key++}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
    }
    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
};

interface MessageAttachment {
    url: string;
    name: string;
    type: string;
    /** Base64 for PDF/Word/txt - used by plan-chat API to extract text */
    base64?: string;
}

interface Message {
    role: "user" | "assistant";
    content: string;
    imageUrl?: string;
    attachments?: MessageAttachment[];
    timestamp?: number;
    id?: string;
    pendingImage?: boolean;
    isThinking?: boolean;
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
    onImageGenerated: (imageUrlOrUrls: string | string[]) => void;
    onImageGenerationPending?: (pending: boolean, options?: ImageGenerationPendingOptions) => void;
    currentImageUrl: string | null;
    onCanvasCommand?: (command: string) => Promise<string>;
    onProjectNameUpdate?: (name: string) => void;
    selectedObject?: any;
    fabricCanvas?: any;
    onAddInputNode?: () => void;
    onAddToolNode?: (kind: string) => void;
    onConnectNodes?: () => void;
    onRunTools?: () => void;
    /** When true (plan mode), hides design/canvas/chat mode buttons and shows attachment button */
    isPlanMode?: boolean;
    /** Called when plan-mode brief context changes (from uploaded docs + assistant summary) */
    onBriefContextChange?: (briefContext: string | null) => void;
    /** Campaign/plan brief context for enriching image generation prompts */
    campaignBrief?: string | null;
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
    onAddInputNode,
    onAddToolNode,
    onConnectNodes,
    onRunTools,
    isPlanMode = false,
    onBriefContextChange,
    campaignBrief,
}: ChatSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [mode, setMode] = useState<ChatMode>("design");
    const [activeTab, setActiveTab] = useState<"chat" | "tools">("chat");
    const [hasSetProjectName, setHasSetProjectName] = useState(false);
    const [selectedRatio, setSelectedRatio] = useState<string>("1×1");
    const [selectedModel, setSelectedModel] = useState<string>("DALL-E 3");
    const [excludeText, setExcludeText] = useState<string>("");
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [displayedText, setDisplayedText] = useState<Record<string, string>>({});
    const toolsAvailable = Boolean(onAddInputNode || onAddToolNode);
    const toolCategories = [
        {
            category: "Copywriting",
            color: "bg-blue-50 border-blue-200",
            tools: [
                { kind: "tool-brand-tagline", title: "Brand Tagline", description: "Turn rough copy into a punchy brand tagline." },
                { kind: "tool-ad-headline", title: "Ad Headline", description: "Generate attention-grabbing ad headlines." },
                { kind: "tool-product-shortener", title: "Copy Shortener", description: "Condense long descriptions into concise copy." },
                { kind: "tool-cta-generator", title: "CTA Generator", description: "Create compelling calls-to-action." },
            ],
        },
        {
            category: "Campaign & Strategy",
            color: "bg-purple-50 border-purple-200",
            tools: [
                { kind: "tool-campaign-hook", title: "Campaign Hook", description: "Generate a hook idea for your campaign." },
                { kind: "tool-audience-persona", title: "Audience Persona", description: "Build a target audience persona from a brief." },
                { kind: "tool-swot", title: "SWOT Analysis", description: "Generate strengths, weaknesses, opportunities, threats." },
                { kind: "tool-positioning", title: "Brand Positioning", description: "Craft a positioning statement from product info." },
            ],
        },
        {
            category: "Content & Social",
            color: "bg-green-50 border-green-200",
            tools: [
                { kind: "tool-social-caption", title: "Social Caption", description: "Write a social media caption from a brief." },
                { kind: "tool-hashtag", title: "Hashtag Generator", description: "Generate relevant hashtags for your content." },
                { kind: "tool-email-subject", title: "Email Subject Line", description: "Craft high-open-rate email subject lines." },
                { kind: "tool-blog-outline", title: "Blog Outline", description: "Create a structured blog post outline." },
            ],
        },
        {
            category: "Brand Identity",
            color: "bg-amber-50 border-amber-200",
            tools: [
                { kind: "tool-brand-voice", title: "Brand Voice", description: "Define tone and voice guidelines from examples." },
                { kind: "tool-name-generator", title: "Name Generator", description: "Brainstorm product or brand name ideas." },
                { kind: "tool-value-prop", title: "Value Proposition", description: "Distill a clear value proposition statement." },
                { kind: "tool-elevator-pitch", title: "Elevator Pitch", description: "Generate a concise elevator pitch." },
            ],
        },
    ];

    // Resize state
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartX = useRef<number>(0);
    const resizeStartWidth = useRef<number>(0);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const pendingMessageIdsRef = useRef<Set<string>>(new Set());
    const typingTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

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
    }, [messages, displayedText]);

    // Typing animation effect - initialize new messages
    useEffect(() => {
        messages.forEach((message) => {
            if (message.role === "assistant" && message.content && !message.pendingImage && !message.isThinking) {
                const messageId = message.id || `${message.timestamp}-${message.role}`;
                
                // Initialize if not started
                if (displayedText[messageId] === undefined) {
                    setDisplayedText((prev) => ({
                        ...prev,
                        [messageId]: "",
                    }));
                }
            }
        });
    }, [messages]);

    // Typing animation effect - continue animation (word-by-word like Cursor)
    useEffect(() => {
        const animateMessages = () => {
            messages.forEach((message) => {
                if (message.role === "assistant" && message.content && !message.pendingImage && !message.isThinking) {
                    const messageId = message.id || `${message.timestamp}-${message.role}`;
                    const fullText = message.content;
                    const currentDisplayed = displayedText[messageId] || "";
                    
                    if (currentDisplayed.length < fullText.length) {
                        // Clear any existing timer for this message
                        if (typingTimersRef.current[messageId]) {
                            clearTimeout(typingTimersRef.current[messageId]);
                        }

                        // Find the next word boundary
                        const remainingText = fullText.slice(currentDisplayed.length);
                        const nextSpaceIndex = remainingText.indexOf(' ');
                        const nextNewlineIndex = remainingText.indexOf('\n');
                        
                        // Determine chunk size: next word (with trailing space) or up to newline; if none, take remaining
                        let chunkSize = 1;
                        if (nextSpaceIndex !== -1 && (nextNewlineIndex === -1 || nextSpaceIndex < nextNewlineIndex)) {
                            chunkSize = nextSpaceIndex + 1; // Include the space
                        } else if (nextNewlineIndex !== -1) {
                            chunkSize = nextNewlineIndex + 1; // Include the newline
                        } else if (remainingText.length > 0) {
                            chunkSize = remainingText.length; // Last word
                        }

                        typingTimersRef.current[messageId] = setTimeout(() => {
                            setDisplayedText((prev) => {
                                const current = prev[messageId] || "";
                                if (current.length < fullText.length) {
                                    return {
                                        ...prev,
                                        [messageId]: fullText.slice(0, current.length + chunkSize),
                                    };
                                }
                                return prev;
                            });
                        }, 30); // Typing speed: 30ms per word/chunk (faster rollout)
                    }
                }
            });
        };

        animateMessages();

        // Cleanup function
        return () => {
            Object.values(typingTimersRef.current).forEach(timer => clearTimeout(timer));
        };
    }, [messages, displayedText]);

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
        const hasAttachments = messages.some(
            (m) => m.role === "user" && (m.imageUrl || (m.attachments?.length ?? 0) > 0)
        );
        const canSendPlanMode = isPlanMode && hasAttachments;
        if (!input.trim() && !canSendPlanMode) {
            toast.error("Please enter a message");
            return;
        }

        const userMessage: Message = { role: "user", content: input.trim() || "Please analyze the attached document(s).", timestamp: Date.now() };
        const thinkingId = generateMessageId();
        const thinkingMessage: Message = {
            id: thinkingId,
            role: "assistant",
            content: "Thinking...",
            timestamp: Date.now(),
            isThinking: true,
        };

        if (!hasSetProjectName && onProjectNameUpdate) {
            const projectName = extractProjectName(input);
            onProjectNameUpdate(projectName);
            setHasSetProjectName(true);
        }

        setMessages(prev => [...prev, userMessage, thinkingMessage]);
        setInput("");
        setIsGenerating(true);
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            if (isPlanMode) {
                const allMessages = messages.concat(userMessage);
                const chatMessages = allMessages.map((m) => ({
                    role: m.role,
                    content: m.role === "user"
                        ? (m.content || (m.imageUrl || m.attachments?.length ? "[User attached file(s)]" : ""))
                        : (m.content || ""),
                })).filter((m) => m.content);
                const attachmentFiles: { name: string; type: string; base64: string }[] = [];
                for (const m of allMessages) {
                    if (m.role !== "user") continue;
                    if (m.attachments) {
                        for (const a of m.attachments) {
                            if (a.base64 && !a.type.startsWith("image/")) {
                                attachmentFiles.push({ name: a.name, type: a.type, base64: a.base64 });
                            }
                        }
                    }
                }
                const res = await fetch("/api/plan-chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: chatMessages,
                        attachmentFiles: attachmentFiles.length > 0 ? attachmentFiles : undefined,
                    }),
                    signal,
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                const assistantMessage: Message = {
                    id: thinkingId,
                    role: "assistant",
                    content: data.message || "I'm here to help with planning. What would you like to explore?",
                    timestamp: Date.now(),
                };
                setDisplayedText((prev) => ({ ...prev, [thinkingId]: "" }));
                setMessages((prev) =>
                    prev.some((m) => m.id === thinkingId)
                        ? prev.map((m) => (m.id === thinkingId ? assistantMessage : m))
                        : [...prev, assistantMessage]
                );
            } else if (mode === "canvas" && onCanvasCommand) {
                const response = await onCanvasCommand(userMessage.content);
                const assistantMessage: Message = {
                    id: thinkingId,
                    role: "assistant",
                    content: response,
                    timestamp: Date.now(),
                };
                setDisplayedText(prev => ({ ...prev, [thinkingId]: "" }));
                setMessages(prev =>
                    prev.some(m => m.id === thinkingId)
                        ? prev.map(m => m.id === thinkingId ? assistantMessage : m)
                        : [...prev, assistantMessage]
                );
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
                    }),
                    signal,
                });

                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();

                if (data.success && data.shouldGenerate) {
                    setMessages(prev => prev.filter(m => m.id !== thinkingId));
                    setDisplayedText(prev => {
                        const next = { ...prev };
                        delete next[thinkingId];
                        return next;
                    });
                    const pendingId = addPendingImageMessage();
                    try {
                        const category = classifyIdea(data.finalPrompt || userMessage.content);
                        const keywords = extractKeywords(data.finalPrompt || userMessage.content);
                        let basePrompt = data.finalPrompt || userMessage.content;
                        // Enrich prompt with campaign/plan brief context if available
                        if (campaignBrief) {
                            basePrompt = `Campaign Brief: ${campaignBrief}\n\nDesign request: ${basePrompt}`;
                        }
                        const refinedPrompt = buildRefinedPrompt(
                            basePrompt,
                            category,
                            keywords,
                            false,
                            excludeText,
                            selectedColors
                        );
                        const genRes = await fetch('/api/design-wizard', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phase: 'chatImage', prompt: refinedPrompt }),
                            signal,
                        });
                        if (!genRes.ok) {
                            removePendingImageMessage(pendingId);
                            throw new Error(await genRes.text());
                        }
                        const genData = await genRes.json();
                        const imageUrls = genData?.imageUrls ?? (genData?.imageUrl ? [genData.imageUrl] : []);
                        if (imageUrls.length > 0) {
                            resolvePendingImageMessage(pendingId, imageUrls[0]);
                            onImageGenerated(imageUrls);
                            setMessages(prev => [...prev, {
                                role: "assistant",
                                content: imageUrls.length > 1
                                    ? `✨ ${imageUrls.length} images created successfully! I've added them to your canvas.`
                                    : "✨ Image created successfully! I've added it to your canvas.",
                                timestamp: Date.now()
                            }]);
                            toast.success(imageUrls.length > 1 ? `${imageUrls.length} images generated!` : "Image generated!");
                        } else {
                            removePendingImageMessage(pendingId);
                            throw new Error("No image URL in generation response");
                        }
                    } catch (err) {
                        if (pendingId) removePendingImageMessage(pendingId);
                        throw err;
                    }
                } else {
                    const assistantMessage: Message = {
                        id: thinkingId,
                        role: "assistant",
                        content: data.message || "Tell me more about what you'd like to create.",
                        timestamp: Date.now()
                    };
                    setDisplayedText(prev => ({ ...prev, [thinkingId]: "" }));
                    setMessages(prev =>
                        prev.some(m => m.id === thinkingId)
                            ? prev.map(m => m.id === thinkingId ? assistantMessage : m)
                            : [...prev, assistantMessage]
                    );
                }
            }
        } catch (error) {
            const isAborted = error instanceof Error && error.name === "AbortError";
            if (!isAborted) {
                console.error('Chat error:', error);
                toast.error("Failed to process message");
            } else {
                toast.info("Stopped");
            }
            const errorMessage: Message = {
                role: "assistant",
                content: isAborted ? "Generation stopped." : "Sorry, I encountered an error. Please try again.",
                timestamp: Date.now()
            };
            setMessages(prev => [
                ...prev.filter(m => m.id !== thinkingId),
                errorMessage
            ]);
            setDisplayedText(prev => {
                const next = { ...prev };
                delete next[thinkingId];
                return next;
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
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
        onBriefContextChange?.(null);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.includes(",") ? result.split(",")[1]! : result;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;
        try {
            const attachments: MessageAttachment[] = [];
            let imageUrl: string | undefined;
            const briefFiles: { name: string; type: string; base64: string }[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const url = URL.createObjectURL(file);
                const att: MessageAttachment = { url, name: file.name, type: file.type };
                if (file.type.startsWith("image/")) {
                    if (!imageUrl) imageUrl = url;
                    else attachments.push(att);
                } else {
                    if (isPlanMode) {
                        try {
                            att.base64 = await fileToBase64(file);
                            briefFiles.push({ name: file.name, type: file.type, base64: att.base64 });
                        } catch {
                            toast.error(`Could not read ${file.name}`);
                        }
                    }
                    attachments.push(att);
                }
            }
            if (imageUrl || attachments.length > 0) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "user",
                        content: "",
                        imageUrl,
                        attachments: attachments.length > 0 ? attachments : undefined,
                        timestamp: Date.now(),
                    },
                ]);
                let briefStored = false;
                if (isPlanMode && onBriefContextChange && briefFiles.length > 0) {
                    try {
                        const res = await fetch("/api/extract-brief", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ attachmentFiles: briefFiles }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data?.text) {
                                onBriefContextChange(data.text);
                                briefStored = true;
                            }
                        }
                    } catch {
                        // Non-blocking; context will still be available when user chats
                    }
                }

                toast.success(
                    briefStored
                        ? "Brief attached and stored as context"
                        : imageUrl && attachments.length
                            ? "Files attached"
                            : imageUrl
                                ? "Image attached"
                                : "File attached"
                );
            }
        } catch {
            toast.error("Failed to attach file");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
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
                        onClick={() => setActiveTab("tools")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "tools"
                                ? "bg-white text-gray-900 shadow-sm border border-gray-200/60"
                                : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                            }`}
                    >
                        <Palette className="w-3.5 h-3.5" />
                        Tools
                    </button>
                </div>

                <div className="flex items-center gap-0.5">
                    {campaignBrief && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-white/60 transition-colors"
                                    title="Brief context stored for image generation"
                                >
                                    <FileText className="h-3.5 w-3.5 text-[hsl(var(--sidebar-ring))]" />
                                    <span className="hidden sm:inline">Context</span>
                                    <ChevronDown className="h-2.5 w-2.5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-w-sm rounded-xl border-gray-200/80 shadow-lg">
                                <DropdownMenuItem disabled className="text-xs opacity-100 whitespace-normal">
                                    <span className="text-gray-400 mr-1.5">Brief:</span> {campaignBrief.slice(0, 120)}{campaignBrief.length > 120 ? "..." : ""}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
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
                    <ScrollArea className="flex-1 px-4 pt-4 pb-0">
                        <div className="space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--sidebar-ring))]/10 to-[hsl(var(--sidebar-ring))]/5 flex items-center justify-center mb-4">
                                        <Sparkles className="w-5 h-5 text-[hsl(var(--sidebar-ring))]/60" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 mb-1">
                                        {isPlanMode ? "Plan your campaign" : "Start a conversation"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {isPlanMode
                                            ? "Attach briefs (PDF, Word), brainstorm ideas, or ask about ADs and visual campaigns"
                                            : "Ask me to create designs, images, or modify your canvas"}
                                    </p>
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
                                                {message.attachments?.map((att, i) =>
                                                    att.type.startsWith("image/") ? (
                                                        <div key={i} className="rounded-lg border border-border overflow-hidden">
                                                            <img src={att.url} alt={att.name} className="w-full h-auto max-w-xs" />
                                                        </div>
                                                    ) : (
                                                        <a
                                                            key={i}
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-100"
                                                        >
                                                            <Paperclip className="w-3 h-3 text-gray-500" />
                                                            {att.name}
                                                        </a>
                                                    )
                                                )}
                                                {message.content && (
                                                    <div className="rounded-xl px-3.5 py-2 bg-gray-200 text-gray-900 text-[13px] shadow-sm">
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
                                                        <div className={`text-[13px] whitespace-pre-wrap leading-snug ${message.isThinking ? "text-gray-400 animate-thinking" : "text-gray-800"}`}>
                                                            {(() => {
                                                                const messageId = message.id || `${message.timestamp}-${message.role}`;
                                                                if (message.isThinking) return message.content;
                                                                const hasDisplayed = Object.prototype.hasOwnProperty.call(displayedText, messageId);
                                                                const displayed = hasDisplayed ? displayedText[messageId] : "";
                                                                const textToRender = message.role === "assistant" 
                                                                    ? (displayed ?? "")
                                                                    : (displayed || message.content);
                                                                return parseBoldText(textToRender);
                                                            })()}
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

                    <div className="px-3 pb-3 pt-0 mt-4">
                        <div className="rounded-xl border border-gray-200/60 bg-gray-50/50 shadow-sm overflow-hidden flex flex-col">
                            <div className="flex-1 relative">
                                <Textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder={isPlanMode ? "Attach a brief, ask questions, or brainstorm ideas..." : "What would you like to create?"}
                                    className="min-h-[56px] max-h-[180px] resize-none bg-transparent border-0 focus-visible:ring-0 focus:ring-0 focus-visible:ring-offset-0 focus:ring-offset-0 focus-visible:outline-none focus:outline-none focus:border-0 focus-visible:border-0 px-4 pt-3.5 pb-0 text-[13px] text-gray-900 placeholder:text-gray-400 w-full"
                                    disabled={isGenerating}
                                />
                                <div className="flex items-center justify-between pl-2 pr-2 pb-2.5 pt-1">
                                    <div className="flex items-center gap-2">
                                        {isPlanMode ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                                                    onClick={handleUploadClick}
                                                    title="Attach images, files, PDFs"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                </Button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*,.pdf,.doc,.docx,.txt"
                                                    multiple
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                />
                                            </>
                                        ) : (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-[11px] rounded-lg flex items-center gap-1"
                                                    >
                                                        {mode === "design" ? (
                                                            <>
                                                                <Palette className="w-3 h-3" />
                                                                Design
                                                            </>
                                                        ) : mode === "canvas" ? (
                                                            <>
                                                                <PenTool className="w-3 h-3" />
                                                                Canvas
                                                            </>
                                                        ) : (
                                                            <>
                                                                <MessageSquare className="w-3 h-3" />
                                                                Chat
                                                            </>
                                                        )}
                                                        <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
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
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 ml-auto">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 text-[11px] rounded-lg"
                                                >
                                                    {selectedModel}
                                                    <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
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

                                        <Button
                                            onClick={isGenerating ? handleStop : handleSend}
                                            disabled={
                                                !isGenerating &&
                                                (!input.trim() &&
                                                    !(isPlanMode &&
                                                        messages.some(
                                                            (m) =>
                                                                m.role === "user" &&
                                                                (m.imageUrl || (m.attachments?.length ?? 0) > 0)
                                                        )))
                                            }
                                            size="icon"
                                            className="h-7 w-7 rounded-full bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={isGenerating ? "Stop" : "Send"}
                                        >
                                            {isGenerating ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <ArrowUp className="w-3.5 h-3.5" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 overflow-hidden relative">
                    {toolsAvailable ? (
                        <ScrollArea className="h-full px-4 py-4">
                            <div className="space-y-5">
                                {/* Input node */}
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Input</p>
                                    <button
                                        onClick={() => onAddInputNode?.()}
                                        className="w-full flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-amber-100/60 transition"
                                    >
                                        <span>Text Input</span>
                                        <Plus className="h-4 w-4 text-gray-500" />
                                    </button>
                                </div>

                                {/* Tool categories */}
                                {toolCategories.map((cat) => (
                                    <div key={cat.category} className="space-y-2">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{cat.category}</p>
                                        <div className="space-y-1.5">
                                            {cat.tools.map((tool) => (
                                                <button
                                                    key={tool.kind}
                                                    onClick={() => onAddToolNode?.(tool.kind)}
                                                    className={`w-full text-left rounded-xl border px-3 py-2 hover:shadow-sm transition group ${cat.color}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[13px] font-semibold text-gray-900">{tool.title}</p>
                                                        <Plus className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{tool.description}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {/* Actions */}
                                <div className="space-y-2 pt-1">
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</p>
                                    <div className="flex flex-col gap-1.5">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="justify-start gap-2 rounded-lg h-8 text-xs"
                                            onClick={() => onConnectNodes?.()}
                                        >
                                            <Link2 className="h-3.5 w-3.5" />
                                            Connect selected nodes
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="justify-start gap-2 rounded-lg h-8 text-xs"
                                            onClick={() => onRunTools?.()}
                                        >
                                            <Play className="h-3.5 w-3.5" />
                                            Run selected tools
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-gray-400 leading-snug">
                                        Drag from a connector dot to link nodes, or select two nodes and click Connect. Then Run to generate output.
                                    </p>
                                </div>
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="flex items-center justify-center h-full p-4">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center mb-4 mx-auto">
                                    <Palette className="w-5 h-5 text-purple-600/60" />
                                </div>
                                <p className="text-sm font-medium text-gray-900 mb-1">Tools tab</p>
                                <p className="text-xs text-gray-500">Tools are not available in this studio</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
