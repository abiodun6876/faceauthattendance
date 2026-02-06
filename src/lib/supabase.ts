import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Initialize Supabase client with TypeScript types
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Type-safe utility to bypass TypeScript errors temporarily
const asAny = <T,>(value: T): any => value;

// Helper function to get device token
export const getDeviceToken = (): string | null => {
  return localStorage.getItem('device_token');
};

// Helper function to set device token
export const setDeviceToken = (token: string): void => {
  localStorage.setItem('device_token', token);
};





// Attendance service
export const attendanceService = {
  // Clock in
  async clockIn(params: {
    userId: string;
    deviceId: string;
    organizationId: string;
    branchId: string;
    shiftId?: string;
    confidence: number;
    photoUrl?: string;
    faceMatchScore?: number;
  }) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .insert(asAny({
        organization_id: params.organizationId,
        user_id: params.userId,
        device_id: params.deviceId,
        branch_id: params.branchId,
        shift_id: params.shiftId,
        clock_in: new Date().toISOString(),
        date: today,
        status: 'present',
        confidence_score: params.confidence,
        face_match_score: params.faceMatchScore,
        photo_url: params.photoUrl,
        verification_method: 'face',
      }))
      .select(`
        *,
        users (
          staff_id,
          full_name
        )
      `)
      .single();

    return { data, error };
  },

  // Clock out
  async clockOut(attendanceId: string) {
    const { data, error } = await supabase
      .from('attendance')
      .update(asAny({
        clock_out: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      .eq('id', attendanceId)
      .select()
      .single();

    return { data, error };
  },

  // Get today's attendance for a branch
  async getTodayAttendance(organizationId: string, branchId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        users (
          staff_id,
          full_name,
          email
        )
      `)
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('date', today)
      .order('clock_in', { ascending: false })
      .limit(50);

    return { data, error };
  },

  // Get user's today attendance
  async getUserTodayAttendance(userId: string, branchId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .eq('date', today)
      .single();

    return { data, error };
  },
};

// User service
export const userService = {
  // Find user by face embedding
  async findByFaceEmbedding(embedding: number[], organizationId: string, threshold = 0.65) {
    try {
      // Convert number[] to string for Supabase vector
      const embeddingString = JSON.stringify(embedding);

      const { data, error } = await supabase.rpc('match_users_by_face', asAny({
        query_embedding: embeddingString,
        match_threshold: threshold,
        filter_organization_id: organizationId,
      }));

      if (error) {
        console.error('Face matching error:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Face matching exception:', error);
      return null;
    }
  },

  // Enroll new user with face data
  async enrollUser(params: {
    organizationId: string;
    branchId: string;
    staffId: string;
    fullName: string;
    faceEmbedding: number[];
    photoUrl: string;
    email?: string;
    phone?: string;
  }) {
    try {
      // Convert embedding to string for database
      const embeddingString = JSON.stringify(params.faceEmbedding);

      // First create user
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert(asAny({
          organization_id: params.organizationId,
          branch_id: params.branchId,
          staff_id: params.staffId,
          full_name: params.fullName,
          email: params.email,
          phone: params.phone,
          enrollment_status: 'enrolled',
          face_embedding_stored: true,
        }))
        .select()
        .single();

      if (userError || !user) {
        throw userError || new Error('Failed to create user');
      }

      // Then create face enrollment
      const { error: faceError } = await supabase
        .from('face_enrollments')
        .insert(asAny({
          user_id: user.id,
          organization_id: params.organizationId,
          embedding: embeddingString,
          photo_url: params.photoUrl,
          quality_score: 0.9,
          is_primary: true,
          is_active: true,
        }));

      if (faceError) throw faceError;

      return { success: true, user };
    } catch (error) {
      console.error('User enrollment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Enrollment failed'
      };
    }
  },

  // Get user by ID
  async getUserById(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    return { data, error };
  },

  // Get all users in organization
  async getOrganizationUsers(organizationId: string, branchId?: string) {
    let query = supabase
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('staff_id');
    return { data, error };
  },
};

// Shift service
export const shiftService = {
  // Get current shift for branch
  async getCurrentShift(branchId: string) {
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime)
      .order('start_time')
      .limit(1);

    return { data: data?.[0], error };
  },

  // Get all shifts for branch
  async getBranchShifts(branchId: string) {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('start_time');

    return { data, error };
  },
};

// Screen pairing service
export const screenService = {
  // Generate pairing code for large screen
  async generatePairingCode(deviceId: string): Promise<string> {
    try {
      // Generate unique 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { error } = await supabase
        .from('screen_pairs')
        .upsert(asAny({
          device_id: deviceId,
          pair_code: code,
          status: 'paired',
          connected_at: new Date().toISOString(),
        }));

      if (error) throw error;
      return code;
    } catch (error) {
      console.error('Pairing code generation error:', error);
      throw error;
    }
  },

  async registerDevice(deviceData: {
    device_name: string;
    device_code: string;
    pairing_code: string;
    organization_code?: string;
  }) {
    try {
      console.log('🔧 Starting device registration...');
      console.log('📦 Device data:', deviceData);

      // FIXED: Get organization based on your actual schema
      let organization_id: string | null = null;

      if (deviceData.organization_code) {
        console.log(`🔍 Looking for organization with code/subdomain: ${deviceData.organization_code}`);

        // Try to find organization by name or subdomain
        const { data: orgs, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, subdomain')
          .or(`name.ilike.%${deviceData.organization_code}%,subdomain.eq.${deviceData.organization_code}`)
          .eq('is_active', true)
          .limit(1);

        if (orgError) {
          console.error('❌ Organization query error:', orgError);
        } else if (orgs && orgs.length > 0) {
          organization_id = orgs[0].id;
          console.log(`✅ Found organization: ${orgs[0].name} (ID: ${orgs[0].id})`);
        } else {
          console.log(`⚠️ No organization found with code: ${deviceData.organization_code}`);
        }
      }

      // If no organization found by code, get the first active organization
      if (!organization_id) {
        console.log('🔍 Getting first active organization...');

        const { data: defaultOrgs, error: defaultError } = await supabase
          .from('organizations')
          .select('id, name, subdomain')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1);

        if (defaultError) {
          console.error('❌ Default organization query error:', defaultError);
          return {
            success: false,
            error: `Database error: ${defaultError.message}`
          };
        }

        if (!defaultOrgs || defaultOrgs.length === 0) {
          console.error('❌ No active organizations found in database');
          return {
            success: false,
            error: 'No organizations found. Please create an organization in Supabase first.'
          };
        }

        organization_id = defaultOrgs[0].id;
        console.log(`✅ Using default organization: ${defaultOrgs[0].name} (ID: ${organization_id})`);
      }

      // Validate device code
      if (!deviceData.device_code || deviceData.device_code.trim() === '') {
        return {
          success: false,
          error: 'Device code is required'
        };
      }

      if (!deviceData.pairing_code || deviceData.pairing_code.trim() === '') {
        return {
          success: false,
          error: 'Pairing code is required'
        };
      }

      // Check if device code already exists
      console.log(`🔍 Checking if device code exists: ${deviceData.device_code}`);
      const { data: existingDevice } = await supabase
        .from('devices')
        .select('device_code')
        .eq('device_code', deviceData.device_code.trim())
        .maybeSingle(); // Use maybeSingle instead of single

      if (existingDevice) {
        console.error(`❌ Device code already exists: ${existingDevice.device_code}`);
        return {
          success: false,
          error: `Device code "${deviceData.device_code}" already exists. Please generate a new one.`
        };
      }

      // Generate device token
      const deviceToken = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 8)}`;
      console.log(`🔑 Generated device token: ${deviceToken}`);

      // Prepare device data
      const devicePayload = {
        device_name: deviceData.device_name.trim() || 'Unnamed Device',
        device_code: deviceData.device_code.trim(),
        pairing_code: deviceData.pairing_code.trim(),
        device_token: deviceToken,
        organization_id: organization_id,
        branch_id: null, // Will be set during branch selection
        status: 'active',
        is_active: true,
        device_type: 'face_recognition',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📤 Inserting device with payload:', devicePayload);

      // Insert device
      const { data: device, error: insertError } = await supabase
        .from('devices')
        .insert(devicePayload)
        .select(`
        *,
        organization:organizations(*),
        branch:branches(*)
      `)
        .single();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        return {
          success: false,
          error: `Database error: ${insertError.message}`,
          code: insertError.code
        };
      }

      console.log('✅ Device created successfully:', device);

      // Store in localStorage
      localStorage.setItem('device_token', deviceToken);
      localStorage.setItem('device_id', device.id);
      localStorage.setItem('device_code', device.device_code);
      localStorage.setItem('organization_id', device.organization_id);

      return {
        success: true,
        device,
        device_token: deviceToken,
        message: 'Device registered successfully!'
      };

    } catch (error: any) {
      console.error('❌ Registration exception:', error);
      return {
        success: false,
        error: error.message || 'Unexpected error during registration'
      };
    }
  },

  // Connect screen with pairing code
  async connectScreen(pairCode: string, screenName?: string) {
    try {
      const { data, error } = await supabase
        .from('screen_pairs')
        .update(asAny({
          screen_name: screenName,
          status: 'paired',
          connected_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
        }))
        .eq('pair_code', pairCode.trim().toUpperCase())
        .eq('status', 'paired')
        .select(`
          *,
          devices (
            *,
            branches (*),
            organizations (*)
          )
        `)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Get screen connection status
  async getScreenConnection(deviceId: string) {
    const { data, error } = await supabase
      .from('screen_pairs')
      .select('*')
      .eq('device_id', deviceId)
      .eq('status', 'paired')
      .single();

    return { data, error };
  },

  // Update screen activity
  async updateScreenActivity(pairId: string) {
    await supabase
      .from('screen_pairs')
      .update(asAny({ last_activity: new Date().toISOString() }))
      .eq('id', pairId);
  },
};

// Real-time subscriptions
export const realtimeService = {
  // Subscribe to attendance updates
  subscribeToAttendance(organizationId: string, callback: (payload: any) => void) {
    return supabase
      .channel('attendance-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log('New attendance record:', payload);
          callback(payload);
        }
      )
      .subscribe();
  },

  // Subscribe to screen pairing updates
  subscribeToScreenPairing(deviceId: string, callback: (payload: any) => void) {
    return supabase
      .channel('screen-pairing')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'screen_pairs',
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          console.log('Screen pairing update:', payload);
          callback(payload);
        }
      )
      .subscribe();
  },

  // Unsubscribe from all channels
  unsubscribeAll() {
    supabase.removeAllChannels();
  },
};

