// utils/enrollmentUtils.ts - Fixed for Multi-tenant WITHOUT gender/level fields
import { supabase } from '../lib/supabase';
import faceRecognition from './faceRecognition';

export interface EnrollmentData {
  staff_id: string; // Changed from student_id to staff_id
  full_name: string; // Changed from name to full_name
  email?: string;
  phone?: string;
  user_role?: string; // 'staff', 'student', 'admin'
  branch_id?: string;
  department_id?: string;
  organization_id?: string;
  photoData: string;
  // Additional metadata for students (store in separate field if needed)
  student_data?: {
    level?: number;
    program_name?: string;
    gender?: string;
  };
}

export interface EnrollmentResult {
  success: boolean;
  user?: {
    id: string;
    staff_id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    user_role?: string | null;
    enrollment_status: string;
    face_enrolled_at: string;
    organization_id?: string;
    branch_id?: string;
    department_id?: string;
    has_face_embedding?: boolean;
    // Student specific data (if applicable)
    student_data?: {
      level?: number;
      program_name?: string;
      gender?: string;
    };
  };
  error?: string;
  faceDetected?: boolean;
  embeddingDimensions?: number;
  message?: string;
}

export const enrollUser = async (enrollmentData: EnrollmentData): Promise<EnrollmentResult> => {
  try {
    console.log('=== STARTING MULTI-TENANT ENROLLMENT ===');
    console.log('User:', enrollmentData.full_name);
    console.log('Staff ID:', enrollmentData.staff_id);
    console.log('Organization ID:', enrollmentData.organization_id);
    console.log('User Role:', enrollmentData.user_role || 'staff');
    
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

    // Check if user already exists
    console.log('Checking for existing user...');
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('staff_id', enrollmentData.staff_id)
      .eq('organization_id', enrollmentData.organization_id)
      .maybeSingle();

    if (existingUser) {
      console.log('User already exists:', existingUser.full_name);
      return {
        success: false,
        error: 'User with this ID already exists in this organization.'
      };
    }

    // Extract face embeddings
    console.log('Extracting face embeddings from photo...');
    let faceEmbedding: number[] | null = null;
    let embeddingDimensions = 0;
    let faceDetected = false;
    
    try {
      // Clean the photo data
      let cleanPhotoData = enrollmentData.photoData;
      if (cleanPhotoData.startsWith('data:image')) {
        console.log('Photo is already a data URL');
      } else {
        cleanPhotoData = `data:image/jpeg;base64,${cleanPhotoData}`;
        console.log('Added data URL prefix to photo');
      }
      
      const descriptor = await faceRecognition.extractFaceDescriptor(cleanPhotoData);
      
      if (descriptor) {
        faceEmbedding = Array.from(descriptor);
        embeddingDimensions = faceEmbedding.length;
        faceDetected = true;
        console.log(`✅ Face embeddings generated: ${embeddingDimensions} dimensions`);
      } else {
        console.log('❌ No face detected in enrollment photo');
        faceDetected = false;
      }
    } catch (embeddingError: any) {
      console.error('❌ Error generating embeddings:', embeddingError);
      faceDetected = false;
    }

    // Create user record with actual database schema
    console.log('Creating user in users table...');
    const userData: any = {
      full_name: enrollmentData.full_name,
      staff_id: enrollmentData.staff_id,
      email: enrollmentData.email || null,
      phone: enrollmentData.phone || null,
      user_role: enrollmentData.user_role || 'staff',
      branch_id: enrollmentData.branch_id || null,
      department_id: enrollmentData.department_id || null,
      organization_id: enrollmentData.organization_id,
      is_active: true,
      enrollment_status: 'enrolled',
      face_photo_url: enrollmentData.photoData,
      face_embedding: faceEmbedding ? JSON.stringify(faceEmbedding) : null,
      face_embedding_stored: faceDetected,
      face_enrolled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // For student role, you might want to store additional metadata
    // Since there's no gender/level fields in schema, we could:
    // 1. Store as JSON in a custom field (but no custom field exists)
    // 2. Create a separate students table (not in current schema)
    // 3. Use department_id for program and add metadata column later
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (userError) {
      console.error('❌ Database insert error:', userError);
      
      if (userError.code === '23505') {
        return {
          success: false,
          error: 'Staff/Student ID already exists. Please generate a new one.'
        };
      }
      
      return {
        success: false,
        error: `Database error: ${userError.message}`
      };
    }

    if (!user) {
      console.error('❌ User record was not created');
      return {
        success: false,
        error: 'User record was not created.'
      };
    }

    // Create face enrollment record
    if (faceDetected && faceEmbedding) {
      console.log('Creating face enrollment record...');
      const { error: faceEnrollmentError } = await supabase
        .from('face_enrollments')
        .insert([
          {
            user_id: user.id,
            organization_id: enrollmentData.organization_id,
            photo_url: enrollmentData.photoData,
            embedding: JSON.stringify(faceEmbedding),
            capture_device: 'web_camera',
            enrollment_location: 'enrollment_station',
            is_primary: true,
            is_active: true,
            quality_score: 95,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);

      if (faceEnrollmentError) {
        console.error('❌ Face enrollment error:', faceEnrollmentError);
      }
    }

    // Save to localStorage for offline use
    if (faceDetected && faceEmbedding) {
      console.log('Saving embeddings to localStorage...');
      faceRecognition.saveEmbeddingToLocal(enrollmentData.staff_id, new Float32Array(faceEmbedding));
    }

    console.log('✅ User enrolled successfully:', user.full_name);
    console.log('=== ENROLLMENT COMPLETE ===');

    // Prepare result with proper typing
    const resultUser = {
      id: user.id,
      staff_id: user.staff_id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      user_role: user.user_role,
      enrollment_status: user.enrollment_status,
      face_enrolled_at: user.face_enrolled_at,
      organization_id: user.organization_id,
      branch_id: user.branch_id,
      department_id: user.department_id,
      has_face_embedding: faceDetected,
      // Include student data if provided
      student_data: enrollmentData.student_data
    };

    return {
      success: true,
      user: resultUser,
      faceDetected,
      embeddingDimensions,
      message: `${enrollmentData.user_role === 'student' ? 'Student' : 'User'} enrolled successfully`
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

// Alias for backward compatibility
export const enrollStudent = enrollUser;

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