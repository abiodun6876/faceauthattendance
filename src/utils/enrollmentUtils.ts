// utils/enrollmentUtils.ts - COMPLETE FIXED VERSION
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
  message?: string;
}

export const enrollStudent = async (enrollmentData: EnrollmentData): Promise<EnrollmentResult> => {
  try {
    console.log('=== STARTING ENROLLMENT ===');
    console.log('Student:', enrollmentData.name);
    console.log('Student ID:', enrollmentData.student_id);
    
    // Ensure models are loaded
    try {
      await faceRecognition.loadModels();
      console.log('Face recognition models loaded');
    } catch (modelError) {
      console.error('Failed to load face models:', modelError);
      return {
        success: false,
        error: 'Face recognition models failed to load'
      };
    }

    // Check if student already exists
    console.log('Checking for existing student...');
    const { data: existingStudent } = await supabase
      .from('students')
      .select('*')
      .or(`matric_number.eq.${enrollmentData.student_id},student_id.eq.${enrollmentData.student_id}`)
      .maybeSingle();

    if (existingStudent) {
      console.log('Student already exists:', existingStudent.name);
      return {
        success: false,
        error: 'Student with this matric number or student ID already exists.'
      };
    }

    // IMPORTANT: Extract face embeddings BEFORE inserting to database
    console.log('Extracting face embeddings from photo...');
    let faceEmbedding: number[] | null = null;
    let embeddingDimensions = 0;
    let faceDetected = false;
    
    try {
      // Clean the photo data (remove data URL prefix if present)
      let cleanPhotoData = enrollmentData.photoData;
      if (cleanPhotoData.startsWith('data:image')) {
        // Keep it as data URL for face-api.js
        console.log('Photo is already a data URL');
      } else {
        // Add data URL prefix
        cleanPhotoData = `data:image/jpeg;base64,${cleanPhotoData}`;
        console.log('Added data URL prefix to photo');
      }
      
      // Extract face descriptor
      const descriptor = await faceRecognition.extractFaceDescriptor(cleanPhotoData);
      
      if (descriptor) {
        faceEmbedding = Array.from(descriptor);
        embeddingDimensions = faceEmbedding.length;
        faceDetected = true;
        console.log(`✅ Face embeddings generated: ${embeddingDimensions} dimensions`);
        console.log('Sample of embedding (first 5 values):', faceEmbedding.slice(0, 5));
      } else {
        console.log('❌ No face detected in enrollment photo');
        faceDetected = false;
      }
    } catch (embeddingError: any) {
      console.error('❌ Error generating embeddings:', embeddingError);
      console.error('Error stack:', embeddingError.stack);
      faceDetected = false;
    }

    // Insert student into database WITH embeddings
    console.log('Inserting student into database...');
    const { data: student, error: insertError } = await supabase
      .from('students')
      .insert([
        {
          student_id: enrollmentData.student_id,
          matric_number: enrollmentData.student_id,
          name: enrollmentData.name,
          gender: enrollmentData.gender,
          program: enrollmentData.program_code,
          program_name: enrollmentData.program_name,
          level: enrollmentData.level,
          photo_url: enrollmentData.photoData,
          face_embedding: faceEmbedding, // This is the key field!
          face_embedding_vector: faceEmbedding,
          face_detected: faceDetected,
          face_enrolled_at: new Date().toISOString(),
          enrollment_status: 'enrolled',
          enrollment_date: new Date().toISOString().split('T')[0],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'Student ID or matric number already exists. Please generate a new one.'
        };
      }
      
      return {
        success: false,
        error: `Database error: ${insertError.message}`
      };
    }

    if (!student) {
      console.error('❌ Student record was not created');
      return {
        success: false,
        error: 'Student record was not created.'
      };
    }

    // Save to localStorage for offline use
    if (faceDetected && faceEmbedding) {
      console.log('Saving embeddings to localStorage...');
      faceRecognition.saveEmbeddingToLocal(enrollmentData.student_id, new Float32Array(faceEmbedding));
    }

    console.log('✅ Student enrolled successfully:', student.name);
    console.log('=== ENROLLMENT COMPLETE ===');

    return {
      success: true,
      student: {
        id: student.id,
        student_id: student.student_id,
        name: student.name,
        matric_number: student.matric_number,
        gender: student.gender,
        program_name: student.program_name,
        program_code: student.program,
        level: student.level,
        enrollment_status: student.enrollment_status,
        enrollment_date: student.enrollment_date,
        has_face_embedding: faceDetected
      },
      faceDetected,
      embeddingDimensions,
      message: 'Student enrolled successfully'
    };
    
  } catch (error: any) {
    console.error('❌ Enrollment error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

// Test function
export const testFaceRecognition = async () => {
  try {
    console.log('Testing face recognition...');
    await faceRecognition.loadModels();
    
    const status = faceRecognition.getStatus();
    console.log('Face recognition status:', status);
    
    // Test with a simple face image
    const testImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    const descriptor = await faceRecognition.extractFaceDescriptor(testImage);
    
    return {
      success: true,
      modelsLoaded: status.modelsLoaded,
      backend: status.backend,
      descriptorExtracted: !!descriptor,
      descriptorLength: descriptor ? descriptor.length : 0
    };
  } catch (error: any) {
    console.error('Face recognition test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};