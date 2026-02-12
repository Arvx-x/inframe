'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { getCampaign, updateCampaign, getCampaignDesigns } from '@/app/lib/services/campaigns.service';
import { getProject } from '@/app/lib/services/projects.service';
import { getUserBrandKits } from '@/app/lib/services/brand-kit.service';
import type { Campaign, CampaignDesign } from '@/app/lib/services/campaigns.service';
import type { BrandKit } from '@/app/lib/services/brand-kit.service';
import { AppNavigation } from '@/app/components/AppNavigation';
import { ProjectCard } from '@/app/components/ProjectCard';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/app/components/ui/select';
import {
    ArrowLeft,
    Pencil,
    Sparkles,
    Plus,
    Loader2,
    Palette,
    Video,
    Send,
    Download,
} from 'lucide-react';
import { BatchExportDialog } from '@/app/components/BatchExportDialog';
import { toast } from 'sonner';

export default function CampaignDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const campaignId = params.id as string;

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [designs, setDesigns] = useState<any[]>([]);
    const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [briefInput, setBriefInput] = useState('');
    const [aiChatInput, setAiChatInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showBatchExport, setShowBatchExport] = useState(false);

    useEffect(() => {
        async function load() {
            if (!user || !campaignId) return;
            try {
                setLoading(true);
                const [campaignData, campaignDesigns, userBrandKits] = await Promise.all([
                    getCampaign(campaignId),
                    getCampaignDesigns(campaignId),
                    getUserBrandKits(user.id),
                ]);

                if (!campaignData) {
                    toast.error('Campaign not found');
                    router.push('/campaigns');
                    return;
                }

                setCampaign(campaignData);
                setNameInput(campaignData.name);
                setBriefInput(campaignData.brief || '');
                setBrandKits(userBrandKits);

                // Load project details for each design link
                const projectPromises = campaignDesigns.map((cd) => getProject(cd.project_id));
                const projects = await Promise.all(projectPromises);
                setDesigns(projects.filter(Boolean));
            } catch (err) {
                console.error('Error loading campaign:', err);
                toast.error('Failed to load campaign');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user, campaignId, router]);

    const saveName = useCallback(async () => {
        if (!campaign || !nameInput.trim() || nameInput === campaign.name) {
            setIsEditingName(false);
            return;
        }
        try {
            const updated = await updateCampaign(campaign.id, { name: nameInput.trim() });
            if (updated) setCampaign(updated);
        } catch {
            toast.error('Failed to rename campaign');
            setNameInput(campaign.name);
        }
        setIsEditingName(false);
    }, [campaign, nameInput]);

    const saveBrief = useCallback(async () => {
        if (!campaign) return;
        setIsSaving(true);
        try {
            const updated = await updateCampaign(campaign.id, { brief: briefInput });
            if (updated) setCampaign(updated);
            toast.success('Brief saved');
        } catch {
            toast.error('Failed to save brief');
        } finally {
            setIsSaving(false);
        }
    }, [campaign, briefInput]);

    const handleStatusChange = useCallback(
        async (newStatus: string) => {
            if (!campaign) return;
            try {
                const updated = await updateCampaign(campaign.id, { status: newStatus });
                if (updated) setCampaign(updated);
                toast.success(`Campaign marked as ${newStatus}`);
            } catch {
                toast.error('Failed to update status');
            }
        },
        [campaign]
    );

    const handleBrandKitChange = useCallback(
        async (kitId: string) => {
            if (!campaign) return;
            try {
                const updated = await updateCampaign(campaign.id, {
                    brand_kit_id: kitId === 'none' ? null : kitId,
                });
                if (updated) setCampaign(updated);
                toast.success('Brand kit updated');
            } catch {
                toast.error('Failed to link brand kit');
            }
        },
        [campaign]
    );

    const handleAiChat = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!aiChatInput.trim() || !campaign) return;
            setIsAiProcessing(true);
            try {
                const activeBrandKit = campaign.brand_kit_id
                    ? brandKits.find((k) => k.id === campaign.brand_kit_id)
                    : null;
                const brandKitPayload = activeBrandKit
                    ? {
                          name: activeBrandKit.name,
                          colors: activeBrandKit.colors as string[],
                          fonts: activeBrandKit.fonts as { primary?: string; secondary?: string; body?: string },
                          voiceTone: activeBrandKit.voice_tone || undefined,
                          guidelines: activeBrandKit.guidelines_text || undefined,
                      }
                    : null;

                const res = await fetch('/api/generate-campaign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        brief: aiChatInput.trim(),
                        brandKit: brandKitPayload,
                        targetAudience: campaign.target_audience || undefined,
                    }),
                });

                if (res.ok) {
                    const { strategy } = await res.json();
                    if (strategy?.campaignName) {
                        // Auto-apply the strategy to the campaign
                        const updated = await updateCampaign(campaign.id, {
                            name: strategy.campaignName,
                            ai_strategy: strategy as any,
                        });
                        if (updated) setCampaign(updated);
                        toast.success('AI strategy generated and applied!');
                    } else {
                        toast.success('AI strategy generated');
                    }
                } else {
                    toast.error('Failed to generate strategy');
                }
            } catch (err) {
                console.error('AI chat error:', err);
                toast.error('Something went wrong');
            } finally {
                setIsAiProcessing(false);
                setAiChatInput('');
            }
        },
        [aiChatInput, campaign, brandKits]
    );

    const handleNewDesign = () => {
        router.push(`/editor?campaign=${campaignId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <AppNavigation />
                <main className="container px-6 py-8 max-w-5xl mx-auto">
                    <Skeleton className="h-8 w-48 mb-4" />
                    <Skeleton className="h-4 w-96 mb-8" />
                    <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="aspect-[16/10] rounded-xl" />
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    if (!campaign) return null;

    return (
        <div className="min-h-screen bg-background">
            <AppNavigation />

            <main className="container px-6 py-8 max-w-5xl mx-auto">
                {/* Back */}
                <button
                    onClick={() => router.push('/campaigns')}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Campaigns
                </button>

                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                        {isEditingName ? (
                            <Input
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={saveName}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveName();
                                    if (e.key === 'Escape') {
                                        setNameInput(campaign.name);
                                        setIsEditingName(false);
                                    }
                                }}
                                autoFocus
                                className="text-2xl font-semibold h-auto py-0 border-0 border-b border-border rounded-none px-0 focus-visible:ring-0"
                            />
                        ) : (
                            <h1
                                className="text-2xl font-semibold cursor-pointer hover:text-muted-foreground transition-colors inline-flex items-center gap-2"
                                onClick={() => setIsEditingName(true)}
                            >
                                {campaign.name}
                                <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                            </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={campaign.status} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Designs */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-medium">Designs</h2>
                            <div className="flex items-center gap-2">
                                {designs.length > 0 && (
                                    <Button size="sm" variant="outline" onClick={() => setShowBatchExport(true)}>
                                        <Download className="mr-1 h-4 w-4" />
                                        Export All
                                    </Button>
                                )}
                                <Button size="sm" onClick={handleNewDesign}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add Design
                                </Button>
                            </div>
                        </div>

                        {designs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-card">
                                <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-3" />
                                <h3 className="font-medium mb-1">No designs yet</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mb-4">
                                    Add a design manually, or use the AI chat to generate campaign visuals.
                                </p>
                                <Button size="sm" onClick={handleNewDesign}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    Create Design
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {designs.map((project: any) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        viewMode="grid"
                                        onDeleted={(id) =>
                                            setDesigns((p) => p.filter((d: any) => d.id !== id))
                                        }
                                        onUpdated={(updated) =>
                                            setDesigns((p) =>
                                                p.map((d: any) => (d.id === updated.id ? updated : d))
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Brief + Brand Kit + AI Chat */}
                    <div className="space-y-6">
                        {/* Brief */}
                        <div className="border rounded-xl p-4 bg-card">
                            <h3 className="text-sm font-medium mb-2">Campaign Brief</h3>
                            <Textarea
                                value={briefInput}
                                onChange={(e) => setBriefInput(e.target.value)}
                                placeholder="Describe the campaign goals, audience, tone, and key messages..."
                                rows={4}
                                className="mb-2 text-sm resize-none"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={saveBrief}
                                disabled={isSaving}
                                className="w-full"
                            >
                                {isSaving ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : null}
                                Save Brief
                            </Button>
                        </div>

                        {/* Brand Kit */}
                        <div className="border rounded-xl p-4 bg-card">
                            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                <Palette className="h-4 w-4" />
                                Brand Kit
                            </h3>
                            {brandKits.length > 0 ? (
                                <Select
                                    value={campaign.brand_kit_id || 'none'}
                                    onValueChange={handleBrandKitChange}
                                >
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Select brand kit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No brand kit</SelectItem>
                                        {brandKits.map((kit) => (
                                            <SelectItem key={kit.id} value={kit.id}>
                                                {kit.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => router.push('/brand-kit')}
                                >
                                    Create Brand Kit
                                </Button>
                            )}
                        </div>

                        {/* AI Chat */}
                        <div className="border rounded-xl p-4 bg-card">
                            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4" />
                                AI Campaign Assistant
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Tell AI what to do: &quot;Generate 3 Instagram post variations&quot;, &quot;Add a TikTok version&quot;, &quot;Create a video from design #1&quot;
                            </p>
                            <form onSubmit={handleAiChat} className="flex gap-2">
                                <Input
                                    value={aiChatInput}
                                    onChange={(e) => setAiChatInput(e.target.value)}
                                    placeholder="Ask AI..."
                                    disabled={isAiProcessing}
                                    className="flex-1 h-9 text-sm"
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={isAiProcessing || !aiChatInput.trim()}
                                    className="h-9 px-3"
                                >
                                    {isAiProcessing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>
                        </div>

                        {/* Generate Video */}
                        <div className="border rounded-xl p-4 bg-card">
                            <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                                <Video className="h-4 w-4" />
                                Video
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Turn campaign designs into short video clips with AI.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs"
                                disabled
                            >
                                Generate Video (Coming Soon)
                            </Button>
                        </div>
                    </div>
                </div>
                {/* Batch Export Dialog */}
                <BatchExportDialog
                    open={showBatchExport}
                    onOpenChange={setShowBatchExport}
                    targets={designs.map((d: any) => ({
                        id: d.id,
                        name: d.name || 'Untitled',
                        width: 1080,
                        height: 1080,
                        platform: undefined,
                    }))}
                    onExport={async (target, format, scale) => {
                        // In a full implementation, this would render the canvas off-screen
                        // and export it. For now, return null as a placeholder.
                        toast.info(`Export for "${target.name}" would render here.`);
                        return null;
                    }}
                />
            </main>
        </div>
    );
}
