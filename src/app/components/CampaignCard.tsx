'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical, Pencil, Trash2, Megaphone } from 'lucide-react';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './ui/alert-dialog';
import { Input } from './ui/input';
import { updateCampaign, deleteCampaign } from '@/app/lib/services/campaigns.service';
import type { Campaign } from '@/app/lib/services/campaigns.service';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-600',
};

interface CampaignCardProps {
    campaign: Campaign;
    designCount?: number;
    onDeleted: (id: string) => void;
    onUpdated: (campaign: Campaign) => void;
}

export function CampaignCard({ campaign, designCount = 0, onDeleted, onUpdated }: CampaignCardProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(campaign.name);

    const handleOpen = () => {
        router.push(`/campaigns/${campaign.id}`);
    };

    const handleRename = async () => {
        if (!newName.trim() || newName === campaign.name) {
            setIsRenaming(false);
            return;
        }
        try {
            const updated = await updateCampaign(campaign.id, { name: newName.trim() });
            if (updated) {
                onUpdated(updated);
                toast.success('Campaign renamed');
            }
        } catch (err) {
            console.error('Error renaming campaign:', err);
            toast.error('Failed to rename campaign');
            setNewName(campaign.name);
        } finally {
            setIsRenaming(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteCampaign(campaign.id);
            onDeleted(campaign.id);
            toast.success('Campaign deleted');
        } catch (err) {
            console.error('Error deleting campaign:', err);
            toast.error('Failed to delete campaign');
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const timeAgo = formatDistanceToNow(new Date(campaign.updated_at), { addSuffix: true });
    const statusClass = statusColors[campaign.status] || statusColors.draft;

    return (
        <>
            <div
                className={cn(
                    'group relative rounded-xl border bg-card hover:shadow-lg transition-all cursor-pointer overflow-hidden',
                    isDeleting && 'opacity-50 pointer-events-none'
                )}
                onClick={handleOpen}
            >
                {/* Thumbnail area */}
                <div className="aspect-[16/10] bg-gradient-to-br from-muted to-muted/50 relative flex items-center justify-center">
                    <Megaphone className="h-10 w-10 text-muted-foreground/30" />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="secondary" size="sm">
                            Open Campaign
                        </Button>
                    </div>

                    {/* Status badge */}
                    <span
                        className={cn(
                            'absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                            statusClass
                        )}
                    >
                        {campaign.status}
                    </span>
                </div>

                {/* Info */}
                <div className="p-3">
                    {isRenaming ? (
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={handleRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename();
                                if (e.key === 'Escape') {
                                    setNewName(campaign.name);
                                    setIsRenaming(false);
                                }
                            }}
                            className="h-7 -ml-2 mb-1"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <h3 className="font-medium truncate mb-0.5">{campaign.name}</h3>
                    )}

                    {campaign.brief && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                            {campaign.brief}
                        </p>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{designCount} design{designCount !== 1 ? 's' : ''}</span>
                            <span className="text-border">|</span>
                            <span>{timeAgo}</span>
                        </div>

                        {/* Actions dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{campaign.name}&quot;? All linked designs will be unlinked but not deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
