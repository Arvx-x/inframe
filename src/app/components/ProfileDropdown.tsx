'use client';

import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Button } from '@/app/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { User, LogOut, Settings, FolderOpen, Megaphone, Palette, LayoutTemplate } from 'lucide-react';
import { AuthModal } from './AuthModal';
import Link from 'next/link';

export function ProfileDropdown() {
    const { user, loading, signOut } = useAuth();
    const [authModalOpen, setAuthModalOpen] = useState(false);

    if (loading) {
        return (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
        );
    }

    if (!user) {
        return (
            <>
                <Button
                    onClick={() => setAuthModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-9 px-3"
                >
                    <User className="mr-2 h-4 w-4" />
                    Sign In
                </Button>
                <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
            </>
        );
    }

    const getInitials = (email: string) => {
        return email.substring(0, 2).toUpperCase();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || ''} />
                        <AvatarFallback>{getInitials(user.email || 'U')}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {user.user_metadata?.full_name || 'User'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/" className="cursor-pointer">
                        <FolderOpen className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/campaigns" className="cursor-pointer">
                        <Megaphone className="mr-2 h-4 w-4" />
                        <span>Campaigns</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/brand-kit" className="cursor-pointer">
                        <Palette className="mr-2 h-4 w-4" />
                        <span>Brand Kit</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/templates" className="cursor-pointer">
                        <LayoutTemplate className="mr-2 h-4 w-4" />
                        <span>Templates</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
