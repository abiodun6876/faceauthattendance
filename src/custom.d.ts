// src/custom.d.ts
declare module 'react-webcam' {
  import React from 'react';
  
  export interface WebcamProps {
    audio?: boolean;
    audioConstraints?: MediaStreamConstraints['audio'];
    videoConstraints?: MediaStreamConstraints['video'];
    screenshotFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
    width?: number;
    height?: number;
    screenshotQuality?: number;
    minScreenshotWidth?: number;
    minScreenshotHeight?: number;
    onUserMedia?: (stream: MediaStream) => void;
    onUserMediaError?: (error: string | DOMException) => void;
    style?: React.CSSProperties;
    mirrored?: boolean;
  }

  const Webcam: React.ForwardRefExoticComponent<
    WebcamProps & React.RefAttributes<HTMLVideoElement>
  >;
  
  export default Webcam;
}