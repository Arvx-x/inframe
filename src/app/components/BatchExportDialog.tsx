'use client';

import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { Download, Loader2, FileImage, FileVideo, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'webp';
export type ExportScale = '1x' | '2x' | '3x';

interface ExportTarget {
    id: string;
    name: string;
    width: number;
    height: number;
    platform?: string;
}

interface BatchExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Available targets (designs/artboards) to export */
    targets: ExportTarget[];
    /** Callback to actually perform the export for a single target */
    onExport: (target: ExportTarget, format: ExportFormat, scale: ExportScale) => Promise<Blob | null>;
}

interface ExportResult {
    targetId: string;
    status: 'pending' | 'exporting' | 'done' | 'error';
    error?: string;
}

export function BatchExportDialog({
    open,
    onOpenChange,
    targets,
    onExport,
}: BatchExportDialogProps) {
    const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(
        new Set(targets.map((t) => t.id))
    );
    const [format, setFormat] = useState<ExportFormat>('png');
    const [scale, setScale] = useState<ExportScale>('2x');
    const [isExporting, setIsExporting] = useState(false);
    const [results, setResults] = useState<ExportResult[]>([]);

    const toggleTarget = (id: string) => {
        setSelectedTargetIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedTargetIds.size === targets.length) {
            setSelectedTargetIds(new Set());
        } else {
            setSelectedTargetIds(new Set(targets.map((t) => t.id)));
        }
    };

    const handleBatchExport = useCallback(async () => {
        if (selectedTargetIds.size === 0) {
            toast.error('Select at least one design to export');
            return;
        }

        setIsExporting(true);
        const exportTargets = targets.filter((t) => selectedTargetIds.has(t.id));
        const newResults: ExportResult[] = exportTargets.map((t) => ({
            targetId: t.id,
            status: 'pending' as const,
        }));
        setResults(newResults);

        let successCount = 0;

        for (let i = 0; i < exportTargets.length; i++) {
            const target = exportTargets[i];
            setResults((prev) =>
                prev.map((r) =>
                    r.targetId === target.id ? { ...r, status: 'exporting' } : r
                )
            );

            try {
                const blob = await onExport(target, format, scale);
                if (blob) {
                    // Trigger download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${target.name.replace(/\s+/g, '_')}_${target.width}x${target.height}.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    successCount++;

                    setResults((prev) =>
                        prev.map((r) =>
                            r.targetId === target.id ? { ...r, status: 'done' } : r
                        )
                    );
                } else {
                    setResults((prev) =>
                        prev.map((r) =>
                            r.targetId === target.id
                                ? { ...r, status: 'error', error: 'Export returned empty' }
                                : r
                        )
                    );
                }
            } catch (err: any) {
                setResults((prev) =>
                    prev.map((r) =>
                        r.targetId === target.id
                            ? { ...r, status: 'error', error: err.message }
                            : r
                    )
                );
            }

            // Small delay between exports to avoid browser choking
            if (i < exportTargets.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
        }

        setIsExporting(false);
        toast.success(`Exported ${successCount}/${exportTargets.length} designs`);
    }, [selectedTargetIds, targets, format, scale, onExport]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Batch Export
                    </DialogTitle>
                    <DialogDescription>
                        Export multiple designs at once in your chosen format and scale.
                    </DialogDescription>
                </DialogHeader>

                {/* Settings */}
                <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Format</label>
                        <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                            <SelectTrigger className="h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="png">PNG</SelectItem>
                                <SelectItem value="jpg">JPG</SelectItem>
                                <SelectItem value="webp">WebP</SelectItem>
                                <SelectItem value="svg">SVG</SelectItem>
                                <SelectItem value="pdf">PDF</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Scale</label>
                        <Select value={scale} onValueChange={(v) => setScale(v as ExportScale)}>
                            <SelectTrigger className="h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1x">1x</SelectItem>
                                <SelectItem value="2x">2x (Recommended)</SelectItem>
                                <SelectItem value="3x">3x (Print)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Target list */}
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
                        <button
                            onClick={toggleAll}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {selectedTargetIds.size === targets.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-xs text-muted-foreground">
                            {selectedTargetIds.size} / {targets.length} selected
                        </span>
                    </div>
                    {targets.map((target) => {
                        const result = results.find((r) => r.targetId === target.id);
                        return (
                            <div
                                key={target.id}
                                className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-accent/50"
                            >
                                <Checkbox
                                    checked={selectedTargetIds.has(target.id)}
                                    onCheckedChange={() => toggleTarget(target.id)}
                                    disabled={isExporting}
                                />
                                <FileImage className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{target.name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {target.width}x{target.height}
                                        {target.platform && ` · ${target.platform}`}
                                    </p>
                                </div>
                                {/* Export status */}
                                {result?.status === 'exporting' && (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                                {result?.status === 'done' && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                                {result?.status === 'error' && (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                )}
                            </div>
                        );
                    })}
                    {targets.length === 0 && (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            No designs to export. Add designs to the campaign first.
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
                        Cancel
                    </Button>
                    <Button onClick={handleBatchExport} disabled={isExporting || selectedTargetIds.size === 0}>
                        {isExporting ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-1 h-4 w-4" />
                        )}
                        Export {selectedTargetIds.size} Design{selectedTargetIds.size !== 1 ? 's' : ''}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
