import React from 'react';
import { useAppSelector } from '../store/hooks';

const CRTEffect: React.FC = () => {
  const showRetro = useAppSelector((state: any) => state.ui?.showRetro ?? false);

  if (!showRetro) return null;

  return (
    <div className="crt-overlay">
      <div className="crt-scanlines" />
      <div className="crt-vignette" />
    </div>
  );
};

export default CRTEffect; 