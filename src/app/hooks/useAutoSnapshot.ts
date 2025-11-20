'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { createSnapshot, deleteOldAutoSnapshots } from '../lib/services/snapshots.service';

export interface UseAutoSnapshotOptions {
    projectId: string | null;
    canvasData: any;
    enabled?: boolean;
    intervalMinutes?: number;
}

export function useAutoSnapshot({
    projectId,
    canvasData,
    enabled = true,
    intervalMinutes = 5,
}: UseAutoSnapshotOptions) {
    const { user } = useAuth();
    const lastSnapshotRef = useRef<number>(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!enabled || !projectId || !user || !canvasData) {
            return;
        }

        const intervalMs = intervalMinutes * 60 * 1000;

        const takeSnapshot = async () => {
            const now = Date.now();

            // Only take snapshot if enough time has passed
            if (now - lastSnapshotRef.current < intervalMs) {
                return;
            }

            try {
                await createSnapshot(
                    projectId,
                    user.id,
                    canvasData,
                    null,
                    true // isAuto
                );

                lastSnapshotRef.current = now;
                console.log('Auto-snapshot created');

                // Clean up old snapshots (keep only 10 most recent auto-snapshots)
                await deleteOldAutoSnapshots(projectId, 10);
            } catch (error) {
                console.error('Failed to create auto-snapshot:', error);
            }
        };

        // Set up interval for auto-snapshots
        intervalRef.current = setInterval(takeSnapshot, intervalMs);

        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [projectId, user, canvasData, enabled, intervalMinutes]);
}
