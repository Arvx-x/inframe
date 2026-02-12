'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import {
    getUserBrandKits,
    createBrandKit,
    updateBrandKit,
    deleteBrandKit,
} from '@/app/lib/services/brand-kit.service';
import type { BrandKit } from '@/app/lib/services/brand-kit.service';
import { AppNavigation } from '@/app/components/AppNavigation';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
    Plus,
    Trash2,
    Palette,
    Type,
    Sparkles,
    X,
    Loader2,
    Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface BrandKitEditorProps {
    kit: BrandKit;
    onUpdate: (kit: BrandKit) => void;
    onDelete: (id: string) => void;
}

function BrandKitEditor({ kit, onUpdate, onDelete }: BrandKitEditorProps) {
    const [name, setName] = useState(kit.name);
    const [colors, setColors] = useState<string[]>((kit.colors as string[]) || []);
    const [newColor, setNewColor] = useState('#000000');
    const [fonts, setFonts] = useState<{ primary: string; secondary: string; body: string }>(
        (kit.fonts as any) || { primary: '', secondary: '', body: '' }
    );
    const [voiceTone, setVoiceTone] = useState(kit.voice_tone || '');
    const [guidelinesText, setGuidelinesText] = useState(kit.guidelines_text || '');
    const [isSaving, setIsSaving] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            const updated = await updateBrandKit(kit.id, {
                name,
                colors: colors as any,
                fonts: fonts as any,
                voice_tone: voiceTone || null,
                guidelines_text: guidelinesText || null,
            });
            if (updated) {
                onUpdate(updated);
                toast.success('Brand kit saved');
            }
        } catch {
            toast.error('Failed to save brand kit');
        } finally {
            setIsSaving(false);
        }
    }, [kit.id, name, colors, fonts, voiceTone, guidelinesText, onUpdate]);

    const handleDeleteConfirm = async () => {
        try {
            await deleteBrandKit(kit.id);
            onDelete(kit.id);
            toast.success('Brand kit deleted');
        } catch {
            toast.error('Failed to delete brand kit');
        }
        setShowDelete(false);
    };

    const addColor = () => {
        if (colors.length >= 12) return;
        setColors([...colors, newColor]);
    };

    const removeColor = (idx: number) => {
        setColors(colors.filter((_, i) => i !== idx));
    };

    return (
        <div className="border rounded-xl bg-card p-5 space-y-5">
            {/* Name */}
            <div className="flex items-center justify-between">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-lg font-semibold border-0 border-b border-transparent hover:border-border focus-visible:border-border rounded-none px-0 h-auto focus-visible:ring-0"
                    placeholder="Brand Kit Name"
                />
                <div className="flex items-center gap-2 ml-4">
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="ml-1">Save</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowDelete(true)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            </div>

            {/* Colors */}
            <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Palette className="h-4 w-4" />
                    Brand Colors
                </h4>
                <div className="flex flex-wrap gap-2 items-center">
                    {colors.map((color, idx) => (
                        <div key={idx} className="relative group">
                            <div
                                className="w-10 h-10 rounded-lg border shadow-sm cursor-pointer"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                            <button
                                onClick={() => removeColor(idx)}
                                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    ))}
                    <div className="flex items-center gap-1">
                        <input
                            type="color"
                            value={newColor}
                            onChange={(e) => setNewColor(e.target.value)}
                            className="w-10 h-10 rounded-lg border cursor-pointer"
                        />
                        <Button size="sm" variant="outline" onClick={addColor} disabled={colors.length >= 12}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Fonts */}
            <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Type className="h-4 w-4" />
                    Fonts
                </h4>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground">Primary</label>
                        <Input
                            value={fonts.primary}
                            onChange={(e) => setFonts({ ...fonts, primary: e.target.value })}
                            placeholder="e.g. Montserrat"
                            className="h-8 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Secondary</label>
                        <Input
                            value={fonts.secondary}
                            onChange={(e) => setFonts({ ...fonts, secondary: e.target.value })}
                            placeholder="e.g. Inter"
                            className="h-8 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Body</label>
                        <Input
                            value={fonts.body}
                            onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
                            placeholder="e.g. Lato"
                            className="h-8 text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Voice & Tone */}
            <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    Brand Voice & Tone
                </h4>
                <Textarea
                    value={voiceTone}
                    onChange={(e) => setVoiceTone(e.target.value)}
                    placeholder="Describe your brand's voice (e.g. friendly, professional, bold, playful)..."
                    rows={2}
                    className="text-sm resize-none"
                />
            </div>

            {/* Guidelines */}
            <div>
                <h4 className="text-sm font-medium mb-2">Brand Guidelines</h4>
                <Textarea
                    value={guidelinesText}
                    onChange={(e) => setGuidelinesText(e.target.value)}
                    placeholder="Additional brand guidelines, dos and don'ts, style notes..."
                    rows={3}
                    className="text-sm resize-none"
                />
            </div>

            {/* AI brand summary (read-only if set) */}
            {kit.ai_brand_summary && (
                <div>
                    <h4 className="text-sm font-medium mb-1 text-muted-foreground">AI Brand Summary</h4>
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                        {kit.ai_brand_summary}
                    </p>
                </div>
            )}

            <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete brand kit?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{kit.name}&quot;? Campaigns using this kit will be unlinked.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function BrandKitPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [kits, setKits] = useState<BrandKit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/editor');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        async function load() {
            if (!user) return;
            try {
                setLoading(true);
                const data = await getUserBrandKits(user.id);
                setKits(data);
            } catch {
                toast.error('Failed to load brand kits');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    const handleCreate = async () => {
        if (!user) return;
        try {
            const kit = await createBrandKit({
                user_id: user.id,
                name: 'New Brand Kit',
            });
            setKits((prev) => [kit, ...prev]);
        } catch {
            toast.error('Failed to create brand kit');
        }
    };

    if (authLoading || !user) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <AppNavigation />

            <main className="container px-6 py-8 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold">Brand Kit</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage brand colors, fonts, voice, and guidelines. AI uses these to keep your campaigns on-brand.
                        </p>
                    </div>
                    <Button onClick={handleCreate} className="gap-1">
                        <Plus className="h-4 w-4" />
                        New Brand Kit
                    </Button>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2].map((i) => (
                            <Skeleton key={i} className="h-64 rounded-xl" />
                        ))}
                    </div>
                ) : kits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card">
                        <Palette className="h-10 w-10 text-muted-foreground/40 mb-3" />
                        <h3 className="font-medium mb-1">No brand kits yet</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mb-4">
                            Create a brand kit to maintain consistency across all your campaigns.
                        </p>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-1 h-4 w-4" />
                            Create Brand Kit
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {kits.map((kit) => (
                            <BrandKitEditor
                                key={kit.id}
                                kit={kit}
                                onUpdate={(updated) =>
                                    setKits((prev) =>
                                        prev.map((k) => (k.id === updated.id ? updated : k))
                                    )
                                }
                                onDelete={(id) => setKits((prev) => prev.filter((k) => k.id !== id))}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
