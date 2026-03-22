import React from 'react';
import './Avatar.css';

interface AvatarProps {
  src: string;
  size?: number;
  alt?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, size = 32, alt = 'Avatar' }) => {
  return (
    <div 
      className="avatar pixel-art"
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        fontSize: `${size * 0.6}px`
      }}
    >
      {src}
    </div>
  );
};

export default Avatar;
