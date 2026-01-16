// utils/api.ts
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
    const response = await fetch('/api/programs');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch programs: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data;
    } else if (data.programs) {
      return data.programs;
    } else if (data.data) {
      return data.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching programs:', error);
    throw error;
  }
};