'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { createProject, getProject, updateProject, saveCanvas } from '../lib/services/projects.service';
import { toast } from 'sonner';

export interface UseProjectReturn {
    projectId: string | null;
    projectName: string;
    canvasData: any;
    canvasColor: string;
    loading: boolean;
    createNewProject: (name?: string) => Promise<void>;
    loadProject: (id: string) => Promise<void>;
    updateProjectName: (name: string) => Promise<void>;
    saveProjectCanvas: (data: any, color: string) => Promise<void>;
    autoSave: (data: any, color: string) => void;
}

export function useProject(): UseProjectReturn {
    const { user } = useAuth();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('Untitled Project');
    const [canvasData, setCanvasData] = useState<any>(null);
    const [canvasColor, setCanvasColor] = useState('#F4F4F6');
    const [loading, setLoading] = useState(false);

    // Auto-save debounce
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingCanvasDataRef = useRef<any>(null);
    const pendingCanvasColorRef = useRef<string>('#F4F4F6');

    const createNewProject = useCallback(async (name: string = 'Untitled Project') => {
        if (!user) {
            toast.error('Please sign in to create projects');
            return;
        }

        setLoading(true);
        try {
            const project = await createProject(user.id, name);
            setProjectId(project.id);
            setProjectName(project.name);
            setCanvasData(project.canvas_data);
            setCanvasColor(project.canvas_color);
            toast.success('Project created');
        } catch (error) {
            console.error('Error creating project:', error);
            toast.error('Failed to create project');
        } finally {
            setLoading(false);
        }
    }, [user]);

    const loadProject = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const project = await getProject(id);
            if (project) {
                setProjectId(project.id);
                setProjectName(project.name);
                setCanvasData(project.canvas_data);
                setCanvasColor(project.canvas_color);
            }
        } catch (error) {
            console.error('Error loading project:', error);
            toast.error('Failed to load project');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProjectName = useCallback(async (name: string) => {
        if (!projectId) return;

        try {
            await updateProject(projectId, { name });
            setProjectName(name);
            toast.success('Project name updated');
        } catch (error) {
            console.error('Error updating project name:', error);
            toast.error('Failed to update project name');
        }
    }, [projectId]);

    const saveProjectCanvas = useCallback(async (data: any, color: string) => {
        if (!projectId) return;

        try {
            await saveCanvas(projectId, data, color);
            setCanvasData(data);
            setCanvasColor(color);
        } catch (error) {
            console.error('Error saving canvas:', error);
            toast.error('Failed to save canvas');
        }
    }, [projectId]);

    const autoSave = useCallback((data: any, color: string) => {
        if (!projectId) return;

        // Store pending changes
        pendingCanvasDataRef.current = data;
        pendingCanvasColorRef.current = color;

        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Set new timeout for auto-save (2 seconds after last change)
        autoSaveTimeoutRef.current = setTimeout(async () => {
            try {
                await saveCanvas(
                    projectId,
                    pendingCanvasDataRef.current,
                    pendingCanvasColorRef.current
                );
                console.log('Auto-saved project');
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }, 2000);
    }, [projectId]);

    // Cleanup auto-save timeout on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, []);

    return {
        projectId,
        projectName,
        canvasData,
        canvasColor,
        loading,
        createNewProject,
        loadProject,
        updateProjectName,
        saveProjectCanvas,
        autoSave,
    };
}
