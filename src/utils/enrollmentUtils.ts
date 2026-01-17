// utils/enrollmentUtils.ts
import { supabase } from '../lib/supabase';
import faceRecognition from './faceRecognition';

export interface EnrollmentData {
  student_id: string;
  name: string;
  gender: string;
  program_id?: string;
  program_name: string;
  program_code: string;
  level: number;
  photoData: string;
}

export interface EnrollmentResult {
  success: boolean;
  student?: {
    id: string;
    student_id: string;
    name: string;
    matric_number: string;
    gender: string;
    program_name: string;
    program_code: string;
    level: number;
    enrollment_status: string;
    enrollment_date: string;
    has_face_embedding?: boolean;
  };
  error?: string;
  faceDetected?: boolean;
  embeddingDimensions?: number;
}

export const enrollStudent = async (data: EnrollmentData): Promise<EnrollmentResult> => {
  try {
    console.log('Starting enrollment process...');
    
    // 1. Check if student already exists
    const { data: existingStudent, error: checkError } = await supabase
      .from('students')
      .select('*')
      .eq('matric_number', data.student_id)
      .single();

    // If there's an error but it's not "no rows" error, throw it
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Database check error:', checkError);
      throw new Error(`Database error: ${checkError.message}`);
    }

    // If student exists, return error
    if (existingStudent) {
      return {
        success: false,
        error: `Student with matric number ${data.student_id} already exists`
      };
    }

    // 2. Extract face descriptor
    console.log('Extracting face descriptor...');
    const faceDescriptor = await faceRecognition.extractFaceDescriptor(data.photoData);
    
    if (!faceDescriptor) {
      console.warn('No face detected. Proceeding without face data...');
    } else {
      console.log('Face descriptor extracted:', faceDescriptor.length, 'dimensions');
    }

    // 3. Prepare student data
    const studentData = {
      student_id: data.student_id,
      name: data.name,
      matric_number: data.student_id,
      gender: data.gender,
      program_name: data.program_name,
      program_code: data.program_code,
      level: data.level,
      enrollment_status: 'enrolled',
      enrollment_date: new Date().toISOString(),
      ...(data.program_id && { program_id: data.program_id })
    };

    // 4. Save to database
    console.log('Saving to database...', studentData);
    const { data: newStudent, error: dbError } = await supabase
      .from('students')
      .insert([studentData])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to save student: ${dbError.message}`);
    }

    console.log('Student saved to database:', newStudent);

    // 5. Save face embedding if detected
    let embeddingSaved = false;
    if (faceDescriptor && newStudent) {
      try {
        console.log('Saving face embedding...');
        
        // Convert Float32Array to regular array for JSON storage
        const embeddingArray = Array.from(faceDescriptor);
        
        // Save to database
        const { error: embeddingError } = await supabase
          .from('students')
          .update({ 
            face_embedding: embeddingArray,
            last_face_update: new Date().toISOString()
          })
          .eq('id', newStudent.id);

        if (embeddingError) {
          console.warn('Failed to save face embedding to database:', embeddingError);
        } else {
          // Also save locally
          faceRecognition.saveEmbeddingToLocal(data.student_id, faceDescriptor);
          embeddingSaved = true;
          console.log('Face embedding saved successfully');
        }
      } catch (embeddingError) {
        console.warn('Failed to save face embedding:', embeddingError);
      }
    }

    // 6. Return success result
    return {
      success: true,
      student: {
        id: newStudent.id,
        student_id: newStudent.student_id,
        name: newStudent.name,
        matric_number: newStudent.matric_number,
        gender: newStudent.gender,
        program_name: newStudent.program_name,
        program_code: newStudent.program_code,
        level: newStudent.level,
        enrollment_status: newStudent.enrollment_status,
        enrollment_date: newStudent.enrollment_date,
        has_face_embedding: embeddingSaved
      },
      faceDetected: !!faceDescriptor,
      embeddingDimensions: faceDescriptor?.length
    };

  } catch (error: any) {
    console.error('Enrollment error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during enrollment'
    };
  }
};

// Helper function to check if enrollment is working
export const testEnrollment = async (): Promise<boolean> => {
  try {
    console.log('Testing enrollment connection...');
    
    // Test database connection
    const { data, error } = await supabase
      .from('students')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database test failed:', error);
      return false;
    }
    
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
};