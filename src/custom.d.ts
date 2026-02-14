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

declare module 'jsqr' {
  export interface QRCodeAttributes {
    binaryData: number[];
    data: string;
    chunks: any[];
    version: number;
    location: {
      topLeftCorner: { x: number; y: number };
      topRightCorner: { x: number; y: number };
      bottomRightCorner: { x: number; y: number };
      bottomLeftCorner: { x: number; y: number };
    };
  }

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }
  ): QRCodeAttributes | null;
}