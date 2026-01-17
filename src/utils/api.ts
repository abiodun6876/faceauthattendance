// utils/api.ts
import { supabase } from '../lib/supabase';

export interface Program {
  id: string;
  code: string;
  name: string;
  short_name?: string;
  faculty_id?: string;
  department_id?: string;
  program_type?: string;
  duration_years?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const fetchPrograms = async (): Promise<Program[]> => {
  try {
    console.log('Fetching programs from database...');
    
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('is_active', true)  // Only fetch active programs
      .order('name');  // Order by name

    if (error) {
      console.error('Database error fetching programs:', error);
      throw error;
    }

    console.log('Fetched programs:', data);
    
    // Ensure we return an array even if data is null
    return data || [];
  } catch (error) {
    console.error('Error in fetchPrograms:', error);
    
    // Return empty array instead of throwing to prevent page crash
    return [];
  }
};

// Alternative: fetch with additional filters
export const fetchProgramsForEnrollment = async (): Promise<Program[]> => {
  try {
    console.log('Fetching programs for enrollment...');
    
    const { data, error } = await supabase
      .from('programs')
      .select('id, code, name, short_name, program_type, duration_years, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Database error:', error);
      return [];
    }

    console.log(`Found ${data?.length || 0} active programs`);
    return data || [];
  } catch (error) {
    console.error('Error fetching programs:', error);
    return [];
  }
};