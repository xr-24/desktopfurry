import React from 'react';
import { Title } from '../../store/inventorySlice';

interface TitleModalProps {
  title: Title;
  isEquipped: boolean;
  onEquip: (titleId: string | null) => void;
  onClose: () => void;
}

const TitleModal: React.FC<TitleModalProps> = ({
  title,
  isEquipped,
  onEquip,
  onClose
}) => {
  const handleEquip = () => {
    onEquip(isEquipped ? null : title.id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="title-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span>🏷️</span>
            <span>Title Details</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-content">
          <div className="title-preview-section">
            <h4>Preview:</h4>
            <div className="title-preview-large">
              <span 
                className="title-display"
                style={title.style_config}
              >
                {title.name}
              </span>
            </div>
          </div>

          <div className="title-details">
            <div className="detail-row">
              <span className="detail-label">Name:</span>
              <span className="detail-value">{title.name}</span>
            </div>
            
            {title.description && (
              <div className="detail-row">
                <span className="detail-label">Description:</span>
                <span className="detail-value">{title.description}</span>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">Cost:</span>
              <span className="detail-value">
                {title.cost > 0 ? `💰 ${title.cost.toLocaleString()}` : 'Free'}
              </span>
            </div>

            {title.unlocked_at && (
              <div className="detail-row">
                <span className="detail-label">Unlocked:</span>
                <span className="detail-value">
                  {new Date(title.unlocked_at).toLocaleDateString()}
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

export default TitleModal; 