'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Sparkles, Loader2, ArrowUp, Wand2, ImagePlus, Zap, Brain, PenTool, Plus, Undo2, Redo2 } from "lucide-react";
// Calls go to local Next.js API routes instead of Supabase Edge Functions
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  timestamp?: number;
}

type ChatMode = "canvas" | "design";
type GenerationCategory = "logo" | "poster" | "image";

const classifyIdea = (idea: string): GenerationCategory => {
  const text = idea.toLowerCase();
  if (/(logo|brand|wordmark|monogram|icon)/.test(text)) return "logo";
  if (/(poster|flyer|banner|cover|thumbnail|ad|social)/.test(text)) return "poster";
  return "image";
};

const extractKeywords = (idea: string): string[] => {
  const stopwords = new Set([
    "the","a","an","and","or","of","for","to","with","in","on","at","by","from","is","are","be","make","create","design","image","poster","logo","please","can","you"
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
  isEdit: boolean
): string => {
  const role = category === "logo" ? "Logo design" : category === "poster" ? "Poster graphic" : "Image";
  const goal = isEdit ? "Refine the existing visual" : "Generate a new visual";
  const kw = keywords.length ? `Keywords: ${keywords.join(", ")}.` : "";
  return [
    `${role} — ${goal}.`,
    `Idea: ${idea}.`,
    kw,
    "Use balanced composition, coherent color harmony, and crisp details.",
  ].filter(Boolean).join("\n");
};

interface PromptSidebarProps {
  onImageGenerated: (imageUrl: string) => void;
  currentImageUrl: string | null;
  onCanvasCommand?: (command: string) => Promise<string>;
  onCanvasUndo?: () => void;
  onCanvasRedo?: () => void;
  showHistoryControls?: boolean;
}

export default function PromptSidebar({ onImageGenerated, currentImageUrl, onCanvasCommand, onCanvasUndo, onCanvasRedo, showHistoryControls = false }: PromptSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<ChatMode>("design");
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [maxTextareaHeight, setMaxTextareaHeight] = useState<number>(0);
  const resizeTextareaEl = (el: HTMLTextAreaElement) => {
    if (!el) return;
    el.style.height = 'auto';
    const desired = el.scrollHeight;
    const maxH = maxTextareaHeight || desired;
    const clamped = Math.min(desired, maxH);
    el.style.height = `${clamped}px`;
    el.style.overflowY = desired > clamped ? 'auto' : 'hidden';
    if (desired > clamped) {
      el.scrollTop = el.scrollHeight;
    }
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Guided wizard state (keeps chat UI unchanged)
  type WizardPhase = "interview" | "directions" | "refinement";
  const [wizardPhase, setWizardPhase] = useState<WizardPhase>("interview");
  const [guidedConversation, setGuidedConversation] = useState<Message[]>([]);
  const [wizardKeywords, setWizardKeywords] = useState<any | null>(null);
  const [wizardDirections, setWizardDirections] = useState<any[]>([]);
  
  // Use NEXT_PUBLIC_PROJECT_NAME in Next; fall back to document.title if available
  const projectName =
    process.env.NEXT_PUBLIC_PROJECT_NAME ||
    (typeof document !== 'undefined' ? (document.title?.split(' - ')[0] || document.title) : '') ||
    'Project';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isGenerating]);

  // Auto-grow textarea with max height = 50% of sidebar height; keep bottom in view
  useEffect(() => {
    const recomputeMax = () => {
      const h = containerRef.current?.clientHeight || 0;
      if (h > 0) setMaxTextareaHeight(Math.floor(h * 0.5));
    };
    recomputeMax();
    window.addEventListener('resize', recomputeMax);
    return () => window.removeEventListener('resize', recomputeMax);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Ensure min-height is enforced before measuring to avoid collapsing due to padding
    el.style.minHeight = '112px';
    resizeTextareaEl(el);
  }, [input, maxTextareaHeight, mode]);

  const handleSend = async () => {
    if (!input.trim()) {
      toast.error("Please enter a message");
      return;
    }

    const userMessage: Message = { role: "user", content: input, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    if (mode === 'design' && isGuidedMode) {
      // Keep a parallel guided conversation log
      setGuidedConversation(prev => [...prev, userMessage]);
    }
    setInput("");
    setIsGenerating(true);

    try {
      if (mode === "canvas") {
        // Canvas mode - send command to canvas
        if (!onCanvasCommand) {
          throw new Error("Canvas command handler not available");
        }
        
        const response = await onCanvasCommand(userMessage.content);
        const assistantMessage: Message = {
          role: "assistant",
          content: response,
          timestamp: Date.now()
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (mode === "design") {
        if (isGuidedMode) {
          // Guided: conversational wizard inside chat
          if (wizardPhase === 'interview') {
            const res = await fetch('/api/design-wizard', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phase: 'interview', messages: guidedConversation.concat(userMessage) })
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const assistantMessage: Message = { role: 'assistant', content: data.message, timestamp: Date.now() };
            setMessages(prev => [...prev, assistantMessage]);
            setGuidedConversation(prev => [...prev, assistantMessage]);
            // Heuristic: after some turns, progress to keywords/directions
            if (guidedConversation.length >= 6 || /got it/i.test(data.message)) {
              const extracted = await runExtractKeywords(guidedConversation.concat(userMessage, assistantMessage));
              await runGenerateDirections(extracted, guidedConversation.concat(userMessage, assistantMessage));
            }
          } else if (wizardPhase === 'directions') {
            // Only generate when user explicitly picks a different direction (by number or name)
            const picks = getDirectionIndicesFromInput(userMessage.content);
            if (picks.length === 0) {
              const assistantMessage: Message = { role: 'assistant', content: 'Want to refine or generate more? You can say “refine in same style” or pick another direction by number or name (e.g., 2 or "Minimal Horizon").', timestamp: Date.now() };
              setMessages(prev => [...prev, assistantMessage]);
              setGuidedConversation(prev => [...prev, assistantMessage]);
              setWizardPhase('refinement');
            } else {
              // Generate variants via direction -> multi-model-generation
              const chosen = picks
                .map((i) => wizardDirections[i])
                .filter(Boolean);
              if (chosen.length > 0) {
                const direction = chosen[0];
                const basePrompt = `${wizardKeywords?.useCase || 'image'} with ${(wizardKeywords?.tone || []).join(', ')}`;
                const mmgRes = await fetch('/api/design-wizard', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phase: 'generateFromDirection', direction, basePrompt })
                });
                if (!mmgRes.ok) throw new Error(await mmgRes.text());
                const mmgData = await mmgRes.json();
                const variants = mmgData?.variants || [];
                for (const v of variants) {
                  if (v?.imageUrl) {
                    onImageGenerated(v.imageUrl);
                    setMessages((prev) => [
                      ...prev,
                      { role: 'assistant', imageUrl: v.imageUrl, content: '', timestamp: Date.now() }
                    ]);
                  }
                }
              }
              const assistantMessage: Message = { role: 'assistant', content: 'Added selected visuals to canvas. Want to refine or generate more?', timestamp: Date.now() };
              setMessages(prev => [...prev, assistantMessage]);
              setGuidedConversation(prev => [...prev, assistantMessage]);
              setWizardPhase('refinement');
            }
          } else if (wizardPhase === 'refinement') {
            // Support iterative refinements within the same style when user says "refine"
            const wantsRefine = /refine|improve|tweak|adjust/i.test(userMessage.content);
            const picks = getDirectionIndicesFromInput(userMessage.content);
            const useSameStyle = wantsRefine && picks.length === 0;
            if (useSameStyle) {
              const refineRes = await fetch('/api/design-wizard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase: 'refine', messages: guidedConversation.concat(userMessage), selectedImages: [] })
              });
              if (!refineRes.ok) throw new Error(await refineRes.text());
              const refineData = await refineRes.json();
              const basePrompt = refineData?.data?.updatedPrompt || `${wizardKeywords?.useCase || 'image'} with ${(wizardKeywords?.tone || []).join(', ')}`;
              const genRes = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: basePrompt })
              });
              if (genRes.ok) {
                const genData = await genRes.json();
                if (genData?.imageUrl) {
                  onImageGenerated(genData.imageUrl);
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', imageUrl: genData.imageUrl, content: '', timestamp: Date.now() }
                  ]);
                }
              }
              const assistantMessage: Message = { role: 'assistant', content: 'Refined the style and added a new variation. Want to refine again or switch to another direction?', timestamp: Date.now() };
              setMessages(prev => [...prev, assistantMessage]);
              setGuidedConversation(prev => [...prev, assistantMessage]);
            } else if (picks.length > 0) {
              // Switch to another direction only when user explicitly names/numbers it
              const refineRes2 = await fetch('/api/design-wizard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase: 'refine', messages: guidedConversation.concat(userMessage), selectedImages: picks.map(String) })
              });
              if (!refineRes2.ok) throw new Error(await refineRes2.text());
              const refineData = await refineRes2.json();
              const basePrompt = refineData?.data?.updatedPrompt || `${wizardKeywords?.useCase || 'image'} with ${(wizardKeywords?.tone || []).join(', ')}`;
              for (const _ of picks) {
                const genRes = await fetch('/api/generate-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: basePrompt })
                });
                if (genRes.ok) {
                  const genData = await genRes.json();
                  if (genData?.imageUrl) {
                    onImageGenerated(genData.imageUrl);
                    setMessages((prev) => [
                      ...prev,
                      { role: 'assistant', imageUrl: genData.imageUrl, content: '', timestamp: Date.now() }
                    ]);
                  }
                }
              }
              const assistantMessage: Message = { role: 'assistant', content: 'Added visuals for the chosen direction. Want to refine or pick another?', timestamp: Date.now() };
              setMessages(prev => [...prev, assistantMessage]);
              setGuidedConversation(prev => [...prev, assistantMessage]);
            } else {
              const assistantMessage: Message = { role: 'assistant', content: 'Tell me “refine in same style” or specify a direction number/name.', timestamp: Date.now() };
              setMessages(prev => [...prev, assistantMessage]);
              setGuidedConversation(prev => [...prev, assistantMessage]);
            }
          }
        } else {
          // Quick create mode - route through dedicated image endpoint
          const quickRes = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userMessage.content, isEdit: !!currentImageUrl, currentImageUrl })
          });
          if (!quickRes.ok) throw new Error(await quickRes.text());
          const data = await quickRes.json();
          if (!data?.imageUrl) throw new Error("No image URL returned");

          onImageGenerated(data.imageUrl);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", imageUrl: data.imageUrl, content: "", timestamp: Date.now() },
          ]);
          toast.success("Image generated!");
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : mode === "canvas" ? "Failed to execute command" : "Failed to generate image");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
    }
  };

  // Click handler: choose a direction card to generate multiple variants
  const handleChooseDirection = async (index: number) => {
    if (index < 0 || index >= wizardDirections.length) return;
    const direction = wizardDirections[index];
    try {
      setIsGenerating(true);
      const basePrompt = `${wizardKeywords?.useCase || 'image'} with ${(wizardKeywords?.tone || []).join(', ')}`;
      const mmgRes = await fetch('/api/design-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'generateFromDirection', direction, basePrompt })
      });
      if (!mmgRes.ok) throw new Error(await mmgRes.text());
      const mmgData = await mmgRes.json();
      const variants = mmgData?.variants || [];
      let added = 0;
      for (const v of variants) {
        if (v?.imageUrl) {
          onImageGenerated(v.imageUrl);
          added++;
        }
      }
      const assistantMessage: Message = { role: 'assistant', content: added > 0 ? `Generated ${added} variant(s) for “${direction?.name || 'selection'}”.` : 'No images returned. Try again or pick another direction.', timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMessage]);
      setGuidedConversation(prev => [...prev, assistantMessage]);
      setWizardPhase('refinement');
    } catch (err) {
      console.error('Direction generation error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate variants');
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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("Only image files are supported");
      return;
    }
    const url = URL.createObjectURL(file);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: '', imageUrl: url, timestamp: Date.now() }
    ]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper: extract keywords from conversation
  const runExtractKeywords = async (conversationMessages: Message[]) => {
    const res = await fetch('/api/design-wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'extract', messages: conversationMessages })
    });
    if (!res.ok) throw new Error(await res.text());
    const payload = await res.json();
    setWizardKeywords(payload.data);
    return payload.data;
  };

  // Helper: generate directions using extracted keywords
  const runGenerateDirections = async (extracted: any, conversationMessages: Message[]) => {
    const res = await fetch('/api/design-wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: 'directions',
        messages: [
          ...conversationMessages,
          { role: 'assistant', content: JSON.stringify(extracted) },
        ],
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const payload = await res.json();
    const directions = payload.data?.directions || [];
    setWizardDirections(directions);
    setWizardPhase('directions');
    // Post directions into chat as a summary
    const summary = directions
      .map((d: any, idx: number) => `${idx + 1}. ${d.name}`)
      .join('\n');
    const assistantMessage: Message = {
      role: 'assistant',
      content: `I've created ${directions.length} design directions. Reply with the numbers to generate visuals (e.g., 1 or 1,3):\n\n${summary}`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, assistantMessage]);
    setGuidedConversation(prev => [...prev, assistantMessage]);
  };

  // Helper: parse direction picks from free text (supports numbers and name substrings)
  const getDirectionIndicesFromInput = (text: string): number[] => {
    const picks: number[] = [];
    const nums = (text.match(/\d+/g) || []).map((n) => parseInt(n, 10) - 1);
    nums.forEach((i) => { if (i >= 0 && i < wizardDirections.length) picks.push(i); });
    const lower = text.toLowerCase();
    wizardDirections.forEach((d: any, idx: number) => {
      const name = String(d.name || '').toLowerCase();
      if (name && lower.includes(name) && !picks.includes(idx)) picks.push(idx);
    });
    return picks;
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-background border-r border-border flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300 ${
              mode === "design" ? "bg-primary" : "bg-foreground"
            }`}>
              {mode === "design" ? (
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              ) : (
                <Zap className="w-5 h-5 text-background" />
              )}
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">{projectName}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === "design" ? "Design Mode • Quick create" : "Canvas command agent"}
              </p>
            </div>
          </div>
          <div className={`text-xs px-2 py-1 rounded-full border transition-all duration-300 ${
            mode === "design" 
              ? "text-muted-foreground bg-muted/40" 
              : "text-foreground bg-accent font-medium"
          }`}>
            {mode === "design" 
              ? "Quick Create"
              : "Active Agent"
            }
          </div>
        </div>
        
        {/* Mode Switcher */}
        <div className="mt-4 flex items-center gap-1 p-1 bg-muted/40 rounded-lg border">
          <button
            onClick={() => setMode("design")}
            className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-md text-xs font-medium transition-all duration-300 ${
              mode === "design"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Design
          </button>
          <button
            onClick={() => setMode("canvas")}
            className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-md text-xs font-medium transition-all duration-300 ${
              mode === "canvas"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Canvas
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm transition-all duration-300 ${
              mode === "design" ? "bg-primary/10" : "bg-foreground/10"
            }`}>
              {mode === "design" ? (
                <Sparkles className="w-8 h-8 text-primary" />
              ) : (
                <Zap className="w-8 h-8 text-foreground" />
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {mode === "design" ? "Quick Design Mode" : "Command the canvas"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {mode === "design" 
                ? "Describe what to create and get instant results. Click the pen icon for guided wizard mode."
                : "Tell the canvas what to do in natural language. Align, move, resize, add elements."
              }
            </p>
            <div className="mt-5 flex flex-wrap gap-2 max-w-sm justify-center">
              {mode === "design" ? [
                { icon: <Wand2 className="w-3.5 h-3.5" />, text: "Minimal logo for 'Stryde'" },
                { icon: <ImagePlus className="w-3.5 h-3.5" />, text: "Poster for jazz night, bold retro" },
                { icon: <Sparkles className="w-3.5 h-3.5" />, text: "Neon cyberpunk city at dusk" },
              ].map((chip, i) => (
                <button
                  key={i}
                  onClick={() => setInput(chip.text)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-muted transition shadow-sm inline-flex items-center gap-1"
                >
                  {chip.icon}
                  {chip.text}
                </button>
              )) : [
                { icon: <Zap className="w-3.5 h-3.5" />, text: "Center everything" },
                { icon: <Zap className="w-3.5 h-3.5" />, text: "Move logo to top-left" },
                { icon: <Zap className="w-3.5 h-3.5" />, text: "Make images smaller" },
              ].map((chip, i) => (
                <button
                  key={i}
                  onClick={() => setInput(chip.text)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-muted transition shadow-sm inline-flex items-center gap-1"
                >
                  {chip.icon}
                  {chip.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[880px] space-y-4">
            {messages.map((message, index) => (
              <div key={index} className="space-y-1.5">
                {message.role === "user" ? (
                  <div className="space-y-2">
                    {message.imageUrl && (
                      <div className="rounded-md border border-border overflow-hidden inline-block max-w-xs">
                        <img src={message.imageUrl} alt="Uploaded" className="w-full h-auto" />
                      </div>
                    )}
                    {message.content && (
                      <div className="rounded-md border border-border bg-muted/60 px-3 py-2 font-inter text-[13px] text-foreground whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {message.imageUrl && (
                      <div className="rounded-md border border-border overflow-hidden inline-block max-w-xs">
                        <img src={message.imageUrl} alt="Generated" className="w-full h-auto" />
                      </div>
                    )}
                    {message.content && (
                      <div className="text-sm leading-6 text-foreground whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>
                )}
                {message.timestamp && (
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            ))}

            {/* Clickable design directions list */}
            {isGuidedMode && wizardPhase === 'directions' && wizardDirections.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Choose a design direction:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {wizardDirections.map((d: any, idx: number) => (
                    <button
                      key={d?.id || idx}
                      onClick={() => handleChooseDirection(idx)}
                      className="text-left rounded-md border border-border bg-white hover:bg-muted transition p-3 shadow-sm"
                    >
                      <div className="font-semibold">{d?.name || `Direction ${idx + 1}`}</div>
                      {d?.rationale && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{d.rationale}</div>
                      )}
                      {(Array.isArray(d?.moodKeywords) && d.moodKeywords.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {d.moodKeywords.slice(0, 5).map((mk: string, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/60">{mk}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Composer */}
      <div className="p-4 transition-all duration-300">
        <div className="mx-auto max-w-[880px]">
          {showHistoryControls && (
            <div className="mb-2 flex items-center gap-2 justify-end">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 rounded-md"
                onClick={onCanvasUndo}
                title="Undo (Ctrl/Cmd+Z)"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                Undo
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 rounded-md"
                onClick={onCanvasRedo}
                title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4 mr-1" />
                Redo
              </Button>
            </div>
          )}
          <div className={`rounded-xl border shadow-sm focus-within:ring-2 transition-all duration-300 ${
            mode === "design"
              ? "border-blue-200/50 bg-muted/70 bg-[linear-gradient(to_bottom_right,rgba(59,130,246,0.08),transparent)] focus-within:ring-blue-400/25"
              : "border-blue-300/50 bg-muted/80 bg-[linear-gradient(to_bottom_right,rgba(59,130,246,0.10),transparent)] focus-within:ring-blue-500/25"
          }`}>
            <div className="relative">
              {/* Left buttons */}
              <div className="absolute left-2 bottom-2 flex items-center gap-2">
                <Button
                  onClick={handleUploadClick}
                  size="icon"
                  className="h-6 w-6 p-0 rounded-full shadow-sm bg-muted text-foreground hover:bg-muted/90 border border-border"
                  title="Upload image"
                >
                  <Plus className="w-3 h-3" />
                </Button>
                {mode === "design" && (
                  <Button
                    onClick={() => { setIsGuidedMode(!isGuidedMode); setWizardPhase('interview'); setGuidedConversation([]); setWizardDirections([]); setWizardKeywords(null); }}
                    size="icon"
                    className={`h-6 w-6 p-0 rounded-full shadow-sm border transition-all duration-300 ${
                      isGuidedMode 
                        ? "bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-transparent ring-2 ring-blue-400/30" 
                        : "bg-muted text-foreground hover:bg-muted/90 border-border"
                    }`}
                    title={isGuidedMode ? "Guided wizard mode active" : "Enable guided wizard mode"}
                  >
                    <PenTool className="w-3 h-3" />
                  </Button>
                )}
                <span className="text-[10px] text-muted-foreground">Press Shift + Enter for new line</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Resize immediately on keystroke so height grows before wrapping
                  if (textareaRef.current) resizeTextareaEl(textareaRef.current);
                }}
                onKeyDown={handleKeyPress}
                placeholder={
                  mode === "design" ? "Describe what to create..." : "Tell the canvas what to do..."
                }
                className="min-h-[112px] resize-none bg-transparent border-0 focus-visible:ring-0 pl-4 pr-16 pt-4 pb-12 placeholder:text-muted-foreground/80"
                disabled={isGenerating}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                <Button
                  onClick={handleSend}
                  disabled={isGenerating || !input.trim()}
                  size="icon"
                  className={`h-7 w-7 p-0 rounded-full shadow-sm transition-all duration-300 ${
                    mode === "canvas" ? "bg-foreground hover:bg-foreground/90" : ""
                  }`}
                  title={mode === "design" ? (isGuidedMode ? "Start Wizard" : "Generate Image") : "Execute Command"}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
            </div>
        </div>
      </div>
    </div>
  );
};
