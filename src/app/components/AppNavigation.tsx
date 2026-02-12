'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProfileDropdown } from './ProfileDropdown';
import { cn } from '@/app/lib/utils';
import { Megaphone, Palette, LayoutTemplate, FolderOpen, Sparkles } from 'lucide-react';

const navItems = [
    { href: '/', label: 'Home', icon: Sparkles },
    { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { href: '/brand-kit', label: 'Brand Kit', icon: Palette },
    { href: '/templates', label: 'Templates', icon: LayoutTemplate },
];

export function AppNavigation() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 mr-8">
                    <img src="/logooo2.png" alt="inFrame" className="h-7 w-7" />
                    <span className="font-semibold text-lg tracking-tight">inFrame</span>
                </Link>

                {/* Nav Links */}
                <nav className="flex items-center gap-1 flex-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                                    isActive(item.href)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right side */}
                <div className="flex items-center gap-3">
                    <ProfileDropdown />
                </div>
            </div>
        </header>
    );
}
