// components/FaceCamera.tsx - Multi-tenant Version
import React, { useRef, useState, useEffect, useCallback } from 'react'; // Added useCallback
import Webcam from 'react-webcam';
import { Button, message, Typography, Alert } from 'antd';
import { Camera, AlertCircle } from 'lucide-react';

import jsQR from 'jsqr';

const { Text } = Typography;

interface FaceCameraProps {
  mode: 'enrollment' | 'attendance';
  scanningMode?: 'face' | 'qr';
  onEnrollmentComplete?: (photoData: string) => void;
  onAttendanceComplete?: (result: {
    success: boolean;
    photoData?: { base64: string };
    user?: any;
    confidence?: number;
  }) => void;
  onQRCodeDetected?: (data: string) => void;
  autoCapture?: boolean;
  captureInterval?: number;
  loading?: boolean;
  deviceInfo?: any;
  organizationName?: string;
  status?: 'idle' | 'scanning' | 'processing' | 'boosting'; // Parent can override status
}

const FaceCamera: React.FC<FaceCameraProps> = ({
  mode,
  scanningMode = 'face',
  onEnrollmentComplete,
  onAttendanceComplete,
  onQRCodeDetected,
  autoCapture = false,
  captureInterval = 1500,
  loading = false,
  deviceInfo,
  organizationName,
  status
}) => {
  const webcamRef = useRef<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [internalScanStatus, setInternalScanStatus] = useState<'idle' | 'scanning' | 'processing' | 'boosting'>('idle');

  // Use prop status if provided, otherwise internal status
  const currentStatus = status || internalScanStatus;

  // Memoize setScanStatus to avoid unnecessary hook re-renders
  const setScanStatus = useCallback((s: typeof internalScanStatus) => {
    setInternalScanStatus(s);
  }, []);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false); // Prevents overlapping captures

  useEffect(() => {
    const checkCameraPermissions = async () => {
      try {
        console.log('Checking camera permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        console.log('Camera access granted');

        // Stop the stream immediately
        stream.getTracks().forEach(track => track.stop());

        setCameraError('');
        setCameraReady(true);
      } catch (error: any) {
        console.error('Camera permission error:', error);
        setCameraError('Camera access denied. Please allow camera permissions in your browser settings.');
        setIsCameraActive(false);
      }
    };

    checkCameraPermissions();
  }, []);

  const capturePhoto = useCallback(() => {
    console.log('Attempting to capture photo...');

    if (!webcamRef.current || !cameraReady) {
      console.error('Webcam not ready');
      message.error('Camera not ready');
      return null;
    }

    try {
      const imageSrc = webcamRef.current.getScreenshot({
        width: 1280,
        height: 720
      });

      console.log('Photo captured successfully');

      if (!imageSrc) {
        console.error('getScreenshot returned null/undefined');
        message.error('Failed to capture photo');
        return null;
      }

      return imageSrc;
    } catch (error) {
      console.error('Error capturing photo:', error);
      message.error('Camera error occurred');
      return null;
    }
  }, [webcamRef, cameraReady]);

  const handleCapture = useCallback(() => {
    // Skip if already processing a previous capture
    if (isProcessingRef.current) {
      console.log('⏳ Skipping capture — previous scan still in progress');
      return;
    }

    isProcessingRef.current = true;
    setScanStatus('processing');
    console.log('Capture button clicked');
    const photoData = capturePhoto();

    if (!photoData) {
      message.error('Failed to capture photo');
      isProcessingRef.current = false;
      setScanStatus('idle');
      return;
    }

    console.log('Photo captured successfully, calling callback...');

    if (mode === 'enrollment' && onEnrollmentComplete) {
      onEnrollmentComplete(photoData);
      isProcessingRef.current = false;
      setScanStatus('idle');
    } else if (mode === 'attendance' && onAttendanceComplete) {
      // For attendance mode, we'll handle face matching elsewhere
      onAttendanceComplete({
        success: true,
        photoData: { base64: photoData }
      });
      // Reset after a short delay to allow the parent to process
      setTimeout(() => {
        isProcessingRef.current = false;
        setScanStatus('idle');
      }, 800);
    } else {
      isProcessingRef.current = false;
      setScanStatus('idle');
    }
  }, [capturePhoto, mode, onEnrollmentComplete, onAttendanceComplete, setScanStatus]);

  useEffect(() => {
    if (autoCapture && isCameraActive && cameraReady && mode === 'attendance' && scanningMode === 'face') {
      setScanStatus('scanning');
      intervalRef.current = setInterval(() => {
        handleCapture();
      }, captureInterval);
    } else {
      setScanStatus('idle');
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoCapture, isCameraActive, mode, captureInterval, cameraReady, handleCapture, scanningMode, setScanStatus]);

  // QR Code Scanning Logic
  useEffect(() => {
    if (scanningMode !== 'qr' || !cameraReady || !isCameraActive) return;

    let requestRef: number;

    const scanQRCode = () => {
      if (!webcamRef.current || !webcamRef.current.video) {
        requestRef = requestAnimationFrame(scanQRCode);
        return;
      }

      const video = webcamRef.current.video;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && onQRCodeDetected) {
            console.log('📷 QR Scanned by Camera:', code.data);
            onQRCodeDetected(code.data);
            // Throttle detection to avoid multiple triggers
            setTimeout(() => {
              requestRef = requestAnimationFrame(scanQRCode);
            }, 2000);
            return;
          }
        }
      }
      requestRef = requestAnimationFrame(scanQRCode);
    };

    requestRef = requestAnimationFrame(scanQRCode);
    return () => cancelAnimationFrame(requestRef);
  }, [scanningMode, cameraReady, isCameraActive, onQRCodeDetected]);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user" as const,
    deviceId: localStorage.getItem('preferred_camera_id') || undefined
  };

  if (cameraError) {
    return (
      <div className="hud-container" style={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="hud-corner corner-tl"></div>
        <div className="hud-corner corner-tr"></div>
        <div className="hud-corner corner-bl"></div>
        <div className="hud-corner corner-br"></div>
        <AlertCircle size={48} className="hud-error" style={{ marginBottom: 16 }} />
        <div className="hud-error" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: 24 }}>ACCESS_DENIED</div>
        <div className="hud-status" style={{ top: '20px', right: '20px' }}>ERROR_CODE: 0x403</div>
        <Button
          className="hologram-btn"
          onClick={() => {
            setCameraError('');
            setIsCameraActive(true);
            window.location.reload();
          }}
        >
          RETRY_CONNECTION
        </Button>
      </div>
    );
  }

  return (
    <div className="hud-container" style={{ minHeight: '450px' }}>
      <div className="hud-corner corner-tl"></div>
      <div className="hud-corner corner-tr"></div>
      <div className="hud-corner corner-bl"></div>
      <div className="hud-corner corner-br"></div>

      <div className="laser-scanner"></div>

      <div className="hud-status">
        STATUS: {currentStatus.toUpperCase() === 'IDLE' ? 'SYSTEM_READY' : currentStatus.toUpperCase() === 'SCANNING' ? 'MONITORING' : currentStatus.toUpperCase() === 'PROCESSING' ? 'ANALYZING...' : 'BOOSTPASS_ACTIVE'}<br />
        RESOLUTION: 1280x720<br />
        ORG: {organizationName || 'CORE_SYSTEM'}<br />
        MODE: {mode.toUpperCase()}<br />
        SCAN_TYPE: {scanningMode.toUpperCase()}<br />
        {currentStatus === 'processing' && (
          <span style={{ color: '#0aff60' }}>BIO_METRIC_MATCH: PENDING...</span>
        )}
      </div>

      {isCameraActive ? (
        <>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
            onUserMedia={() => {
              console.log('Webcam stream started');
              setCameraReady(true);
            }}
            onUserMediaError={(error) => {
              console.error('Webcam error:', error);
              setCameraError('Failed to start camera. Please check your camera connection.');
              setIsCameraActive(false);
            }}
            mirrored={true}
          />

          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              textAlign: 'center'
            }}>
              <div style={{
                width: 100,
                height: 100,
                border: '4px solid transparent',
                borderTopColor: 'var(--neon-blue)',
                borderRightColor: '#bc13fe',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{
                marginTop: 20,
                color: 'var(--neon-blue)',
                fontFamily: 'monospace',
                letterSpacing: '3px',
                fontSize: '12px',
                textShadow: '0 0 10px rgba(0, 243, 255, 0.5)'
              }}>
                PROCESSING_DATA
              </div>
            </div>
          )}

          {/* Central Target Frame */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: scanningMode === 'qr' ? '250px' : '300px',
            height: scanningMode === 'qr' ? '250px' : '400px',
            border: `1px solid ${currentStatus === 'processing' ? 'rgba(10, 255, 96, 0.6)' : 'rgba(0, 243, 255, 0.3)'}`,
            borderRadius: scanningMode === 'qr' ? '12px' : '40px',
            boxShadow: currentStatus === 'processing'
              ? 'inset 0 0 50px rgba(10, 255, 96, 0.1), 0 0 30px rgba(10, 255, 96, 0.2)'
              : 'inset 0 0 50px rgba(0, 243, 255, 0.05), 0 0 20px rgba(0, 243, 255, 0.1)',
            transition: 'all 0.5s ease',
            pointerEvents: 'none',
            zIndex: 5
          }}>
            {/* Corner Indicators for Frame */}
            <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '3px solid var(--neon-blue)', borderLeft: '3px solid var(--neon-blue)', borderRadius: '10px 0 0 0' }} />
            <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '3px solid var(--neon-blue)', borderRight: '3px solid var(--neon-blue)', borderRadius: '0 10px 0 0' }} />
            <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '3px solid var(--neon-blue)', borderLeft: '3px solid var(--neon-blue)', borderRadius: '0 0 0 10px' }} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '3px solid var(--neon-blue)', borderRight: '3px solid var(--neon-blue)', borderRadius: '0 0 10px 0' }} />
          </div>

          {!autoCapture && !loading && (
            <div style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 10
            }}>
              <Button
                className="hologram-btn"
                onClick={handleCapture}
                disabled={!cameraReady}
                size="large"
                style={{ height: 'auto', padding: '12px 40px' }}
              >
                {mode === 'enrollment' ? 'START_BIO_CAPTURE' : 'INITIATE_SCAN'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div style={{
          height: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16
        }}>
          <Camera size={48} color="rgba(0, 242, 255, 0.3)" />
          <div className="hud-status" style={{ position: 'static', textAlign: 'center' }}>CAMERA_OFFLINE</div>
          <Button
            className="hologram-btn"
            onClick={() => setIsCameraActive(true)}
          >
            RESTORE_LINK
          </Button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FaceCamera;