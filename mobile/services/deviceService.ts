import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const deviceService = {
    /**
     * Check if the current device is registered using the stored token.
     */
    async checkRegistration() {
        try {
            const deviceToken = await AsyncStorage.getItem('device_token');

            if (!deviceToken) {
                return { isRegistered: false, device: null };
            }

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
                // Fallback to cache
                const cachedDevice = await AsyncStorage.getItem('cached_device_info');
                if (cachedDevice) {
                    return { isRegistered: true, device: JSON.parse(cachedDevice) };
                }
                return { isRegistered: false, device: null };
            }

            // Update cache
            await AsyncStorage.setItem('cached_device_info', JSON.stringify(device));
            return { isRegistered: true, device };
        } catch (error) {
            console.error('Device registration check error:', error);
            const cachedDevice = await AsyncStorage.getItem('cached_device_info');
            if (cachedDevice) {
                return { isRegistered: true, device: JSON.parse(cachedDevice) };
            }
            return { isRegistered: false, device: null };
        }
    },

    /**
     * Update device heartbeat/last seen.
     */
    async updateLastSeen(deviceId: string) {
        return await supabase
            .from('devices')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', deviceId);
    },

    /**
     * Register a new device.
     */
    async registerDevice(params: {
        device_name: string;
        device_code: string;
        pairing_code: string;
        organization_code?: string;
    }) {
        try {
            // Call the register_device RPC function
            const { data, error } = await supabase.rpc('register_device', {
                p_device_name: params.device_name,
                p_device_code: params.device_code,
                p_pairing_code: params.pairing_code,
                p_org_code: params.organization_code || 'default'
            });

            if (error) {
                console.error('Device registration error:', error);
                return { success: false, error: error.message };
            }

            if (data && 'device_token' in data && data.device_token) {
                await AsyncStorage.setItem('device_token', data.device_token);
                return { success: true, device: data };
            }

            return { success: false, error: 'Failed to receive device token' };
        } catch (error: any) {
            console.error('Device registration exception:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Login an existing device.
     */
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
                .eq('is_active', true)
                .single();

            if (error || !device) {
                return { success: false, error: 'Invalid device or pairing code' };
            }

            // Store token and info
            if (device.device_token) {
                await AsyncStorage.setItem('device_token', device.device_token);
                await AsyncStorage.setItem('cached_device_info', JSON.stringify(device));
            }

            return { success: true, device };
        } catch (error: any) {
            console.error('Device login error:', error);
            return { success: false, error: error.message };
        }
    }
};
