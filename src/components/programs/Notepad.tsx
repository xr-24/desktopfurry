import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import ProgramWindow from '../ProgramWindow';

interface NotepadProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    content: string;
    filename: string;
    isDirty: boolean;
    fontFamily: string;
    fontSize: number;
    textColor: string;
    backgroundColor: string;
    isBold: boolean;
    isItalic: boolean;
  };
  controllerId: string;
  currentPlayerId: string;
}

const Notepad: React.FC<NotepadProps> = ({
  windowId,
  position,
  size,
  zIndex,
  isMinimized,
  programState,
  controllerId,
  currentPlayerId,
}) => {
  const dispatch = useAppDispatch();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(programState.content || '');
  
  // Only the controller can edit
  const canEdit = controllerId === currentPlayerId;

  // Sync local content with program state
  useEffect(() => {
    if (programState.content !== localContent) {
      setLocalContent(programState.content || '');
    }
  }, [programState.content]);

  const handleContentChange = (newContent: string) => {
    if (!canEdit) return;
    
    setLocalContent(newContent);
    
    // Update program state
    dispatch(updateProgramState({
      windowId,
      newState: {
        content: newContent,
        isDirty: true, // Any content change marks as dirty
      },
    }));
  };

  const handleMenuAction = (action: string) => {
    if (!canEdit) return;

    switch (action) {
      case 'new':
        handleContentChange('');
        dispatch(updateProgramState({
          windowId,
          newState: {
            filename: 'Untitled.txt',
            isDirty: false,
          },
        }));
        break;
      case 'save':
        // In a real app, this would open a save dialog
        dispatch(updateProgramState({
          windowId,
          newState: {
            filename: 'Document.txt',
            isDirty: false,
          },
        }));
        break;
      case 'time':
        const now = new Date();
        const timeString = now.toLocaleString();
        const newContentWithTime = localContent + timeString;
        handleContentChange(newContentWithTime);
        break;
    }
  };

  const handleFormatChange = (property: string, value: any) => {
    if (!canEdit) return;

    dispatch(updateProgramState({
      windowId,
      newState: {
        [property]: value,
        isDirty: true, // Formatting changes mark as dirty
      },
    }));
  };

  const toggleFormat = (property: 'isBold' | 'isItalic') => {
    if (!canEdit) return;

    dispatch(updateProgramState({
      windowId,
      newState: {
        [property]: !programState[property],
        isDirty: true, // Format toggles mark as dirty
      },
    }));
  };

  const getWindowTitle = () => {
    const filename = programState.filename || 'Untitled.txt';
    const isDirty = programState.isDirty ? '*' : '';
    const controllerInfo = !canEdit ? ` (Controlled by ${controllerId})` : '';
    return `${isDirty}${filename} - Notepad${controllerInfo}`;
  };

  const wordCount = localContent.trim() ? localContent.trim().split(/\s+/).length : 0;
  const charCount = localContent.length;

  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="📝"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      {/* Menu Bar */}
      <div className="program-menu-bar">
        <div className="menu-item" onClick={() => handleMenuAction('new')}>
          File
        </div>
        <div className="menu-item" onClick={() => handleMenuAction('edit')}>
          Edit
        </div>
        <div className="menu-item" onClick={() => handleMenuAction('view')}>
          View
        </div>
        <div className="menu-item" onClick={() => handleMenuAction('help')}>
          Help
        </div>
      </div>

      {/* Toolbar */}
      <div className="program-toolbar">
        <div className="toolbar-group">
          <button 
            className="toolbar-button" 
            onClick={() => handleMenuAction('new')}
            disabled={!canEdit}
            title="New"
          >
            📄
          </button>
          <button 
            className="toolbar-button" 
            onClick={() => handleMenuAction('save')}
            disabled={!canEdit}
            title="Save"
          >
            💾
          </button>
        </div>
        <div className="toolbar-separator" />
        
        {/* Font Controls */}
        <div className="toolbar-group">
          <select 
            className="toolbar-select"
            value={programState.fontFamily || 'Comic Sans MS'}
            onChange={(e) => handleFormatChange('fontFamily', e.target.value)}
            disabled={!canEdit}
            title="Font Family"
          >
            <option value="Comic Sans MS">Comic Sans MS</option>
            <option value="Better VCR">Better VCR</option>
            <option value="Arial">Arial</option>
            <option value="Courier New">Courier New</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Verdana">Verdana</option>
            <option value="Georgia">Georgia</option>
            <option value="Impact">Impact</option>
          </select>
          
          <select 
            className="toolbar-select"
            value={programState.fontSize || 32}
            onChange={(e) => handleFormatChange('fontSize', parseInt(e.target.value))}
            disabled={!canEdit}
            title="Font Size"
          >
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
            <option value="11">11</option>
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="24">24</option>
            <option value="28">28</option>
            <option value="32">32</option>
            <option value="36">36</option>
            <option value="40">40</option>
            <option value="48">48</option>
            <option value="56">56</option>
            <option value="64">64</option>
            <option value="72">72</option>
          </select>
        </div>
        <div className="toolbar-separator" />
        
        {/* Format Controls */}
        <div className="toolbar-group">
          <button 
            className={`toolbar-button ${programState.isBold ? 'active' : ''}`}
            onClick={() => toggleFormat('isBold')}
            disabled={!canEdit}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button 
            className={`toolbar-button ${programState.isItalic ? 'active' : ''}`}
            onClick={() => toggleFormat('isItalic')}
            disabled={!canEdit}
            title="Italic"
          >
            <em>I</em>
          </button>
        </div>
        <div className="toolbar-separator" />
        
        {/* Color Controls */}
        <div className="toolbar-group">
          <label className="color-picker-label" title="Text Color">
            🎨
            <input
              type="color"
              value={programState.textColor || '#000000'}
              onChange={(e) => handleFormatChange('textColor', e.target.value)}
              disabled={!canEdit}
              className="color-picker"
            />
          </label>
        </div>
        <div className="toolbar-separator" />
        
        <div className="toolbar-group">
          <button 
            className="toolbar-button" 
            onClick={() => handleMenuAction('time')}
            disabled={!canEdit}
            title="Insert Date/Time"
          >
            🕐
          </button>
        </div>
      </div>

      {/* Main Text Area */}
      <div className="program-content" style={{ padding: 0 }}>
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder=""
          readOnly={!canEdit}

          onMouseDown={(e) => {
            // Prevent window dragging when clicking in textarea
            e.stopPropagation();
          }}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            padding: '8px',
            fontFamily: programState.fontFamily || 'Comic Sans MS',
            fontSize: `${programState.fontSize || 32}px`,
            fontWeight: programState.isBold ? 'bold' : 'normal',
            fontStyle: programState.isItalic ? 'italic' : 'normal',
            color: canEdit ? (programState.textColor || '#000000') : '#666',
            backgroundColor: canEdit ? '#ffffff' : '#f5f5f5',
            resize: 'none',
            outline: 'none',
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="program-status-bar">
        <div className="status-section">
          <span className="status-panel">
            Line 1, Col {textareaRef.current?.selectionStart || 0}
          </span>
          <span className="status-panel">
            {wordCount} words
          </span>
          <span className="status-panel">
            {charCount} characters
          </span>
          <span className="status-panel">
            {programState.fontFamily || 'Comic Sans MS'} {programState.fontSize || 32}pt
          </span>
        </div>
        <div className="status-section">
          {!canEdit && (
            <span className="status-panel" style={{ color: '#666' }}>
              Read Only
            </span>
          )}
          <span className="status-panel">
            {programState.isDirty ? 'Modified' : 'Saved'}
          </span>
        </div>
      </div>
    </ProgramWindow>
  );
};

export default Notepad; 