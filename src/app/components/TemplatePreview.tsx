'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { createProject } from '@/app/lib/services/projects.service';
import type { Template } from '@/app/lib/services/templates.service';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { LayoutTemplate, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface TemplatePreviewProps {
    template: Template | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TemplatePreview({ template, open, onOpenChange }: TemplatePreviewProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [isCreating, setIsCreating] = useState(false);

    if (!template) return null;

    const handleUseTemplate = async () => {
        if (!user) {
            // Unsigned users go directly to editor with template param
            router.push(`/editor?template=${template.id}`);
            onOpenChange(false);
            return;
        }

        setIsCreating(true);
        try {
            // Create a new project pre-filled with the template's canvas data
            const project = await createProject(user.id, `From: ${template.name}`);
            // Navigate to editor with both project and template IDs
            router.push(`/editor?project=${project.id}&template=${template.id}`);
            onOpenChange(false);
        } catch (err) {
            console.error('Error creating project from template:', err);
            toast.error('Failed to create project from template');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LayoutTemplate className="h-5 w-5" />
                        {template.name}
                    </DialogTitle>
                    <DialogDescription>
                        {template.category.replace('_', ' ')} template
                        {template.is_system && ' (System)'}
                    </DialogDescription>
                </DialogHeader>

                {/* Preview */}
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                    {template.thumbnail_url ? (
                        <img
                            src={template.thumbnail_url}
                            alt={template.name}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <LayoutTemplate className="h-12 w-12 text-muted-foreground/30" />
                    )}
                </div>

                {/* AI customization hints */}
                {template.ai_customization_hints && (
                    <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{template.ai_customization_hints}</span>
                        </p>
                    </div>
                )}

                {/* Tags */}
                {template.tags && Array.isArray(template.tags) && (
                    <div className="flex flex-wrap gap-1">
                        {(template.tags as string[]).map((tag, i) => (
                            <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleUseTemplate} disabled={isCreating}>
                        {isCreating ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : null}
                        Use Template
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
