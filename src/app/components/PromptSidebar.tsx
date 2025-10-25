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
      if (!isChatMode) {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded && !isChatMode) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, isChatMode, isExcludeOpen, isColorOpen]);

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
    if (isChatMode) {
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
      {isChatMode && chatMessages.length > 0 && (
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
                onClick={() => setIsChatMode(false)}
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
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
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
          isChatMode && chatMessages.length === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          height: isChatMode && chatMessages.length === 0 ? '40px' : '0px',
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
                onClick={() => setIsChatMode(false)}
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
        className={`${isChatMode ? 'rounded-b-xl' : 'rounded-xl'} border shadow-[0_4px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.16)] bg-white transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded || isChatMode ? 'cursor-default' : 'cursor-text'
        } ${
          mode === "design"
            ? "border-blue-200/50"
            : "border-blue-300/50"
        }`}
        style={{ 
          height: (isExpanded || isChatMode) ? '100px' : '52px'
        }}
      >
        <div className="relative h-full flex flex-col">
          
          {/* Left buttons - always rendered but animated */}
          <div className={`absolute left-4 bottom-3 flex items-center gap-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            !isExpanded && !isChatMode ? 'translate-y-12 pointer-events-none' : 'translate-y-0'
          }`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  className="h-4 w-4 p-0 bg-transparent border border-black rounded-full shadow-none text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                  title={`Current mode: ${mode === "design" ? "Design" : "Canvas"}`}
                >
                  {mode === "design" ? <DesignIcon className="w-2 h-2" /> : <CanvasIcon className="w-2 h-2" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="rounded-xl">
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setMode("design")}
                >
                  <DesignIcon className="w-4 h-4" /> Design Mode
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="gap-2 text-sm" 
                  onClick={() => setMode("canvas")}
                >
                  <CanvasIcon className="w-4 h-4" /> Canvas Mode
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {mode === "design" && (
              <>
              <Button
                onClick={() => { 
                  setIsChatMode(!isChatMode);
                  if (!isChatMode) {
                    setIsExpanded(true);
                  }
                }}
                size="icon"
                  className={`h-5 w-5 p-0 bg-transparent hover:bg-transparent border-0 rounded-none shadow-none transition-all duration-300 ${
                  isChatMode 
                      ? "text-[hsl(var(--sidebar-ring))]" 
                      : "text-foreground/70 hover:text-foreground"
                }`}
                title={isChatMode ? "Chat mode active" : "Enable chat mode"}
              >
                <PenTool className="w-2.5 h-2.5" />
              </Button>
              {/* Exclude (negative prompt) */}
              <Popover open={isExcludeOpen} onOpenChange={handleExcludeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-4 w-4 p-0 bg-transparent border border-black rounded-full shadow-none ${excludeText.trim() ? 'text-[hsl(var(--sidebar-ring))] hover:bg-muted/50' : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'}`}
                    title="Exclude from results"
                  >
                    <Minus className="w-2 h-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={8} className="w-80 p-0 rounded-xl border bg-white shadow-lg">
                  <div className="p-4 border-b">
                    <h3 className="text-sm font-semibold mb-1">Exclude from results</h3>
                    <p className="text-xs text-muted-foreground">Specify elements to avoid in generated images</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <Textarea
                      value={tempExcludeText}
                      onChange={(e) => setTempExcludeText(e.target.value)}
                      placeholder="e.g., text, watermark, hands, low quality..."
                      className="min-h-[80px] text-sm resize-none"
                    />
                    <div className="text-xs text-muted-foreground">
                      These elements will be avoided using negative guidance during generation.
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 p-3 bg-muted/30 rounded-b-xl">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearExcludePreferences}
                      className="text-xs h-8"
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={applyExcludePreferences}
                      className="text-xs h-8 bg-foreground hover:bg-foreground/90 text-background"
                    >
                      Done
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {/* Color wheel */}
              <Popover open={isColorOpen} onOpenChange={handleColorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-5 w-5 p-0 bg-transparent hover:bg-transparent border-0 rounded-none shadow-none ${selectedColors.length ? 'text-[hsl(var(--sidebar-ring))]' : 'text-foreground/70 hover:text-foreground'}`}
                    title="Choose colors"
                  >
                    <span
                      className="block h-3.5 w-3.5 rounded-full border border-black"
                      style={{
                        background: 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #f472b6, #ef4444)'
                      }}
                    />
            </Button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={8} className="w-80 p-0 rounded-xl border bg-white shadow-lg">
                  <div className="p-4 border-b">
                    <h3 className="text-sm font-semibold mb-1">Preferred colors</h3>
                    <p className="text-xs text-muted-foreground">Select colors to guide the image generation</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-8 gap-2.5">
                      {['#111827','#000000','#FFFFFF','#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#14B8A6','#F472B6','#22C55E','#EAB308','#A855F7','#06B6D4','#F97316','#94A3B8'].map((hex) => (
                        <button
                          key={hex}
                          onClick={() => toggleTempColor(hex)}
                          className={`h-8 w-8 rounded-lg border-2 transition-all ${
                            tempSelectedColors.includes(hex) 
                              ? 'ring-2 ring-[hsl(var(--sidebar-ring))] ring-offset-2 border-white scale-110' 
                              : 'border-border hover:border-foreground/30 hover:scale-105'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                      <span>{tempSelectedColors.length} color{tempSelectedColors.length !== 1 ? 's' : ''} selected</span>
                      {tempSelectedColors.length > 0 && (
                        <div className="flex gap-1">
                          {tempSelectedColors.map((color, idx) => (
                            <div
                              key={idx}
                              className="w-4 h-4 rounded border border-border"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 p-3 bg-muted/30 rounded-b-xl">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearColorPreferences}
                      className="text-xs h-8"
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={applyColorPreferences}
                      className="text-xs h-8 bg-foreground hover:bg-foreground/90 text-background"
                    >
                      Done
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Right button - always rendered but animated */}
          <div className={`absolute right-2 bottom-3 flex items-center gap-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            !isExpanded && !isChatMode ? 'translate-y-12 pointer-events-none' : 'translate-y-0'
          }`}>
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
          
          {!isExpanded && !isChatMode ? (
            // Collapsed search-bar mode - without send button
            <div 
              onClick={() => setIsExpanded(true)}
              className="relative h-full flex flex-col justify-start px-4 pt-4 cursor-pointer caret-transparent overflow-hidden"
            >
              <div className="text-sm text-muted-foreground/80 whitespace-nowrap overflow-hidden">
                {firstUserMessage || (mode === "design" ? "What would you like to create?" : "Tell the canvas what to do...")}
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
                    mode === "design" ? "What would you like to create?" : "Tell the canvas what to do..."
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
