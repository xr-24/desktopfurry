import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { changeRoom, ChickenQuestStats } from '../../store/chickenQuestSlice';

interface TrainingBoardProps {
  onClose: () => void;
  isVisible: boolean;
}

const TrainingBoard: React.FC<TrainingBoardProps> = ({ onClose, isVisible }) => {
  const dispatch = useAppDispatch();
  const chickenQuestState = useAppSelector((state: any) => state.chickenQuest);

  const trainingOptions = [
    {
      id: 'archery' as keyof ChickenQuestStats,
      name: 'Archery Training',
      description: 'Practice with bow and arrow',
      room: 'archery' as const,
      icon: '🏹',
      currentLevel: chickenQuestState.stats.archery,
    },
    {
      id: 'swordsman' as keyof ChickenQuestStats,
      name: 'Swordsmanship Training',
      description: 'Learn melee combat techniques',
      room: 'swordsman' as const,
      icon: '⚔️',
      currentLevel: chickenQuestState.stats.swordsman,
    },
    {
      id: 'magic' as keyof ChickenQuestStats,
      name: 'Magic Training',
      description: 'Study arcane arts and spellcasting',
      room: 'magic' as const,
      icon: '🪄',
      currentLevel: chickenQuestState.stats.magic,
    },
    {
      id: 'fishing' as keyof ChickenQuestStats,
      name: 'Fishing Training',
      description: 'Improve patience and fishing technique',
      room: 'fishing' as const,
      icon: '🎣',
      currentLevel: chickenQuestState.stats.fishing,
    },
    {
      id: 'charisma' as keyof ChickenQuestStats,
      name: 'Charisma Training',
      description: 'Practice social interaction with NPCs',
      room: 'dialogue' as const,
      icon: '💬',
      currentLevel: chickenQuestState.stats.charisma,
    },
  ];

  const handleTrainingSelect = (option: typeof trainingOptions[0]) => {
    dispatch(changeRoom(option.room));
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#c0c0c0',
        border: '2px outset #c0c0c0',
        padding: '20px',
        fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
        fontSize: '11px',
        minWidth: '400px',
        maxHeight: '500px',
        overflowY: 'auto',
      }}>
        {/* Title Bar */}
        <div style={{
          background: '#0000ff',
          color: 'white',
          padding: '4px 8px',
          margin: '-20px -20px 16px -20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 'bold',
        }}>
          <span>🏆 Training Board</span>
          <button
            onClick={onClose}
            style={{
              background: '#c0c0c0',
              border: '1px outset #c0c0c0',
              color: 'black',
              padding: '1px 6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '12px', textAlign: 'center' }}>
          <strong>Choose your training:</strong>
        </div>

        {/* Training Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {trainingOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleTrainingSelect(option)}
              style={{
                background: '#c0c0c0',
                border: '2px outset #c0c0c0',
                padding: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '11px',
                textAlign: 'left',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.border = '2px inset #c0c0c0';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.border = '2px outset #c0c0c0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '2px outset #c0c0c0';
              }}
            >
              <div style={{ fontSize: '24px' }}>{option.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {option.name}
                </div>
                <div style={{ color: '#666', marginBottom: '4px' }}>
                  {option.description}
                </div>
                <div style={{ fontWeight: 'bold' }}>
                  Current Level: {option.currentLevel}/100
                </div>
              </div>
              <div style={{
                background: option.currentLevel < 100 ? '#00ff00' : '#ffff00',
                color: 'black',
                padding: '4px 8px',
                border: '1px inset #c0c0c0',
                fontSize: '10px',
                fontWeight: 'bold',
              }}>
                {option.currentLevel < 100 ? '+2 XP' : 'MAX'}
              </div>
            </button>
          ))}
        </div>

        {/* Info Panel */}
        <div style={{
          marginTop: '16px',
          padding: '8px',
          background: '#fff',
          border: '1px inset #c0c0c0',
          fontSize: '10px',
          color: '#333',
        }}>
          <strong>💡 Training Tips:</strong><br />
          • Each training session increases the stat by 2 points<br />
          • Higher stats unlock better equipment and dialogue options<br />
          • Complete minigames to earn your training progress<br />
          • Return to town after each training session
        </div>

        {/* Bottom Buttons */}
        <div style={{
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
        }}>
          <button
            onClick={onClose}
            style={{
              background: '#c0c0c0',
              border: '2px outset #c0c0c0',
              padding: '6px 16px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.border = '2px inset #c0c0c0';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.border = '2px outset #c0c0c0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = '2px outset #c0c0c0';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingBoard; 