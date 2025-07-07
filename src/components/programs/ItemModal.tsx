import React from 'react';
import { Item } from '../../store/inventorySlice';

interface ItemModalProps {
  item: Item;
  isEquipped: boolean;
  onEquip: (itemId: string) => void;
  onClose: () => void;
}

const ItemModal: React.FC<ItemModalProps> = ({
  item,
  isEquipped,
  onEquip,
  onClose
}) => {
  const handleEquip = () => {
    onEquip(item.id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="item-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>✨</span>
            <span>Item Details</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-content">
          <div className="item-preview-section">
            <h4>Preview:</h4>
            <div className="item-preview-large">
              <img 
                src={item.asset_path} 
                alt={item.name}
                className="item-image-large"
              />
            </div>
          </div>

          <div className="item-details">
            <div className="detail-row">
              <span className="detail-label">Name:</span>
              <span className="detail-value">{item.name}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{item.type}</span>
            </div>

            {item.description && (
              <div className="detail-row">
                <span className="detail-label">Description:</span>
                <span className="detail-value">{item.description}</span>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">Cost:</span>
              <span className="detail-value">
                {item.cost > 0 ? `💰 ${item.cost.toLocaleString()}` : 'Free'}
              </span>
            </div>

            {item.unlocked_at && (
              <div className="detail-row">
                <span className="detail-label">Unlocked:</span>
                <span className="detail-value">
                  {new Date(item.unlocked_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="win98-button primary"
            onClick={handleEquip}
          >
            {isEquipped ? 'Unequip' : 'Equip'}
          </button>
          <button 
            className="win98-button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemModal; 