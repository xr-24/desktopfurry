import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState, closeProgram } from '../../store/programSlice';
import { setCurrentTitle, setCurrentItems, Title, Item } from '../../store/inventorySlice';
import ProgramWindow from '../ProgramWindow';
import TitleModal from './TitleModal';
import ItemModal from './ItemModal';
import { authService } from '../../services/authService';
import '../../styles/inventory.css';

interface InventoryProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: any;
  controllerId: string;
  currentPlayerId: string;
}

const Inventory: React.FC<InventoryProps> = ({
  windowId, position, size, zIndex, isMinimized,
  programState, controllerId, currentPlayerId
}) => {
  const dispatch = useAppDispatch();
  const { money, titles, items, currentTitleId, currentItemIds } = useAppSelector((state: any) => state.inventory);
  
  const [activeTab, setActiveTab] = useState<'titles' | 'items'>(programState.activeTab || 'titles');
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Only allow current player to interact (local-only program)
  const canEdit = controllerId === currentPlayerId;

  useEffect(() => {
    // Update program state when tab changes
    dispatch(updateProgramState({
      windowId,
      newState: { activeTab }
    }));
  }, [activeTab, windowId, dispatch]);

  const handleTitleSelect = (title: any) => {
    if (!canEdit) return;
    setSelectedTitle(title);
    setShowTitleModal(true);
  };

  const handleItemSelect = (item: any) => {
    if (!canEdit) return;
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const handleEquipTitle = async (titleId: string | null) => {
    if (!canEdit) return;
    
    try {
      dispatch(setCurrentTitle(titleId));
      await authService.updateCurrentTitle(titleId);
      setShowTitleModal(false);
    } catch (error) {
      console.error('Failed to equip title:', error);
    }
  };

  const handleEquipItem = async (itemId: string) => {
    if (!canEdit) return;
    
    try {
      const newItemIds = currentItemIds.includes(itemId)
        ? currentItemIds.filter((id: string) => id !== itemId)
        : [...currentItemIds, itemId];
      
      dispatch(setCurrentItems(newItemIds));
      await authService.updateCurrentItems(newItemIds);
      setShowItemModal(false);
    } catch (error) {
      console.error('Failed to equip item:', error);
    }
  };

  const getCurrentTitle = () => {
    return titles.find((title: Title) => title.id === currentTitleId);
  };

  const isItemEquipped = (itemId: string) => {
    return currentItemIds.includes(itemId);
  };

  if (isMinimized) return null;

  return (
    <ProgramWindow
      windowId={windowId}
      title="🎒 Inventory"
      icon="🎒"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      <div className="inventory-container">
        {/* Header with money display */}
        <div className="inventory-header">
          <div className="money-display">
            <span className="money-icon">💰</span>
            <span className="money-amount">{money.toLocaleString()}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="inventory-tabs">
          <button
            className={`inventory-tab ${activeTab === 'titles' ? 'active' : ''}`}
            onClick={() => setActiveTab('titles')}
            disabled={!canEdit}
          >
            🏷️ Titles
          </button>
          <button
            className={`inventory-tab ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
            disabled={!canEdit}
          >
            ✨ Items
          </button>
        </div>

        {/* Tab Content */}
        <div className="inventory-content">
          {activeTab === 'titles' && (
            <div className="titles-tab">
              <div className="available-items">
                <h4>Available Titles:</h4>
                <div className="titles-grid">
                  {titles.map((title: Title) => (
                    <div
                      key={title.id}
                      className={`title-item ${title.id === currentTitleId ? 'equipped' : ''}`}
                      onClick={() => handleTitleSelect(title)}
                    >
                      <div 
                        className="title-name"
                        style={title.style_config}
                      >
                        {title.name}
                      </div>
                      {title.id === currentTitleId && (
                        <div className="equipped-badge">Equipped</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="items-tab">
              <div className="available-items">
                <h4>Available Items:</h4>
                <div className="items-grid">
                  {items.map((item: Item) => (
                    <div
                      key={item.id}
                      className={`item-card ${isItemEquipped(item.id) ? 'equipped' : ''}`}
                      onClick={() => handleItemSelect(item)}
                    >
                      <div className="item-image">
                        <img 
                          src={item.asset_path}
                          alt={item.name}
                          className="item-icon"
                          onError={(e)=>{
                            const fallback=`/assets/characters/items/misc/${item.name.toLowerCase().replace(/\s+/g,'')}.png`;
                            if((e.target as HTMLImageElement).src!==window.location.origin+fallback){
                              (e.target as HTMLImageElement).src=fallback;
                            }
                          }}
                        />
                      </div>
                      <div className="item-name">{item.name}</div>
                      {isItemEquipped(item.id) && (
                        <div className="equipped-badge">Equipped</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        {showTitleModal && selectedTitle && (
          <TitleModal
            title={selectedTitle}
            isEquipped={selectedTitle.id === currentTitleId}
            onEquip={handleEquipTitle}
            onClose={() => setShowTitleModal(false)}
          />
        )}

        {showItemModal && selectedItem && (
          <ItemModal
            item={selectedItem}
            isEquipped={isItemEquipped(selectedItem.id)}
            onEquip={handleEquipItem}
            onClose={() => setShowItemModal(false)}
          />
        )}
      </div>
    </ProgramWindow>
  );
};

export default Inventory; 