import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Initialize Supabase client with TypeScript types
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Type-safe utility to bypass TypeScript errors temporarily
export const asAny = <T,>(value: T): any => value;

// Re-export services for centralized access
export { deviceService } from '../services/deviceService';
export { userService } from '../services/userService';
export { attendanceService } from '../services/attendanceService';
export { orgService as organizationService } from '../services/orgService';
export { default as syncService } from '../services/syncService';

/**
 * Helper function to test connection
 */
export const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `Connected successfully. Found ${data?.length || 0} organizations.`
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};