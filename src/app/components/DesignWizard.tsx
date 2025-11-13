'use client';

import { useState, useEffect, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Loader2, Sparkles, CheckCircle2, RefreshCw, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

interface ExtractedKeywords {
  useCase: string;
  tone: string[];
  audience: string;
  elements: string[];
  constraints: string[];
}

interface Direction {
  id: string;
  name: string;
  rationale: string;
  moodKeywords: string[];
  compositionRules: string;
  styleHints: string[];
}

interface Variant {
  model: string;
  imageUrl: string;
}

interface DirectionWithVariants extends Direction {
  variants: Variant[];
  isGenerating: boolean;
}

type WizardPhase = "interview" | "keywords" | "directions" | "generation" | "feedback";

interface DesignWizardProps {
  onImageGenerated: (imageUrl: string) => void;
  onResetRef?: React.MutableRefObject<(() => void) | null>;
}

export default function DesignWizard({ onImageGenerated, onResetRef }: DesignWizardProps) {
  const [phase, setPhase] = useState<WizardPhase>("interview");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [keywords, setKeywords] = useState<ExtractedKeywords | null>(null);
  const [directions, setDirections] = useState<DirectionWithVariants[]>([]);
  const [selectedDirectionIds, setSelectedDirectionIds] = useState<string[]>([]);
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  // Expose reset handler to parent via ref
  useEffect(() => {
    if (onResetRef) {
      onResetRef.current = handleStartOver;
      return () => {
        if (onResetRef) onResetRef.current = null;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResetRef, messages, phase, keywords, directions, selectedDirectionIds, selectedImageIndices]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      if (phase === "interview") {
        // Interview phase via local API
        const res = await fetch('/api/design-wizard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'interview', messages: [...messages, userMessage] })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const assistantMessage: Message = { role: "assistant", content: data.message };
        setMessages(prev => [...prev, assistantMessage]);

        // Check if interview is complete
        if (data.message.toLowerCase().includes("got it") || messages.length >= 8) {
          setTimeout(() => extractKeywords([...messages, userMessage, assistantMessage]), 1000);
        }
      } else if (phase === "feedback") {
        // Feedback/refinement phase via local API
        const res = await fetch('/api/design-wizard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'refine', messages: [...messages, userMessage], selectedImages: selectedImageIndices.map(String) })
        });
        if (!res.ok) throw new Error(await res.text());
        const payload = await res.json();
        const analysis = payload.data;
        const assistantMessage: Message = {
          role: "assistant",
          content: `${analysis.analysis}\n\nSuggestions:\n${analysis.suggestions.map((s: string) => `• ${s}`).join('\n')}\n\nWould you like me to regenerate with these refinements?`
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Wizard error:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const extractKeywords = async (conversationMessages: Message[]) => {
    setPhase("keywords");
    setMessages(prev => [...prev, { 
      role: "assistant", 
      content: "Let me analyze your needs..." 
    }]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/design-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'extract', messages: conversationMessages })
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      setKeywords(payload.data);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Perfect! I've identified the key elements. Now let me create some distinct design directions for you..."
      }]);

      setTimeout(() => generateDirections(payload.data, conversationMessages), 1500);
    } catch (error) {
      console.error('Keyword extraction error:', error);
      toast.error("Failed to extract keywords");
      setIsProcessing(false);
    }
  };

  const generateDirections = async (extractedKeywords: ExtractedKeywords, conversationMessages: Message[]) => {
    setPhase("directions");
    setIsProcessing(true);

    try {
      const res = await fetch('/api/design-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'directions',
          messages: [
            ...conversationMessages,
            { role: 'assistant', content: JSON.stringify(extractedKeywords) },
          ],
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      const generatedDirections = payload.data.directions || [];
      setDirections(generatedDirections.map((d: Direction) => ({
        ...d,
        variants: [],
        isGenerating: false
      })));

      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I've created ${generatedDirections.length} distinct design directions for you. Select one or more to generate visuals!`
      }]);
    } catch (error) {
      console.error('Direction generation error:', error);
      toast.error("Failed to generate directions");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectionSelect = (directionId: string) => {
    setSelectedDirectionIds(prev => {
      if (prev.includes(directionId)) {
        return prev.filter(id => id !== directionId);
      }
      return [...prev, directionId];
    });
  };

  const handleGenerateSelected = async () => {
    if (selectedDirectionIds.length === 0) {
      toast.error("Please select at least one direction");
      return;
    }

    setPhase("generation");
    setIsProcessing(true);

    // Mark selected directions as generating
    setDirections(prev => prev.map(d => ({
      ...d,
      isGenerating: selectedDirectionIds.includes(d.id)
    })));

    const basePrompt = `${keywords?.useCase || "image"} with ${keywords?.tone.join(", ") || "professional"} tone. 
Target audience: ${keywords?.audience || "general"}. 
Elements: ${keywords?.elements.join(", ") || "none specified"}.`;

    try {
      // Generate for each selected direction in parallel via local API
      const generationPromises = selectedDirectionIds.map(async (directionId) => {
        const direction = directions.find(d => d.id === directionId);
        if (!direction) return;

        const res = await fetch('/api/design-wizard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'generateFromDirection', direction, basePrompt })
        });
        if (!res.ok) {
          console.error(`Generation failed for ${directionId}:`, await res.text());
          return;
        }
        const payload = await res.json();
        const variants: Variant[] = payload?.variants || [];

        // Update this direction with variants
        setDirections(prev => prev.map(d => {
          if (d.id === directionId) {
            return { ...d, variants, isGenerating: false };
          }
          return d;
        }));

        // Append images into chat stream as assistant messages
        const imageMessages: Message[] = variants
          .filter(v => v?.imageUrl)
          .map(v => ({ role: 'assistant', content: v.model ? `${v.model.toUpperCase()} result` : '', imageUrl: v.imageUrl }));
        if (imageMessages.length) {
          setMessages(prev => [...prev, ...imageMessages]);
        }
      });

      await Promise.all(generationPromises);

      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Here are your generated variations! Click any image to add it to your canvas. Which ones do you like most?"
      }]);

      setPhase("feedback");
      toast.success("Images generated successfully!");
    } catch (error) {
      console.error('Generation error:', error);
      toast.error("Failed to generate images");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) {
        toast.error("Only image files are supported");
        return;
      }
      const url = URL.createObjectURL(file);
      // Add as a chat message attachment (stay in chat only)
      setMessages(prev => [...prev, { role: "user", content: "", imageUrl: url }]);
      toast.success("Image attached to chat");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageSelect = (directionId: string, variantIndex: number) => {
    const direction = directions.find(d => d.id === directionId);
    if (!direction) return;

    const imageUrl = direction.variants[variantIndex]?.imageUrl;
    if (imageUrl) {
      onImageGenerated(imageUrl);
      toast.success("Image added to canvas!");
    }
  };

  const handleStartOver = () => {
    setPhase("interview");
    setMessages([{
      role: "assistant",
      content: "Let's start fresh! What would you like to design?"
    }]);
    setKeywords(null);
    setDirections([]);
    setSelectedDirectionIds([]);
    setSelectedImageIndices([]);
  };

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Content Area */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="mx-auto max-w-[720px] space-y-6">
          {/* Intro when empty */}
          {messages.length === 0 && phase === "interview" ? (
            <div className="flex flex-col items-center justify-center text-center px-4 py-8 -mt-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm bg-foreground/10">
                <Sparkles className="w-8 h-8 text-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Design Mode</h3>
              <div className="text-sm text-muted-foreground max-w-sm space-y-1">
              Talk to Inframe like a creative partner — it asks, understands, and turns your ideas into visual directions you can explore instantly.
              </div>
              <div className="mt-5 flex flex-wrap gap-2 max-w-sm justify-center">
                {[
                  { text: "Minimal logo for a fintech named Stryde" },
                  { text: "Poster for a jazz night, bold retro typography" },
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(chip.text)}
                    className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-muted transition shadow-sm inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {chip.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className="space-y-1.5">
                {msg.role === 'user' ? (
                  <div className="space-y-2">
                    {msg.imageUrl && (
                      <div className="rounded-md border border-border overflow-hidden inline-block max-w-xs">
                        <img src={msg.imageUrl} alt="Uploaded" className="w-full h-auto" />
                      </div>
                    )}
                    {msg.content && (
                      <div className="rounded-md border border-border bg-muted/60 px-3 py-2 font-inter text-[13px] text-foreground whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {msg.imageUrl && (
                      <div className="rounded-md border border-border overflow-hidden inline-block max-w-xs">
                        <img src={msg.imageUrl} alt="Generated" className="w-full h-auto" />
                      </div>
                    )}
                    {msg.content && (
                      <div className="text-sm leading-6 text-foreground whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}

          {/* Keywords Display */}
          {keywords && (
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                Extracted Keywords
              </h3>
              <div className="space-y-2 text-xs">
                <div><strong>Use Case:</strong> {keywords.useCase}</div>
                <div><strong>Tone:</strong> {keywords.tone.map((t, i) => (
                  <Badge key={i} variant="secondary" className="ml-1">{t}</Badge>
                ))}</div>
                <div><strong>Audience:</strong> {keywords.audience}</div>
                {keywords.elements.length > 0 && (
                  <div><strong>Elements:</strong> {keywords.elements.join(", ")}</div>
                )}
              </div>
            </Card>
          )}

          {/* Directions */}
          {directions.length > 0 && phase !== "interview" && phase !== "keywords" && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Design Directions</h3>
              <div className="grid gap-3">
                {directions.map(direction => (
                  <Card
                    key={direction.id}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedDirectionIds.includes(direction.id)
                        ? "ring-2 ring-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => phase === "directions" && handleDirectionSelect(direction.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm">{direction.name}</h4>
                      {selectedDirectionIds.includes(direction.id) && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{direction.rationale}</p>
                    <div className="flex flex-wrap gap-1">
                      {direction.moodKeywords.map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                    </div>

                    {/* Variants */}
                    {direction.variants.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {direction.variants.map((variant, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all group"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImageSelect(direction.id, idx);
                            }}
                          >
                            <img
                              src={variant.imageUrl}
                              alt={`${direction.name} variant ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                                Add to Canvas
                              </span>
                            </div>
                            <Badge className="absolute top-1 right-1 text-[10px]">
                              {variant.model}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {direction.isGenerating && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {Array.from({ length: 4 }).map((_, idx) => (
                          <Skeleton
                            key={idx}
                            animate="blink"
                            className="aspect-square w-full rounded-lg bg-muted/70"
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {phase === "directions" && (
                <Button
                  onClick={handleGenerateSelected}
                  disabled={selectedDirectionIds.length === 0 || isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Generate Visuals ({selectedDirectionIds.length} selected)
                </Button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      {(phase === "interview" || phase === "feedback") && (
        <div className="p-4 border-t border-border bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40">
          <div className="mx-auto max-w-[720px]">
            <div className="rounded-xl border shadow-sm focus-within:ring-2 transition-all duration-300 border-blue-200/50 bg-muted/70 bg-[linear-gradient(to_bottom_right,rgba(59,130,246,0.08),transparent)] focus-within:ring-blue-400/25">
              <div className="relative">
                {/* Upload (+) button */}
                <div className="absolute left-2 bottom-2 flex items-center gap-2">
                  <Button
                    onClick={handleUploadClick}
                    size="icon"
                    className="h-6 w-6 p-0 rounded-full shadow-sm bg-muted text-foreground hover:bg-muted/90 border border-border"
                    title="Upload image"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">Press Shift + Enter for new line</span>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={phase === "interview" ? "Type your answer..." : "Share your thoughts..."}
                  className="min-h-[96px] resize-none bg-transparent border-0 focus-visible:ring-0 px-4 pr-12 py-4 placeholder:text-muted-foreground/80"
                disabled={isProcessing}
              />
                <div className="absolute right-2 bottom-2 flex items-center gap-2">
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                size="icon"
                    className="h-7 w-7 p-0 rounded-full shadow-sm"
                    title={phase === "interview" ? "Send" : "Send feedback"}
              >
                {isProcessing ? (
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
      )}
    </div>
  );
}
