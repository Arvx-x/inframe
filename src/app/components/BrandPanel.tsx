'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { getUserBrandKits } from '@/app/lib/services/brand-kit.service';
import type { BrandKit } from '@/app/lib/services/brand-kit.service';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Palette, Type, Image as ImageIcon, Sparkles, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface BrandPanelProps {
    activeBrandKitId?: string | null;
    onApplyColor?: (color: string) => void;
    onApplyFont?: (font: string) => void;
}

export function BrandPanel({ activeBrandKitId, onApplyColor, onApplyFont }: BrandPanelProps) {
    const { user } = useAuth();
    const [kits, setKits] = useState<BrandKit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                const data = await getUserBrandKits(user.id);
                setKits(data);
            } catch {
                // silently fail
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    // If a specific kit is active (from campaign), prioritize it
    const activeKit = activeBrandKitId
        ? kits.find((k) => k.id === activeBrandKitId) || kits[0]
        : kits[0];

    if (loading) {
        return (
            <div className="p-4 space-y-3">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-20 bg-muted animate-pulse rounded-lg" />
            </div>
        );
    }

    if (!user || kits.length === 0) {
        return (
            <div className="p-4 flex flex-col items-center text-center">
                <Palette className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium mb-1">No Brand Kit</p>
                <p className="text-xs text-muted-foreground mb-3">
                    Create a brand kit to quickly apply brand colors, fonts, and logos.
                </p>
                <Button asChild size="sm" variant="outline" className="gap-1 text-xs">
                    <Link href="/brand-kit">
                        <ExternalLink className="h-3 w-3" />
                        Create Brand Kit
                    </Link>
                </Button>
            </div>
        );
    }

    const colors = (activeKit?.colors as string[]) || [];
    const fonts = (activeKit?.fonts as { primary?: string; secondary?: string; body?: string }) || {};
    const voiceTone = activeKit?.voice_tone;

    return (
        <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
                {/* Kit name */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium truncate">{activeKit?.name}</h3>
                    <Button asChild size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Link href="/brand-kit">
                            <ExternalLink className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>

                {/* Colors */}
                {colors.length > 0 && (
                    <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Palette className="h-3 w-3" />
                            Colors
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {colors.map((color, i) => (
                                <button
                                    key={i}
                                    onClick={() => onApplyColor?.(color)}
                                    className="w-8 h-8 rounded-lg border shadow-sm hover:scale-110 transition-transform cursor-pointer"
                                    style={{ backgroundColor: color }}
                                    title={`Apply ${color}`}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Fonts */}
                {(fonts.primary || fonts.secondary || fonts.body) && (
                    <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Type className="h-3 w-3" />
                            Fonts
                        </h4>
                        <div className="space-y-1.5">
                            {fonts.primary && (
                                <button
                                    onClick={() => onApplyFont?.(fonts.primary!)}
                                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-sm"
                                    style={{ fontFamily: fonts.primary }}
                                >
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground block">Primary</span>
                                    {fonts.primary}
                                </button>
                            )}
                            {fonts.secondary && (
                                <button
                                    onClick={() => onApplyFont?.(fonts.secondary!)}
                                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-sm"
                                    style={{ fontFamily: fonts.secondary }}
                                >
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground block">Secondary</span>
                                    {fonts.secondary}
                                </button>
                            )}
                            {fonts.body && (
                                <button
                                    onClick={() => onApplyFont?.(fonts.body!)}
                                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-sm"
                                    style={{ fontFamily: fonts.body }}
                                >
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground block">Body</span>
                                    {fonts.body}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Voice & Tone */}
                {voiceTone && (
                    <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Brand Voice
                        </h4>
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 leading-relaxed">
                            {voiceTone}
                        </p>
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}
