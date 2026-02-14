import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, FolderOpen, Save, Settings, Terminal, Download,
  Upload, RotateCcw, Archive, Key
} from 'lucide-react';

const { ipcRenderer } = window.require('electron');

export default function MenuBar({ handleExportZip }) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleMenuClick = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuAction = (action) => {
    ipcRenderer.send(action);
    setActiveMenu(null);
  };

  return (
    <div className="menu-bar" ref={menuRef}>
      {/* File Menu */}
      <div className="menu-item" onClick={() => handleMenuClick('file')}>
        File
        {activeMenu === 'file' && (
          <div className="menu-dropdown">
            <div className="menu-option" onClick={() => handleMenuAction('new-project-trigger')}>
              <div className="menu-option-content">
                <FileText size={14} />
                New Project
              </div>
              <span className="menu-option-shortcut">Ctrl+Shift+N</span>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('new-file-trigger')}>
              <div className="menu-option-content">
                <FileText size={14} />
                New File
              </div>
              <span className="menu-option-shortcut">Alt+A</span>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('new-blank-tab')}>
              <div className="menu-option-content">
                <FileText size={14} />
                New Tab
              </div>
              <span className="menu-option-shortcut">Ctrl+N</span>
            </div>
            <div className="menu-separator"></div>
            <div className="menu-option" onClick={() => handleMenuAction('open-folder-trigger')}>
              <div className="menu-option-content">
                <FolderOpen size={14} />
                Open Folder
              </div>
              <span className="menu-option-shortcut">Ctrl+O</span>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('load-project-trigger')}>
              <div className="menu-option-content">
                <Upload size={14} />
                Load Project
              </div>
              <span className="menu-option-shortcut">Ctrl+L</span>
            </div>
            <div className="menu-separator"></div>
            <div className="menu-option" onClick={() => handleMenuAction('save-trigger')}>
              <div className="menu-option-content">
                <Save size={14} />
                Save
              </div>
              <span className="menu-option-shortcut">Ctrl+S</span>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('save-as-trigger')}>
              <div className="menu-option-content">
                <Save size={14} />
                Save As
              </div>
              <span className="menu-option-shortcut">Ctrl+Shift+S</span>
            </div>
            <div className="menu-separator"></div>
            {/* تم إصلاح هذا الجزء ليعمل شريط التحميل */}
            <div className="menu-option" onClick={() => { handleExportZip(); setActiveMenu(null); }}>
              <div className="menu-option-content">
                <Archive size={14} />
                Export as ZIP
              </div>
              <span className="menu-option-shortcut">Ctrl+E</span>
            </div>
          </div>
        )}
      </div>

      {/* Edit Menu */}
      <div className="menu-item" onClick={() => handleMenuClick('edit')}>
        Edit
        {activeMenu === 'edit' && (
          <div className="menu-dropdown">
            <div className="menu-option" onClick={() => handleMenuAction('copy-file-trigger')}>
              <div className="menu-option-content">
                Copy
              </div>
              <span className="menu-option-shortcut">Ctrl+C</span>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('paste-file-trigger')}>
              <div className="menu-option-content">
                Paste
              </div>
              <span className="menu-option-shortcut">Ctrl+V</span>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('delete-file-trigger')}>
              <div className="menu-option-content">
                Delete
              </div>
              <span className="menu-option-shortcut">Delete</span>
            </div>
            <div className="menu-separator"></div>
            <div className="menu-option" onClick={() => handleMenuAction('show-shortcuts-trigger')}>
              <div className="menu-option-content">
                <Key size={14} />
                Keyboard Shortcuts
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Menu */}
      <div className="menu-item" onClick={() => handleMenuClick('terminal')}>
        Terminal
        {activeMenu === 'terminal' && (
          <div className="menu-dropdown">
            <div className="menu-option" onClick={() => handleMenuAction('open-terminal-trigger')}>
              <div className="menu-option-content">
                <Terminal size={14} />
                Open Terminal
              </div>
              <span className="menu-option-shortcut">Alt+R`</span>
            </div>
          </div>
        )}
      </div>

      {/* View Menu */}
      <div className="menu-item" onClick={() => handleMenuClick('view')}>
        View
        {activeMenu === 'view' && (
          <div className="menu-dropdown">
            <div className="menu-option" onClick={() => handleMenuAction('toggle-sidebar')}>
              <div className="menu-option-content">
                Toggle Sidebar
              </div>
              <span className="menu-option-shortcut">Ctrl+B</span>
            </div>
            <div className="menu-separator"></div>
            <div className="menu-option" onClick={() => handleMenuAction('next-tab')}>
              <div className="menu-option-content">
                Next Tab
              </div>
              <span className="menu-option-shortcut">Ctrl+Tab</span>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('prev-tab')}>
              <div className="menu-option-content">
                Previous Tab
              </div>
              <span className="menu-option-shortcut">Ctrl+Shift+Tab</span>
            </div>
          </div>
        )}
      </div>

      {/* Recovery Menu */}
      <div className="menu-item" onClick={() => handleMenuClick('recovery')}>
        Recovery
        {activeMenu === 'recovery' && (
          <div className="menu-dropdown">
            <div className="menu-option" onClick={() => handleMenuAction('auto-save-settings-trigger')}>
              <div className="menu-option-content">
                <Settings size={14} />
                Auto-Save Settings
              </div>
            </div>
            <div className="menu-option" onClick={() => handleMenuAction('restore-backup-trigger')}>
              <div className="menu-option-content">
                <RotateCcw size={14} />
                Restore Backup
              </div>
            </div>
            <div className="menu-separator"></div>
            <div className="menu-option" onClick={() => handleMenuAction('show-backups-trigger')}>
              <div className="menu-option-content">
                <Download size={14} />
                View All Backups
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}