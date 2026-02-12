'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { getUserCampaigns, createCampaign } from '@/app/lib/services/campaigns.service';
import type { Campaign } from '@/app/lib/services/campaigns.service';
import { AppNavigation } from '@/app/components/AppNavigation';
import { AICommandBar } from '@/app/components/AICommandBar';
import { CampaignCard } from '@/app/components/CampaignCard';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'draft' | 'active' | 'completed' | 'archived';

export default function CampaignsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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
                const data = await getUserCampaigns(user.id);
                setCampaigns(data);
            } catch (err) {
                console.error('Error loading campaigns:', err);
                toast.error('Failed to load campaigns');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    const handleCreateCampaign = async () => {
        if (!user) return;
        try {
            const campaign = await createCampaign({
                user_id: user.id,
                name: 'Untitled Campaign',
                status: 'draft',
            });
            router.push(`/campaigns/${campaign.id}`);
        } catch (err: any) {
            console.error('Error creating campaign:', err);
            toast.error(err?.message || 'Failed to create campaign');
        }
    };

    const filtered = campaigns.filter((c) => {
        const matchesSearch =
            !searchQuery.trim() ||
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.brief && c.brief.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (authLoading || !user) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        );
    }

    const statusTabs: { value: StatusFilter; label: string }[] = [
        { value: 'all', label: 'All' },
        { value: 'draft', label: 'Drafts' },
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
        { value: 'archived', label: 'Archived' },
    ];

    return (
        <div className="min-h-screen bg-background">
            <AppNavigation />

            <main className="container px-6 py-8 max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-semibold">Campaigns</h1>
                    <Button onClick={handleCreateCampaign} className="gap-1">
                        <Plus className="h-4 w-4" />
                        New Campaign
                    </Button>
                </div>

                {/* Compact AI bar */}
                <AICommandBar compact className="mb-6 max-w-lg" />

                {/* Filters */}
                <div className="flex items-center gap-4 mb-6">
                    {/* Status tabs */}
                    <div className="flex items-center gap-1 border rounded-lg p-0.5">
                        {statusTabs.map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setStatusFilter(tab.value)}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                    statusFilter === tab.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search campaigns..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="aspect-[16/10] w-full rounded-xl" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-muted p-6 mb-4">
                            <Plus className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium mb-1">
                            {campaigns.length === 0 ? 'No campaigns yet' : 'No matching campaigns'}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">
                            {campaigns.length === 0
                                ? 'Create your first campaign to start building marketing visuals with AI.'
                                : 'Try a different search or filter.'}
                        </p>
                        {campaigns.length === 0 && (
                            <Button onClick={handleCreateCampaign}>
                                <Plus className="mr-1 h-4 w-4" />
                                Create Campaign
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filtered.map((campaign) => (
                            <CampaignCard
                                key={campaign.id}
                                campaign={campaign}
                                onDeleted={(id) => setCampaigns((p) => p.filter((c) => c.id !== id))}
                                onUpdated={(updated) =>
                                    setCampaigns((p) => p.map((c) => (c.id === updated.id ? updated : c)))
                                }
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
