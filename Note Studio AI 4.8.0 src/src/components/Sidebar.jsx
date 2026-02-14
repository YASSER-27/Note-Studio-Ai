import React from 'react';
import { 
  FilePlus, Plus, FolderOpen, FileCode, ChevronDown, ChevronRight,
  FolderPlus as NewFolder 
} from 'lucide-react';

export default function Sidebar({
  files, currentFolderPath, isCreatingFile, isCreatingFolder,
  newFileName, newFolderName, isRenaming, renamePath, renameValue,
  activeTab, selectedPath, expandedFolders, dropTarget,
  fileNameInputRef, folderNameInputRef, renameInputRef,
  setIsCreatingFile, setIsCreatingFolder, setNewFileName, setNewFolderName,
  setRenameValue, setIsRenaming, setRenamePath, handleCreateFileSubmit,
  handleCreateFolderSubmit, handleRenameSubmit, handleOpenFolder,
  createNewBlankTab, setShowProjectModal, onFileClick, onContextMenu,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
}) {
  
  // مكون شجرة الملفات الداخلي بتنسيق اللون الجديد
  const FileTree = ({ items }) => (
    <div className="tree-container">
      {items.map((item, i) => (
        <div key={i}>
          {isRenaming && renamePath === item.path ? (
            <div className="rename-input-container" style={{ padding: '2px 12px' }}>
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') { setIsRenaming(false); setRenamePath(null); }
                }}
                className="rename-input"
                style={{ 
                  background: '#1c1c1e', border: '1px solid #2ea043', 
                  color: '#fff', width: '100%', fontSize: '12px', padding: '4px' 
                }}
              />
            </div>
          ) : (
            <div 
              className={`tree-item ${activeTab?.path === item.path ? 'active' : ''} ${dropTarget === item.path ? 'drop-target' : ''}`}
              draggable
              onDragStart={(e) => onDragStart(e, item)}
              onDragOver={(e) => onDragOver(e, item)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, item)}
              onDragEnd={onDragEnd}
              onClick={() => onFileClick(item)}
              onContextMenu={(e) => onContextMenu(e, item)}
              style={{
                background: activeTab?.path === item.path ? 'rgba(46, 160, 67, 0.1)' : 'transparent',
                borderLeft: activeTab?.path === item.path ? '2px solid #2ea043' : '2px solid transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.isDirectory ? (
                  expandedFolders[item.path] ? <ChevronDown size={14} color="#aaa"/> : <ChevronRight size={14} color="#aaa"/>
                ) : (
                  <FileCode size={14} color={activeTab?.path === item.path ? "#2ea043" : "#666"}/>
                )}
                <span style={{ 
                  fontSize: '13px', 
                  color: activeTab?.path === item.path ? '#fff' : '#ccc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {item.name}
                </span>
              </div>
            </div>
          )}
          {item.isDirectory && expandedFolders[item.path] && item.children && (
            <div style={{ marginLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
              <FileTree items={item.children} />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <aside className="app-sidebar" style={{ background: '#111112', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="sidebar-header" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', letterSpacing: '1px' }}>EXPLORER</span>
        <div className="header-icons" style={{ display: 'flex', gap: '8px', color: '#888' }}>
          <Plus size={16} className="h-icon" onClick={() => setIsCreatingFile(true)} />
          <NewFolder size={16} className="h-icon" onClick={() => setIsCreatingFolder(true)} />
          <FolderOpen size={16} className="h-icon" onClick={handleOpenFolder} />
        </div>
      </div>
      
      <div className="explorer-content" style={{ flex: 1, overflowY: 'auto' }}>
        {/* حقول إدخال الملفات الجديدة بتصميم متوافق */}
        {(isCreatingFile || isCreatingFolder) && (
          <div style={{ padding: '5px 15px' }}>
            <form onSubmit={isCreatingFile ? handleCreateFileSubmit : handleCreateFolderSubmit}>
              <input 
                ref={isCreatingFile ? fileNameInputRef : folderNameInputRef}
                value={isCreatingFile ? newFileName : newFolderName}
                onChange={(e) => isCreatingFile ? setNewFileName(e.target.value) : setNewFolderName(e.target.value)}
                autoFocus
                className="new-file-input"
                style={{
                  background: '#1c1c1e', border: '1px solid #333', color: '#fff',
                  width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px'
                }}
                placeholder={isCreatingFile ? "file.js" : "folder name"}
              />
            </form>
          </div>
        )}
        
        {files.length > 0 ? (
          <FileTree items={files} />
        ) : (
          <div className="no-folder-ui" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
             <button 
              className="gray-btn" 
              onClick={handleOpenFolder}
              style={{ background: '#2ea043', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              Open Project
            </button>
            <button 
              className="gray-btn" 
              onClick={() => setShowProjectModal(true)}
              style={{ background: 'transparent', color: '#aaa', border: '1px solid #333', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              New Project
            </button>
          </div>
        )}
      </div>

      <style>{`
        .tree-item {
          display: flex;
          align-items: center;
          padding: 6px 15px;
          cursor: pointer;
          transition: 0.1s;
          user-select: none;
        }
        .tree-item:hover {
          background: rgba(255,255,255,0.03) !important;
        }
        .h-icon {
          cursor: pointer;
          transition: 0.2s;
        }
        .h-icon:hover {
          color: #fff;
          transform: scale(1.1);
        }
        .explorer-content::-webkit-scrollbar {
          width: 5px;
        }
        .explorer-content::-webkit-scrollbar-thumb {
          background: #222;
          border-radius: 10px;
        }
      `}</style>
    </aside>
  );
}