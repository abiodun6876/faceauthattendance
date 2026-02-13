import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingAttendance {
    id: string;
    userId: string;
    deviceId: string;
    organizationId: string;
    branchId: string;
    timestamp: string;
    confidence: number;
    photoUrl?: string;
}

export interface PendingFaceEmbedding {
    userId: string;
    descriptor: number[];
    timestamp: string;
}

export class SyncService {
    private static instance: SyncService;
    private isSyncing = false;

    private constructor() { }

    public static getInstance(): SyncService {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService();
        }
        return SyncService.instance;
    }

    // ========== ATTENDANCE SYNC ==========

    async addPendingAttendance(attendance: Omit<PendingAttendance, 'id'>): Promise<void> {
        const pending = await this.getPendingAttendance();
        const newRecord: PendingAttendance = {
            ...attendance,
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        pending.push(newRecord);
        await AsyncStorage.setItem('pending_attendance', JSON.stringify(pending));
        console.log(`Added pending attendance for user: ${attendance.userId}`);
    }

    async getPendingAttendance(): Promise<PendingAttendance[]> {
        try {
            const data = await AsyncStorage.getItem('pending_attendance');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting pending attendance:', error);
            return [];
        }
    }

    async clearPendingAttendance(recordIds: string[]): Promise<void> {
        const pending = await this.getPendingAttendance();
        const filtered = pending.filter(record => !recordIds.includes(record.id));
        await AsyncStorage.setItem('pending_attendance', JSON.stringify(filtered));
    }

    async syncAttendance(): Promise<{
        synced: number;
        errors: Array<{ record: PendingAttendance; error: string }>;
    }> {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return { synced: 0, errors: [] };
        }

        this.isSyncing = true;
        const pendingArray = await this.getPendingAttendance();
        const errors: Array<{ record: PendingAttendance; error: string }> = [];
        const synced: PendingAttendance[] = [];

        console.log(`Starting sync of ${pendingArray.length} attendance records`);

        try {
            for (const record of pendingArray) {
                try {
                    const { error } = await supabase
                        .from('attendance')
                        .insert({
                            user_id: record.userId,
                            device_id: record.deviceId,
                            organization_id: record.organizationId,
                            branch_id: record.branchId,
                            clock_in: record.timestamp,
                            date: new Date(record.timestamp).toISOString().split('T')[0],
                            status: 'present',
                            confidence_score: record.confidence,
                            photo_url: record.photoUrl,
                            verification_method: 'face',
                            synced: true
                        });

                    if (error) {
                        errors.push({ record, error: error.message });
                        console.error('Attendance sync error:', error);
                    } else {
                        synced.push(record);
                        console.log(`✅ Synced attendance for user: ${record.userId}`);
                    }
                } catch (error: any) {
                    errors.push({ record, error: error.message });
                    console.error('Attendance sync exception:', error);
                }
            }

            if (synced.length > 0) {
                await this.clearPendingAttendance(synced.map(r => r.id));
            }

            console.log(`Sync completed: ${synced.length} synced, ${errors.length} errors`);

            return {
                synced: synced.length,
                errors
            };
        } finally {
            this.isSyncing = false;
        }
    }

    // ========== FACE EMBEDDING SYNC ==========

    async addPendingFaceEmbedding(embedding: PendingFaceEmbedding): Promise<void> {
        const pending = await this.getPendingFaceEmbeddings();
        pending.push(embedding);
        await AsyncStorage.setItem('pending_embeddings', JSON.stringify(pending));
        console.log(`Added pending embedding for user: ${embedding.userId}`);
    }

    async getPendingFaceEmbeddings(): Promise<PendingFaceEmbedding[]> {
        try {
            const data = await AsyncStorage.getItem('pending_embeddings');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting pending embeddings:', error);
            return [];
        }
    }

    async clearPendingEmbeddings(userIds: string[]): Promise<void> {
        const pending = await this.getPendingFaceEmbeddings();
        const filtered = pending.filter(embedding => !userIds.includes(embedding.userId));
        await AsyncStorage.setItem('pending_embeddings', JSON.stringify(filtered));
    }

    async syncFaceEmbeddings(): Promise<{
        synced: number;
        errors: string[];
    }> {
        const embeddings = await this.getPendingFaceEmbeddings();
        const errors: string[] = [];
        const syncedUserIds: string[] = [];

        console.log(`Starting sync of ${embeddings.length} face embeddings`);

        for (const embedding of embeddings) {
            try {
                const { error } = await supabase
                    .from('users')
                    .update({
                        face_embedding: JSON.stringify(embedding.descriptor),
                        face_embedding_stored: true,
                        last_face_update: new Date().toISOString()
                    })
                    .eq('id', embedding.userId);

                if (error) {
                    errors.push(`User ${embedding.userId}: ${error.message}`);
                    console.error(`Embedding sync error for user ${embedding.userId}:`, error);
                } else {
                    syncedUserIds.push(embedding.userId);
                    console.log(`✅ Synced embedding for user: ${embedding.userId}`);
                }
            } catch (error: any) {
                errors.push(`User ${embedding.userId}: ${error.message}`);
                console.error(`Embedding sync exception for user ${embedding.userId}:`, error);
            }
        }

        if (syncedUserIds.length > 0) {
            await this.clearPendingEmbeddings(syncedUserIds);
        }

        console.log(`Embeddings sync completed: ${syncedUserIds.length} synced, ${errors.length} errors`);

        return {
            synced: syncedUserIds.length,
            errors
        };
    }

    // ========== FULL SYNC ==========

    async performFullSync(): Promise<{
        attendance: { synced: number; errors: any[] };
        embeddings: { synced: number; errors: string[] };
    }> {
        console.log('Starting full sync...');

        const [attendanceResult, embeddingsResult] = await Promise.all([
            this.syncAttendance(),
            this.syncFaceEmbeddings()
        ]);

        return {
            attendance: attendanceResult,
            embeddings: embeddingsResult
        };
    }

    // ========== STATUS & UTILITY ==========

    async getSyncStatus(): Promise<{
        pendingAttendance: number;
        pendingEmbeddings: number;
        isSyncing: boolean;
    }> {
        const pendingAttendance = await this.getPendingAttendance();
        const pendingEmbeddings = await this.getPendingFaceEmbeddings();
        return {
            pendingAttendance: pendingAttendance.length,
            pendingEmbeddings: pendingEmbeddings.length,
            isSyncing: this.isSyncing
        };
    }

    async clearAllPending(): Promise<void> {
        await AsyncStorage.removeItem('pending_attendance');
        await AsyncStorage.removeItem('pending_embeddings');
        console.log('Cleared all pending sync data');
    }

    // Initialize not strictly needed in the same way for RN as we might handle background tasks differently
    // but we can keep a simple periodic sync when app is open
    startPeriodicSync() {
        // Simple timeout-based loop or integration with BackgroundFetch
        setInterval(() => {
            if (!this.isSyncing) {
                this.performFullSync().catch(console.error);
            }
        }, 2 * 60 * 1000); // 2 minutes
    }
}

export default SyncService.getInstance();
