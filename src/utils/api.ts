// utils/api.ts
import { supabase } from '../lib/supabase';

interface DatabaseUser {
  branch_id: string;
  created_at: string;
  department_id: string;
  email: string;
  enrollment_status: string;
  face_embedding: string;
  face_embedding_stored: boolean;
  face_enrolled_at: string;
  user_role: string;
  full_name: string;
  is_active: boolean;
  organization_id: string;
}

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
  organization_id: string;
}

// Fetch all users in organization
export const fetchUsers = async (organizationId?: string): Promise<DatabaseUser[]> => {
  try {
    let query = supabase
      .from('users')
      .select('*')
      .eq('is_active', true);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.order('full_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

// Fetch all branches in organization
export const fetchBranches = async (organizationId?: string): Promise<Branch[]> => {
  try {
    let query = supabase
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching branches:', error);
    return [];
  }
};