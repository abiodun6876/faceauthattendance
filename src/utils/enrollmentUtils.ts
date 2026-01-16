// utils/enrollmentUtils.ts - New utility file
import { supabase } from '../lib/supabase';
import faceRecognition from './faceRecognition';
import { compressImage } from './imageUtils';

export interface EnrollmentData {
  student_id: string;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  program_id?: string;
  program?: string;
  level?: number;
  photoData: string;
}

export async function enrollStudent(data: EnrollmentData) {
  try {
    console.log('🟡 Starting enrollment process...');
    
    // Generate matric number if not provided
    const matricNumber = data.student_id || generateMatricNumber();
    
    // Load face models
    await faceRecognition.loadModels();
    
    // Extract face embedding
    console.log('🟡 Extracting face features...');
    const descriptor = await faceRecognition.extractFaceDescriptor(data.photoData);
    
    let faceEmbedding: number[] = [];
    let faceDetected = false;
    
    if (descriptor) {
      faceDetected = true;
      faceEmbedding = Array.from(descriptor);
      console.log('✅ Face detected, embedding length:', faceEmbedding.length);
    } else {
      console.log('⚠️ No face detected, using fallback');
      // Generate random embedding for fallback
      faceEmbedding = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    }
    
    // Convert to 128D if needed
    const finalEmbedding = generate128DEmbedding(faceEmbedding);
    console.log('✅ Final embedding (128D):', finalEmbedding.length);
    
    // Compress and upload photo
    console.log('🟡 Processing photo...');
    const compressedImage = await compressImage(data.photoData, 640, 0.8);
    const fileName = `enrollment_${Date.now()}_${data.name.replace(/\s+/g, '_')}.jpg`;
    
    let photoUrl = '';
    try {
      const blob = dataURLtoBlob(compressedImage);
      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(fileName, blob);
      
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('student-photos')
          .getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }
    } catch (storageError) {
      console.warn('Storage upload failed, using base64:', storageError);
      photoUrl = compressedImage;
    }
    
    // Prepare student data
    const studentData = {
      student_id: matricNumber,
      matric_number: matricNumber,
      name: data.name,
      email: data.email,
      phone: data.phone,
      gender: data.gender || 'male',
      program_id: data.program_id,
      program: data.program,
      program_name: data.program,
      level: data.level || 100,
      level_code: data.level ? `L${data.level}` : 'L100',
      face_embedding: finalEmbedding,
      face_embedding_vector: finalEmbedding,
      face_detected: faceDetected,
      face_enrolled_at: new Date().toISOString(),
      face_match_threshold: faceDetected ? 0.65 : 0.5,
      photo_url: photoUrl,
      enrollment_status: 'enrolled' as const,
      is_active: true,
      enrollment_date: new Date().toISOString().split('T')[0]
    };
    
    // Save to database
    console.log('🟡 Saving to database...');
    const { data: savedStudent, error } = await supabase
      .from('students_new')
      .upsert([studentData], {
        onConflict: 'matric_number'
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    console.log('✅ Student enrolled successfully!');
    return {
      success: true,
      student: savedStudent,
      faceDetected,
      embeddingDimensions: finalEmbedding.length
    };
    
  } catch (error: any) {
    console.error('❌ Enrollment failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function generateMatricNumber(): string {
  const currentYear = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ABU/${currentYear}/${randomNum}`;
}

function generate128DEmbedding(embedding: number[]): number[] {
  if (embedding.length <= 128) {
    return embedding.length === 128 ? embedding : [...embedding, ...Array(128 - embedding.length).fill(0)];
  }
  
  // Downsample 512D to 128D
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

function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new Blob([u8arr], { type: mime });
}