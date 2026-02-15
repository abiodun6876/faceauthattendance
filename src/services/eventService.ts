import { supabase } from '../lib/supabase';

export interface Event {
    id: string;
    organization_id: string;
    branch_id?: string;
    name: string;
    description?: string;
    event_type: string;
    start_date: string;
    end_date?: string;
    location?: string;
    status: 'upcoming' | 'active' | 'completed' | 'cancelled';
    capacity?: number;
    settings: any;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface EventRegistration {
    id: string;
    event_id: string;
    user_id: string;
    registration_date: string;
    status: 'registered' | 'checked_in' | 'cancelled';
    notes?: string;
    user?: {
        full_name: string;
        staff_id: string;
        email: string;
        face_photo_url: string;
    };
}

const supabaseAny = supabase as any;

export const eventService = {
    async getEvents(organizationId: string, branchId?: string) {
        let query = supabaseAny
            .from('events')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        return await query.order('start_date', { ascending: true });
    },

    async getEventById(eventId: string) {
        return await supabaseAny
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();
    },

    async createEvent(eventData: Partial<Event>) {
        return await supabaseAny
            .from('events')
            .insert([eventData])
            .select()
            .single();
    },

    async updateEvent(eventId: string, updates: Partial<Event>) {
        return await supabaseAny
            .from('events')
            .update(updates)
            .eq('id', eventId)
            .select()
            .single();
    },

    async registerUser(eventId: string, userId: string, notes?: string) {
        return await supabaseAny
            .from('event_registrations')
            .insert([
                {
                    event_id: eventId,
                    user_id: userId,
                    notes,
                    status: 'registered'
                }
            ])
            .select()
            .single();
    },

    async getRegistrations(eventId: string) {
        return await supabaseAny
            .from('event_registrations')
            .select(`
                *,
                user:users(full_name, staff_id, email, face_photo_url)
            `)
            .eq('event_id', eventId)
            .order('registration_date', { ascending: false });
    },

    async checkInAttendee(registrationId: string) {
        return await supabaseAny
            .from('event_registrations')
            .update({ status: 'checked_in', updated_at: new Date().toISOString() })
            .eq('id', registrationId)
            .select()
            .single();
    }
};
