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
  const response = await fetch('/api/programs');
  if (!response.ok) {
    throw new Error('Failed to fetch programs');
  }
  return response.json();
};