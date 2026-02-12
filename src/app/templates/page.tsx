'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { getUserTemplates } from '@/app/lib/services/templates.service';
import type { Template } from '@/app/lib/services/templates.service';
import { AppNavigation } from '@/app/components/AppNavigation';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Search, LayoutTemplate, Sparkles, Plus } from 'lucide-react';
import { TemplatePreview } from '@/app/components/TemplatePreview';
import { toast } from 'sonner';

const CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'social_post', label: 'Social Posts' },
    { value: 'story', label: 'Stories' },
    { value: 'ad', label: 'Ads' },
    { value: 'banner', label: 'Banners' },
    { value: 'email_header', label: 'Email' },
    { value: 'presentation', label: 'Presentations' },
    { value: 'print', label: 'Print' },
];

const PLATFORMS = [
    { value: 'all', label: 'All Platforms' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'twitter', label: 'X / Twitter' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' },
];

export default function TemplatesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

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
                const data = await getUserTemplates(user.id);
                setTemplates(data);
            } catch {
                toast.error('Failed to load templates');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    const filtered = templates.filter((t) => {
        const matchesSearch =
            !searchQuery.trim() ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = category === 'all' || t.category === category;
        return matchesSearch && matchesCategory;
    });

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

            <main className="container px-6 py-8 max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold">Templates</h1>
                        <p className="text-sm text-muted-foreground">
                            Browse templates or let AI generate a custom one for you.
                        </p>
                    </div>
                </div>

                {/* AI Template Generator prompt */}
                <div className="border rounded-xl p-5 bg-card mb-6">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium mb-1">Generate a Custom Template</h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Describe the template you need and AI will create one for you.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder='e.g. "Minimal product showcase for Instagram with tagline space"'
                                    className="flex-1 h-9 text-sm"
                                    disabled
                                />
                                <Button size="sm" disabled className="h-9">
                                    Generate (Coming Soon)
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-6">
                    {/* Category tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.value}
                                onClick={() => setCategory(cat.value)}
                                className={`px-3 py-1 text-sm rounded-md whitespace-nowrap transition-colors ${
                                    category === cat.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative ml-auto max-w-xs w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Templates grid */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                                <Skeleton className="h-3 w-3/4" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <LayoutTemplate className="h-10 w-10 text-muted-foreground/40 mb-3" />
                        <h3 className="font-medium mb-1">
                            {templates.length === 0 ? 'No templates yet' : 'No matching templates'}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mb-4">
                            {templates.length === 0
                                ? 'Templates will appear here once you save designs as templates, or when system templates are seeded.'
                                : 'Try a different search or category.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filtered.map((template) => (
                            <div
                                key={template.id}
                                className="group relative rounded-xl border bg-card hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                                onClick={() => setPreviewTemplate(template)}
                            >
                                <div className="aspect-[3/4] bg-gradient-to-br from-muted to-muted/50 relative flex items-center justify-center">
                                    {template.thumbnail_url ? (
                                        <img
                                            src={template.thumbnail_url}
                                            alt={template.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <LayoutTemplate className="h-8 w-8 text-muted-foreground/30" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button variant="secondary" size="sm">
                                            Use Template
                                        </Button>
                                    </div>

                                    {template.is_system && (
                                        <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                            System
                                        </span>
                                    )}
                                </div>
                                <div className="p-2.5">
                                    <h3 className="text-sm font-medium truncate">{template.name}</h3>
                                    <p className="text-[11px] text-muted-foreground capitalize">{template.category.replace('_', ' ')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Template Preview Modal */}
                <TemplatePreview
                    template={previewTemplate}
                    open={previewTemplate !== null}
                    onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}
                />
            </main>
        </div>
    );
}
