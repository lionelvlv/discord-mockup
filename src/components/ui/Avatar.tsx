import React, { useState } from 'react';
import './Avatar.css';

interface AvatarProps {
  src: string;
  size?: number;
  alt?: string;
}

// Renders either a real image (http URL) or an emoji/text avatar.
const Avatar: React.FC<AvatarProps> = ({ src, size = 32, alt = 'Avatar' }) => {
  const [imgError, setImgError] = useState(false);
  const isUrl = src?.startsWith('http');

  const style: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${size * 0.6}px`,
  };

  if (isUrl && !imgError) {
    return (
      <div className="avatar avatar-img" style={style}>
        <img
          src={src}
          alt={alt}
          className="avatar-image"
          onError={() => setImgError(true)}
          draggable={false}
        />
      </div>
    );
  }

  // Emoji / text fallback
  return (
    <div className="avatar pixel-art" style={style}>
      {imgError ? '👤' : src}
    </div>
  );
};

export default Avatar;