// Helper function to test connection
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






// Organization service
export const organizationService = {
  // Create new organization
  async createOrganization(params: {
    name: string;
    type: 'company' | 'school';
    idLabel?: string;
    branchName?: string;
  }) {
    try {
      // Generate a subdomain from name (simplified)
      const cleanName = params.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const subdomain = `${cleanName}-${Math.floor(Math.random() * 10000)}`;

      const { data: organization, error } = await supabase
        .from('organizations')
        .insert(asAny({
          name: params.name,
          type: params.type,
          subdomain: subdomain,
          settings: {
            id_label: params.idLabel || (params.type === 'school' ? 'Student ID' : 'Staff ID'),
            shift_based: true,
            attendance_mode: 'shift',
            max_shift_hours: 9,
            overtime_allowed: true,
            require_clock_out: true,
            allow_multi_branch: true,
            late_penalty_minutes: 15,
            verification_threshold: 0.65
          },
          branding: {
            primary_color: '#2563eb',
            welcome_message: `Welcome to ${params.name}`,
            logo_url: null
          },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
        .select()
        .single();

      if (error) throw error;

      // Create a default branch for the new organization
      const { error: branchError } = await supabase
        .from('branches')
        .insert(asAny({
          organization_id: organization.id,
          name: params.branchName || 'Main Branch',
          code: (params.branchName || 'MAIN').substring(0, 3).toUpperCase(),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

      if (branchError) {
        console.error('Error creating default branch:', branchError);
        // Continue anyway, as the organization was created
      }

      return { success: true, organization };
    } catch (error: any) {
      console.error('Error creating organization:', error);
      return { success: false, error: error.message };
    }
  }
};

// Device service for managing device registration
export const deviceService = {
  async checkDeviceRegistration() {
    const deviceToken = localStorage.getItem('device_token');

    if (!deviceToken) {
      return { isRegistered: false, device: null };
    }

    try {
      const { data: device, error } = await supabase
        .from('devices')
        .select(`
          *,
          organization:organizations(*),
          branch:branches(*)
        `)
        .eq('device_token', deviceToken)
        .eq('is_active', true)
        .single();

      if (error || !device) {
        // Fallback to cache if network fails but we had a token
        const cachedDevice = localStorage.getItem('cached_device_info');
        if (cachedDevice) {
          console.log('🌐 Network failed, using cached device info');
          return { isRegistered: true, device: JSON.parse(cachedDevice) };
        }
        localStorage.removeItem('device_token');
        return { isRegistered: false, device: null };
      }

      // Save to cache
      localStorage.setItem('cached_device_info', JSON.stringify(device));

      // Ensure critical IDs are in localStorage to support pages that rely on them
      if (device.organization_id) {
        localStorage.setItem('organization_id', device.organization_id);
      }
      if (device.branch_id) {
        localStorage.setItem('branch_id', device.branch_id);
      }

      await supabase
        .from('devices')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', device.id);

      return { isRegistered: true, device };
    } catch (error) {
      console.error('Error checking device registration:', error);
      const cachedDevice = localStorage.getItem('cached_device_info');
      if (cachedDevice) {
        const device = JSON.parse(cachedDevice);
        // Ensure critical IDs are available even when offline
        if (device.organization_id) {
          localStorage.setItem('organization_id', device.organization_id);
        }
        if (device.branch_id) {
          localStorage.setItem('branch_id', device.branch_id);
        }
        return { isRegistered: true, device };
      }
      return { isRegistered: false, device: null };
    }
  },

  async registerDevice(deviceData: {
    device_name: string;
    device_code: string;
    pairing_code: string;
    organization_code?: string;
  }) {
    try {
      if (!deviceData.device_code) {
        return { success: false, error: 'Device code is required' };
      }

      let organization_id = null;

      let branch_id = null;

      if (deviceData.organization_code) {
        // Try subdomain first
        let { data: org } = await supabase
          .from('organizations')
          .select('id')
          .ilike('subdomain', deviceData.organization_code)
          .eq('is_active', true)
          .maybeSingle();

        // Fallback to searching by name
        if (!org) {
          const { data: orgByName } = await supabase
            .from('organizations')
            .select('id')
            .ilike('name', deviceData.organization_code)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          org = orgByName;
        }

        if (org) {
          organization_id = org.id;
          // Try to get the first branch of this organization to auto-assign if possible
          const { data: branch } = await supabase
            .from('branches')
            .select('id')
            .eq('organization_id', organization_id)
            .limit(1)
            .maybeSingle();
          if (branch) branch_id = branch.id;
        } else {
          // AUTO-CREATE organization if not found (Guest/New Org flow)
          console.log(`Organization '${deviceData.organization_code}' not found. Creating it now...`);
          const createResult = await organizationService.createOrganization({
            name: deviceData.organization_code,
            type: 'company',
            branchName: 'Main Office'
          });

          if (createResult.success && createResult.organization) {
            organization_id = createResult.organization.id;
            // Fetch the newly created branch
            const { data: newBranch } = await supabase
              .from('branches')
              .select('id')
              .eq('organization_id', organization_id)
              .limit(1)
              .maybeSingle();
            if (newBranch) branch_id = newBranch.id;
            console.log('✅ Auto-created organization and branch:', organization_id, branch_id);
          } else {
            return {
              success: false,
              error: `Failed to create organization '${deviceData.organization_code}': ${createResult.error}`
            };
          }
        }
      } else {
        // ... (existing default org logic)
        const { data: defaultOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (defaultOrg) {
          organization_id = defaultOrg.id;
          const { data: branch } = await supabase
            .from('branches')
            .select('id')
            .eq('organization_id', organization_id)
            .limit(1)
            .maybeSingle();
          if (branch) branch_id = branch.id;
        } else {
          return {
            success: false,
            error: 'No active organization found to register with. Please create an organization first.'
          };
        }
      }

      const deviceToken = `dev_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`;

      // First check if device already exists with this code
      const { data: existingDevice } = await supabase
        .from('devices')
        .select('id')
        .eq('device_code', deviceData.device_code)
        .maybeSingle();

      if (existingDevice) {
        return {
          success: false,
          error: 'Device code already exists'
        };
      }

      // Get device IP (simulated)
      const deviceIp = await this.getDeviceIP();

      const { data: device, error } = await supabase
        .from('devices')
        .insert({
          device_name: deviceData.device_name,
          device_code: deviceData.device_code,
          pairing_code: deviceData.pairing_code,
          device_token: deviceToken,
          organization_id,
          branch_id, // AUTO-ASSIGNED
          device_ip: deviceIp,
          is_active: true,
          status: 'active',
          device_type: 'face_recognition',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select(`
          *,
          organization:organizations(*),
          branch:branches(*)
        `)
        .single();

      if (error) {
        console.error('Database error:', error);
        return { success: false, error: error.message };
      }

      localStorage.setItem('device_token', deviceToken);
      localStorage.setItem('cached_device_info', JSON.stringify(device));

      return { success: true, device };
    } catch (error: any) {
      console.error('Error registering device:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  },

  async loginDevice(deviceCode: string, pairingCode: string) {
    try {
      const { data: device, error } = await supabase
        .from('devices')
        .select(`
          *,
          organization:organizations(*),
          branch:branches(*)
        `)
        .eq('device_code', deviceCode)
        .eq('pairing_code', pairingCode)
        .single();

      if (error || !device) {
        return { success: false, error: 'Invalid device code or pairing code' };
      }

      if (!device.is_active) {
        // Reactivate if inactive
        await supabase
          .from('devices')
          .update({ is_active: true, status: 'active', last_seen: new Date().toISOString() })
          .eq('id', device.id);
      } else {
        // Update last seen
        await supabase
          .from('devices')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', device.id);
      }

      // Store in localStorage
      localStorage.setItem('device_token', device.device_token);
      localStorage.setItem('device_id', device.id);
      localStorage.setItem('device_code', device.device_code);
      localStorage.setItem('organization_id', device.organization_id);

      return { success: true, device };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  },

  async getDeviceIP(): Promise<string> {
    try {
      // Try to get real IP
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      // Fallback to simulated IP
      const ipParts = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 255) + 1
      );
      return ipParts.join('.');
    }
  },

  async updateBranch(branchId: string) {
    try {
      const deviceToken = localStorage.getItem('device_token');
      if (!deviceToken) {
        return {
          success: false,
          error: 'No device token found. Please register device first.'
        };
      }

      const { data: device, error } = await supabase
        .from('devices')
        .update({
          branch_id: branchId,
          updated_at: new Date().toISOString()
        })
        .eq('device_token', deviceToken)
        .select(`
          *,
          organization:organizations(*),
          branch:branches(*)
        `)
        .single();

      if (error) {
        console.error('Database error:', error);
        return { success: false, error: error.message };
      }

      if (!device) {
        return {
          success: false,
          error: 'Device not found. Please re-register.'
        };
      }

      return { success: true, device };
    } catch (error: any) {
      console.error('Error updating branch:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  },

  async getAvailableBranches() {
    try {
      const deviceToken = localStorage.getItem('device_token');
      if (!deviceToken) {
        return {
          branches: [],
          error: 'No device token found'
        };
      }

      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('organization_id')
        .eq('device_token', deviceToken)
        .single();

      if (deviceError || !device) {
        return {
          branches: [],
          error: 'Device not found or not registered'
        };
      }

      if (!device.organization_id) {
        return {
          branches: [],
          error: 'Device not associated with any organization'
        };
      }

      const { data: branches, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', device.organization_id)
        .eq('is_active', true)
        .order('name');

      if (branchesError) {
        console.error('Database error:', branchesError);
        return {
          branches: [],
          error: branchesError.message
        };
      }

      return { branches: branches || [] };
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      return {
        branches: [],
        error: error.message || 'An unexpected error occurred'
      };
    }
  },

  async getDeviceInfo() {
    try {
      const deviceToken = localStorage.getItem('device_token');
      if (!deviceToken) {
        return { device: null };
      }

      const { data: device, error } = await supabase
        .from('devices')
        .select(`
          *,
          organization:organizations(*),
          branch:branches(*)
        `)
        .eq('device_token', deviceToken)
        .single();

      if (error || !device) {
        localStorage.removeItem('device_token');
        return { device: null };
      }

      return { device };
    } catch (error) {
      console.error('Error getting device info:', error);
      return { device: null };
    }
  },

  async unregisterDevice() {
    try {
      const deviceToken = localStorage.getItem('device_token');
      if (deviceToken) {
        await supabase
          .from('devices')
          .update({
            is_active: false,
            status: 'inactive',
            updated_at: new Date().toISOString()
          })
          .eq('device_token', deviceToken);
      }

      localStorage.removeItem('device_token');
      return { success: true };
    } catch (error) {
      console.error('Error unregistering device:', error);
      return { success: false, error };
    }
  }
};

// Quick test function
export const quickTest = async () => {
  console.log('Testing Supabase connection...');

  try {
    // Test 1: Simple query
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);

    if (orgError) {
      console.error('Organization query failed:', orgError);
      return false;
    }

    console.log('✅ Organizations query successful:', orgs);



    return true;
  } catch (error) {
    console.error('❌ Supabase test failed:', error);
    return false;
  }
};

export default supabase;