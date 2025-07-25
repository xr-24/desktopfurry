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
  ShopItem,
  updateUserMoney
} from '../../store/shopSlice';
import { earnMoney, spendMoney, setInventoryData } from '../../store/inventorySlice';
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
  const inventoryMoney = useAppSelector((state:any)=> state.inventory.money);
  
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
      const data = await authService.loadShopItems();
      if (data) {
        // Remove placeholder categories/items per requirement
        const filteredItems = { ...data.items };

        // Helper to filter out placeholder items – keep those with a valid asset_path
        const filterPlaceholders = (arr: ShopItem[] = []) => arr.filter(i => !!i.asset_path);
        filteredItems.games = filterPlaceholders(filteredItems.games);
        // Don't filter themes by asset_path since they use CSS files instead
        // filteredItems.themes = filterPlaceholders(filteredItems.themes);
        
        // Filter out free backgrounds from shop (they're available by default)
        const FREE_BACKGROUND_IDS = [
          'sandstone', 'waves', 'circles', 'blocks', 'bubbles', 'clouds', 
          'paradise', 'metal links', 'palm tree', 'purple sponge', 'red tile', 
          'pink flower', 'sunset'
        ];
        filteredItems.backgrounds = (filteredItems.backgrounds || []).filter((bg: ShopItem) => {
          const bgId = bg.metadata?.background_id?.toLowerCase();
          return bgId && !FREE_BACKGROUND_IDS.includes(bgId);
        });

        // Always trust server-reported balance as the source of truth.
        dispatch(loadShopSuccess({
          items: filteredItems,
          userMoney: data.userMoney
        }));

        // Synchronise inventory slice to match server balance exactly.
        const diff = data.userMoney - inventoryMoney;
        if (diff > 0) {
          dispatch(earnMoney(diff));
        } else if (diff < 0) {
          dispatch(spendMoney(-diff));
        }
      } else {
        dispatch(loadShopFailure('Failed to load shop data'));
      }
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
      const data = await authService.purchaseItem(item.id);
      dispatch(purchaseSuccess({
        itemId: item.id,
        newBalance: data.newBalance,
        purchasedItem: data.purchasedItem
      }));

      // Update inventory money as well – adjust by difference
      const diff = data.newBalance - inventoryMoney;
      if (diff > 0) dispatch(earnMoney(diff));
      else if (diff < 0) dispatch(spendMoney(-diff));

      // Also ensure shop slice userMoney is updated (safety)
      dispatch(updateUserMoney(data.newBalance));

      // Reload inventory to include new items
      const inv = await authService.loadInventory();
      if (inv) {
        dispatch(setInventoryData(inv));
      }
      
    } catch (error: any) {
      dispatch(purchaseFailure(error.message || 'Purchase failed'));
    }
  };

  const handleTabChange = (tab: 'cosmetics' | 'themes' | 'backgrounds' | 'games' | 'titles' | 'misc') => {
    if (canInteract) {
      dispatch(setActiveTab(tab));
    }
  };

  // Helper: return emoji icon for non-image items
  function getItemIcon(itemType: string) {
    switch (itemType) {
      case 'item': return '✨';
      case 'theme': return '🎨';
      case 'background': return '🖼️';
      case 'program': return '📦';
      default: return '📋';
    }
  }
 
  // Utility: darken hex color by factor (0 - 1)
  const darkenColor = (hex:string, factor:number = 0.5) => {
    let h = hex.replace('#','');
    if (h.length === 3) h = h.split('').map(c=>c+c).join('');
    const r = Math.max(0,Math.min(255, Math.round(parseInt(h.substr(0,2),16)*factor)));
    const g = Math.max(0,Math.min(255, Math.round(parseInt(h.substr(2,2),16)*factor)));
    const b = Math.max(0,Math.min(255, Math.round(parseInt(h.substr(4,2),16)*factor)));
    return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  };
 
  const renderShopItem = (item: ShopItem) => {
    const canAfford = userMoney >= item.price;
    const isPurchased = item.is_purchased;

    // Helper to build title preview style
    const buildTitleStyle = (metadata: any = {}) => {
      const cfg = metadata.style_config || {};
      const style: React.CSSProperties = {
        fontWeight: cfg.fontWeight || 'bold',
      };

      if (cfg.rainbow) {
        // Let per-letter spans set their own colours; just add composite glow
        style.textShadow = '0 0 4px rgba(0,0,0,0.4)';
      } else if (cfg.color) {
        style.color = cfg.color;
        style.textShadow = `0 0 4px ${darkenColor(cfg.color, 0.4)}`;
      } else if (cfg.gradient) {
        const stopsArr = Array.isArray(cfg.gradient) ? cfg.gradient : cfg.gradient.split(',');
        const stops = stopsArr.join(', ');
        style.background = `linear-gradient(90deg, ${stops})`;
        style.WebkitBackgroundClip = 'text';
        style.WebkitTextFillColor = 'transparent';
        style.textShadow = `0 0 4px ${darkenColor(stopsArr[0].trim(),0.4)}`;
      }
      return style;
    };
 
    return (
      <div
        key={item.id}
        className={`shop-item ${isPurchased ? 'purchased' : ''} ${!canAfford ? 'unaffordable' : ''}`}
        onClick={() => !isPurchased && canAfford && handlePurchase(item)}
      >
        <div className="shop-item-image">
          {item.item_type === 'title' ? (
            <div className="title-preview" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%', height: '100%',
              fontSize: '14px',
              ...buildTitleStyle(item.metadata)
            }}>
              {(item.metadata?.style_config?.rainbow || item.name.toLowerCase()==='gaymer') ? (
                (() => {
                  const letters = item.name.split('');
                  const rainbow = ['#ff0000','#ff7f00','#ffff00','#00ff00','#0000ff','#8b00ff'];
                  const glow = rainbow.map(c=>`0 0 4px ${c}`).join(', ');
                  return letters.map((ch,idx)=>(
                    <span key={idx} style={{color: rainbow[idx % rainbow.length], textShadow: glow}}>{ch}</span>
                  ));
                })()
              ) : (
                item.name
              )}
            </div>
          ) : item.item_type === 'background' ? (
            <div className="background-preview" style={{
              width: '100%',
              height: '100%',
              backgroundImage: item.metadata?.background_id ? 
                `url(/assets/patterns/${item.metadata.background_id.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}.png)` : 
                'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'repeat',
              border: '1px solid #999',
              borderRadius: '2px'
            }}>
              {!item.metadata?.background_id && (
                <div className="item-placeholder">
                  {getItemIcon(item.item_type)}
                </div>
              )}
            </div>
          ) : item.item_type === 'theme' ? (
            <div className="theme-preview" style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #999',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              {/* Theme color preview */}
              <div style={{
                flex: 1,
                background: (() => {
                  // Get theme colors based on theme name
                  if (item.name === 'Ocean Theme') {
                    return 'linear-gradient(45deg, #b3d9ff 0%, #0066cc 50%, #e6f3ff 100%)';
                  } else if (item.name === 'Forest Theme') {
                    return 'linear-gradient(45deg, #c8e6c8 0%, #228B22 50%, #e8f5e8 100%)';
                  } else if (item.name === 'Sunset Theme') {
                    return 'linear-gradient(45deg, #ffcc99 0%, #ff6600 50%, #ffe6cc 100%)';
                  } else if (item.name === 'Orchid Theme') {
                    return 'linear-gradient(45deg, #e6d7ff 0%, #8a2be2 50%, #f3ebff 100%)';
                  } else if (item.name === 'Pinkie Theme') {
                    return 'linear-gradient(45deg, #ffd7e6 0%, #e91e63 50%, #ffebf0 100%)';
                  } else if (item.name === 'Joker Theme') {
                    return 'linear-gradient(45deg, #d7ffd7 0%, #32cd32 25%, #8a2be2 75%, #ebffeb 100%)';
                  } else if (item.name === 'Hotrod Theme') {
                    return 'linear-gradient(45deg, #ffd7d7 0%, #dc143c 50%, #ffebeb 100%)';
                  }
                  return 'linear-gradient(45deg, #c0c0c0 0%, #0080ff 50%, #dfdfdf 100%)';
                })(),
                position: 'relative'
              }}>
                {/* Mini window preview */}
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  right: '4px',
                  bottom: '4px',
                  backgroundColor: (() => {
                    if (item.name === 'Ocean Theme') return '#b3d9ff';
                    if (item.name === 'Forest Theme') return '#c8e6c8';
                    if (item.name === 'Sunset Theme') return '#ffcc99';
                    if (item.name === 'Orchid Theme') return '#e6d7ff';
                    if (item.name === 'Pinkie Theme') return '#ffd7e6';
                    if (item.name === 'Joker Theme') return '#d7ffd7';
                    if (item.name === 'Hotrod Theme') return '#ffd7d7';
                    return '#c0c0c0';
                  })(),
                  border: `1px solid ${(() => {
                    if (item.name === 'Ocean Theme') return '#0080ff';
                    if (item.name === 'Forest Theme') return '#90EE90';
                    if (item.name === 'Sunset Theme') return '#ff9966';
                    if (item.name === 'Orchid Theme') return '#c299ff';
                    if (item.name === 'Pinkie Theme') return '#ff99cc';
                    if (item.name === 'Joker Theme') return '#99ff99';
                    if (item.name === 'Hotrod Theme') return '#ff9999';
                    return '#808080';
                  })()}`,
                  borderRadius: '1px'
                }}>
                  <div style={{
                    height: '8px',
                    background: (() => {
                      if (item.name === 'Ocean Theme') return '#0066cc';
                      if (item.name === 'Forest Theme') return '#228B22';
                      if (item.name === 'Sunset Theme') return '#ff6600';
                      if (item.name === 'Orchid Theme') return '#8a2be2';
                      if (item.name === 'Pinkie Theme') return '#e91e63';
                      if (item.name === 'Joker Theme') return 'linear-gradient(90deg, #32cd32 0%, #8a2be2 100%)';
                      if (item.name === 'Hotrod Theme') return 'linear-gradient(90deg, #ff4500 0%, #dc143c 50%, #8b0000 100%)';
                      return '#0080ff';
                    })(),
                    borderBottom: `1px solid ${(() => {
                      if (item.name === 'Ocean Theme') return '#0080ff';
                      if (item.name === 'Forest Theme') return '#90EE90';
                      if (item.name === 'Sunset Theme') return '#ff9966';
                      if (item.name === 'Orchid Theme') return '#c299ff';
                      if (item.name === 'Pinkie Theme') return '#ff99cc';
                      if (item.name === 'Joker Theme') return '#99ff99';
                      if (item.name === 'Hotrod Theme') return '#ff9999';
                      return '#808080';
                    })()}`
                  }}></div>
                  <div style={{
                    padding: '2px',
                    fontSize: '6px',
                    color: (() => {
                      if (item.name === 'Ocean Theme') return '#003366';
                      if (item.name === 'Forest Theme') return '#1a4d1a';
                      if (item.name === 'Sunset Theme') return '#663300';
                      if (item.name === 'Orchid Theme') return '#4d1a66';
                      if (item.name === 'Pinkie Theme') return '#661a33';
                      if (item.name === 'Joker Theme') return '#1a4d1a';
                      if (item.name === 'Hotrod Theme') return '#661a1a';
                      return '#000000';
                    })(),
                    lineHeight: '1'
                  }}>
                    Theme Preview
                  </div>
                </div>
              </div>
            </div>
          ) : item.asset_path ? (
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
          {item.item_type !== 'title' && (
            <div className="shop-item-description">{item.description}</div>
          )}
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

  const getTabEmoji = (tab: string) => {
    switch (tab) {
      case 'cosmetics': return '✨';
      case 'themes': return '🎨';
      case 'backgrounds': return '🖼️';
      case 'games': return '🎮';
      case 'titles': return '🏷️';
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
          {(['cosmetics', 'themes', 'backgrounds', 'games', 'titles', 'misc'] as const).map((tab) => (
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
