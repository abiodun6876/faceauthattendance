// pages/AttendancePage.tsx - Complete Multi-tenant Attendance System
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Space,
  Tag,
  Spin,
  message,
  Input,
  Image,
  Typography
} from 'antd';

import {
  Camera,
  QrCode,
  User,
  Scan,
  ArrowLeft,
  Play,
  StopCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase } from '../lib/supabase';
import { deviceService } from '../services/deviceService';
import { attendanceService } from '../services/attendanceService';
import { userService } from '../services/userService';
import faceService from '../utils/faceService';
import faceRecognition from '../utils/faceRecognition';
import offlineStorageService from '../services/offlineStorageService';
import { speak } from '../utils/speechSynthesis';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

const { Title, Text } = Typography;
dayjs.extend(relativeTime);


interface AttendanceRecord {
  id: string;
  user_id: string;
  organization_id: string;
  branch_id: string;
  device_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
  confidence_score: number;
  face_match_score: number;
  photo_url: string;
  verification_method: string;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    staff_id: string;
    face_photo_url: string;
    department_id: string;
    user_role: string;
  };
  branch?: {
    name: string;
  };
}

interface OrganizationSettings {
  id_label?: string;
  attendance_mode?: 'toggle' | 'explicit' | 'event';
  shift_based?: boolean;
  grace_minutes?: number;
  working_hours?: {
    start: string;
    end: string;
  };
}

