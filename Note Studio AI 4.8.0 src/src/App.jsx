import React, { useState, useEffect, useRef } from 'react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import {
  Copy, Scissors, Clipboard, Info, Terminal, Edit3, Trash2
} from 'lucide-react';
import './App.css';

// Import Components
import ChatComponent from './ChatComponent';
import TitleBar from './components/TitleBar';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import EditorContainer from './components/EditorContainer';
import ProjectModal from './components/ProjectModal';
const { ipcRenderer } = window.require('electron');
loader.config({ monaco });
export default function App() {
  const [files, setFiles] = useState([]);
  const [saveMessage, setSaveMessage] = useState({ visible: false, text: '' });
  const [currentFolderPath, setCurrentFolderPath] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedPath, setSelectedPath] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamePath, setRenamePath] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectType, setProjectType] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); 
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const editorRef = useRef(null);
  const fileNameInputRef = useRef(null);
  const folderNameInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const selectedPathRef = useRef(selectedPath);
  const activeTab = tabs.find(t => t.id === activeTabId);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  useEffect(() => { selectedPathRef.current = selectedPath; }, [selectedPath]);
  const pathSeparator = () => (process.platform === 'win32' ? '\\' : '/');
  const handleAskAI = async (prompt) => {
    try {
      const result = await ipcRenderer.invoke('ai:chat', { 
        prompt, 
        modelPath: "./models/qwen2.5-coder-0.5b-instruct-q4_k_m.gguf" 
      });
      return result;
    } catch (err) {
      console.error("AI Chat Error:", err);
    }
  };
  const filesFindByPath = (searchPath) => {
    if (!searchPath) return null;
    let found = null;
    const dfs = (nodes) => {
      if (!nodes || found) return;
      for (const n of nodes) {
        if (n.path === searchPath) { found = n; return; }
        if (n.isDirectory && n.children) dfs(n.children);
        if (found) return;
      }
    };
    dfs(files);
    return found;
  };
  function App() {
  return (
    <div className="App">
      <ChatComponent />
    </div>
  );
}
  const handleExportZip = async () => {
  if (!currentFolderPath) {
    alert("Please open a folder first!");
    return;
  } 
  setIsExporting(true);
  setExportProgress(20);
  try {
    const result = await ipcRenderer.invoke('export-zip', currentFolderPath);
    
    if (result.success) {
      setExportProgress(100);
      alert("Project exported successfully to: " + result.path);
    }
  } catch (error) {
    console.error("Export error:", error);
  } finally {
    setTimeout(() => setIsExporting(false), 2000);
  }
};
const handleGlobalSearch = async (term) => {
  // لا نبحث إذا كان النص فارغاً أو أقل من حرفين لتجنب الثقل
  if (!term || term.length < 2) {
    setSearchResults([]);
    return;
  }
  try {
    // نرسل الطلب لعملية Electron الرئيسية
    const results = await ipcRenderer.invoke('search-in-files', { 
      folderPath: currentFolderPath, 
      searchTerm: term 
    });
    setSearchResults(results);
  } catch (error) {
    console.error("Search failed:", error);
  }
};
  useEffect(() => {
    if (activeTabId && editorRef.current) {
      const editor = editorRef.current;
      try {
        // register save via menu/keyboard (this is fallback; EditorContainer also registers Ctrl+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          handleSave(activeTabIdRef.current);
        });
      } catch (e) {
        console.warn('Failed to register editor command', e);
      }
      const timer = setTimeout(() => {
        try { editor.focus(); } catch (e) {}
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTabId]);

  useEffect(() => {
    const onEditorSaveRequest = (ev) => {
      const tabId = ev?.detail?.tabId;
      if (tabId) handleSave(tabId);
    };
    window.addEventListener('editor-save-request', onEditorSaveRequest);
    return () => window.removeEventListener('editor-save-request', onEditorSaveRequest);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'i') {
        e.preventDefault(); // منع المتصفح من فتح "Inspect" أو أي وظيفة افتراضية
        setIsChatVisible(prev => !prev); // تبديل الحالة (ظهور/إخفاء)
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      e.stopPropagation(); // منع المحرر من أخذ هذا الاختصار
      console.log("Global Search Triggered");
      setIsSearchOpen(true);
      return;
    }
    if (e.key === 'Escape' && isSearchOpen) {
      setIsSearchOpen(false);
    }
    if (e.ctrlKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
    }
  };
  window.addEventListener('keydown', handleKeyDown, true);
 
  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
  };
}, [isSearchOpen, currentFolderPath]); // أضفنا isSearchOpen لضمان تحديث حالة الإغلاق

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+R -> open terminal
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        const targetPath = selectedPath || currentFolderPath || require('os').homedir();
        ipcRenderer.invoke('open-terminal', targetPath);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'f') {
        const newCode = prompt("أدخل الكود لإضافته بذكاء:");
        if (newCode && editorRef.current) {
          const editor = editorRef.current;
          const model = editor.getModel();
          if (!model) return;

          try { editor.pushUndoStop(); } catch (err) {}
          
          const lines = model.getLinesContent();
          let insertLine = 1;

          lines.forEach((line, index) => {
            if (line.includes('import') || line.includes('require')) {
              insertLine = index + 2;
            }
          });

          insertLine = Math.max(1, Math.min(insertLine, model.getLineCount() + 1));

          const range = new monaco.Range(insertLine, 1, insertLine, 1);
          const op = {
            range: range,
            text: `\n${newCode}\n`,
            forceMoveMarkers: true
          };

          try {
            editor.executeEdits("smart-box", [op]);
          } catch (err) {
            console.error('executeEdits failed', err);
          }

          try { editor.pushUndoStop(); } catch (err) {}
          try { editor.focus(); } catch (err) {}
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPath, currentFolderPath]);
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  const handleDragStart = (e, item) => {
    e.stopPropagation();
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', item.path); } catch (err) {}
  };
  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.isDirectory && draggedItem && draggedItem.path !== item.path) {
      setDropTarget(item.path);
      e.dataTransfer.dropEffect = 'move';
    }
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDropTarget(null);
  };
  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);   
    if (!draggedItem || !targetItem || !targetItem.isDirectory) return;    
    const res = await ipcRenderer.invoke('move-file', {
      sourcePath: draggedItem.path,
      targetDir: targetItem.path
    });   
    if (res && res.success) {
      if (res.newPath) {
        setTabs(prev => prev.map(t => t.path === draggedItem.path ? { ...t, path: res.newPath } : t));
      }
      await refreshFileTree();
    } else {
    }   
    setDraggedItem(null);
  };
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };
  const handleDeleteItem = async (targetPath) => {
    if (!targetPath) return;
    const res = await ipcRenderer.invoke('delete-item', targetPath);
    if (res && res.success && res.trashed) {
        await refreshFileTree();
        setSelectedPath(null);
    } else if (res && !res.success) {
        await refreshFileTree();
        console.error('Error deleting file:', res.error);
    }
};
const handleAiOnSelection = async (editor) => {
  const selection = editor.getSelection();
  const selectedText = editor.getModel().getValueInRange(selection);
  if (!selectedText || selectedText.trim() === "") {
    alert("الرجاء تحديد كود أولاً!");
    return;
  }
  const instruction = window.prompt("ماذا تريد من الذكاء الاصطناعي أن يفعل؟ (مثال: أصلح الخطأ، أضف تعليقات)");

  if (!instruction) return; // الخروج إذا لم يكتب المستخدم شيئاً
  try {
    const res = await ipcRenderer.invoke('ask-ai-to-fix-selection', {
      text: selectedText,
      instruction: instruction, // إرسال التعليمات
      language: activeTab?.language || 'javascript'
    });
    if (res && res.success && res.fixedText) {
      editor.executeEdits("ai-assist", [{
        range: selection,
        text: res.fixedText,
        forceMoveMarkers: true
      }]);
    } else if (res && res.error) {
      alert("AI Error: " + res.error);
    }
  } catch (err) {
    console.error("IPC Error:", err);
  }
};
const handleDropInRoot = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  setDropTarget(null);

  if (!draggedItem) return;
  const res = await ipcRenderer.invoke('move-file', {
    sourcePath: draggedItem.path,
    targetDir: null 
  });
  if (res && res.success) {
    if (res.newPath) {
      setTabs(prev => prev.map(t => t.path === draggedItem.path ? { ...t, path: res.newPath } : t));
    }
    await refreshFileTree();
  }
  setDraggedItem(null);
};
  const refreshFileTree = async () => {
    if (currentFolderPath) {
      const res = await ipcRenderer.invoke('open-folder-at-path', currentFolderPath);
      if (res && res.success && res.files) {
        setFiles(res.files);
      }
    }
  };
  const handleCopyFile = async () => {
    if (!selectedPath) return;
    await ipcRenderer.invoke('copy-file', selectedPath);
  };
  const handleCutFile = async () => {
    if (!selectedPath) return;
    await ipcRenderer.invoke('cut-file', selectedPath);
  };
  const handlePasteFile = async () => {
    if (!currentFolderPath) return;
    let target = currentFolderPath;
    if (selectedPath) {
      const node = filesFindByPath(selectedPath);
      if (node && node.isDirectory) target = selectedPath;
      else {
        const parts = selectedPath.split(/[\\/]/);
        parts.pop();
        const parent = parts.join('/');
        if (parent) target = parent;
      }
    }
    const res = await ipcRenderer.invoke('paste-file', target);
    if (res && res.success) {
      await refreshFileTree();
    } else {
    }
  };
  const handleCheckFile = async () => {
    if (!selectedPath) return;
    const res = await ipcRenderer.invoke('check-file', selectedPath);
    if (res && res.success) {
      const info = res.info;
      alert(`File Information:     
Size: ${(info.size / 1024).toFixed(2)} KB
Lines: ${info.lines}
Created: ${new Date(info.created).toLocaleString()}
Modified: ${new Date(info.modified).toLocaleString()}
Type: ${info.isDirectory ? 'Directory' : 'File'}`);
    }
  };
  const handleOpenTerminal = async () => {
    const targetPath = selectedPath || currentFolderPath;
    if (!targetPath) return;
    await ipcRenderer.invoke('open-terminal', targetPath);
  };
  const startRename = () => {
    if (!selectedPath) return;
    setIsRenaming(true);
    setRenamePath(selectedPath);
    setRenameValue(selectedPath.split(/[\\/]/).pop());
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };
  const handleRenameSubmit = async () => {
    if (!renamePath || !renameValue) return;    
    const oldPath = renamePath;
    const parentDir = oldPath.split(/[\\/]/).slice(0, -1).join('/');
    const newPath = `${parentDir}/${renameValue}`;    
    const res = await ipcRenderer.invoke('rename-item', { oldPath, newPath });
    if (res && res.success) {
      setTabs(prev => prev.map(t => t.path === oldPath ? { ...t, path: newPath, name: renameValue } : t));
      await refreshFileTree();
      setIsRenaming(false);
      setRenamePath(null);
      setRenameValue('');
    } else {
     // alert("Error renaming: " + (res && res.error));
    }
  };
  const handleCreateFileSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newFileName || !currentFolderPath) return;
    const fullPath = `${currentFolderPath}/${newFileName}`;
    const res = await ipcRenderer.invoke('save-file', { filePath: fullPath, content: '' });   
    if (res && res.success) {
      setIsCreatingFile(false);
      setNewFileName('');
      await refreshFileTree();
      openFileInTab(newFileName, fullPath, '');
    } else {
    }
  };
  const handleCreateFolderSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newFolderName || !currentFolderPath) return;
    const res = await ipcRenderer.invoke('create-folder', { 
      parentPath: currentFolderPath, 
      folderName: newFolderName 
    });
    
    if (res && res.success) {
      setIsCreatingFolder(false);
      setNewFolderName('');
      await refreshFileTree();
    } else {
    }
  };
  const handleCreateProject = async () => {
    if (!projectName.trim()) {
    //  alert("Please enter a project name!");
      return;
    }
    setIsLoading(true);
    const res = await ipcRenderer.invoke('create-project', {
      type: projectType,
      name: projectName
    });
    setIsLoading(false);
    if (res && res.success) {
     // alert(`✅ Project created successfully!\nLocation: Desktop/${projectName}`);
      setShowProjectModal(false);
      setProjectName('');
      setProjectType(null);
    } else {
    }
  };
  const handleOpenFolder = async () => {
    const res = await ipcRenderer.invoke('open-folder');
    if (res) { 
      setFiles(res.files); 
      setCurrentFolderPath(res.path); 
    }
  };
  const openFileInTab = (name, path, content) => {
    const existing = tabsRef.current.find(t => t.path === path && path !== null);
    if (existing) { 
      setActiveTabId(existing.id); 
      return; 
    }
    const newTab = { 
      id: Date.now(), 
      name, 
      path, 
      content, 
      language: detectLanguage(name), 
      modified: false 
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };
  const handleFileClick = async (file) => {
    setSelectedPath(file.path);
    if (file.isDirectory) {
      setExpandedFolders(prev => ({ ...prev, [file.path]: !prev[file.path] }));
      return;
    }
    const res = await ipcRenderer.invoke('read-file', file.path);
    if (res && res.success) openFileInTab(file.name, file.path, res.content);
  };
  const handleContextMenu = (e, file) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPath(file.path);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file: file
    });
  };
  const createNewBlankTab = () => {
    const newTab = {
      id: Date.now(),
      name: 'Untitled',
      path: null,
      content: '',
      language: 'plaintext',
      modified: true
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };
  const handleSave = async (tabId) => {
  const idToSave = tabId || activeTabIdRef.current;
  const tabToSave = tabsRef.current.find(t => t.id === idToSave);
  
  if (!tabToSave) return;

  let contentToSave = tabToSave.content;
  if (idToSave === activeTabIdRef.current && editorRef.current) {
      contentToSave = editorRef.current.getValue();
  }

  if (tabToSave.path) {
    const res = await ipcRenderer.invoke('save-file', { filePath: tabToSave.path, content: contentToSave });
    
    if (res && res.success) {
      setTabs(prev => prev.map(t => t.id === idToSave ? { ...t, content: contentToSave, modified: false } : t));
      
      // --- إضافة رسالة التأكيد هنا ---
      setSaveMessage({ visible: true, text: `Saved: ${tabToSave.name}` });
      
      // إخفاء الرسالة بعد 2 ثانية
      setTimeout(() => {
        setSaveMessage({ visible: false, text: '' });
      }, 2000);
      // ----------------------------
    }
  }
};
  const handleSaveAs = async () => {
    const currentTabs = tabsRef.current;
    const currentActiveId = activeTabIdRef.current;
    const tabToSave = currentTabs.find(t => t.id === currentActiveId);
    if (!tabToSave) return;
    const res = await ipcRenderer.invoke('save-file-as', tabToSave.content);
    if (res && res.success) {
      setTabs(prev => prev.map(t => t.id === currentActiveId ? {
        ...t, name: res.name, path: res.path, modified: false, language: detectLanguage(res.name)
      } : t));
      await refreshFileTree();
    }
  };
  const detectLanguage = (name) => {
    if (!name) return 'plaintext';
    const ext = name.split('.').pop();
    const map = { 
      js: 'javascript', py: 'python', html: 'html', css: 'css', 
      ts: 'typescript', json: 'json', md: 'markdown', jsx: 'javascript',
      cpp: 'cpp', c: 'c', java: 'java', php: 'php', rb: 'ruby',
      go: 'go', rs: 'rust', swift: 'swift', kt: 'kotlin'
    };
    return map[ext] || 'plaintext';
  };
  const switchTab = (direction) => {
    const currentTabs = tabsRef.current;
    if (currentTabs.length < 2) return;
    const currentIndex = currentTabs.findIndex(t => t.id === activeTabIdRef.current);
    let newIndex = (currentIndex + direction + currentTabs.length) % currentTabs.length;
    setActiveTabId(currentTabs[newIndex].id);
  };
  const closeAllTabs = () => {
    if (window.confirm("Close all tabs?")) { setTabs([]); setActiveTabId(null); }
  };
  useEffect(() => {
    const handleRefresh = () => refreshFileTree();
    ipcRenderer.on('refresh-tree', handleRefresh);
    return () => ipcRenderer.removeListener('refresh-tree', handleRefresh);
  }, [currentFolderPath]);
useEffect(() => {
  const electron = window.require('electron');
  const { ipcRenderer } = electron;
  const handleAltA = () => {
    if (!currentFolderPath) return;
    setIsCreatingFile(true);
    setTimeout(() => {
      if (fileNameInputRef.current) fileNameInputRef.current.focus();
    }, 100);
  };
  const handleAltZ = () => {
    if (!currentFolderPath) return;
    setIsCreatingFolder(true);
    setTimeout(() => {
      if (folderNameInputRef.current) folderNameInputRef.current.focus();
    }, 100);
  };
  ipcRenderer.on('command-add-file', handleAltA);
  ipcRenderer.on('command-add-folder', handleAltZ);
  return () => {
    ipcRenderer.removeAllListeners('command-add-file');
    ipcRenderer.removeAllListeners('command-add-folder');
  };
}, [currentFolderPath, setIsCreatingFile, setIsCreatingFolder]); // أضف الاعتمادات اللازمة
  useEffect(() => {
  ipcRenderer.on('export-project-trigger', handleExportZip);
  return () => {
    ipcRenderer.removeAllListeners('export-project-trigger');
  };
}, [currentFolderPath]);
useEffect(() => {
  const handleIpcToggle = () => {
    setIsChatVisible(prev => !prev);
  };
  ipcRenderer.on('toggle-ai-chat', handleIpcToggle);
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      setIsChatVisible(prev => !prev);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    ipcRenderer.removeListener('toggle-ai-chat', handleIpcToggle);
    window.removeEventListener('keydown', handleKeyDown);
  };
}, []);
  useEffect(() => {
    const handleFsEvent = (event, payload) => {
      if (!payload || !payload.event) return;
      const ev = payload.event;
      const p = payload.path;
      if (ev === 'unlink' || ev === 'unlinkDir' || ev === 'deleted' || ev === 'missing') {
        setTabs(prev => {
          const remaining = prev.filter(tab => {
            if (!tab.path) return true;
            if (tab.path === p) return false;
            if (p && tab.path.startsWith(p + pathSeparator())) return false;
            return true;
          });
          if (remaining.length > 0 && !remaining.find(t => t.id === activeTabIdRef.current)) {
            setActiveTabId(remaining[0].id);
          } else if (remaining.length === 0) {
            setActiveTabId(null);
          }
          return remaining;
        });
        refreshFileTree();
        return;
      }
      refreshFileTree();
    };
    ipcRenderer.on('fs-event', handleFsEvent);
    return () => ipcRenderer.removeListener('fs-event', handleFsEvent);
  }, [files, currentFolderPath]);

  useEffect(() => {
    const handleShortcutNewFile = () => {
      if (!currentFolderPath) {
       // alert("Please open a project folder first!");
        return;
      }
      setIsCreatingFile(true);
      setTimeout(() => fileNameInputRef.current?.focus(), 50);
    };
	ipcRenderer.on('refresh-tree', refreshFileTree);
    ipcRenderer.on('new-file-trigger', handleShortcutNewFile);
    ipcRenderer.on('new-blank-tab', createNewBlankTab);
    ipcRenderer.on('save-trigger', () => handleSave());
    ipcRenderer.on('save-as-trigger', handleSaveAs);
    ipcRenderer.on('copy-file-trigger', handleCopyFile);
    ipcRenderer.on('paste-file-trigger', handlePasteFile);
    ipcRenderer.on('delete-file-trigger', () => handleDeleteItem(selectedPathRef.current));
    ipcRenderer.on('open-terminal-trigger', handleOpenTerminal);
    ipcRenderer.on('toggle-sidebar', () => setSidebarVisible(prev => !prev));
    ipcRenderer.on('new-project-trigger', () => setShowProjectModal(true));    
    ipcRenderer.on('folder-opened', (event, data) => {
      setFiles(data.files || []);
      setCurrentFolderPath(data.path || null);
      setSelectedPath(null);
    });    
    ipcRenderer.on('close-tab', () => {
      const currentActiveId = activeTabIdRef.current;
      if (currentActiveId) {
        setTabs(prev => {
          const newTabs = prev.filter(t => t.id !== currentActiveId);
          if (newTabs.length > 0) setActiveTabId(newTabs[0].id);
          else setActiveTabId(null);
          return newTabs;
        });
      }
    });    
    ipcRenderer.on('next-tab', () => switchTab(1));
    ipcRenderer.on('prev-tab', () => switchTab(-1));

    return () => {
      ipcRenderer.removeAllListeners('new-file-trigger');
      ipcRenderer.removeAllListeners('new-blank-tab');
      ipcRenderer.removeAllListeners('save-trigger');
      ipcRenderer.removeAllListeners('save-as-trigger');
      ipcRenderer.removeAllListeners('copy-file-trigger');
      ipcRenderer.removeAllListeners('paste-file-trigger');
      ipcRenderer.removeAllListeners('delete-file-trigger');
      ipcRenderer.removeAllListeners('open-terminal-trigger');
      ipcRenderer.removeAllListeners('toggle-sidebar');
      ipcRenderer.removeAllListeners('new-project-trigger');
      ipcRenderer.removeAllListeners('folder-opened');
      ipcRenderer.removeAllListeners('close-tab');
      ipcRenderer.removeAllListeners('next-tab');
      ipcRenderer.removeAllListeners('prev-tab');
    };
  }, [currentFolderPath]);
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Delete' && selectedPathRef.current && !isRenaming) {
        handleDeleteItem(selectedPathRef.current);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isRenaming]);

  return (
    <div className="app-main">
      <TitleBar isChatVisible={isChatVisible} setIsChatVisible={setIsChatVisible} />
		<MenuBar handleExportZip={handleExportZip} />
      <div className="content-wrapper">
        {sidebarVisible && (
          <Sidebar
            files={files}
            currentFolderPath={currentFolderPath}
            isCreatingFile={isCreatingFile}
            isCreatingFolder={isCreatingFolder}
            newFileName={newFileName}
            newFolderName={newFolderName}
            isRenaming={isRenaming}
            renamePath={renamePath}
            renameValue={renameValue}
            activeTab={activeTab}
            selectedPath={selectedPath}
            expandedFolders={expandedFolders}
            dropTarget={dropTarget}
            fileNameInputRef={fileNameInputRef}
            folderNameInputRef={folderNameInputRef}
            renameInputRef={renameInputRef}
            setIsCreatingFile={setIsCreatingFile}
            setIsCreatingFolder={setIsCreatingFolder}
            setNewFileName={setNewFileName}
            setNewFolderName={setNewFolderName}
            setRenameValue={setRenameValue}
            setIsRenaming={setIsRenaming}
            setRenamePath={setRenamePath}
            handleCreateFileSubmit={handleCreateFileSubmit}
            handleCreateFolderSubmit={handleCreateFolderSubmit}
            handleRenameSubmit={handleRenameSubmit}
            handleOpenFolder={handleOpenFolder}
            createNewBlankTab={createNewBlankTab}
            setShowProjectModal={setShowProjectModal}
            onFileClick={handleFileClick}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        )}

        <EditorContainer
          tabs={tabs}
          activeTabId={activeTabId}
          activeTab={activeTab}
          editorRef={editorRef}
          setActiveTabId={setActiveTabId}
          setTabs={setTabs}
          closeAllTabs={closeAllTabs}
        />
		{/* استبدل كود النافذة بهذا السطر والشرط */}
{isChatVisible && (
		<div className="ai-sidebar-fixed" style={{ 
    width: '320px', 
    minWidth: '240px', // اجعلها ثابتة لمنع المشاكل
    maxWidth: '240px', 
    height: '100%', 
    borderLeft: '1px solid var(--border)', 
    backgroundColor: 'var(--bg-dark)', 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden',
    zIndex: 1000 
  }}>
    {/* شريط التحكم العلوي */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 15px',
      background: '#1a1a1b',
      borderBottom: '1px solid var(--border)'
    }}>
      <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 'bold', letterSpacing: '1px' }}>AI Assist</span>
      <button 
        onClick={() => setIsChatVisible(false)} // الزر هنا سيقوم بالإخفاء الآن
        style={{
          background: 'none',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '2px 6px',
          borderRadius: '4px'
        }}
      >
        ✕
      </button>
    </div>
	
    <ChatComponent />
  </div>
)}}

      {/* رسالة تأكيد الحفظ العائمة (تظهر هنا لتكون فوق المحتوى) */}
      {saveMessage.visible && (
        <div className={`save-notification ${saveMessage.type === 'error' ? 'error' : ''}`}>
          <span className="save-icon">
            {saveMessage.type === 'error' ? '✕' : '✓'}
          </span>
          <div className="save-text-container">
            <span className="save-status">
              {saveMessage.type === 'error' ? 'Save Failed' : 'Saved Successfully'}
            </span>
            <span className="save-filename">{saveMessage.text}</span>
          </div>
        </div>
      )}

    </div> {/* إغلاق content-wrapper */}

    {/* 1. شريط تقدم التصدير */}
    {isExporting && (
        <div className="export-progress-container">
          <div className="progress-header">
            <span>Exporting Project to ZIP...</span>
            <span>{exportProgress}%</span>
          </div>
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${exportProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      {/* 2. نافذة البحث الشامل (Global Search) */}
      {isSearchOpen && (
  <div className="search-overlay" onClick={() => setIsSearchOpen(false)}>
    <div className="search-container" onClick={(e) => e.stopPropagation()}>
      <div className="search-header">
        <input 
          autoFocus 
          className="search-input"
          placeholder="Search in all files..." 
          onChange={(e) => {
             setSearchTerm(e.target.value);
             handleGlobalSearch(e.target.value);
          }}
        />
        <button className="close-search-btn" onClick={() => setIsSearchOpen(false)}>×</button>
      </div>
      <div className="search-results">
        {searchResults && searchResults.length > 0 ? (
          searchResults.map((result, index) => (
            <div key={index} className="search-result-item" onClick={async () => {
              // 1. تجهيز كائن الملف
              const fileToOpen = {
                path: result.path,
                name: result.fileName,
                type: 'file'
              };
              if (typeof handleFileClick === 'function') {
                await handleFileClick(fileToOpen);
              } else if (typeof openFile === 'function') {
                await openFile(result.path);
              }
              // 3. --- تحديث القائمة الجانبية (Sidebar) لتحديد الملف وفتح مجلداته ---
              if (typeof setSelectedPath === 'function') {
                setSelectedPath(result.path); // تحديد الملف بلون الـ Active
              }
              if (typeof setExpandedFolders === 'function') {
                const pathParts = result.path.split(/[\\/]/);
                let currentPath = "";
                const newExpanded = { ...expandedFolders };
                for (let i = 0; i < pathParts.length - 1; i++) {
                  if (i === 0 && result.path.startsWith('/')) {
                    currentPath = "/" + pathParts[i];
                  } else {
                    // استخدام الفاصل المناسب للنظام
                    const separator = result.path.includes('\\') ? '\\' : '/';
                    currentPath = currentPath ? `${currentPath}${separator}${pathParts[i]}` : pathParts[i];
                  }
                  newExpanded[currentPath] = true;
                }
                setExpandedFolders(newExpanded); // تطبيق فتح المجلدات
              }
              setIsSearchOpen(false);
              setTimeout(() => {
                if (editorRef.current) {
                  const model = editorRef.current.getModel();
                  const matches = model.findMatches(searchTerm); 
                  if (matches.length > 0) {
                    editorRef.current.revealRangeInCenter(matches[0].range);
                    editorRef.current.setSelection(matches[0].range);
                    editorRef.current.focus();
                  }
                }
              }, 400);
            }}>
              <div className="search-result-title">
                <span className="file-icon">📁</span>
                <span className="file-name">{result.fileName}</span>
              </div>
              <div className="search-result-preview">...{result.preview}...</div>
            </div>
          ))
        ) : (
          <div className="no-results-text">No matches found</div>
        )}
      </div>
    </div>
  </div>
)}
      {/* 3. القائمة اليمينية */}
      {contextMenu && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-item" onClick={() => { handleCopyFile(); setContextMenu(null); }}>
            <Copy size={14} /> Copy
          </div>
          <div className="context-item" onClick={() => { handleCutFile(); setContextMenu(null); }}>
            <Scissors size={14} /> Cut
          </div>
          <div className="context-item" onClick={() => { handlePasteFile(); setContextMenu(null); }}>
            <Clipboard size={14} /> Paste
          </div>
          <div className="context-separator"></div>
          <div className="context-item" onClick={() => { startRename(); setContextMenu(null); }}>
            <Edit3 size={14} /> Rename
          </div>
          <div className="context-item" onClick={() => { handleDeleteItem(contextMenu.file.path); setContextMenu(null); }}>
            <Trash2 size={14} /> Delete
          </div>
          <div className="context-separator"></div>
          <div className="context-item" onClick={() => { handleCheckFile(); setContextMenu(null); }}>
            <Info size={14} /> Properties
          </div>
          <div className="context-item" onClick={() => { handleOpenTerminal(); setContextMenu(null); }}>
            <Terminal size={14} /> Open Terminal Here
          </div>
        </div>
      )}
      {/* 4. مودال إنشاء المشروع */}
      <ProjectModal
        showProjectModal={showProjectModal}
        isLoading={isLoading}
        projectType={projectType}
        projectName={projectName}
        setProjectType={setProjectType}
        setProjectName={setProjectName}
        setShowProjectModal={setShowProjectModal}
        handleCreateProject={handleCreateProject}
      />
    </div>
  );
}