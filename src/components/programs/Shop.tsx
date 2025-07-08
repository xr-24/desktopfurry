import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  setActiveTab, 
  loadShopStart, 
  loadShopSuccess, 
  loadShopFailure,
  purchaseStart,
  purchaseSuccess,
  purchaseFailure,
  clearShopError,
  ShopItem
} from '../../store/shopSlice';
import { earnMoney } from '../../store/inventorySlice';
import ProgramWindow from '../ProgramWindow';
import { authService } from '../../services/authService';
import '../../styles/shop.css';

interface ShopProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: any;
  controllerId: string;
  currentPlayerId: string;
}

const Shop: React.FC<ShopProps> = ({
  windowId, position, size, zIndex, isMinimized,
  programState, controllerId, currentPlayerId
}) => {
  const dispatch = useAppDispatch();
  const { items, userMoney, activeTab, isLoading, error, isPurchasing } = useAppSelector((state: any) => state.shop);
  
  // Only allow current player to interact (local-only program)
  const canInteract = controllerId === currentPlayerId;

  // Load shop data on mount
  useEffect(() => {
    if (canInteract) {
      loadShopData();
    }
  }, [canInteract]);

  const loadShopData = async () => {
    dispatch(loadShopStart());
    try {
      const response = await fetch('/api/shop/items', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load shop data');
      }
      
      const data = await response.json();
      dispatch(loadShopSuccess({
        items: data.items,
        userMoney: data.userMoney
      }));
    } catch (error: any) {
      dispatch(loadShopFailure(error.message || 'Failed to load shop'));
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (!canInteract || isPurchasing || item.is_purchased || userMoney < item.price) {
      return;
    }

    dispatch(purchaseStart());
    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`
        },
        body: JSON.stringify({ itemId: item.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Purchase failed');
      }
      
      const data = await response.json();
      dispatch(purchaseSuccess({
        itemId: item.id,
        newBalance: data.newBalance,
        purchasedItem: data.purchasedItem
      }));

      // Update inventory money as well
      dispatch(earnMoney(0)); // This will sync with the shop money
      
    } catch (error: any) {
      dispatch(purchaseFailure(error.message || 'Purchase failed'));
    }
  };

  const handleTabChange = (tab: 'cosmetics' | 'themes' | 'backgrounds' | 'games' | 'misc') => {
    if (canInteract) {
      dispatch(setActiveTab(tab));
    }
  };

  const renderShopItem = (item: ShopItem) => {
    const canAfford = userMoney >= item.price;
    const isPurchased = item.is_purchased;
    
    return (
      <div
        key={item.id}
        className={`shop-item ${isPurchased ? 'purchased' : ''} ${!canAfford ? 'unaffordable' : ''}`}
        onClick={() => !isPurchased && canAfford && handlePurchase(item)}
      >
        <div className="shop-item-image">
          {item.asset_path ? (
            <img 
              src={item.asset_path}
              alt={item.name}
              className="item-preview"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="item-placeholder">
              {getItemIcon(item.item_type)}
            </div>
          )}
        </div>
        <div className="shop-item-details">
          <div className="shop-item-name">{item.name}</div>
          <div className="shop-item-description">{item.description}</div>
          <div className="shop-item-footer">
            <div className="shop-item-price">💰 {item.price.toLocaleString()}</div>
            <div className="shop-item-status">
              {isPurchased ? (
                <span className="status-purchased">✓ Owned</span>
              ) : canAfford ? (
                <span className="status-buyable">Click to buy</span>
              ) : (
                <span className="status-expensive">Too expensive</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'item': return '✨';
      case 'theme': return '🎨';
      case 'background': return '🖼️';
      case 'program': return '📦';
      default: return '📋';
    }
  };

  const getTabEmoji = (tab: string) => {
    switch (tab) {
      case 'cosmetics': return '✨';
      case 'themes': return '🎨';
      case 'backgrounds': return '🖼️';
      case 'games': return '🎮';
      case 'misc': return '📋';
      default: return '📋';
    }
  };

  const renderTabContent = () => {
    const currentItems = items[activeTab] || [];
    
    if (currentItems.length === 0) {
      return (
        <div className="empty-tab">
          <div className="empty-icon">{getTabEmoji(activeTab)}</div>
          <div className="empty-message">
            No {activeTab} available yet.
            <br />
            <small>Check back later for new items!</small>
          </div>
        </div>
      );
    }

    return (
      <div className="shop-items-grid">
        {currentItems.map(renderShopItem)}
      </div>
    );
  };

  if (isMinimized) return null;

  return (
    <ProgramWindow
      windowId={windowId}
      title="🛒 Shop"
      icon="🛒"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      <div className="shop-container">
        
        {/* Header with money display */}
        <div className="shop-header">
          <div className="money-display">
            <span className="money-icon">💰</span>
            <span className="money-amount">{userMoney.toLocaleString()}</span>
          </div>
          {error && (
            <div className="shop-error">
              {error}
              <button onClick={() => dispatch(clearShopError())} className="error-close">×</button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="shop-tabs">
          {(['cosmetics', 'themes', 'backgrounds', 'games', 'misc'] as const).map((tab) => (
            <button
              key={tab}
              className={`shop-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => handleTabChange(tab)}
              disabled={!canInteract}
            >
              {getTabEmoji(tab)} {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="shop-content">
          {isLoading ? (
            <div className="shop-loading">
              <div className="loading-spinner">⏳</div>
              <div>Loading shop...</div>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>

        {/* Purchase indicator */}
        {isPurchasing && (
          <div className="purchase-overlay">
            <div className="purchase-indicator">
              <div className="purchase-spinner">⏳</div>
              <div>Processing purchase...</div>
            </div>
          </div>
        )}
      </div>
    </ProgramWindow>
  );
};

export default Shop; 