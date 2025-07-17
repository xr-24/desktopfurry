import React from 'react';
import { useAppSelector } from '../store/hooks';

interface NotificationBadgeProps {
  type: 'messages' | 'friendRequests';
  className?: string;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ type, className = '' }) => {
  const { unreadMessages, unreadFriendRequests } = useAppSelector((state) => state.social);
  
  const count = type === 'messages' ? unreadMessages : unreadFriendRequests;
  
  if (count === 0) return null;
  
  return (
    <div className={`notification-badge ${className}`}>
      {count > 99 ? '99+' : count}
    </div>
  );
};

export default NotificationBadge; 