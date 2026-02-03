// utils/attendanceUtils.ts - UPDATED VERSION
import { supabase } from '../lib/supabase';
import faceRecognition from './faceRecognition';
import dayjs from 'dayjs';
import syncService from '../services/syncService';

export interface AttendanceData {
  deviceId: string;
  organizationId: string;
  branchId: string;
  confidence?: number;
  photoUrl?: string;
}

export async function markAttendance(
  photoData: string, 
  attendanceData: AttendanceData
): Promise<AttendanceResult> {
  try {
    console.log('🟡 Starting attendance marking...');
    
    // Load face models
    await faceRecognition.loadModels();
    
    // Extract face embedding
    console.log('🟡 Extracting face from photo...');
    const descriptor = await faceRecognition.extractFaceDescriptor(photoData);
    
    if (!descriptor) {
      return {
        success: false,
        error: 'No face detected in photo'
      };
    }
    
    console.log('✅ Face extracted, searching for matches...');
    
    // Find matching user
    const matches = await faceRecognition.matchFaceForAttendance(photoData);
    
    if (matches.length === 0) {
      return {
        success: false,
        error: 'No matching user found'
      };
    }
    
    const bestMatch = matches[0];
    console.log(`✅ Best match: ${bestMatch.name} (${bestMatch.confidence.toFixed(3)})`);
    
    // Check if user already clocked in today
    const alreadyMarked = await checkExistingAttendance(
      bestMatch.userId,
      attendanceData.branchId
    );
    
    if (alreadyMarked) {
      return {
        success: false,
        error: 'Attendance already marked today',
        user: {
          name: bestMatch.name,
          staffId: bestMatch.staffId
        }
      };
    }
    
    // Record attendance
    await recordAttendance({
      userId: bestMatch.userId,
      userName: bestMatch.name,
      staffId: bestMatch.staffId,
      deviceId: attendanceData.deviceId,
      organizationId: attendanceData.organizationId,
      branchId: attendanceData.branchId,
      confidence: attendanceData.confidence || bestMatch.confidence,
      photoUrl: attendanceData.photoUrl
    });
    
    return {
      success: true,
      user: {
        name: bestMatch.name,
        staffId: bestMatch.staffId
      },
      confidence: bestMatch.confidence
    };
    
  } catch (error: any) {
    console.error('❌ Attendance marking failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function checkExistingAttendance(
  userId: string,
  branchId: string
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('attendance') // ✅ Correct table name
    .select('id')
    .eq('user_id', userId) // ✅ Correct column name
    .eq('branch_id', branchId)
    .eq('date', today)
    .maybeSingle();
  
  return !!data;
}

export async function recordAttendance(data: {
  userId: string;
  userName: string;
  staffId: string;
  deviceId: string;
  organizationId: string;
  branchId: string;
  confidence: number;
  photoUrl?: string;
}) {
  const today = new Date().toISOString().split('T')[0];
  
  const attendanceRecord = {
    user_id: data.userId, // ✅ Correct column name
    device_id: data.deviceId,
    organization_id: data.organizationId,
    branch_id: data.branchId,
    clock_in: new Date().toISOString(),
    date: today,
    status: 'present',
    confidence_score: data.confidence,
    photo_url: data.photoUrl,
    verification_method: 'face',
    synced: false
  };
  
  const { error } = await supabase
    .from('attendance') // ✅ Correct table name
    .insert(attendanceRecord);
  
  if (error) {
    console.error('Error recording attendance:', error);
    
    // If there's an error, save to local storage for sync later
    const pendingAttendance = {
      userId: data.userId,
      deviceId: data.deviceId,
      organizationId: data.organizationId,
      branchId: data.branchId,
      timestamp: new Date().toISOString(),
      confidence: data.confidence,
      photoUrl: data.photoUrl
    };
    
    syncService.addPendingAttendance(pendingAttendance);
    console.log('Attendance saved to local storage for sync');
  }
}

export async function getUserTodayAttendance(userId: string, branchId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('attendance')
    .select(`
      *,
      users!inner (
        staff_id,
        full_name,
        email
      )
    `)
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .eq('date', today)
    .maybeSingle();
  
  return data;
}

export async function getTodayAttendance(branchId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      users!inner (
        staff_id,
        full_name,
        email,
        department:departments (
          name
        )
      )
    `)
    .eq('branch_id', branchId)
    .eq('date', today)
    .order('clock_in', { ascending: false });
  
  if (error) {
    console.error('Error fetching today attendance:', error);
    return [];
  }
  
  return data || [];
}

export async function getUserAttendanceHistory(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching user attendance history:', error);
    return [];
  }
  
  return data || [];
}

export async function clockOutUser(attendanceId: string) {
  const { error } = await supabase
    .from('attendance')
    .update({
      clock_out: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', attendanceId);
  
  if (error) {
    console.error('Error clocking out:', error);
    throw new Error(`Clock out failed: ${error.message}`);
  }
}

// Alternative method using manual face matching
export async function manualFaceSearch(
  capturedImage: string,
  organizationId: string,
  threshold = 0.65
) {
  try {
    // Use the face recognition service to find matches
    const matches = await faceRecognition.matchFaceForAttendance(capturedImage);
    
    if (matches.length === 0) {
      return {
        success: false,
        error: 'No matching user found'
      };
    }
    
    // Filter by organization if needed
    const filteredMatches = matches.filter(match => {
      // You might need to add organization filtering logic here
      return true;
    });
    
    return {
      success: true,
      matches: filteredMatches,
      bestMatch: filteredMatches[0]
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Manual search failed: ${error.message}`
    };
  }
}

