// services/offlineStorageService.ts
// Local-first user cache for fast, reliable face/QR/ID matching.
// Syncs from Supabase on mount, then all matching is done locally.

import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'face_attendance_users';
const SYNC_TS_KEY = 'face_attendance_sync_ts';

export interface LocalUser {
    id: string;
    full_name: string;
    staff_id: string | null;
    qr_code: string | null;
    face_embedding: string | null; // JSON-serialized number[]
    face_photo_url: string | null;
    department_id: string | null;
    user_role: string | null;
    branch_id: string | null;
    organization_id: string;
    is_active: boolean;
}

class OfflineStorageService {
    private users: LocalUser[] = [];
    private loaded = false;

    // ─── Sync ────────────────────────────────────────────────────────────────

    /**
     * Fetch all active users (with embeddings) from Supabase and cache locally.
     * Call this on page mount.
     */
    async syncUsers(organizationId: string, branchId?: string): Promise<void> {
        try {
            console.log('[OfflineStorage] Syncing users from Supabase...');

            let query = supabase
                .from('users')
                .select(
                    'id, full_name, staff_id, qr_code, face_embedding, face_photo_url, department_id, user_role, branch_id, organization_id, is_active'
                )
                .eq('organization_id', organizationId)
                .eq('is_active', true);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[OfflineStorage] Sync error:', error);
                // Load from cache if available
                this.loadFromCache();
                return;
            }

            this.users = (data || []) as LocalUser[];
            this.saveToCache();
            localStorage.setItem(SYNC_TS_KEY, new Date().toISOString());
            console.log(`[OfflineStorage] Synced ${this.users.length} users locally.`);
        } catch (err) {
            console.error('[OfflineStorage] Sync exception:', err);
            this.loadFromCache();
        }
    }

    // ─── Cache helpers ────────────────────────────────────────────────────────

    private saveToCache(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.users));
        } catch (e) {
            console.warn('[OfflineStorage] Could not save to localStorage:', e);
        }
    }

    loadFromCache(): void {
        if (this.loaded) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.users = JSON.parse(raw) as LocalUser[];
                console.log(`[OfflineStorage] Loaded ${this.users.length} users from cache.`);
            }
        } catch (e) {
            console.warn('[OfflineStorage] Could not load from localStorage:', e);
        }
        this.loaded = true;
    }

    getLocalUsers(): LocalUser[] {
        if (!this.loaded) this.loadFromCache();
        return this.users;
    }

    getLastSyncTime(): string | null {
        return localStorage.getItem(SYNC_TS_KEY);
    }

    // ─── Face Matching ────────────────────────────────────────────────────────

    /**
     * Compare a query embedding against all locally cached users.
     * Returns the best match if distance < threshold, otherwise null.
     */
    findByFaceEmbedding(
        queryEmbedding: Float32Array,
        threshold = 0.6
    ): { user: LocalUser; distance: number } | null {
        if (!this.loaded) this.loadFromCache();

        const usersWithEmbeddings = this.users.filter(u => u.face_embedding);

        if (usersWithEmbeddings.length === 0) {
            console.warn('[OfflineStorage] No users with face embeddings in local cache.');
            return null;
        }

        let bestMatch: LocalUser | null = null;
        let bestDistance = Infinity;

        for (const user of usersWithEmbeddings) {
            try {
                let parsed: number[];
                if (typeof user.face_embedding === 'string') {
                    parsed = JSON.parse(user.face_embedding);
                } else {
                    parsed = user.face_embedding as any;
                }

                if (!Array.isArray(parsed) || parsed.length !== 128) continue;

                const storedDescriptor = new Float32Array(parsed);
                const distance = faceapi.euclideanDistance(queryEmbedding, storedDescriptor);

                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = user;
                }
            } catch (e) {
                console.warn(`[OfflineStorage] Could not parse embedding for user ${user.id}:`, e);
            }
        }

        if (bestMatch && bestDistance < threshold) {
            const confidence = Math.round((1 - bestDistance) * 100);
            console.log(
                `[OfflineStorage] Matched user: ${bestMatch.full_name} (distance=${bestDistance.toFixed(3)}, confidence=${confidence}%)`
            );
            return { user: bestMatch, distance: bestDistance };
        }

        console.log(`[OfflineStorage] No match found. Best distance: ${bestDistance.toFixed(3)}`);
        return null;
    }

    // ─── QR / ID Matching ─────────────────────────────────────────────────────

    /**
     * Find a user by staff_id, qr_code, or id from local cache.
     * Case-insensitive comparison.
     */
    findByIdOrQr(value: string): LocalUser | null {
        if (!this.loaded) this.loadFromCache();

        const normalized = value.trim().toLowerCase();

        const match = this.users.find(
            u =>
                (u.staff_id && u.staff_id.toLowerCase() === normalized) ||
                (u.qr_code && u.qr_code.toLowerCase() === normalized) ||
                u.id.toLowerCase() === normalized
        );

        if (match) {
            console.log(`[OfflineStorage] ID/QR match: ${match.full_name} for value "${value}"`);
        } else {
            console.log(`[OfflineStorage] No ID/QR match found for value "${value}"`);
        }

        return match || null;
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    clearCache(): void {
        this.users = [];
        this.loaded = false;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_TS_KEY);
        console.log('[OfflineStorage] Cache cleared.');
    }
}

const offlineStorageService = new OfflineStorageService();
export default offlineStorageService;
