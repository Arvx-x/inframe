'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Input } from "@/app/components/ui/input";
import { Sparkles, Loader2, ArrowUp, Wand2, ImagePlus, Zap, Brain, PenTool, Plus, Undo2, Redo2, Minus, Palette, X, Palette as DesignIcon, MousePointer as CanvasIcon, ChevronDown } from "lucide-react";
// Calls go to local Next.js API routes instead of Supabase Edge Functions
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  timestamp?: number;
}

type ChatMode = "canvas" | "design" | "chat";
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
  isEdit: boolean,
  excludeText?: string,
  colors?: string[]
): string => {
  const role = category === "logo" ? "Logo design" : category === "poster" ? "Poster graphic" : "Image";
  const goal = isEdit ? "Refine the existing visual" : "Generate a new visual";
  const kw = keywords.length ? `Keywords: ${keywords.join(", ")}.` : "";
  
  const colorGuidance = colors && colors.length > 0 
    ? `Preferred color palette: ${colors.join(", ")}.`
    : "";
  
  const exclusions = excludeText && excludeText.trim()
    ? `Avoid including: ${excludeText.trim()}.`
    : "";
  
  return [
    `${role} — ${goal}.`,
    `Idea: ${idea}.`,
    kw,
    colorGuidance,
    exclusions,
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
  onProjectNameUpdate?: (name: string) => void;
}

export default function PromptSidebar({ onImageGenerated, currentImageUrl, onCanvasCommand, onCanvasUndo, onCanvasRedo, showHistoryControls = false, onProjectNameUpdate }: PromptSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<ChatMode>("design");
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  // User preferences for generation
  const [excludeText, setExcludeText] = useState<string>("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isExcludeOpen, setIsExcludeOpen] = useState(false);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [tempExcludeText, setTempExcludeText] = useState<string>("");
  const [tempSelectedColors, setTempSelectedColors] = useState<string[]>([]);
  const [hasSetProjectName, setHasSetProjectName] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<string>("1×1");
  const [selectedModel, setSelectedModel] = useState<string>("DALL-E 3");
  
  // Extract project name from user message
  const extractProjectName = (message: string): string => {
    // Clean the message
    const cleaned = message.trim();
    
    // Extract first few words (max 5 words or 50 chars)
    const words = cleaned.split(/\s+/).slice(0, 5);
    let name = words.join(' ');
    
    // Truncate if too long
    if (name.length > 50) {
      name = name.substring(0, 47) + '...';
    }
    
    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);
    
    return name || "Untitled Project";
  };
  
  // Handlers for preferences
  const toggleTempColor = (hex: string) => {
    setTempSelectedColors(prev => prev.includes(hex) ? prev.filter(c => c !== hex) : [...prev, hex]);
  };
  
  const handleExcludeOpen = (open: boolean) => {
    setIsExcludeOpen(open);
    if (open) {
      setTempExcludeText(excludeText);
    }
  };
  
  const handleColorOpen = (open: boolean) => {
    setIsColorOpen(open);
    if (open) {
      setTempSelectedColors(selectedColors);
    }
  };
  
  const applyExcludePreferences = () => {
    setExcludeText(tempExcludeText);
    setIsExcludeOpen(false);
  };
  
  const clearExcludePreferences = () => {
    setTempExcludeText("");
    setExcludeText("");
    setIsExcludeOpen(false);
  };
  
  const applyColorPreferences = () => {
    setSelectedColors(tempSelectedColors);
    setIsColorOpen(false);
  };
  
  const clearColorPreferences = () => {
    setTempSelectedColors([]);
    setSelectedColors([]);
    setIsColorOpen(false);
  };
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  
  // New states for expand/collapse
  const [isExpanded, setIsExpanded] = useState(true);
  const [firstUserMessage, setFirstUserMessage] = useState("");
  
  // Chat mode states
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
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
    el.style.minHeight = '120px';
    resizeTextareaEl(el);
  }, [input, maxTextareaHeight, mode]);

  // Click-outside detection to collapse the composer (skip if chat mode is active or clicking in popovers)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is inside composer
      if (composerRef.current && composerRef.current.contains(target)) {
        return;
      }
      
      // Check if click is inside any popover content (Radix UI popovers)
      const clickedElement = event.target as Element;
      if (clickedElement.closest('[role="dialog"]') || 
          clickedElement.closest('[data-radix-popper-content-wrapper]') ||
          clickedElement.closest('[data-state="open"]')) {
        return;
      }
      
      // Check if any of our preference popovers are open
      if (isExcludeOpen || isColorOpen) {
        return;
      }
      
      // Only collapse if not in chat mode
      if (!isChatMode && mode !== "chat") {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded && !isChatMode && mode !== "chat") {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, isChatMode, mode, isExcludeOpen, isColorOpen]);

  // Auto-focus textarea when expanding
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);
  
  // Scroll chat messages to bottom when new messages arrive
  useEffect(() => {
    if (isChatMode && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatMode]);

  const handleSend = async () => {
    if (!input.trim()) {
      toast.error("Please enter a message");
      return;
    }

    const userMessage: Message = { role: "user", content: input, timestamp: Date.now() };
    
    // Update project name from first message
    if (!hasSetProjectName && onProjectNameUpdate) {
      const projectName = extractProjectName(input);
      onProjectNameUpdate(projectName);
      setHasSetProjectName(true);
    }
    
    // Handle chat mode separately
    if (isChatMode || mode === "chat") {
      setChatMessages((prev) => [...prev, userMessage]);
      if (!firstUserMessage) setFirstUserMessage(input);
      setInput("");
      setIsGenerating(true);
      
      try {
        // Simplified conversational flow
        const res = await fetch('/api/design-wizard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phase: 'chat', 
            messages: chatMessages.concat(userMessage),
            preferences: {
              exclude: (excludeText || "").trim() || undefined,
              colors: selectedColors,
            }
          })
        });
        
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        console.log('Chat API response:', data);
        
        // Check if AI is ready to generate
        if (data.success && data.shouldGenerate) {
          // Generate the image
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
          
          console.log('Generating image with refined prompt:', refinedPrompt);
          
          const genRes = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: refinedPrompt
            })
          });
          
          if (!genRes.ok) {
            const errorText = await genRes.text();
            console.error('Image generation failed:', errorText);
            throw new Error(errorText);
          }
          
          const genData = await genRes.json();
          console.log('Image generation response:', genData);
          
          if (genData?.imageUrl) {
            onImageGenerated(genData.imageUrl);
            const confirmMessage: Message = {
              role: "assistant",
              content: "✨ Image created successfully! I've added it to your canvas.",
              timestamp: Date.now()
            };
            setChatMessages((prev) => [...prev, confirmMessage]);
            toast.success("Image generated!");
          } else {
            throw new Error("No image URL in generation response");
          }
        } else {
          // Continue conversation
          const assistantMessage: Message = {
            role: "assistant",
            content: data.message || "Tell me more about what you'd like to create.",
            timestamp: Date.now()
          };
          setChatMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (error) {
        console.error('Chat error:', error);
        toast.error("Failed to process message");
        const errorMessage: Message = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: Date.now()
        };
        setChatMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsGenerating(false);
      }
      return;
    }
    
    // Original non-chat mode logic
    setMessages((prev) => [...prev, userMessage]);
    if (!firstUserMessage) setFirstUserMessage(input); // Save first user message
    if (mode === 'design' && isGuidedMode) {
      // Keep a parallel guided conversation log
      setGuidedConversation(prev => [...prev, userMessage]);
    }
    setInput("");
    setIsGenerating(true);

    try {
      const preferences = {
        exclude: (excludeText || "").trim() || undefined,
        colors: selectedColors,
      } as { exclude?: string; colors: string[] };
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
              // Generate image using simple generate-image API
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
    <div ref={containerRef} className="w-full relative overflow-visible">
      {/* Mode Switcher - Hidden but functionality preserved */}
      <div className="hidden">
        <button onClick={() => setMode("design")}>Design</button>
        <button onClick={() => setMode("canvas")}>Canvas</button>
        </div>
        
      {/* Chat Mode Message Area - appears above composer */}
      {(isChatMode || mode === "chat") && chatMessages.length > 0 && (
        <div 
          className="absolute bottom-full left-0 right-0 bg-white rounded-t-xl border border-b-0 border-blue-200/50 focus-within:ring-2 focus-within:ring-blue-400/25 transition-all duration-300 ease-in-out flex flex-col"
          style={{ 
            maxHeight: '300px',
            opacity: 1,
          }}
        >
          {/* Chat header - moves up when messages appear */}
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 h-10 min-h-[40px] border-b border-border">
            <span className="text-sm font-medium">My Project</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => {
                  setChatMessages([]);
                  setInput("");
                  setFirstUserMessage("");
                  setHasSetProjectName(false);
                }}
                title="New chat"
              >
                <Plus className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => {
                  setIsChatMode(false);
                  setMode("design");
                }}
                title="Close chat mode"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {/* Chat messages area */}
          <ScrollArea className="flex-1 px-4 py-2 border-t border-l border-r border-blue-200/50 focus-within:ring-2 focus-within:ring-blue-400/25 overflow-y-auto">
            <div className="space-y-3">
              {chatMessages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'user' ? (
                    <div className="max-w-[80%] rounded-lg px-3 py-2 bg-muted text-foreground">
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  ) : (
                    <div className="max-w-[80%] text-foreground">
                      <div className="text-sm whitespace-normal">{message.content}</div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>
      )}
        
      {/* Chat header - appears above composer when no messages */}
      <div 
        className={`absolute bottom-full left-0 right-0 bg-white rounded-t-xl border border-b-0 border-blue-200/50 focus-within:ring-2 focus-within:ring-blue-400/25 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          (isChatMode || mode === "chat") && chatMessages.length === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          height: (isChatMode || mode === "chat") && chatMessages.length === 0 ? '40px' : '0px',
          overflow: 'hidden'
        }}
        >
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 h-10 min-h-[40px]">
            <span className="text-sm font-medium">My Project</span>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => {
                  setChatMessages([]);
                  setInput("");
                  setFirstUserMessage("");
                  setHasSetProjectName(false);
                }}
                title="New chat"
              >
                <Plus className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => {
                  setIsChatMode(false);
                  setMode("design");
                }}
                title="Close chat mode"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

      {/* Composer */}
      <div 
        ref={composerRef}
        className={`${isChatMode || mode === "chat" ? 'rounded-b-xl' : 'rounded-xl'} border shadow-[0_4px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.16)] bg-white transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded || isChatMode || mode === "chat" ? 'cursor-default' : 'cursor-text'
        } ${
          mode === "design"
            ? "border-blue-200/50"
            : mode === "canvas"
            ? "border-blue-300/50"
            : "border-green-200/50"
        }`}
        style={{ 
          height: (isExpanded || isChatMode || mode === "chat") ? '100px' : '52px'
        }}
      >
        <div className="relative h-full flex flex-col">
          
          {/* Left buttons - always rendered but animated */}
          <div className={`absolute left-2 bottom-3 flex items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            !isExpanded && !isChatMode && mode !== "chat" ? 'translate-y-12 pointer-events-none' : 'translate-y-0'
          }`}>
            {/* Mode toggle button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  className="h-6 w-6 bg-transparent hover:bg-gray-100 border-0 rounded-sm shadow-none text-gray-700 hover:text-gray-900 transition-all duration-200 ml-1 -m"
                  title={`Current mode: ${mode === "design" ? "Design" : mode === "canvas" ? "Canvas" : "Chat"}`}
                >
                  {mode === "design" ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21,15 16,10 5,21"/>
                    </svg>
                  ) : mode === "canvas" ? (
                    <CanvasIcon className="w-3 h-3" />
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="rounded-xl border bg-white shadow-lg">
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setMode("design")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
                  Design Mode
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setMode("canvas")}
                >
                  <CanvasIcon className="w-4 h-4" /> Canvas Mode
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => {
                    setMode("chat");
                    setIsChatMode(true);
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Chat Mode
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>


            {/* Exclude popup */}
            <Popover open={isExcludeOpen} onOpenChange={handleExcludeOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  className="h-4 w-4 p-0 bg-transparent hover:bg-gray-100 border border-black rounded-full shadow-none text-gray-700 hover:text-gray-900 transition-all duration-200 ml-1.5"
                  title="Exclude elements"
                >
                  <Minus className="w-2 h-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4 bg-white border border-gray-200 shadow-xl rounded-2xl" align="start" sideOffset={8}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Exclude Elements</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={clearExcludePreferences}
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={applyExcludePreferences}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">What should be avoided in the image?</label>
                    <textarea
                      value={tempExcludeText}
                      onChange={(e) => setTempExcludeText(e.target.value)}
                      placeholder="e.g., text, watermarks, logos, people..."
                      className="w-full h-20 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  {tempExcludeText && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">Preview:</p>
                      <div className="px-3 py-2 bg-gray-100 rounded-md text-xs text-gray-700">
                        Avoid including: {tempExcludeText}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Aspect Ratio dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-6 px-2 py-1 bg-transparent hover:bg-gray-100 border-0 rounded-sm shadow-none text-gray-700 hover:text-gray-900 transition-all duration-200 flex items-center gap-1.5"
                  title="Aspect Ratio"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <span className="text-xs font-medium">{selectedRatio}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="rounded-xl border bg-white shadow-lg">
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("1×1")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  </svg>
                  1×1 (Square)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("16×9")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="6" width="18" height="12" rx="2" ry="2"/>
                  </svg>
                  16×9 (Widescreen)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("4×3")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" ry="2"/>
                  </svg>
                  4×3 (Standard)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("3×2")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
                  </svg>
                  3×2 (Photo)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("9×16")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="3" width="12" height="18" rx="2" ry="2"/>
                  </svg>
                  9×16 (Portrait)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("2×3")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="3" width="14" height="18" rx="2" ry="2"/>
                  </svg>
                  2×3 (Portrait Photo)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("21×9")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="10" rx="2" ry="2"/>
                  </svg>
                  21×9 (Ultrawide)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setSelectedRatio("5×4")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
                  </svg>
                  5×4 (Large Format)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>


            {/* Color wheel button */}
            <Popover open={isColorOpen} onOpenChange={handleColorOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  className="h-5 w-5 p-0 bg-transparent hover:bg-gray-100 border-0 rounded-sm shadow-none transition-all duration-200"
                  title="Choose colors"
                >
                  <span
                    className="block h-4 w-4 rounded-full border border-gray-300"
                    style={{
                      background: 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #f472b6, #ef4444)'
                    }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 bg-white border border-gray-200 shadow-xl rounded-2xl" align="start" sideOffset={8}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Color Palette</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={clearColorPreferences}
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={applyColorPreferences}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                  
                  {/* Color grid */}
                  <div className="grid grid-cols-8 gap-2">
                    {[
                      '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#f472b6', '#ef4444', '#f97316',
                      '#84cc16', '#06b6d4', '#6366f1', '#ec4899', '#dc2626', '#ea580c', '#16a34a', '#2563eb',
                      '#7c3aed', '#db2777', '#b91c1c', '#c2410c', '#15803d', '#0891b2', '#4f46e5', '#be185d',
                      '#991b1b', '#9a3412', '#166534', '#0e7490', '#3730a3', '#9d174d', '#7f1d1d', '#92400e',
                      '#14532d', '#155e75', '#312e81', '#831843', '#450a0a', '#78350f', '#052e16', '#164e63',
                      '#1e1b4b', '#500724', '#1c1917', '#365314', '#1e3a8a', '#581c87', '#7c2d12', '#374151'
                    ].map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                          tempSelectedColors.includes(color) 
                            ? 'border-gray-800 ring-2 ring-gray-300' 
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => toggleTempColor(color)}
                        title={color}
                      />
                    ))}
                  </div>
                  
                  {/* Selected colors preview */}
                  {tempSelectedColors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">Selected colors:</p>
                      <div className="flex flex-wrap gap-1">
                        {tempSelectedColors.map((color) => (
                          <div
                            key={color}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs"
                          >
                            <div 
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-gray-700">{color}</span>
                            <button
                              onClick={() => toggleTempColor(color)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Right button - always rendered but animated */}
          <div className={`absolute right-3.5 bottom-3 flex items-center gap-1.5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            !isExpanded && !isChatMode && mode !== "chat" ? 'translate-y-12 pointer-events-none' : 'translate-y-0'
          }`}>
            {/* Models dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-7 px-1.5 py-1 bg-transparent hover:bg-gray-100 border-0 rounded-md shadow-none text-gray-700 hover:text-gray-900 transition-all duration-200 flex items-center gap-1.5 text-xs font-medium"
                  title="Select model"
                >
                  <span className="max-w-[80px] truncate">{selectedModel}</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="rounded-xl border bg-white shadow-lg">
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("DALL-E 3")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                  DALL-E 3
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("DALL-E 2")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                  DALL-E 2
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("Midjourney")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8"/>
                    <path d="M12 8v8"/>
                  </svg>
                  Midjourney
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("Stable Diffusion")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
                  Stable Diffusion
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("Imagen")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
                  Imagen
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("SeaDream")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                  SeaDream
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("Nano Banana")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                  Nano Banana
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0" 
                  onClick={() => setSelectedModel("Kandinsky")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8"/>
                    <path d="M12 8v8"/>
                  </svg>
                  Kandinsky
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleSend}
              disabled={isGenerating || !input.trim()}
              size="icon"
              className={`h-7 w-7 p-0 rounded-full shadow-sm transition-all duration-300 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                mode === "canvas" ? "bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90" : mode === "chat" ? "bg-green-600 hover:bg-green-700" : ""
              }`}
              title={mode === "design" ? (isGuidedMode ? "Start Wizard" : "Generate Image") : mode === "canvas" ? "Execute Command" : "Send Message"}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className={`w-3 h-3 ${mode === "chat" || mode === "canvas" ? "text-white" : ""}`} />
              )}
            </Button>
          </div>
          
          {!isExpanded && !isChatMode && mode !== "chat" ? (
            // Collapsed search-bar mode - without send button
            <div 
              onClick={() => setIsExpanded(true)}
              className="relative h-full flex flex-col justify-start px-4 pt-4 cursor-pointer caret-transparent overflow-hidden"
            >
              <div className="text-sm text-muted-foreground/80 whitespace-nowrap overflow-hidden">
                {firstUserMessage || (mode === "design" ? "What would you like to create?" : mode === "canvas" ? "Tell the canvas what to do..." : "Start a conversation...")}
              </div>
              {/* Fade-out gradient on the right */}
              {firstUserMessage && (
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none" />
              )}
            </div>
          ) : (
            // Expanded mode with full composer (shown in both normal expanded and chat mode)
            <div className="h-full">
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
                    mode === "design" ? "What would you like to create?" : mode === "canvas" ? "Tell the canvas what to do..." : "Start a conversation..."
                  }
                className="min-h-[120px] resize-none bg-transparent border-0 focus-visible:ring-0 pl-4 pr-16 pt-4 pb-8 placeholder:text-muted-foreground/80"
                disabled={isGenerating}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
