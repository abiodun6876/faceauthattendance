// src/types/attendance.ts
import { Student } from '../types/student'; // Import your Student type if you have it

export interface AttendanceData {
  course_code: string;
  course_title: string;
  level?: number;
}

export interface AttendanceStudent {
  name: string;
  matric_number: string;
}

export interface AttendanceSuccessResult {
  success: true;
  student: AttendanceStudent;
  confidence: number;
  error?: never;
}

export interface AttendanceErrorResult {
  success: false;
  error: string;
  student?: AttendanceStudent;
  confidence?: never;
}

export type AttendanceResult = AttendanceSuccessResult | AttendanceErrorResult;

export interface AttendanceMarkRequest {
  student_id: string;
  student_name: string;
  matric_number: string;
  course_code: string;
  course_title: string;
  level?: number;
  confidence_score: number;
}

export interface AttendanceRecord {
  id: string;
  event_id?: string;
  session_id?: string;
  student_id: string;
  student_name?: string;
  matric_number?: string;
  faculty_code?: string;
  department_code?: string;
  program?: string;
  level?: number;
  student?: Student;
  check_in_time: string;
  check_out_time?: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  verified: boolean;
  device_id: string;
  synced?: boolean;
  face_match_score?: number;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSession {
  id: string;
  course_code: string;
  faculty_id: string;
  department_id: string;
  level: number;
  session_date: string;
  start_time: string;
  end_time?: string;
  total_students: number;
  attended_students: number;
  status: 'active' | 'completed';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}