import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import dayjs from 'dayjs';

export type Attendance = Database['public']['Tables']['attendance']['Row'];

export const attendanceService = {
    /**
     * Clock in a user.
     */
    async clockIn(params: {
        userId: string;
        deviceId: string;
        organizationId: string;
        branchId: string;
        confidence: number;
        photoUrl: string;
        verificationMethod?: string;
    }) {
        const now = new Date().toISOString();
        const today = dayjs().format('YYYY-MM-DD');

        return await supabase
            .from('attendance')
            .insert({
                user_id: params.userId,
                organization_id: params.organizationId,
                branch_id: params.branchId,
                device_id: params.deviceId,
                date: today,
                clock_in: now,
                status: 'present',
                confidence_score: params.confidence,
                face_match_score: params.confidence,
                photo_url: params.photoUrl,
                verification_method: params.verificationMethod || 'face',
            } as any)
            .select(`
        *,
        user:users(full_name, staff_id, photo_url),
        branch:branches(name)
      `)
            .single();
    },

    /**
     * Clock out a user by updating their existing attendance record.
     */
    async clockOut(attendanceId: string) {
        const now = new Date().toISOString();

        return await supabase
            .from('attendance')
            .update({
                clock_out: now,
                updated_at: now
            } as any)
            .eq('id', attendanceId)
            .select(`
        *,
        user:users(full_name, staff_id, photo_url),
        branch:branches(name)
      `)
            .single();
    },

    /**
     * Get the most recent attendance record for a user today.
     */
    async getTodayRecord(userId: string, organizationId: string) {
        const today = dayjs().format('YYYY-MM-DD');

        return await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
    },

    /**
     * Fetch attendance stats for a branch today.
     */
    async getTodayStats(organizationId: string, branchId?: string) {
        const today = dayjs().format('YYYY-MM-DD');

        let query = supabase
            .from('attendance')
            .select('status, clock_in')
            .eq('organization_id', organizationId)
            .eq('date', today);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        return await query;
    },

    /**
     * Get attendance logs with full user details for management views.
     */
    async getAttendanceLogs(params: {
        organizationId: string;
        branchId?: string;
        limit?: number;
        offset?: number;
    }) {
        let query = supabase
            .from('attendance')
            .select(`
        *,
        user:users(
          id, 
          staff_id, 
          student_id,
          full_name, 
          email, 
          user_role,
          photo_url,
          department_id
        )
      `)
            .eq('organization_id', params.organizationId);

        if (params.branchId) {
            query = query.eq('branch_id', params.branchId);
        }

        return await query
            .order('created_at', { ascending: false })
            .limit(params.limit || 100);
    },

    /**
     * Log a face match attempt (audit log).
     */
    async logFaceMatch(params: {
        userId: string;
        organizationId: string;
        deviceId: string;
        photoUrl: string;
        confidence: number;
        isMatch: boolean;
        result: string;
    }) {
        return await supabase
            .from('face_match_logs')
            .insert({
                user_id: params.userId,
                organization_id: params.organizationId,
                device_id: params.deviceId,
                photo_url: params.photoUrl,
                confidence_score: params.confidence,
                threshold_score: 0.70,
                is_match: params.isMatch,
                verification_result: params.result,
                created_at: new Date().toISOString()
            } as any);
    }
};
