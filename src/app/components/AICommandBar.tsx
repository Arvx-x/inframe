'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { createCampaign } from '@/app/lib/services/campaigns.service';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const EXAMPLE_PROMPTS = [
    'Create a summer sale campaign for Instagram',
    'Design a LinkedIn banner for our product launch',
    'Generate 5 ad variations for a new coffee brand',
    'Build a social media kit for a fitness app',
    'Create a holiday email header with festive vibes',
];

interface AICommandBarProps {
    className?: string;
    /** If true, renders a compact version for use in headers/overlays */
    compact?: boolean;
}

export function AICommandBar({ className, compact = false }: AICommandBarProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Cycle placeholder examples
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIdx((i) => (i + 1) % EXAMPLE_PROMPTS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Global keyboard shortcut: Cmd/Ctrl+K focuses the command bar
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmed = query.trim();
            if (!trimmed) return;

            if (!user) {
                toast.error('Please sign in to use AI features');
                return;
            }

            setIsProcessing(true);
            try {
                // Create a campaign with the user's brief and navigate to it
                const campaign = await createCampaign({
                    user_id: user.id,
                    name: trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed,
                    brief: trimmed,
                    status: 'draft',
                });
                toast.success('Campaign created! Generating your strategy...');
                router.push(`/campaigns/${campaign.id}`);
            } catch (err: any) {
                console.error('Error processing AI command:', err);
                toast.error(err?.message || 'Something went wrong. Please try again.');
            } finally {
                setIsProcessing(false);
            }
        },
        [query, user, router]
    );

    if (compact) {
        return (
            <form onSubmit={handleSubmit} className={className}>
                <div className="relative flex items-center">
                    <Sparkles className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask AI anything... (Ctrl+K)"
                        disabled={isProcessing}
                        className="w-full h-9 pl-9 pr-4 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-all"
                    />
                </div>
            </form>
        );
    }

    return (
        <div className={className}>
            <div className="text-center mb-4">
                <h2 className="text-2xl font-semibold tracking-tight mb-1">
                    What do you want to create?
                </h2>
                <p className="text-sm text-muted-foreground">
                    Describe your campaign, design, or visual -- AI will build it for you.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
                <div className="relative flex items-center">
                    <Sparkles className="absolute left-4 h-5 w-5 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={EXAMPLE_PROMPTS[placeholderIdx]}
                        disabled={isProcessing}
                        className="w-full h-14 pl-12 pr-14 bg-card border border-border rounded-2xl text-base shadow-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:shadow-md transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isProcessing || !query.trim()}
                        className="absolute right-3 h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                        {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowRight className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </form>

            <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground">
                    Press{' '}
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border">
                        Ctrl+K
                    </kbd>{' '}
                    to focus from anywhere
                </p>
            </div>
        </div>
    );
}
