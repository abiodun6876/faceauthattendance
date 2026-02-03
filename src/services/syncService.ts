// src/services/syncService.ts - FIXED VERSION
import { supabase } from '../lib/supabase';

export interface PendingAttendance {
  id: string;
  userId: string; // Changed from studentId
  deviceId: string;
  organizationId: string;
  branchId: string;
  timestamp: string;
  confidence: number;
  photoUrl?: string;
}

export interface PendingFaceEmbedding {
  userId: string; // Changed from studentId
  descriptor: number[];
  timestamp: string;
}

export class SyncService {
  private static instance: SyncService;
  private isSyncing = false;

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  // ========== ATTENDANCE SYNC ==========

  // Add pending attendance to local storage
  addPendingAttendance(attendance: Omit<PendingAttendance, 'id'>): void {
    const pending = this.getPendingAttendance();
    const newRecord: PendingAttendance = {
      ...attendance,
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    pending.push(newRecord);
    localStorage.setItem('pending_attendance', JSON.stringify(pending));
    console.log(`Added pending attendance for user: ${attendance.userId}`);
  }

  // Get all pending attendance
  getPendingAttendance(): PendingAttendance[] {
    const data = localStorage.getItem('pending_attendance');
    return data ? JSON.parse(data) : [];
  }

  // Clear pending attendance
  clearPendingAttendance(recordIds: string[]): void {
    const pending = this.getPendingAttendance();
    const filtered = pending.filter(record => !recordIds.includes(record.id));
    localStorage.setItem('pending_attendance', JSON.stringify(filtered));
  }

  // Sync pending attendance to Supabase
  async syncAttendance(): Promise<{
    synced: number;
    errors: Array<{ record: PendingAttendance; error: string }>;
  }> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { synced: 0, errors: [] };
    }

    this.isSyncing = true;
    const pendingArray = this.getPendingAttendance();
    const errors: Array<{ record: PendingAttendance; error: string }> = [];
    const synced: PendingAttendance[] = [];

    console.log(`Starting sync of ${pendingArray.length} attendance records`);

    try {
      // Sync each attendance record to the correct table
      for (const record of pendingArray) {
        try {
          const { error } = await supabase
            .from('attendance') // ✅ CORRECT TABLE NAME
            .insert({
              user_id: record.userId, // ✅ CORRECT COLUMN NAME
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

      // Remove successfully synced records
      if (synced.length > 0) {
        this.clearPendingAttendance(synced.map(r => r.id));
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

  // Add pending face embedding
  addPendingFaceEmbedding(embedding: PendingFaceEmbedding): void {
    const pending = this.getPendingFaceEmbeddings();
    pending.push(embedding);
    localStorage.setItem('pending_embeddings', JSON.stringify(pending));
    console.log(`Added pending embedding for user: ${embedding.userId}`);
  }

  // Get pending face embeddings
  getPendingFaceEmbeddings(): PendingFaceEmbedding[] {
    const data = localStorage.getItem('pending_embeddings');
    return data ? JSON.parse(data) : [];
  }

  // Clear pending embeddings
  clearPendingEmbeddings(userIds: string[]): void {
    const pending = this.getPendingFaceEmbeddings();
    const filtered = pending.filter(embedding => !userIds.includes(embedding.userId));
    localStorage.setItem('pending_embeddings', JSON.stringify(filtered));
  }

  // Sync face embeddings to Supabase
  async syncFaceEmbeddings(): Promise<{
    synced: number;
    errors: string[];
  }> {
    const embeddings = this.getPendingFaceEmbeddings();
    const errors: string[] = [];
    const syncedUserIds: string[] = [];

    console.log(`Starting sync of ${embeddings.length} face embeddings`);

    // Sync each embedding to the correct table
    for (const embedding of embeddings) {
      try {
        const { error } = await supabase
          .from('users') // ✅ CORRECT TABLE NAME
          .update({
            face_embedding: JSON.stringify(embedding.descriptor),
            face_embedding_stored: true,
            last_face_update: new Date().toISOString()
          })
          .eq('id', embedding.userId); // ✅ CORRECT COLUMN NAME

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

    // Remove successfully synced embeddings
    if (syncedUserIds.length > 0) {
      this.clearPendingEmbeddings(syncedUserIds);
    }

    console.log(`Embeddings sync completed: ${syncedUserIds.length} synced, ${errors.length} errors`);
    
    return {
      synced: syncedUserIds.length,
      errors
    };
  }

  // ========== FULL SYNC ==========

  // Perform full sync (attendance + embeddings)
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

  // Check sync status
  getSyncStatus(): {
    pendingAttendance: number;
    pendingEmbeddings: number;
    isSyncing: boolean;
  } {
    return {
      pendingAttendance: this.getPendingAttendance().length,
      pendingEmbeddings: this.getPendingFaceEmbeddings().length,
      isSyncing: this.isSyncing
    };
  }

  // Clear all pending data
  clearAllPending(): void {
    localStorage.removeItem('pending_attendance');
    localStorage.removeItem('pending_embeddings');
    console.log('Cleared all pending sync data');
  }

  // Check if online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Initialize sync service
  initialize(): void {
    // Start periodic sync if online
    if (this.isOnline()) {
      // Initial sync after 5 seconds
      setTimeout(() => {
        this.performFullSync().catch(console.error);
      }, 5000);

      // Periodic sync every 2 minutes
      setInterval(() => {
        if (this.isOnline() && !this.isSyncing) {
          this.performFullSync().catch(console.error);
        }
      }, 2 * 60 * 1000);
    }

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Device came online, triggering sync...');
      this.performFullSync().catch(console.error);
    });

    window.addEventListener('offline', () => {
      console.log('Device went offline');
    });
  }
}

// Export singleton instance
export default SyncService.getInstance();