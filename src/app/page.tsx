'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { getUserProjects } from '@/app/lib/services/projects.service';
import { ProjectsGrid } from '@/app/components/ProjectsGrid';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ProfileDropdown } from '@/app/components/ProfileDropdown';
import { Search, Grid3x3, List, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<any[]>([]);
    const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Redirect unsigned users to editor to use canvas
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/editor');
        }
    }, [user, authLoading, router]);

    // Load projects
    useEffect(() => {
        async function loadProjects() {
            if (!user) return;

            try {
                setLoading(true);
                const userProjects = await getUserProjects(user.id);
                setProjects(userProjects);
                setFilteredProjects(userProjects);
            } catch (error) {
                console.error('Error loading projects:', error);
                toast.error('Failed to load projects');
            } finally {
                setLoading(false);
            }
        }

        loadProjects();
    }, [user]);

    // Filter projects based on search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredProjects(projects);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = projects.filter((project) =>
            project.name.toLowerCase().includes(query)
        );
        setFilteredProjects(filtered);
    }, [searchQuery, projects]);

    const handleCreateProject = () => {
        router.push('/editor');
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!user) {
        // Redirect will happen in useEffect, show loading meanwhile
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center px-4">
                    {/* Left: Profile + Title */}
                    <div className="flex items-center gap-4 flex-1">
                        <ProfileDropdown />
                        <h1 className="text-lg font-semibold">My Projects</h1>
                    </div>

                    {/* Center: Search */}
                    <div className="flex-1 flex justify-center max-w-md">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-full"
                            />
                        </div>
                    </div>

                    {/* Right: View toggle */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="flex items-center border rounded-md">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                className={viewMode === 'grid' ? 'rounded-r-none bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90 text-white' : 'rounded-r-none'}
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                className={viewMode === 'list' ? 'rounded-l-none bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90 text-white' : 'rounded-l-none'}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container px-4 py-8">
                {/* Create New Project Button */}
                <div className="mb-6">
                    <Button onClick={handleCreateProject} size="lg" className="gap-2 bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90 text-white">
                        <Plus className="h-5 w-5" />
                        New Project
                    </Button>
                </div>

                {/* Projects Grid */}
                <ProjectsGrid
                    projects={filteredProjects}
                    loading={loading}
                    viewMode={viewMode}
                    onProjectsChange={setProjects}
                />
            </main>
        </div>
    );
}