interface DeviceInfo {
  id: string;
  device_name: string;
  device_code: string;
  branch_id: string;
  organization_id: string;
  status: string;
  last_seen: string;
  organization?: {
    id: string;
    name: string;
    type: string;
    settings: OrganizationSettings | null;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

interface AttendanceStats {
  total_users: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  attendance_rate: number;
  average_confidence: number;
  current_shift?: string;
  next_shift?: string;
}

const AttendancePage: React.FC = () => {

  const [processing, setProcessing] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [attendanceMode, setAttendanceMode] = useState<'toggle' | 'explicit' | 'event'>('toggle');
  const [userAction, setUserAction] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [_lastAttendance, setLastAttendance] = useState<AttendanceRecord | null>(null);
  const [stats, setStats] = useState<AttendanceStats>({
    total_users: 0,
    present_today: 0,
    late_today: 0,
    absent_today: 0,
    attendance_rate: 0,
    average_confidence: 0
  });

  const [showResultModal, setShowResultModal] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<{
    success: boolean;
    user?: any;
    confidence?: number;
    action?: 'clock_in' | 'clock_out';
    attendance?: AttendanceRecord;
    error?: string;
    photoData?: string;
  } | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);
  const [_connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [manualId, setManualId] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'face' | 'qr' | 'manual'>('face');
  const [showCourseSidebar, setShowCourseSidebar] = useState(false);
  const [_manualLoading, setManualLoading] = useState(false);
  const [_showHistory, _setShowHistory] = useState(false);
  const navigate = useNavigate();


  // Helper function to extract organization settings
  const extractOrganizationSettings = useCallback((settings: any): OrganizationSettings => {
    if (!settings || typeof settings !== 'object') {
      return {};
    }

    return {
      id_label: typeof settings.id_label === 'string' ? settings.id_label : undefined,
      attendance_mode: ['toggle', 'explicit', 'event'].includes(settings.attendance_mode)
        ? settings.attendance_mode as 'toggle' | 'explicit' | 'event'
        : 'toggle',
      shift_based: typeof settings.shift_based === 'boolean' ? settings.shift_based : undefined,
      grace_minutes: typeof settings.grace_minutes === 'number' ? settings.grace_minutes : undefined,
      working_hours: typeof settings.working_hours === 'object' && settings.working_hours !== null
        ? {
          start: typeof settings.working_hours.start === 'string' ? settings.working_hours.start : '09:00',
          end: typeof settings.working_hours.end === 'string' ? settings.working_hours.end : '17:00'
        }
        : undefined
    };
  }, []);

  // Check connection
  const checkConnection = useCallback(async () => {
    try {
      const { data: _data, error } = await supabase
        .from('devices')
        .select('id')
        .limit(1);

      if (error) throw error;
      setConnectionStatus('online');

      // Update device last seen
      if (deviceInfo) {
        await deviceService.updateLastSeen(deviceInfo.id);
      }
    } catch (error) {
      console.log('Connection offline');
      setConnectionStatus('online'); // Keep online if we can't confirm offline but had data
    }
  }, [deviceInfo]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      if (!deviceInfo?.organization_id) return;

      const { data: attendance, error } = await attendanceService.getTodayStats(
        deviceInfo.organization_id,
        deviceInfo.branch_id
      );

      if (error) throw error;

      const present = attendance?.filter(a => a.status === 'present').length || 0;
      const late = attendance?.filter(a => a.status === 'late').length || 0;

      setStats(prev => ({
        ...prev,
        present_today: present,
        late_today: late,
        attendance_rate: stats.total_users > 0 ? (present / stats.total_users) * 100 : 0
      }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [deviceInfo?.organization_id, deviceInfo?.branch_id, stats.total_users]);

  // Load user count
  const loadUserCount = useCallback(async () => {
    try {
      if (!deviceInfo?.organization_id) return;

      const { count, error } = await userService.getOrganizationUsers(
        deviceInfo.organization_id,
        deviceInfo.branch_id
      );

      if (error) throw error;

      setStats(prev => ({
        ...prev,
        total_users: count || 0,
        absent_today: count ? count - prev.present_today : 0
      }));
    } catch (error) {
      console.error('Error loading user count:', error);
    }
  }, [deviceInfo?.organization_id, deviceInfo?.branch_id]);

  // Load recent attendance
  const load = useCallback(async (limit = 10) => {
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          user:users(full_name, staff_id, face_photo_url, department_id, user_role),
          branch:branches(name)
        `)
        .eq('organization_id', deviceInfo?.organization_id);

      if (deviceInfo?.branch_id) {
        query = query.eq('branch_id', deviceInfo.branch_id);
      }

      const { error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

    } catch (error) {
      console.error('Error loading recent attendance:', error);
    }
  }, [deviceInfo?.organization_id, deviceInfo?.branch_id]);

  // Check last attendance
  const checkLastAttendance = useCallback(async () => {
    try {
      if (!deviceInfo?.id) return;

      await attendanceService.getTodayRecord(
        '', // We don't have user ID yet, this function in service is for a specific user
        deviceInfo.organization_id
      );
      // Wait, the checkLastAttendance in original code was getting last attendance for *this device*

      const today = dayjs().format('YYYY-MM-DD');
      const { data: deviceLastRecord, error: devError } = await supabase
        .from('attendance')
        .select('*')
        .eq('device_id', deviceInfo.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (devError && devError.code !== 'PGRST116') throw devError;
      setLastAttendance(deviceLastRecord || null);
    } catch (error) {
      console.error('Error checking last attendance:', error);
    }
  }, [deviceInfo]);

  // Determine next action
  const determineNextAction = useCallback(async () => {
    if (!deviceInfo) return;

    const userId = null; // We'll get this after face match

    // For toggle mode, check if user is already clocked in
    if (attendanceMode === 'toggle' && userId) {
      const { data: todayRecord } = await attendanceService.getTodayRecord(
        userId,
        deviceInfo.organization_id
      );

      if (todayRecord) {
        setUserAction(todayRecord.clock_out ? 'clock_in' : 'clock_out');
      } else {
        setUserAction('clock_in');
      }
    }
  }, [deviceInfo, attendanceMode]);

  // Initialize attendance
  const initializeAttendance = useCallback(async () => {
    try {
      const { isRegistered, device: deviceInfoData } = await deviceService.checkRegistration();

      if (!isRegistered || !deviceInfoData) {
        message.warning('Device not registered. Redirecting to setup...');
        setTimeout(() => window.location.href = '/device-setup', 1500);
        return;
      }

      if (!deviceInfoData.branch_id) {
        message.warning('Branch not selected. Redirecting to branch selection...');
        setTimeout(() => window.location.href = '/branch-selection', 1500);
        return;
      }

      const typedDevice: DeviceInfo = {
        id: deviceInfoData.id,
        device_name: deviceInfoData.device_name,
        device_code: deviceInfoData.device_code,
        branch_id: deviceInfoData.branch_id,
        organization_id: deviceInfoData.organization_id,
        status: deviceInfoData.status,
        last_seen: deviceInfoData.last_seen || new Date().toISOString(),
        organization: deviceInfoData.organization ? {
          id: deviceInfoData.organization.id,
          name: deviceInfoData.organization.name,
          type: deviceInfoData.organization.type || 'company',
          settings: extractOrganizationSettings(deviceInfoData.organization.settings)
        } : undefined,
        branch: deviceInfoData.branch
      };

      setDeviceInfo(typedDevice);

      const settings = typedDevice.organization?.settings;
      const mode = settings?.attendance_mode || 'toggle';
      setAttendanceMode(mode);

      await Promise.all([
        loadStats(),
        load(),
        checkLastAttendance(),
        loadUserCount(),
        faceService.initializeModels()
      ]);

      // Preload face embeddings into memory for instant matching (no network delay per scan)
      faceRecognition.preloadEmbeddings().catch(e => console.warn('Embedding preload failed:', e));

      // Sync enrolled users to local cache for offline-capable matching
      await offlineStorageService.syncUsers(
        typedDevice.organization_id,
        typedDevice.branch_id
      );

      await determineNextAction();
    } catch (error: any) {
      console.error('Initialization error:', error);
      message.error(error.message || 'Failed to initialize attendance system');
    }
  }, [
    loadStats,
    load,
    checkLastAttendance,
    loadUserCount,
    determineNextAction,
    extractOrganizationSettings
  ]);

  // Determine attendance action
  const determineAttendanceAction = useCallback(async (userId: string): Promise<'clock_in' | 'clock_out'> => {
    if (attendanceMode === 'explicit') {
      return userAction;
    }

    try {
      // Check existing attendance for today
      const { data: existingRecord, error } = await attendanceService.getTodayRecord(
        userId,
        deviceInfo?.organization_id || ''
      );

      if (error) {
        console.error('Error fetching existing attendance:', error);
        return 'clock_in';
      }

      if (!existingRecord) {
        return 'clock_in';
      }

      // If already clocked out today
      if (existingRecord.clock_out) {
        return 'clock_in';
      }

      return 'clock_out';
    } catch (e) {
      console.error('Exception in determineAttendanceAction:', e);
      return 'clock_in';
    }
  }, [attendanceMode, userAction, deviceInfo?.organization_id]);

  // Record attendance
  const recordAttendance = useCallback(async (
    userId: string,
    action: 'clock_in' | 'clock_out',
    photoData: string,
    confidence: number,
    _embedding: string,
    verificationMethod: string = 'face'
  ): Promise<AttendanceRecord> => {
    // Check existing record for today
    const { data: existingRecord } = await attendanceService.getTodayRecord(
      userId,
      deviceInfo?.organization_id || ''
    );

    let finalResult;

    if (existingRecord && action === 'clock_out') {
      finalResult = await attendanceService.clockOut(existingRecord.id);
    } else {
      finalResult = await attendanceService.clockIn({
        userId,
        deviceId: deviceInfo?.id || '',
        organizationId: deviceInfo?.organization_id || '',
        branchId: deviceInfo?.branch_id || '',
        confidence,
        photoUrl: photoData,
        verificationMethod
      });
    }

    if (finalResult.error) throw finalResult.error;

    // Log face match
    await attendanceService.logFaceMatch({
      userId,
      organizationId: deviceInfo?.organization_id || '',
      deviceId: deviceInfo?.id || '',
      photoUrl: photoData,
      confidence,
      isMatch: true,
      result: action
    });

    return finalResult.data as AttendanceRecord;
  }, [deviceInfo]);

  const [faceStatus, setFaceStatus] = useState<'idle' | 'scanning' | 'processing' | 'boosting'>('scanning');

  // Handle face capture — uses local embedding matching for speed & reliability
  const handleFaceCapture = useCallback(async (photoData: string) => {
    if (processing) return;

    setProcessing(true);
    setFaceStatus('processing');
    try {
      // 1. Extract face embedding from captured photo
      const faceResult = await faceService.processImage(photoData);

      if (faceResult.isEnhanced) {
        setFaceStatus('boosting');
      }

      if (!faceResult.success || !faceResult.embedding) {
        throw new Error(faceResult.error || 'Face not detected. Please ensure good lighting and face the camera directly.');
      }

      // 2. Match locally against cached users (fast, no network needed)
      const localMatch = offlineStorageService.findByFaceEmbedding(faceResult.embedding, 0.6);

      if (!localMatch) {
        throw new Error('Identity not recognized. Please scan again or enroll first.');
      }

      const matchedUser = localMatch.user;
      const confidence = Math.round((1 - localMatch.distance) * 100);

      // 3. Determine clock-in or clock-out
      const action = await determineAttendanceAction(matchedUser.id);

      // 4. Record attendance in Supabase
      const attendanceRecord = await recordAttendance(
        matchedUser.id,
        action,
        photoData,
        confidence,
        '',
        'face'
      );

      // 5. Show result
      setAttendanceResult({
        success: true,
        user: matchedUser,
        confidence,
        action,
        attendance: attendanceRecord,
        photoData
      });
      message.success(`${action === 'clock_in' ? 'Clocked in' : 'Clocked out'} successfully!`);

      speak(`Hello ${matchedUser.full_name.split(' ')[0]}, ${action === 'clock_in' ? 'clocked in' : 'clocked out'}`);

      await Promise.all([loadStats(), load()]);

      if (autoScan) {
        setTimeout(() => setAttendanceResult(null), 3500);
      }

    } catch (error: any) {
      console.error('Attendance error:', error);
      setAttendanceResult({
        success: false,
        error: error.message || 'Attendance processing failed',
        photoData
      });
      message.error(error.message || 'Attendance failed');

      if (autoScan) {
        const isFaceError = error.message?.includes('No face detected') || error.message?.includes('Face not detected');
        setTimeout(() => setAttendanceResult(null), isFaceError ? 2000 : 5000);
      }
    } finally {
      setProcessing(false);
      setFaceStatus('scanning');
    }
  }, [
    processing,
    autoScan,
    determineAttendanceAction,
    recordAttendance,
    loadStats,
    load,
    setFaceStatus,
    setProcessing
  ]);

  // Handle QR Detection — local-first lookup, fallback to Supabase
  const handleQRDetected = useCallback(async (qrData: string) => {
    if (processing) return;

    console.log('🔍 QR Detected:', qrData);
    if (!deviceInfo?.organization_id) {
      console.error('❌ Device info or Org ID missing');
      return;
    }

    setProcessing(true);
    try {
      // 1. Try local cache first (fast, works offline)
      let user: any = offlineStorageService.findByIdOrQr(qrData);

      // 2. Fallback to Supabase if not in local cache
      if (!user) {
        console.log('📡 QR not in local cache, querying Supabase...');
        const { data: remoteUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('organization_id', deviceInfo.organization_id)
          .eq('is_active', true)
          .or(`qr_code.eq."${qrData}",staff_id.eq."${qrData}"`)
          .maybeSingle();

        if (error) throw error;
        user = remoteUser;
      }

      if (!user) {
        throw new Error(`User not recognized for QR value: ${qrData}`);
      }

      console.log('✅ QR matched:', user.full_name);

      const action = await determineAttendanceAction(user.id);
      const attendanceRecord = await recordAttendance(
        user.id,
        action,
        'qr_scan',
        100,
        '',
        'qr'
      );

      setAttendanceResult({
        success: true,
        user,
        confidence: 100,
        action,
        attendance: attendanceRecord
      });
      message.success(`QR ${action} successful!`);
      speak(`Hello ${user.full_name.split(' ')[0]}, ${action === 'clock_in' ? 'clocked in' : 'clocked out'}`);

      await Promise.all([loadStats(), load()]);

    } catch (error: any) {
      console.error('QR Attendance error:', error);
      message.error(error.message || 'QR Verification failed');
    } finally {
      setProcessing(false);
    }
  }, [
    processing,
    deviceInfo?.organization_id,
    determineAttendanceAction,
    recordAttendance,
    loadStats,
    load
  ]);

  const handleCameraComplete = useCallback(({ photoData }: any) => {
    if (photoData?.base64) {
      handleFaceCapture(photoData.base64);
    }
  }, [handleFaceCapture]);

  // Handle manual attendance — local-first lookup, fallback to Supabase
  const handleManualAttendance = useCallback(async () => {
    if (!manualId.trim()) {
      message.error('Please enter a staff/student ID');
      return;
    }

    setManualLoading(true);
    try {
      // 1. Try local cache first
      let user: any = offlineStorageService.findByIdOrQr(manualId.trim());

      // 2. Fallback to Supabase
      if (!user) {
        console.log('📡 ID not in local cache, querying Supabase...');
        let query = supabase
          .from('users')
          .select('*')
          .eq('organization_id', deviceInfo?.organization_id)
          .eq('is_active', true)
          .or(`staff_id.eq."${manualId}",email.eq."${manualId}",qr_code.eq."${manualId}"`);

        if (deviceInfo?.branch_id) {
          query = query.eq('branch_id', deviceInfo.branch_id);
        }

        const { data: remoteUser, error } = await query.single();
        if (error || !remoteUser) {
          throw new Error('User not found. Please check the ID and try again.');
        }
        user = remoteUser;
      }

      const action = await determineAttendanceAction(user.id);
      const attendanceRecord = await recordAttendance(
        user.id,
        action,
        'manual_entry',
        100,
        '',
        'manual'
      );

      setAttendanceResult({
        success: true,
        user,
        confidence: 100,
        action,
        attendance: attendanceRecord
      });

      await Promise.all([loadStats(), load()]);

      message.success(`Manual ${action} recorded for ${user.full_name}`);
      speak(`Hello ${user.full_name.split(' ')[0]}, ${action === 'clock_in' ? 'clocked in' : 'clocked out'}`);
      setManualId('');

    } catch (error: any) {
      console.error('Manual attendance error:', error);
      message.error(error.message || 'Failed to record manual attendance');
    } finally {
      setManualLoading(false);
    }
  }, [
    manualId,
    deviceInfo?.organization_id,
    deviceInfo?.branch_id,
    determineAttendanceAction,
    recordAttendance,
    loadStats,
    load
  ]);

  // Handle screen pairing

  // Helper functions

  const formatTime = (time: string) => {
    return dayjs(time).format('HH:mm:ss');
  };


  // Add a function to use the scanInterval
  const setupAutoScan = useCallback(() => {
    if (autoScan && !scanInterval) {
      const interval = setInterval(() => {
        // Auto scan logic here
        console.log('Auto scanning...');
      }, 1500); // Scan every 1.5s for real-time feel (was 3000ms)
      setScanInterval(interval);
    } else if (!autoScan && scanInterval) {
      clearInterval(scanInterval);
      setScanInterval(null);
    }
  }, [autoScan, scanInterval]);

  // Initialize on mount
  useEffect(() => {
    initializeAttendance();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds

    // Setup auto scan
    setupAutoScan();

    return () => {
      clearInterval(interval);
      if (scanInterval) clearInterval(scanInterval);
    };
  }, [initializeAttendance, checkConnection, scanInterval, setupAutoScan]);

  // Real-time attendance subscription
  useEffect(() => {
    if (!deviceInfo?.organization_id) return;

    console.log('📡 Setting up real-time attendance listener for org:', deviceInfo.organization_id);

    const attendanceChannel = supabase.channel('attendance-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `organization_id=eq.${deviceInfo.organization_id}`
        },
        (payload) => {
          console.log('🔔 Real-time attendance update received:', payload);
          // Refresh data to keep stats and list in sync
          loadStats();
          load();
        }
      )
      .subscribe((status) => {
        console.log('🔌 Attendance subscription status:', status);
      });

    return () => {
      console.log('🔌 Removing real-time attendance listener');
      supabase.removeChannel(attendanceChannel);
    };
  }, [deviceInfo?.organization_id, loadStats, load]);

  // Real-time face enrollment subscription
  useEffect(() => {
    if (!deviceInfo?.organization_id) return;

    console.log('📡 Setting up real-time face enrollment listener for org:', deviceInfo.organization_id);

    const enrollmentChannel = supabase.channel('enrollment-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'face_enrollments',
          filter: `organization_id=eq.${deviceInfo.organization_id}`
        },
        (payload) => {
          console.log('👤 Real-time face enrollment update received:', payload);
          // Refresh user count and potentially reload enrollment data if needed
          loadUserCount();
        }
      )
      .subscribe((status) => {
        console.log('🔌 Enrollment subscription status:', status);
      });

    return () => {
      console.log('🔌 Removing real-time face enrollment listener');
      supabase.removeChannel(enrollmentChannel);
    };
  }, [deviceInfo?.organization_id, loadUserCount]);

  // Real-time face match logs subscription
  useEffect(() => {
    if (!deviceInfo?.organization_id) return;

    console.log('📡 Setting up real-time face match listener for org:', deviceInfo.organization_id);

    const logChannel = supabase.channel('face-match-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'face_match_logs',
          filter: `organization_id=eq.${deviceInfo.organization_id}`
        },
        (payload) => {
          console.log('🖼️ Real-time face match log received:', payload);
          // You could trigger notifications here if needed
        }
      )
      .subscribe((status) => {
        console.log('🔌 Face match log subscription status:', status);
      });

    return () => {
      console.log('🔌 Removing real-time face match listener');
      supabase.removeChannel(logChannel);
    };
  }, [deviceInfo?.organization_id]);

  // Real-time shifts subscription
  useEffect(() => {
    if (!deviceInfo?.organization_id) return;

    console.log('📡 Setting up real-time shifts listener for org:', deviceInfo.organization_id);

    const shiftChannel = supabase.channel('shift-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `organization_id=eq.${deviceInfo.organization_id}`
        },
        (payload) => {
          console.log('🕒 Real-time shift update received:', payload);
          // Refresh statistics as shift times affect late/early detection
          loadStats();
        }
      )
      .subscribe((status) => {
        console.log('🔌 Shift subscription status:', status);
      });

    return () => {
      console.log('🔌 Removing real-time shifts listener');
      supabase.removeChannel(shiftChannel);
    };
  }, [deviceInfo?.organization_id, loadStats]);

  if (!deviceInfo) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" style={{ marginBottom: 24, color: '#00f3ff' }} />
          <Title level={3} style={{ color: 'white', marginBottom: 16 }}>
            INITIALIZING_SYSTEM
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
            CONNECTING TO NEURAL NETWORK
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="intergalactic-theme" style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: 'white',
      padding: 0,
      margin: 0,
      overflow: 'hidden'
    }}>
      {/* Main Container */}
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>

        {/* Top Bar - Only visible during scanning */}
        {!processing && !attendanceResult && (
          <div style={{
            padding: '12px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 100,
            borderBottom: '1px solid rgba(0, 243, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            {/* Left - Back Button and Org Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button
                type="text"
                icon={<ArrowLeft size={20} color="white" />}
                onClick={() => navigate('/')}
                className="hologram-btn"
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              />

              <div style={{ maxWidth: 200 }}>
                <Text style={{
                  color: '#00f3ff',
                  fontSize: 14,
                  fontWeight: 'bold',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {deviceInfo.organization?.name || "RELIANT SYSTEM"}
                </Text>
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: 10,
                  display: 'block',
                  textTransform: 'uppercase'
                }}>
                  {deviceInfo.branch?.name || "MAIN TERMINAL"}
                </Text>
              </div>
            </div>

            {/* Center - Stats Hub */}
            <div style={{
              display: 'flex',
              gap: 12
            }}>
              <div style={{
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(10, 255, 96, 0.1)',
                border: '1px solid #0aff60',
                textAlign: 'center',
                minWidth: 80
              }}>
                <Text style={{ color: '#0aff60', fontSize: 18, fontWeight: 'bold', display: 'block', lineHeight: 1.2 }}>
                  {stats.present_today}
                </Text>
                <Text style={{ color: 'rgba(10, 255, 96, 0.6)', fontSize: 9 }}>ONLINE</Text>
              </div>

              <div style={{
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(0, 243, 255, 0.1)',
                border: '1px solid #00f3ff',
                textAlign: 'center',
                minWidth: 80
              }}>
                <Text style={{ color: '#00f3ff', fontSize: 18, fontWeight: 'bold', display: 'block', lineHeight: 1.2 }}>
                  {stats.total_users}
                </Text>
                <Text style={{ color: 'rgba(0, 243, 255, 0.6)', fontSize: 9 }}>TOTAL</Text>
              </div>
            </div>

            {/* Right - Verification Modes */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Button
                type={verificationMethod === 'face' ? 'primary' : 'text'}
                icon={<Scan size={16} />}
                onClick={() => setVerificationMethod('face')}
                style={{
                  height: 32,
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: verificationMethod === 'face' ? 'white' : 'rgba(255,255,255,0.6)'
                }}
              >
                FACE
              </Button>
              <Button
                type={verificationMethod === 'qr' ? 'primary' : 'text'}
                icon={<QrCode size={16} />}
                onClick={() => setVerificationMethod('qr')}
                style={{
                  height: 32,
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: verificationMethod === 'qr' ? 'white' : 'rgba(255,255,255,0.6)'
                }}
              >
                QR
              </Button>
              <Button
                type={verificationMethod === 'manual' ? 'primary' : 'text'}
                icon={<User size={16} />}
                onClick={() => setVerificationMethod('manual')}
                style={{
                  height: 32,
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: verificationMethod === 'manual' ? 'white' : 'rgba(255,255,255,0.6)'
                }}
              >
                ID
              </Button>
            </div>
          </div>
        )}

        {/* Main View Area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}>

          {/* Camera View */}
          {!attendanceResult && !processing && (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <div className="hud-container" style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }}>
                <FaceCamera
                  mode="attendance"
                  scanningMode={verificationMethod === 'qr' ? 'qr' : 'face'}
                  onAttendanceComplete={handleCameraComplete}
                  onQRCodeDetected={handleQRDetected}
                  autoCapture={autoScan && verificationMethod === 'face'}
                  captureInterval={1800}
                  loading={processing}
                  status={faceStatus}
                  deviceInfo={deviceInfo}
                  organizationName={deviceInfo.organization?.name}
                />

                {/* HUD Elements */}
                <div className="hud-corner corner-tl" />
                <div className="hud-corner corner-tr" />
                <div className="hud-corner corner-bl" />
                <div className="hud-corner corner-br" />
                {autoScan && verificationMethod === 'face' && <div className="laser-scanner" />}

                {/* Status HUD Text */}
                <div className="hud-status">
                  <div>TERMINAL_ID: {deviceInfo.device_code}</div>
                  <div>SECURE_LINK: ESTABLISHED</div>
                  <div>BIO_SCAN: {autoScan ? 'ACTIVE' : 'READY'}</div>
                  <div style={{ color: verificationMethod === 'face' ? '#00f3ff' : '#ffac33' }}>
                    METHOD: {verificationMethod.toUpperCase()}
                  </div>
                </div>

                {/* Overlay Controls */}
                {!autoScan && verificationMethod === 'face' && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 50
                  }}>
                    <Button
                      type="primary"
                      shape="circle"
                      icon={<Play size={40} fill="white" />}
                      onClick={() => setAutoScan(true)}
                      className="hologram-btn"
                      style={{
                        height: 120,
                        width: 120,
                        boxShadow: '0 0 30px rgba(0, 243, 255, 0.3)',
                        border: '2px solid #00f3ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    />
                    <Text style={{ color: '#00f3ff', marginTop: 24, fontSize: 16, fontWeight: 'bold', letterSpacing: '4px' }}>
                      START_SCANNER
                    </Text>
                  </div>
                )}

                {/* Bottom Center Stop Button */}
                {autoScan && verificationMethod === 'face' && (
                  <div style={{
                    position: 'absolute',
                    bottom: 40,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100
                  }}>
                    <Button
                      type="primary"
                      danger
                      icon={<StopCircle size={20} />}
                      onClick={() => setAutoScan(false)}
                      className="hologram-btn"
                      style={{
                        height: 50,
                        padding: '0 32px',
                        borderRadius: '25px',
                        backgroundColor: 'rgba(255, 77, 79, 0.2)',
                        borderColor: '#ff4d4f',
                        color: '#ff4d4f',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        letterSpacing: '2px'
                      }}
                    >
                      STOP_SCANNER
                    </Button>
                  </div>
                )}

                {/* ID Input overlay for Manual mode */}
                {verificationMethod === 'manual' && (
                  <div style={{
                    position: 'absolute',
                    bottom: 40,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '90%',
                    maxWidth: 400,
                    zIndex: 100
                  }}>
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.7)',
                      backdropFilter: 'blur(10px)',
                      padding: '24px',
                      borderRadius: '16px',
                      border: '1px solid #00f3ff',
                      boxShadow: '0 8px 32px rgba(0, 243, 255, 0.2)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <User size={20} color="#00f3ff" />
                        <Text strong style={{ color: '#00f3ff', fontSize: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Manual Identity Check
                        </Text>
                      </div>
                      <Input
                        placeholder="ENTER STAFF / STUDENT ID..."
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        onPressEnter={handleManualAttendance}
                        className="hologram-btn"
                        style={{
                          height: 50,
                          backgroundColor: 'rgba(0, 243, 255, 0.05)',
                          color: 'white',
                          borderRadius: '8px',
                          border: '1px solid rgba(0, 243, 255, 0.3)',
                          fontSize: '16px',
                          letterSpacing: '2px',
                          marginBottom: 16
                        }}
                      />
                      <Button
                        type="primary"
                        block
                        onClick={handleManualAttendance}
                        style={{ height: 50, borderRadius: '8px', fontWeight: 'bold', letterSpacing: '2px' }}
                      >
                        VERIFY_IDENTITY
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing / Results Full Screen View */}
          {(processing || attendanceResult) && (
            <div style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              padding: '24px'
            }}>
              {processing && !attendanceResult ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 180,
                    height: 180,
                    position: 'relative',
                    margin: '0 auto 48px'
                  }}>
                    <Spin size="large" style={{ color: '#00f3ff', fontSize: 40 }} />
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}>
                      <Camera size={50} color="#00f3ff" strokeWidth={1} />
                    </div>
                  </div>
                  <Title level={1} style={{ color: '#00f3ff', margin: '0 0 16px 0', fontWeight: 900, letterSpacing: '4px' }}>
                    ANALYZING_BIO
                  </Title>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '18px', letterSpacing: '2px' }}>
                    MATCHING BIOMETRIC HASH...
                  </Text>
                </div>
              ) : attendanceResult?.success ? (
                <div style={{ textAlign: 'center', maxWidth: 500 }}>
                  <div style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(10, 255, 96, 0.1)',
                    border: '3px solid #0aff60',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 40px',
                    boxShadow: '0 0 40px rgba(10, 255, 96, 0.3)'
                  }}>
                    <CheckCircle size={60} color="#0aff60" strokeWidth={1.5} />
                  </div>
                  <Title level={1} style={{ color: 'white', margin: '0 0 8px 0', fontWeight: 900, letterSpacing: '4px' }}>
                    ACCESS_GRANTED
                  </Title>
                  <div style={{ marginBottom: 40 }}>
                    <Text style={{ color: '#0aff60', fontSize: '20px', letterSpacing: '2px' }}>VERIFICATION SUCCESSFUL</Text>
                  </div>

                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '32px',
                    borderRadius: 24,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'left',
                    marginBottom: 40,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '4px',
                      height: '100%',
                      background: '#0aff60'
                    }} />

                    <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '1px' }}>Biometric Profile</div>

                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                      {attendanceResult.photoData && (
                        <div style={{
                          width: 80,
                          height: 80,
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.2)'
                        }}>
                          <Image
                            src={attendanceResult.photoData}
                            preview={false}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', marginBottom: 8, letterSpacing: '1px' }}>
                          {attendanceResult.user?.full_name}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <Tag color="black" style={{ borderRadius: 4, fontWeight: 'bold', border: '1px solid #0aff60', color: '#0aff60' }}>
                            {attendanceResult.user?.staff_id || "ID: UNKNOWN"}
                          </Tag>
                          <Tag style={{ borderRadius: 4, fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>
                            {attendanceResult.action === 'clock_in' ? 'CLOCK_IN' : 'CLOCK_OUT'}
                          </Tag>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '14px', fontWeight: 500, letterSpacing: '2px' }}>
                    SYSTEM AUTO-RESET IN 3 SECONDS
                  </div>

                  {!autoScan && (
                    <Button
                      type="primary"
                      onClick={() => setAttendanceResult(null)}
                      className="hologram-btn"
                      style={{ marginTop: 24, height: 50, padding: '0 48px', borderRadius: 8 }}
                    >
                      RETURN_TO_DASHBOARD
                    </Button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', maxWidth: 500 }}>
                  <div style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 77, 79, 0.1)',
                    border: '3px solid #ff4d4f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 40px',
                    boxShadow: '0 0 40px rgba(255, 77, 79, 0.3)'
                  }}>
                    <XCircle size={60} color="#ff4d4f" strokeWidth={1.5} />
                  </div>
                  <Title level={1} style={{ color: 'white', margin: '0 0 16px 0', fontWeight: 900, letterSpacing: '4px' }}>
                    DENIED_IDENTITY
                  </Title>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '18px', display: 'block', marginBottom: 48, letterSpacing: '1px' }}>
                    {attendanceResult?.error || "Neural-match failed to identify subject"}
                  </Text>
                  <Space size="large">
                    <Button
                      type="primary"
                      onClick={() => setAttendanceResult(null)}
                      className="hologram-btn"
                      style={{
                        height: 60,
                        padding: '0 40px',
                        fontSize: '16px',
                        borderRadius: 12,
                        background: '#fff',
                        color: '#000'
                      }}
                    >
                      RE-TRY SCAN
                    </Button>
                    <Button
                      onClick={() => navigate('/')}
                      style={{
                        height: 60,
                        padding: '0 40px',
                        fontSize: '16px',
                        borderRadius: 12,
                        background: 'transparent',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        color: 'white'
                      }}
                    >
                      EXIT_SYSTEM
                    </Button>
                  </Space>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
