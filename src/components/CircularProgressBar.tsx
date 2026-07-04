import React from 'react';

interface CircularProgressBarProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  color?: string;
}

export const CircularProgressBar: React.FC<CircularProgressBarProps> = ({
  progress,
  size = 60,
  strokeWidth = 7, // Thicker default for cozy feel
  showText = true,
  color = 'var(--accent-blue)',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div 
      style={{ 
        position: 'relative', 
        width: size, 
        height: size, 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <svg className="progress-ring" width={size} height={size}>
        {/* Track circle */}
        <circle
          stroke="var(--border-color)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{ opacity: 0.7 }}
        />
        {/* Progress circle */}
        <circle
          className="progress-ring__circle"
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ 
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.5s ease-out'
          }}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {showText && (
        <span 
          style={{ 
            position: 'absolute', 
            fontSize: `${size * 0.26}px`, 
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            transition: 'color 0.3s ease'
          }}
        >
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
};
