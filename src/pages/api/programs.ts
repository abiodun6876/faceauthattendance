// utils/api.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    console.log('Fetching programs from Supabase...');
    
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .order('name');

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Fetched programs:', data);
    return data || [];
  } catch (error: any) {
    console.error('Error fetching programs:', error);
    throw new Error(`Failed to fetch programs: ${error.message}`);
  }
};