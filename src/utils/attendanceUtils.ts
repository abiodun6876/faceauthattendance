// utils/attendanceUtils.ts
import { supabase } from '../lib/supabase';
import faceRecognition from './faceRecognition';
import dayjs from 'dayjs';


export interface AttendanceData {
  course_code: string;
  course_title: string;
  level?: number;
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
    
    const embedding = Array.from(descriptor);
    const queryEmbedding = generate128DEmbedding(embedding);
    console.log('✅ Face extracted, searching for matches...');
    
    // Find similar faces using vector search
    const { data: matches, error: searchError } = await supabase
      .rpc('find_similar_faces', {
        query_embedding: queryEmbedding,
        similarity_threshold: 0.65,
        max_results: 3
      });
    
    if (searchError) {
      console.log('Vector search failed, trying manual search...');
      return await manualFaceSearch(queryEmbedding, attendanceData);
    }
    
    if (!matches || matches.length === 0) {
      return {
        success: false,
        error: 'No matching student found'
      };
    }
    
    const bestMatch = matches[0];
    console.log(`✅ Best match: ${bestMatch.name} (${bestMatch.similarity_score.toFixed(3)})`);
    
    // Check if already marked today
    const alreadyMarked = await checkExistingAttendance(
      bestMatch.student_id,
      attendanceData.course_code
    );
    
    if (alreadyMarked) {
      return {
        success: false,
        error: 'Attendance already marked today',
        student: {
          name: bestMatch.name,
          matric_number: bestMatch.matric_number
        }
      };
    }
    
    // Record attendance
    await recordAttendance({
      student_id: bestMatch.student_id,
      student_name: bestMatch.name,
      matric_number: bestMatch.matric_number,
      course_code: attendanceData.course_code,
      course_title: attendanceData.course_title,
      level: attendanceData.level,
      confidence_score: bestMatch.similarity_score
    });
    
    // Update last face scan
    await supabase
      .from('students_new')
      .update({ last_face_scan: new Date().toISOString() })
      .eq('student_id', bestMatch.student_id);
    
    return {
      success: true,
      student: {
        name: bestMatch.name,
        matric_number: bestMatch.matric_number
      },
      confidence: bestMatch.similarity_score
    };
    
  } catch (error: any) {
    console.error('❌ Attendance marking failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function manualFaceSearch(
  queryEmbedding: number[],
  attendanceData: AttendanceData
): Promise<AttendanceResult> {
  try {
    // Get all enrolled students
    const { data: students, error } = await supabase
      .from('students_new')
      .select(`
        id,
        student_id,
        name,
        matric_number,
        face_embedding,
        face_detected,
        face_match_threshold
      `)
      .eq('enrollment_status', 'enrolled')
      .eq('is_active', true)
      .not('face_embedding', 'is', null);
    
    if (error || !students || students.length === 0) {
      return {
        success: false,
        error: 'No enrolled students found'
      };
    }
    
    const queryVector = new Float32Array(queryEmbedding);
    let bestMatch: any = null;
    let bestScore = -1;
    
    for (const student of students) {
      if (!student.face_embedding || !Array.isArray(student.face_embedding)) {
        continue;
      }
      
      const storedVector = new Float32Array(student.face_embedding);
      
      // Calculate similarity
      const distance = calculateEuclideanDistance(queryVector, storedVector);
      const similarity = 1 / (1 + distance); // Convert to similarity score
      
      const threshold = student.face_match_threshold || 0.65;
      
      if (similarity > threshold && similarity > bestScore) {
        bestScore = similarity;
        bestMatch = {
          ...student,
          similarity_score: similarity
        };
      }
    }
    
    if (!bestMatch) {
      return {
        success: false,
        error: 'No matching student found'
      };
    }
    
    // Check existing attendance
    const alreadyMarked = await checkExistingAttendance(
      bestMatch.student_id,
      attendanceData.course_code
    );
    
    if (alreadyMarked) {
      return {
        success: false,
        error: 'Attendance already marked today',
        student: {
          name: bestMatch.name,
          matric_number: bestMatch.matric_number
        }
      };
    }
    
    // Record attendance
    await recordAttendance({
      student_id: bestMatch.student_id,
      student_name: bestMatch.name,
      matric_number: bestMatch.matric_number,
      course_code: attendanceData.course_code,
      course_title: attendanceData.course_title,
      level: attendanceData.level,
      confidence_score: bestMatch.similarity_score
    });
    
    return {
      success: true,
      student: {
        name: bestMatch.name,
        matric_number: bestMatch.matric_number
      },
      confidence: bestMatch.similarity_score
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: `Manual search failed: ${error.message}`
    };
  }
}
    
   

function calculateEuclideanDistance(vec1: Float32Array, vec2: Float32Array): number {
  let distance = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    distance += diff * diff;
  }
  return Math.sqrt(distance);
}

async function checkExistingAttendance(
  studentId: string,
  courseCode: string
): Promise<boolean> {
  const today = dayjs().format('YYYY-MM-DD');
  
  const { data } = await supabase
    .from('student_attendance')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_code', courseCode)
    .eq('attendance_date', today)
    .maybeSingle();
  
  return !!data;
}

async function recordAttendance(data: {
  student_id: string;
  student_name: string;
  matric_number: string;
  course_code: string;
  course_title: string;
  level?: number;
  confidence_score: number;
}) {
  const attendanceRecord = {
    student_id: data.student_id,
    student_name: data.student_name,
    matric_number: data.matric_number,
    course_code: data.course_code,
    course_title: data.course_title,
    level: data.level,
    attendance_date: dayjs().format('YYYY-MM-DD'),
    check_in_time: new Date().toISOString(),
    status: 'present',
    verification_method: 'face_recognition',
    confidence_score: data.confidence_score,
    similarity_score: data.confidence_score,
    score: 2.00,
    created_at: new Date().toISOString()
  };
  
  const { error } = await supabase
    .from('student_attendance')
    .insert([attendanceRecord]);
  
  if (error) {
    throw new Error(`Attendance recording failed: ${error.message}`);
  }
}

function generate128DEmbedding(embedding: number[]): number[] {
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

// utils/attendanceUtils.ts - Add these interfaces at the top
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

