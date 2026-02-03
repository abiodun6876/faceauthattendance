
import React from 'react';

interface AppIconProps {
  size?: number;
  className?: string;
  showLabel?: boolean;
}

const AppIcon: React.FC<AppIconProps> = ({ 
  size = 512, 
  className = '',
  showLabel = false 
}) => {
  return (
    <div 
      className={`flex flex-col items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <div 
        className="relative rounded-2xl flex items-center justify-center overflow-hidden"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        {/* Face circle */}
        <div 
          className="absolute rounded-full bg-white/90"
          style={{
            width: size * 0.3,
            height: size * 0.3,
            top: '25%',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        />
        
        {/* Eyes */}
        <div 
          className="absolute rounded-full bg-gray-800"
          style={{
            width: size * 0.05,
            height: size * 0.05,
            top: '28%',
            left: '40%'
          }}
        />
        <div 
          className="absolute rounded-full bg-gray-800"
          style={{
            width: size * 0.05,
            height: size * 0.05,
            top: '28%',
            left: '55%'
          }}
        />
        
        {/* Smile */}
        <div 
          className="absolute bg-gray-800"
          style={{
            width: size * 0.15,
            height: size * 0.02,
            borderRadius: '1px',
            top: '40%',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        />
        
        {/* Scanning waves */}
        <div 
          className="absolute border-2 border-white/50 border-dashed rounded-full"
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderWidth: '2px'
          }}
        />
      </div>
      
      {showLabel && (
        <div className="mt-2 text-sm font-medium text-gray-600">
          FaceAuth
        </div>
      )}
    </div>
  );
};

export default AppIcon;
