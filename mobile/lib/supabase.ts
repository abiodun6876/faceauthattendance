import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vpliofrxoalpihmebhrk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbGlvZnJ4b2FscGlobWViaHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDE2OTgsImV4cCI6MjA4NTYxNzY5OH0.8ycqRYouT_6VxS2rSjBgOOQy6SovNQ7Nd1qBoowc-WY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});

// Re-export services (we'll create these files next)
export { deviceService } from '../services/deviceService';
export { userService } from '../services/userService';
export { attendanceService } from '../services/attendanceService';
export { orgService as organizationService } from '../services/orgService';
// export { default as syncService } from '../services/syncService'; // Might need adaptation
