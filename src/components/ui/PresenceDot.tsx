import React from 'react';
import { PresenceStatus } from '../../types/user';
import './PresenceDot.css';

interface PresenceDotProps {
  status: PresenceStatus;
}

const PresenceDot: React.FC<PresenceDotProps> = ({ status }) => {
  return <span className={`status-dot ${status}`}></span>;
};

export default PresenceDot;
