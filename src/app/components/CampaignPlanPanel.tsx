'use client';

import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import {
    Sparkles,
    Loader2,
    Send,
    Target,
    MessageSquare,
    Lightbulb,
    ArrowRight,
    Megaphone,
    Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface CampaignPlanPanelProps {
    /** Canvas command handler to add sticky notes / text to the whiteboard */
    onCanvasCommand?: (command: string) => Promise<string>;
    /** Callback to add a sticky note to the canvas */
    onAddStickyNote?: () => void;
    /** Callback when the user wants to generate designs from the plan */
    onGenerateFromPlan?: (strategy: any) => void;
    className?: string;
}

interface BrainstormResult {
    ideas: string[];
    strategy?: any;
}

const BRAINSTORM_STARTERS = [
    { icon: Target, label: 'Define target audience', prompt: 'Help me define my target audience for this campaign' },
    { icon: MessageSquare, label: 'Generate key messages', prompt: 'Brainstorm 5 key messages for this campaign' },
    { icon: Lightbulb, label: 'Creative concepts', prompt: 'Give me 5 unique creative concepts for this campaign' },
    { icon: Megaphone, label: 'Platform strategy', prompt: 'Suggest the best platforms and content types for this campaign' },
    { icon: Zap, label: 'Campaign hooks', prompt: 'Generate 5 attention-grabbing hooks for this campaign' },
];

export function CampaignPlanPanel({
    onCanvasCommand,
    onAddStickyNote,
    onGenerateFromPlan,
    className,
}: CampaignPlanPanelProps) {
    const [brief, setBrief] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<BrainstormResult | null>(null);
    const [strategy, setStrategy] = useState<any>(null);

    const handleBrainstorm = useCallback(
        async (prompt: string) => {
            if (!prompt.trim()) return;
            setIsProcessing(true);

            try {
                const res = await fetch('/api/generate-campaign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        brief: `${brief ? `Campaign brief: ${brief}\n\n` : ''}${prompt}`,
                    }),
                });

                if (res.ok) {
                    const { strategy: result } = await res.json();
                    setStrategy(result);

                    // Extract ideas to show
                    const ideas: string[] = [];
                    if (result.objectives) ideas.push(...result.objectives.map((o: string) => `Objective: ${o}`));
                    if (result.keyMessages) ideas.push(...result.keyMessages.map((m: string) => `Message: ${m}`));
                    if (result.copyBank?.taglines) ideas.push(...result.copyBank.taglines.map((t: string) => `Tagline: ${t}`));
                    if (result.deliverables) {
                        ideas.push(...result.deliverables.map((d: any) => `Design: ${d.name} (${d.format})`));
                    }

                    setResults({ ideas, strategy: result });
                    toast.success('Brainstorm complete!');
                } else {
                    toast.error('AI brainstorming failed');
                }
            } catch (err) {
                console.error('Brainstorm error:', err);
                toast.error('Something went wrong');
            } finally {
                setIsProcessing(false);
            }
        },
        [brief]
    );

    const handleAddToCanvas = useCallback(
        async (text: string) => {
            if (onCanvasCommand) {
                await onCanvasCommand(`Add text: "${text}"`);
                toast.success('Added to canvas');
            }
        },
        [onCanvasCommand]
    );

    const handleAddAllToCanvas = useCallback(async () => {
        if (!results || !onCanvasCommand) return;
        for (const idea of results.ideas) {
            await onCanvasCommand(`Add text: "${idea}"`);
        }
        toast.success(`Added ${results.ideas.length} items to canvas`);
    }, [results, onCanvasCommand]);

    const handleGenerateFromPlan = useCallback(() => {
        if (strategy && onGenerateFromPlan) {
            onGenerateFromPlan(strategy);
        } else {
            toast.info('Generate a strategy first, then bridge it to designs.');
        }
    }, [strategy, onGenerateFromPlan]);

    return (
        <div className={className}>
            <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4" />
                            AI Campaign Planner
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            Brainstorm campaign ideas with AI. Add them to the whiteboard to build your plan.
                        </p>
                    </div>

                    {/* Campaign brief input */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Campaign Brief (optional context)
                        </label>
                        <Textarea
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            placeholder="Describe your campaign goals, audience, product..."
                            rows={3}
                            className="text-sm resize-none"
                        />
                    </div>

                    {/* Quick brainstorm starters */}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Quick Start</p>
                        <div className="space-y-1.5">
                            {BRAINSTORM_STARTERS.map((starter) => {
                                const Icon = starter.icon;
                                return (
                                    <button
                                        key={starter.label}
                                        onClick={() => handleBrainstorm(starter.prompt)}
                                        disabled={isProcessing}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
                                    >
                                        <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                        <span>{starter.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom prompt */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Or ask anything
                        </label>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleBrainstorm(chatInput);
                                setChatInput('');
                            }}
                            className="flex gap-2"
                        >
                            <Input
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Ask AI..."
                                disabled={isProcessing}
                                className="flex-1 h-8 text-sm"
                            />
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isProcessing || !chatInput.trim()}
                                className="h-8 w-8 p-0"
                            >
                                {isProcessing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Send className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </form>
                    </div>

                    {/* Loading */}
                    {isProcessing && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            AI is brainstorming...
                        </div>
                    )}

                    {/* Results */}
                    {results && !isProcessing && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Ideas ({results.ideas.length})
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px]"
                                    onClick={handleAddAllToCanvas}
                                >
                                    Add All to Canvas
                                </Button>
                            </div>
                            <div className="space-y-1.5">
                                {results.ideas.map((idea, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 px-2.5 py-2 rounded-lg border bg-card text-xs group"
                                    >
                                        <span className="flex-1 leading-relaxed">{idea}</span>
                                        <button
                                            onClick={() => handleAddToCanvas(idea)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                            title="Add to canvas"
                                        >
                                            <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Generate from Plan Bridge */}
                    {strategy && (
                        <div className="border-t pt-4">
                            <Button
                                onClick={handleGenerateFromPlan}
                                className="w-full gap-2"
                                size="sm"
                            >
                                <Zap className="h-4 w-4" />
                                Generate Designs from Plan
                            </Button>
                            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                                Creates a campaign with designs based on your strategy
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
