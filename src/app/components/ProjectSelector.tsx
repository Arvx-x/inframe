'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/app/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { ChevronDown, Plus, FolderOpen, Loader2 } from 'lucide-react';
import { getUserProjects, createProject } from '../lib/services/projects.service';
import { toast } from 'sonner';

interface ProjectSelectorProps {
    currentProjectId: string | null;
    currentProjectName: string;
    onProjectSelect: (projectId: string) => void;
    onCreateProject: (name?: string) => void;
}

export function ProjectSelector({
    currentProjectId,
    currentProjectName,
    onProjectSelect,
    onCreateProject,
}: ProjectSelectorProps) {
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open && user) {
            loadProjects();
        }
    }, [open, user]);

    const loadProjects = async () => {
        if (!user) return;

        setLoading(true);
        try {
            const userProjects = await getUserProjects(user.id);
            setProjects(userProjects);
        } catch (error) {
            console.error('Error loading projects:', error);
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = async () => {
        setOpen(false);
        onCreateProject();
    };

    if (!user) {
        return (
            <h1 className="text-sm font-medium text-foreground">
                {currentProjectName}
            </h1>
        );
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto px-2 py-1 hover:bg-muted/50">
                    <h1 className="text-sm font-medium text-foreground mr-1">
                        {currentProjectName}
                    </h1>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
                <DropdownMenuLabel>Your Projects</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No projects yet
                    </div>
                ) : (
                    <div className="max-h-[300px] overflow-y-auto">
                        {projects.map((project) => (
                            <DropdownMenuItem
                                key={project.id}
                                onClick={() => {
                                    onProjectSelect(project.id);
                                    setOpen(false);
                                }}
                                className={
                                    currentProjectId === project.id
                                        ? 'bg-muted font-medium'
                                        : ''
                                }
                            >
                                <FolderOpen className="mr-2 h-4 w-4" />
                                <span className="truncate">{project.name}</span>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCreateNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>New Project</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