// Helper function to calculate Euclidean distance
export function calculateEuclideanDistance(vec1: Float32Array, vec2: Float32Array): number {
  let distance = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    distance += diff * diff;
  }
  return Math.sqrt(distance);
}

// Helper to convert embedding to 128D if needed
export function generate128DEmbedding(embedding: number[]): number[] {
  if (embedding.length <= 128) {
    return embedding.length === 128 ? embedding : [...embedding, ...Array(128 - embedding.length).fill(0)];
  }
  
  const result: number[] = [];
  const segmentSize = embedding.length / 128;
  
  for (let i = 0; i < 128; i++) {
    const start = Math.floor(i * segmentSize);
    const end = Math.floor((i + 1) * segmentSize);
    const segment = embedding.slice(start, end);
    const average = segment.reduce((sum, val) => sum + val, 0) / segment.length;
    result.push(parseFloat(average.toFixed(6)));
  }
  
  return result;
}

// ========== INTERFACES ==========

export interface AttendanceUser {
  name: string;
  staffId: string;
}

export interface AttendanceSuccessResult {
  success: true;
  user: AttendanceUser;
  confidence: number;
  error?: never;
}

export interface AttendanceErrorResult {
  success: false;
  error: string;
  user?: AttendanceUser;
  confidence?: never;
}

export type AttendanceResult = AttendanceSuccessResult | AttendanceErrorResult;

// For backward compatibility (if other files still use student terminology)
export type AttendanceStudent = AttendanceUser;
export interface AttendanceSuccessStudentResult extends Omit<AttendanceSuccessResult, 'user'> {
  student: AttendanceStudent;
}
export interface AttendanceErrorStudentResult extends Omit<AttendanceErrorResult, 'user'> {
  student?: AttendanceStudent;
}
export type AttendanceStudentResult = AttendanceSuccessStudentResult | AttendanceErrorStudentResult;

// Convert new result to old format for compatibility
export function convertToStudentResult(result: AttendanceResult): AttendanceStudentResult {
  if (result.success) {
    return {
      success: true,
      student: {
        name: result.user.name,
        staffId: result.user.staffId
      },
      confidence: result.confidence
    };
  } else {
    return {
      success: false,
      error: result.error,
      student: result.user ? {
        name: result.user.name,
        staffId: result.user.staffId
      } : undefined
    };
  }
}