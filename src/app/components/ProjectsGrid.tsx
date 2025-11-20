'use client';

import { useState } from 'react';
import { ProjectCard } from './ProjectCard';
import { Skeleton } from './ui/skeleton';

interface ProjectsGridProps {
    projects: any[];
    loading: boolean;
    viewMode: 'grid' | 'list';
    onProjectsChange: (projects: any[]) => void;
}

export function ProjectsGrid({
    projects,
    loading,
    viewMode,
    onProjectsChange,
}: ProjectsGridProps) {
    if (loading) {
        return (
            <div
                className={
                    viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                        : 'flex flex-col gap-2'
                }
            >
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="aspect-[16/10] w-full rounded-lg" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                ))}
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                    <svg
                        className="h-12 w-12 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Create your first project to get started with inFrame
                </p>
            </div>
        );
    }

    const handleProjectDeleted = (projectId: string) => {
        onProjectsChange(projects.filter((p) => p.id !== projectId));
    };

    const handleProjectUpdated = (updatedProject: any) => {
        onProjectsChange(
            projects.map((p) => (p.id === updatedProject.id ? updatedProject : p))
        );
    };

    if (viewMode === 'list') {
        return (
            <div className="flex flex-col gap-2">
                {projects.map((project) => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        viewMode="list"
                        onDeleted={handleProjectDeleted}
                        onUpdated={handleProjectUpdated}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {projects.map((project) => (
                <ProjectCard
                    key={project.id}
                    project={project}
                    viewMode="grid"
                    onDeleted={handleProjectDeleted}
                    onUpdated={handleProjectUpdated}
                />
            ))}
        </div>
    );
}
