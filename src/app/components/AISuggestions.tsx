'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Video, LayoutTemplate, RefreshCw } from 'lucide-react';
import type { Campaign } from '@/app/lib/services/campaigns.service';

interface AISuggestionsProps {
    campaigns: Campaign[];
    className?: string;
}

interface Suggestion {
    id: string;
    label: string;
    icon: React.ElementType;
    action: () => void;
}

export function AISuggestions({ campaigns, className }: AISuggestionsProps) {
    const router = useRouter();

    // Generate contextual suggestions based on user's data
    const suggestions: Suggestion[] = [];

    // Suggest continuing the most recent draft campaign
    const draftCampaign = campaigns.find((c) => c.status === 'draft');
    if (draftCampaign) {
        suggestions.push({
            id: 'continue-draft',
            label: `Continue "${draftCampaign.name.length > 30 ? draftCampaign.name.slice(0, 30) + '...' : draftCampaign.name}"`,
            icon: ArrowRight,
            action: () => router.push(`/campaigns/${draftCampaign.id}`),
        });
    }

    // Suggest creating from a template
    suggestions.push({
        id: 'from-template',
        label: 'Start from a template',
        icon: LayoutTemplate,
        action: () => router.push('/templates'),
    });

    // Suggest generating a video from an active campaign
    const activeCampaign = campaigns.find((c) => c.status === 'active');
    if (activeCampaign) {
        suggestions.push({
            id: 'generate-video',
            label: 'Generate video from latest design',
            icon: Video,
            action: () => router.push(`/campaigns/${activeCampaign.id}`),
        });
    }

    // Suggest a new creative direction
    suggestions.push({
        id: 'new-creative',
        label: 'Explore a new creative direction',
        icon: Sparkles,
        action: () => router.push('/campaigns'),
    });

    // Suggest resizing for another platform
    if (campaigns.length > 0) {
        suggestions.push({
            id: 'resize-platform',
            label: 'Resize designs for another platform',
            icon: RefreshCw,
            action: () => router.push(`/campaigns/${campaigns[0].id}`),
        });
    }

    // Show at most 4 suggestions
    const visibleSuggestions = suggestions.slice(0, 4);

    if (visibleSuggestions.length === 0) return null;

    return (
        <div className={className}>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Suggested for you
            </p>
            <div className="flex flex-wrap gap-2">
                {visibleSuggestions.map((s) => {
                    const Icon = s.icon;
                    return (
                        <button
                            key={s.id}
                            onClick={s.action}
                            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl border bg-card hover:bg-accent transition-colors"
                        >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{s.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
