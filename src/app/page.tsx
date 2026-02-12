'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { getUserCampaigns } from '@/app/lib/services/campaigns.service';
import { getUserProjects } from '@/app/lib/services/projects.service';
import { AppNavigation } from '@/app/components/AppNavigation';
import { AICommandBar } from '@/app/components/AICommandBar';
import { AISuggestions } from '@/app/components/AISuggestions';
import { CampaignCard } from '@/app/components/CampaignCard';
import { ProjectCard } from '@/app/components/ProjectCard';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Campaign } from '@/app/lib/services/campaigns.service';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [recentProjects, setRecentProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Redirect unsigned users to editor
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/editor');
        }
    }, [user, authLoading, router]);

    // Load campaigns + recent projects
    useEffect(() => {
        async function loadData() {
            if (!user) return;
            try {
                setLoading(true);
                const [userCampaigns, userProjects] = await Promise.all([
                    getUserCampaigns(user.id),
                    getUserProjects(user.id),
                ]);
                setCampaigns(userCampaigns);
                setRecentProjects(userProjects.slice(0, 6));
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                toast.error('Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [user]);

    if (authLoading || !user) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        );
    }

    const handleCampaignDeleted = (id: string) => {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
    };

    const handleCampaignUpdated = (updated: Campaign) => {
        setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    };

    const handleProjectDeleted = (id: string) => {
        setRecentProjects((prev) => prev.filter((p: any) => p.id !== id));
    };

    const handleProjectUpdated = (updated: any) => {
        setRecentProjects((prev) => prev.map((p: any) => (p.id === updated.id ? updated : p)));
    };

    return (
        <div className="min-h-screen bg-background">
            <AppNavigation />

            <main className="container px-6 py-10 max-w-6xl mx-auto">
                {/* Hero: AI Command Bar */}
                <AICommandBar className="mb-10" />

                {/* AI Suggestions */}
                {!loading && (
                    <AISuggestions campaigns={campaigns} className="mb-10" />
                )}

                {/* Recent Campaigns */}
                <section className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Recent Campaigns</h2>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/campaigns')}
                                className="text-xs"
                            >
                                View All
                                <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="aspect-[16/10] w-full rounded-xl" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-xl bg-card">
                            <div className="rounded-full bg-muted p-4 mb-3">
                                <Plus className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium mb-1">No campaigns yet</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mb-4">
                                Use the AI command bar above to describe your first campaign, or create one manually.
                            </p>
                            <Button onClick={() => router.push('/campaigns')} size="sm">
                                <Plus className="mr-1 h-4 w-4" />
                                New Campaign
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {campaigns.slice(0, 6).map((campaign) => (
                                <CampaignCard
                                    key={campaign.id}
                                    campaign={campaign}
                                    onDeleted={handleCampaignDeleted}
                                    onUpdated={handleCampaignUpdated}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Recent Designs */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Recent Designs</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/editor')}
                            className="text-xs"
                        >
                            <Plus className="mr-1 h-3 w-3" />
                            New Design
                        </Button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="aspect-[16/10] w-full rounded-lg" />
                                    <Skeleton className="h-3 w-3/4" />
                                </div>
                            ))}
                        </div>
                    ) : recentProjects.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            No designs yet. Designs will appear here as you create campaign visuals.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {recentProjects.map((project) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    viewMode="grid"
                                    onDeleted={handleProjectDeleted}
                                    onUpdated={handleProjectUpdated}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
