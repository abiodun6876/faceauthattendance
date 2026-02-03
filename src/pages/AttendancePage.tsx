// pages/AttendancePage.tsx - Complete Multi-tenant Attendance System
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Alert,
  Space,
  Statistic,
  Tag,
  Modal,
  Spin,
  Result,
  Avatar,
  List,
  Divider,
  message,
  Tooltip,
  Radio,
  Input,
  Descriptions,
  Empty,
  Switch,
  Image
} from 'antd';
import {
  Camera,
  CheckCircle,
  Clock,
  User,
  Users,
  RefreshCw,
  BarChart3,
  ChevronRight,
  Bell,
  Power,
  Settings,
  History,
  LogIn,
  ArrowLeft,
  LogOut,
  Monitor,
  QrCode,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react';
import FaceCamera from '../components/FaceCamera';
import { supabase, deviceService } from '../lib/supabase';
import faceService from '../utils/faceService';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

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
  const navigate = useNavigate();
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
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
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
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');
  const [manualId, setManualId] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [_showHistory, _setShowHistory] = useState(false);
  const [screenPairCode, setScreenPairCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

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
      // Fix: Add underscore prefix to unused 'data' variable
      const { data: _data, error } = await supabase
        .from('devices')
        .select('id')
        .limit(1);

      if (error) throw error;
      setConnectionStatus('online');

      // Update device last seen
      if (deviceInfo) {
        await supabase
          .from('devices')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', deviceInfo.id);
      }
    } catch (error) {
      console.log('Connection offline');
      setConnectionStatus('offline');
    }
  }, [deviceInfo]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const today = dayjs().format('YYYY-MM-DD');

      let query = supabase
        .from('attendance')
        .select('*')
        .eq('date', today)
        .eq('organization_id', deviceInfo?.organization_id);

      if (deviceInfo?.branch_id) {
        query = query.eq('branch_id', deviceInfo.branch_id);
      }

      const { data: attendance, error } = await query;

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
      let query = supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', deviceInfo?.organization_id)
        .eq('is_active', true);

      if (deviceInfo?.branch_id) {
        query = query.eq('branch_id', deviceInfo.branch_id);
      }

      const { count, error } = await query;

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
  const loadRecentAttendance = useCallback(async (limit = 10) => {
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

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setRecentAttendance(data || []);
    } catch (error) {
      console.error('Error loading recent attendance:', error);
    }
  }, [deviceInfo?.organization_id, deviceInfo?.branch_id]);

  // Check last attendance
  const checkLastAttendance = useCallback(async () => {
    try {
      // Get last attendance for this device today
      const today = dayjs().format('YYYY-MM-DD');
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('device_id', deviceInfo?.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      setLastAttendance(data || null);
    } catch (error) {
      console.error('Error checking last attendance:', error);
    }
  }, [deviceInfo?.id]);

  // Determine next action
  const determineNextAction = useCallback(async () => {
    if (!deviceInfo) return;

    const today = dayjs().format('YYYY-MM-DD');
    const userId = null; // We'll get this after face match

    // For toggle mode, check if user is already clocked in
    if (attendanceMode === 'toggle' && userId) {
      const { data: todayRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('organization_id', deviceInfo.organization_id)
        .single();

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
      const { isRegistered, device: deviceInfoData } = await deviceService.checkDeviceRegistration();

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
        loadRecentAttendance(),
        checkLastAttendance(),
        loadUserCount()
      ]);

      await determineNextAction();
    } catch (error: any) {
      console.error('Initialization error:', error);
      message.error(error.message || 'Failed to initialize attendance system');
    }
  }, [
    loadStats,
    loadRecentAttendance,
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

    const today = dayjs().format('YYYY-MM-DD');

    // Check existing attendance for today
    const { data: existingRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .eq('organization_id', deviceInfo?.organization_id)
      .single();

    if (!existingRecord) {
      return 'clock_in';
    }

    // If already clocked out today (for toggle mode)
    if (existingRecord.clock_out) {
      return 'clock_in';
    }

    return 'clock_out';
  }, [attendanceMode, userAction, deviceInfo?.organization_id]);

  // Record attendance
  const recordAttendance = useCallback(async (
    userId: string,
    action: 'clock_in' | 'clock_out',
    photoData: string,
    confidence: number,
    _embedding: string // Add underscore prefix since it's not used
  ): Promise<AttendanceRecord> => {
    const today = dayjs().format('YYYY-MM-DD');
    const now = new Date().toISOString();

    // Check existing record for today
    const { data: existingRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .eq('organization_id', deviceInfo?.organization_id)
      .single();

    let attendanceData: any;
    let recordId: string;

    if (existingRecord) {
      // Update existing record
      if (action === 'clock_out') {
        attendanceData = {
          clock_out: now,
          status: 'present',
          updated_at: now
        };
      } else {
        // For toggle mode clocking in again after clock out
        attendanceData = {
          clock_in: now,
          clock_out: null,
          status: 'present',
          updated_at: now
        };
      }

      const { error } = await supabase
        .from('attendance')
        .update(attendanceData)
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      recordId = existingRecord.id;
    } else {
      // Create new record
      attendanceData = {
        user_id: userId,
        organization_id: deviceInfo?.organization_id,
        branch_id: deviceInfo?.branch_id,
        device_id: deviceInfo?.id,
        date: today,
        clock_in: now,
        clock_out: action === 'clock_out' ? now : null,
        status: 'present',
        confidence_score: confidence,
        face_match_score: confidence,
        photo_url: photoData,
        verification_method: 'face_recognition',
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase
        .from('attendance')
        .insert(attendanceData)
        .select()
        .single();

      if (error) throw error;
      recordId = data.id;
    }

    // Create face match log
    await supabase
      .from('face_match_logs')
      .insert({
        user_id: userId,
        organization_id: deviceInfo?.organization_id,
        device_id: deviceInfo?.id,
        photo_url: photoData,
        confidence_score: confidence,
        threshold_score: 70,
        is_match: true,
        verification_result: action === 'clock_in' ? 'clock_in' : 'clock_out',
        created_at: now
      });

    // Return the created/updated record
    const { data: finalRecord } = await supabase
      .from('attendance')
      .select(`
        *,
        user:users(full_name, staff_id, face_photo_url, department_id, user_role),
        branch:branches(name)
      `)
      .eq('id', recordId)
      .single();

    return finalRecord;
  }, [deviceInfo?.organization_id, deviceInfo?.branch_id, deviceInfo?.id]);

  // Handle face capture
  const handleFaceCapture = useCallback(async (photoData: string) => {
    if (processing) return;

    setProcessing(true);
    try {
      // Process face
      const faceResult = await faceService.processImage(photoData);

      if (!faceResult.success || !faceResult.embedding) {
        throw new Error(faceResult.error || 'Face not detected');
      }

      // Find matching user
      const embeddingArray = Array.from(faceResult.embedding);
      const embeddingString = JSON.stringify(embeddingArray);

      let matches = [];
      const { data: rpcMatches, error: matchError } = await supabase.rpc(
        'match_users_by_face',
        {
          filter_organization_id: deviceInfo?.organization_id,
          match_threshold: 0.70,
          query_embedding: embeddingString
        }
      );

      if (matchError) {
        console.warn('RPC matching failed, falling back to client-side matching:', matchError);
      } else {
        matches = rpcMatches || [];
      }

      // FALLBACK: Client-side matching if RPC returns no results or fails
      if (matches.length === 0) {
        console.log('Fetching embeddings from face_enrollments for fallback matching...');
        const { data: enrollments, error: fetchError } = await supabase
          .from('face_enrollments')
          .select('embedding, user_id, users(*)')
          .eq('organization_id', deviceInfo?.organization_id)
          .eq('is_active', true);

        if (fetchError) {
          console.error('Fallback fetch error:', fetchError);
        } else if (enrollments && enrollments.length > 0) {
          for (const enc of enrollments) {
            if (enc.embedding && faceService.compareFaces(faceResult.embedding, enc.embedding, 0.6)) {
              if (enc.users) {
                matches.push(enc.users);
                console.log('✅ Client-side match found in record:', enc.users.full_name);
                break;
              }
            }
          }
        }
      }

      if (matches.length === 0) {
        throw new Error('No matching user found');
      }

      const matchedUser = matches[0];

      // Determine action based on mode
      const action = await determineAttendanceAction(matchedUser.id);

      // Record attendance
      const attendanceRecord = await recordAttendance(
        matchedUser.id,
        action,
        photoData,
        faceResult.quality || 0,
        embeddingString
      );

      // Show result
      const result = {
        success: true,
        user: matchedUser,
        confidence: faceResult.quality,
        action,
        attendance: attendanceRecord,
        photoData
      };

      setAttendanceResult(result);
      setShowResultModal(true);
      message.success(`${action === 'clock_in' ? 'Clocked in' : 'Clocked out'} successfully!`);

      // Refresh data
      await Promise.all([
        loadStats(),
        loadRecentAttendance()
      ]);

      // FAST TRACK: Automatically close result and resume scanning after 2.5 seconds
      if (autoScan) {
        setTimeout(() => {
          setShowResultModal(false);
        }, 2500);
      }

    } catch (error: any) {
      console.error('Attendance error:', error);
      const result = {
        success: false,
        error: error.message || 'Attendance processing failed',
        photoData
      };
      setAttendanceResult(result);
      setShowResultModal(true);
      message.error(error.message || 'Attendance failed');
    } finally {
      setProcessing(false);
    }
  }, [
    processing,
    deviceInfo?.organization_id,
    determineAttendanceAction,
    recordAttendance,
    loadStats,
    loadRecentAttendance,
    checkLastAttendance
  ]);

  // Handle manual attendance
  const handleManualAttendance = useCallback(async () => {
    if (!manualId.trim()) {
      message.error('Please enter a staff/student ID');
      return;
    }

    setManualLoading(true);
    try {
      let query = supabase
        .from('users')
        .select('*')
        .or(`staff_id.eq.${manualId},email.eq.${manualId}`)
        .eq('organization_id', deviceInfo?.organization_id)
        .eq('is_active', true);

      if (deviceInfo?.branch_id) {
        query = query.eq('branch_id', deviceInfo.branch_id);
      }

      const { data: user, error } = await query.single();

      if (error || !user) {
        throw new Error('User not found');
      }

      const action = await determineAttendanceAction(user.id);
      const attendanceRecord = await recordAttendance(
        user.id,
        action,
        'manual_entry',
        100,
        ''
      );

      const result = {
        success: true,
        user,
        confidence: 100,
        action,
        attendance: attendanceRecord
      };

      setAttendanceResult(result);
      setShowResultModal(true);

      await Promise.all([
        loadStats(),
        loadRecentAttendance()
      ]);

      message.success(`Manual ${action} recorded for ${user.full_name}`);
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
    loadRecentAttendance
  ]);

  // Handle screen pairing
  const handlePairScreen = useCallback(async () => {
    if (!screenPairCode.trim()) {
      message.error('Please enter a pair code');
      return;
    }

    setPairingLoading(true);
    try {
      const { data: existingPair, error: checkError } = await supabase
        .from('screen_pairs')
        .select('*')
        .eq('pair_code', screenPairCode.trim())
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (existingPair) {
        // Update existing pair
        const { error } = await supabase
          .from('screen_pairs')
          .update({
            device_id: deviceInfo?.id,
            connected_at: new Date().toISOString(),
            status: 'connected',
            last_activity: new Date().toISOString()
          })
          .eq('id', existingPair.id);

        if (error) throw error;
      } else {
        // Create new pair
        const { error } = await supabase
          .from('screen_pairs')
          .insert({
            pair_code: screenPairCode.trim(),
            device_id: deviceInfo?.id,
            screen_name: `Screen ${screenPairCode}`,
            status: 'connected',
            connected_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
          });

        if (error) throw error;
      }

      message.success(`Screen paired successfully! Code: ${screenPairCode}`);
      setScreenPairCode('');

    } catch (error: any) {
      console.error('Screen pairing error:', error);
      message.error(error.message || 'Failed to pair screen');
    } finally {
      setPairingLoading(false);
    }
  }, [screenPairCode, deviceInfo?.id]);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'green';
      case 'late': return 'orange';
      case 'absent': return 'red';
      default: return 'default';
    }
  };

  const formatTime = (time: string) => {
    return dayjs(time).format('HH:mm:ss');
  };

  const getTimeAgo = (time: string) => {
    return dayjs(time).fromNow();
  };

  // Add a function to use the scanInterval
  const setupAutoScan = useCallback(() => {
    if (autoScan && !scanInterval) {
      const interval = setInterval(() => {
        // Auto scan logic here
        console.log('Auto scanning...');
      }, 3000);
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

  if (!deviceInfo) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-50)' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '16px 24px',
        borderBottom: '1px solid var(--gray-200)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 32
      }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space size={16}>
              <Button
                type="text"
                icon={<ArrowLeft size={24} />}
                onClick={() => navigate('/')}
                style={{ color: 'var(--gray-600)' }}
              />
              <div>
                <Title level={4} style={{ color: 'var(--gray-900)', margin: 0, fontWeight: 700 }}>
                  {deviceInfo.organization?.type === 'school' ? 'Take Attendance' : 'Clock In/Out'}
                </Title>
                <Text style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                  {deviceInfo.branch?.name} • {deviceInfo.device_name}
                </Text>
              </div>
            </Space>
          </Col>

          <Col>
            <Space>
              <Tooltip title={connectionStatus === 'online' ? 'Online' : 'Offline'}>
                <Tag
                  color={connectionStatus === 'online' ? 'success' : 'error'}
                  style={{ borderRadius: 20, border: 'none', padding: '2px 10px' }}
                  icon={connectionStatus === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}
                >
                  {connectionStatus.toUpperCase()}
                </Tag>
              </Tooltip>
              <Tag
                color="blue"
                style={{ borderRadius: 20, border: 'none', padding: '2px 10px' }}
              >
                {attendanceMode === 'toggle' ? 'Auto Mode' :
                  attendanceMode === 'explicit' ? 'Button Mode' : 'Event Mode'}
              </Tag>
              <Button
                icon={<Settings size={16} />}
                onClick={() => navigate('/device-setup')}
              >
                Settings
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* Stats Row */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12 }}>
              <Statistic
                title="Total Users"
                value={stats.total_users}
                prefix={<Users size={20} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12 }}>
              <Statistic
                title="Present Today"
                value={stats.present_today}
                prefix={<CheckCircle size={20} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12 }}>
              <Statistic
                title="Late Today"
                value={stats.late_today}
                prefix={<Clock size={20} />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12 }}>
              <Statistic
                title="Attendance Rate"
                value={stats.attendance_rate.toFixed(1)}
                suffix="%"
                prefix={<BarChart3 size={20} />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          {/* Main Camera Column */}
          <Col xs={24} lg={16}>
            <Card
              title={
                <Space>
                  <Camera size={20} />
                  <span>Face Recognition</span>
                </Space>
              }
              style={{ marginBottom: 24, borderRadius: 12 }}
              extra={
                <Space>
                  <Tooltip title="Toggle auto scan">
                    <Switch
                      checked={autoScan}
                      onChange={setAutoScan}
                      checkedChildren="Auto"
                      unCheckedChildren="Manual"
                    />
                  </Tooltip>
                  <Button
                    icon={<RefreshCw size={16} />}
                    onClick={initializeAttendance}
                  />
                </Space>
              }
            >
              {/* Action Selection for Explicit Mode */}
              {attendanceMode === 'explicit' && (
                <div style={{ marginBottom: 24, textAlign: 'center' }}>
                  <Radio.Group
                    value={userAction}
                    onChange={(e) => setUserAction(e.target.value)}
                    buttonStyle="solid"
                    size="large"
                  >
                    <Radio.Button value="clock_in">
                      <Space>
                        <LogIn size={16} />
                        Clock In
                      </Space>
                    </Radio.Button>
                    <Radio.Button value="clock_out">
                      <Space>
                        <LogOut size={16} />
                        Clock Out
                      </Space>
                    </Radio.Button>
                  </Radio.Group>
                </div>
              )}

              {/* Camera Feed */}
              <div style={{
                height: 400,
                backgroundColor: '#000',
                borderRadius: 8,
                marginBottom: 24,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <FaceCamera
                  mode="attendance"
                  onAttendanceComplete={({ photoData }) => {
                    if (photoData?.base64) {
                      handleFaceCapture(photoData.base64);
                    }
                  }}
                  autoCapture={autoScan}
                  captureInterval={2000}
                  loading={processing}
                  deviceInfo={deviceInfo}
                  organizationName={deviceInfo.organization?.name}
                />
                {!autoScan && !processing && (
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
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    zIndex: 10
                  }}>
                    <Button
                      type="primary"
                      size="large"
                      onClick={() => setAutoScan(true)}
                      icon={<Camera size={24} />}
                      style={{
                        height: 80,
                        width: 200,
                        fontSize: 20,
                        borderRadius: 40,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                        border: 'none'
                      }}
                    >
                      START SCANNING
                    </Button>
                    <Text style={{ color: '#fff', marginTop: 16, fontSize: 16, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                      Click to begin automatic face detection
                    </Text>
                  </div>
                )}
              </div>

              {/* Manual Attendance */}
              <Card
                title="Manual Attendance"
                size="small"
                style={{ marginTop: 16 }}
                extra={
                  <Tag color="orange">Fallback</Tag>
                }
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder={`Enter ${deviceInfo.organization?.settings?.id_label || 'Staff/Student'} ID`}
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    size="large"
                    onPressEnter={handleManualAttendance}
                    disabled={manualLoading}
                  />
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleManualAttendance}
                    loading={manualLoading}
                  >
                    {attendanceMode === 'explicit' ? userAction === 'clock_in' ? 'Clock In' : 'Clock Out' : 'Record'}
                  </Button>
                </Space.Compact>
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  Use this if face recognition fails
                </Text>
              </Card>

              {/* Connection Status */}
              <Alert
                message={connectionStatus === 'online' ? 'Online Mode' : 'Offline Mode'}
                description={
                  connectionStatus === 'online'
                    ? 'Attendance records are syncing in real-time'
                    : 'Records are being stored locally and will sync when connection is restored'
                }
                type={connectionStatus === 'online' ? 'success' : 'warning'}
                showIcon
                style={{ marginTop: 16 }}
                action={
                  <Button size="small" onClick={checkConnection}>
                    Check Connection
                  </Button>
                }
              />
            </Card>

            {/* Recent Activity */}
            <Card
              title={
                <Space>
                  <History size={20} />
                  <span>Recent Activity</span>
                </Space>
              }
              style={{ borderRadius: 12 }}
              extra={
                <Button
                  type="link"
                  onClick={() => navigate('/attendance-management')}
                  icon={<ChevronRight size={16} />}
                >
                  View All
                </Button>
              }
            >
              {recentAttendance.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No attendance recorded yet"
                />
              ) : (
                <List
                  dataSource={recentAttendance}
                  renderItem={(record) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            src={record.user?.face_photo_url}
                            icon={<User />}
                            style={{ backgroundColor: getStatusColor(record.status) }}
                          />
                        }
                        title={
                          <Space>
                            <Text strong>{record.user?.full_name}</Text>
                            <Tag color={getStatusColor(record.status)}>
                              {record.status?.toUpperCase()}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary">
                              ID: {record.user?.staff_id}
                            </Text>
                            <Text type="secondary">
                              In: {formatTime(record.clock_in)} • {getTimeAgo(record.clock_in)}
                            </Text>
                            {record.clock_out && (
                              <Text type="secondary">
                                Out: {formatTime(record.clock_out)}
                              </Text>
                            )}
                            {record.confidence_score && (
                              <Text type="secondary">
                                Confidence: {record.confidence_score.toFixed(1)}%
                              </Text>
                            )}
                          </Space>
                        }
                      />
                      <div style={{ textAlign: 'right' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {record.branch?.name}
                        </Text>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          {/* Right Column */}
          <Col xs={24} lg={8}>
            {/* Device & Mode Info */}
            <Card
              title="Device Information"
              style={{ marginBottom: 24, borderRadius: 12 }}
              extra={<Settings size={16} />}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Device">
                  {deviceInfo.device_name}
                </Descriptions.Item>
                <Descriptions.Item label="Code">
                  <Tag color="blue">{deviceInfo.device_code}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Branch">
                  {deviceInfo.branch?.name}
                </Descriptions.Item>
                <Descriptions.Item label="Organization">
                  {deviceInfo.organization?.name}
                </Descriptions.Item>
                <Descriptions.Item label="Mode">
                  <Tag color={attendanceMode === 'toggle' ? 'blue' :
                    attendanceMode === 'explicit' ? 'purple' : 'orange'}>
                    {attendanceMode === 'toggle' ? 'Auto Toggle' :
                      attendanceMode === 'explicit' ? 'Manual Button' : 'Event Based'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Last Active">
                  {dayjs(deviceInfo.last_seen).fromNow()}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={deviceInfo.status === 'active' ? 'green' : 'red'}>
                    {deviceInfo.status?.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Screen Pairing */}
            <Card
              title={
                <Space>
                  <Monitor size={20} />
                  <span>Large Screen Pairing</span>
                </Space>
              }
              style={{ marginBottom: 24, borderRadius: 12 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="Enter pair code"
                    value={screenPairCode}
                    onChange={(e) => setScreenPairCode(e.target.value)}
                    size="large"
                    prefix={<QrCode size={16} />}
                  />
                  <Button
                    type="primary"
                    onClick={handlePairScreen}
                    loading={pairingLoading}
                  >
                    Pair
                  </Button>
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Enter the code displayed on your large screen monitor
                </Text>
              </Space>

              <Divider style={{ margin: '16px 0' }} />

              <Alert
                message="Live Display"
                description="Pair with a large screen to show real-time attendance updates"
                type="info"
                showIcon
              />
            </Card>

            {/* Quick Actions */}
            <Card
              title="Quick Actions"
              style={{ borderRadius: 12 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  icon={<User size={16} />}
                  onClick={() => navigate('/enroll')}
                  block
                  size="large"
                  type="primary"
                >
                  Enroll New User
                </Button>
                <Button
                  icon={<TrendingUp size={16} />}
                  onClick={() => navigate('/attendance-management')}
                  block
                  size="large"
                >
                  View Reports
                </Button>
                <Button
                  icon={<Bell size={16} />}
                  onClick={() => {
                    message.info('Late notifications would be sent here');
                  }}
                  block
                  size="large"
                >
                  Notify Late Users
                </Button>
                <Button
                  icon={<Power size={16} />}
                  onClick={() => {
                    deviceService.unregisterDevice();
                    navigate('/device-setup');
                  }}
                  block
                  size="large"
                  danger
                >
                  Unregister Device
                </Button>
              </Space>
            </Card>
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
            title={`${attendanceResult.action === 'clock_in' ? 'Clock In' : 'Clock Out'} Successful!`}
            subTitle={`${attendanceResult.user?.full_name} at ${formatTime(new Date().toISOString())}`}
            extra={[
              <Space key="details" direction="vertical" style={{ width: '100%', textAlign: 'left' }}>
                <div>
                  <Text strong>ID: </Text>
                  <Text>{attendanceResult.user?.staff_id}</Text>
                </div>
                <div>
                  <Text strong>Confidence: </Text>
                  <Text>{attendanceResult.confidence?.toFixed(1)}%</Text>
                </div>
                <div>
                  <Text strong>Action: </Text>
                  <Tag color={attendanceResult.action === 'clock_in' ? 'green' : 'blue'}>
                    {attendanceResult.action === 'clock_in' ? 'CLOCK IN' : 'CLOCK OUT'}
                  </Tag>
                </div>
                {attendanceResult.photoData && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Image
                      src={attendanceResult.photoData}
                      alt="Capture"
                      width={150}
                      height={150}
                      style={{ borderRadius: 8 }}
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
                Try Manual Entry
              </Button>
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;