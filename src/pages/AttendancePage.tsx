// pages/AttendancePage.tsx - Complete Multi-tenant Attendance System
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Row,
  Col,
  Button,
  Space,
  Tag,
  Modal,
  Spin,
  Result,
  message,
  Input,
  Switch,
  Image
} from 'antd';
import {
  Camera,
  QrCode,
  User,
  Scan,
  ArrowLeft
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
      setShowResultModal(true);
      message.success(`${action === 'clock_in' ? 'Clocked in' : 'Clocked out'} successfully!`);

      speak(`Hello ${matchedUser.full_name.split(' ')[0]}, ${action === 'clock_in' ? 'clocked in' : 'clocked out'}`);

      await Promise.all([loadStats(), load()]);

      if (autoScan) {
        setTimeout(() => setShowResultModal(false), 1500);
      }

    } catch (error: any) {
      console.error('Attendance error:', error);
      setAttendanceResult({
        success: false,
        error: error.message || 'Attendance processing failed',
        photoData
      });
      setShowResultModal(true);
      message.error(error.message || 'Attendance failed');

      if (autoScan) {
        const isFaceError = error.message?.includes('No face detected') || error.message?.includes('Face not detected');
        setTimeout(() => setShowResultModal(false), isFaceError ? 1500 : 4000);
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
    load
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
      setShowResultModal(true);
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
      setShowResultModal(true);

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="intergalactic-theme" style={{ minHeight: '100vh', background: 'transparent' }}>


      <div style={{ padding: 0, height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
        <Row style={{ height: '100%', width: '100%' }}>
          {/* Main Camera Column - True Full Screen */}
          <Col span={24} style={{ height: '100%' }}>
            <div style={{
              height: '100%',
              backgroundColor: '#000',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <FaceCamera
                mode="attendance"
                scanningMode={verificationMethod === 'qr' ? 'qr' : 'face'}
                onAttendanceComplete={handleCameraComplete}
                onQRCodeDetected={handleQRDetected}
                autoCapture={autoScan && verificationMethod === 'face'}
                captureInterval={1500}
                loading={processing}
                status={faceStatus}
                deviceInfo={deviceInfo}
                organizationName={deviceInfo.organization?.name}
              />

              {/* Floating Back Button */}
              <div style={{
                position: 'absolute',
                top: 24,
                left: 24,
                zIndex: 30
              }}>
                <Button
                  type="text"
                  icon={<ArrowLeft size={24} color="white" />}
                  onClick={() => navigate('/')}
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(10px)',
                    height: 50,
                    width: 50,
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
              </div>

              {!autoScan && !processing && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  zIndex: 10
                }}>
                  <Button
                    type="primary"
                    shape="circle"
                    onClick={() => setAutoScan(true)}
                    icon={<Camera size={48} />}
                    style={{
                      height: 120,
                      width: 120,
                      boxShadow: '0 0 50px rgba(82, 196, 26, 0.6)',
                      background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                      border: 'none',
                    }}
                  />
                </div>
              )}

              {/* Minimal Overlays */}
              <div style={{
                position: 'absolute',
                top: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(15px)',
                padding: '4px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}>
                <Button
                  type={verificationMethod === 'face' ? 'primary' : 'text'}
                  icon={<Scan size={18} />}
                  onClick={() => setVerificationMethod('face')}
                  style={{
                    color: verificationMethod === 'face' ? 'white' : 'rgba(255,255,255,0.6)',
                    borderRadius: '8px',
                    height: '40px',
                    padding: '0 20px'
                  }}
                >
                  FACE
                </Button>
                <Button
                  type={verificationMethod === 'qr' ? 'primary' : 'text'}
                  icon={<QrCode size={18} />}
                  onClick={() => setVerificationMethod('qr')}
                  style={{
                    color: verificationMethod === 'qr' ? 'white' : 'rgba(255,255,255,0.6)',
                    borderRadius: '8px',
                    height: '40px',
                    padding: '0 20px'
                  }}
                >
                  QR
                </Button>
                <Button
                  type={verificationMethod === 'manual' ? 'primary' : 'text'}
                  icon={<User size={18} />}
                  onClick={() => setVerificationMethod('manual')}
                  style={{
                    color: verificationMethod === 'manual' ? 'white' : 'rgba(255,255,255,0.6)',
                    borderRadius: '8px',
                    height: '40px',
                    padding: '0 20px'
                  }}
                >
                  ID
                </Button>
              </div>

              {/* Bottom Overlays */}
              <div style={{
                position: 'absolute',
                bottom: 24,
                left: 24,
                zIndex: 20,
                display: 'flex',
                gap: 16,
                alignItems: 'center'
              }}>
                {(verificationMethod === 'manual' || true) && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    padding: '4px 12px',
                    borderRadius: 20,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <User size={14} color="rgba(255,255,255,0.6)" style={{ marginRight: 8 }} />
                    <Input
                      placeholder="ENTER ID..."
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      style={{
                        width: 100,
                        background: 'transparent',
                        color: 'white',
                        border: 'none',
                        fontSize: '12px',
                        letterSpacing: '1px'
                      }}
                      onPressEnter={handleManualAttendance}
                    />
                  </div>
                )}

                {verificationMethod === 'face' && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    padding: '8px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white'
                  }}>
                    <Switch
                      checked={autoScan}
                      onChange={setAutoScan}
                      size="small"
                    />
                    <span style={{ marginLeft: 8, fontSize: 12 }}>AUTO</span>
                  </div>
                )}
              </div>


            </div>
          </Col>
        </Row>
      </div>

      {/* Attendance Result Modal */}
      <Modal
        title={attendanceResult?.success ? "Attendance Recorded" : "Attendance Failed"}
        open={showResultModal}
        onCancel={() => setShowResultModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowResultModal(false)}>
            Close
          </Button>,
          attendanceResult?.success && (
            <Button
              key="another"
              type="primary"
              onClick={() => setShowResultModal(false)}
            >
              Scan Another
            </Button>
          )
        ]}
        width={600}
      >
        {attendanceResult?.success ? (
          <Result
            status="success"
            title={attendanceResult.user?.full_name}
            subTitle={formatTime(new Date().toISOString())}
            extra={[
              <Space key="details" direction="vertical" style={{ width: '100%', alignItems: 'center' }}>
                <Tag color={attendanceResult.action === 'clock_in' ? 'green' : 'blue'} style={{ fontSize: 16, padding: '4px 16px' }}>
                  {attendanceResult.action === 'clock_in' ? 'CLOCK IN' : 'CLOCK OUT'}
                </Tag>
                {attendanceResult.photoData && (
                  <div style={{ marginTop: 16 }}>
                    <Image
                      src={attendanceResult.photoData}
                      alt="Capture"
                      width={180}
                      height={180}
                      style={{ borderRadius: 12, border: '2px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                )}
              </Space>
            ]}
          />
        ) : (
          <Result
            status="error"
            title="Recognition Failed"
            subTitle={attendanceResult?.error || "Face not recognized"}
            extra={[
              <Button
                key="manual"
                type="primary"
                onClick={() => {
                  setShowResultModal(false);
                }}
              >
                Try Manual
              </Button>
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;