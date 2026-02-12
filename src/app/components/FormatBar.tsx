'use client';

import { useState, useEffect } from 'react';
import { getDesignFormats } from '@/app/lib/services/formats.service';
import type { DesignFormat } from '@/app/lib/services/formats.service';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Monitor, ChevronDown } from 'lucide-react';

interface FormatBarProps {
    activeFormat?: DesignFormat | null;
    onFormatChange?: (format: DesignFormat) => void;
    className?: string;
}

const platformGroups: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'X / Twitter',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    print: 'Print',
    custom: 'Custom',
};

export function FormatBar({ activeFormat, onFormatChange, className }: FormatBarProps) {
    const [formats, setFormats] = useState<DesignFormat[]>([]);

    useEffect(() => {
        getDesignFormats().then(setFormats).catch(() => {});
    }, []);

    // Group formats by platform
    const grouped = formats.reduce<Record<string, DesignFormat[]>>((acc, f) => {
        const key = f.platform;
        if (!acc[key]) acc[key] = [];
        acc[key].push(f);
        return acc;
    }, {});

    const label = activeFormat
        ? `${activeFormat.name} (${activeFormat.width}x${activeFormat.height})`
        : 'No format selected';

    return (
        <div className={className}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                        <Monitor className="h-3 w-3" />
                        <span className="max-w-[180px] truncate">{label}</span>
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-64">
                    {/* No format option */}
                    <DropdownMenuItem
                        onClick={() => onFormatChange?.(null as any)}
                        className="text-xs"
                    >
                        Freeform (no format)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {Object.entries(grouped).map(([platform, fmts]) => (
                        <div key={platform}>
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {platformGroups[platform] || platform}
                            </DropdownMenuLabel>
                            {fmts.map((f) => (
                                <DropdownMenuItem
                                    key={f.id}
                                    onClick={() => onFormatChange?.(f)}
                                    className="text-xs flex justify-between"
                                >
                                    <span>{f.name}</span>
                                    <span className="text-muted-foreground ml-2">
                                        {f.width}x{f.height}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </div>
                    ))}

                    {formats.length === 0 && (
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            No formats available. Seed design_formats table.
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
