import React from 'react';
import { useAppSelector } from '../store/hooks';

const MoneyDisplay: React.FC = () => {
  const { money } = useAppSelector((state: any) => state.inventory);

  const formatMoney = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  };

  return (
    <div className="money-display-taskbar">
      <div className="money-icon">💰</div>
      <div className="money-value">{formatMoney(money)}</div>
    </div>
  );
};

export default MoneyDisplay; 