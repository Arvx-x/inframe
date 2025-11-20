'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { getUserProjects } from '@/app/lib/services/projects.service';
import { ProjectsGrid } from '@/app/components/ProjectsGrid';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ProfileDropdown } from '@/app/components/ProfileDropdown';
import { Search, Grid3x3, List, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<any[]>([]);
    const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Redirect to home if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
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
        router.push('/');
    };

    if (authLoading || !user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center px-4">
                    {/* Left: Back button + Title */}
                    <div className="flex items-center gap-4 flex-1">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Editor
                            </Button>
                        </Link>
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

                    {/* Right: View toggle + Profile */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="flex items-center border rounded-md">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                className="rounded-r-none"
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                className="rounded-l-none"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                        <ProfileDropdown />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container px-4 py-8">
                {/* Create New Project Button */}
                <div className="mb-6">
                    <Button onClick={handleCreateProject} size="lg" className="gap-2 bg-black hover:bg-black/90 text-white">
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
