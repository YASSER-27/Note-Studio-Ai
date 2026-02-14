import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { X, Sparkles, Send, Loader2, FileCode, Plus, FolderOpen, Terminal, CheckCircle2 } from 'lucide-react';

const { ipcRenderer } = window.require('electron');

export default function EditorContainer({
  tabs, activeTabId, activeTab, editorRef, setActiveTabId, setTabs
}) {
  const containerRef = useRef(null);
  const monacoEditorRef = useRef(null);
  
  const [showAiInput, setShowAiInput] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [currentSelection, setCurrentSelection] = useState(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showSavedHint, setShowSavedHint] = useState(false);

  // حالة الـ Status Bar
  const [cursorPos, setCursorPos] = useState({ ln: 1, col: 1 });

  // --- 1. تعريف الثيم ---
  useEffect(() => {
    monaco.editor.defineTheme('note-studio-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'identifier', foreground: '50fa7b' },
      ],
      colors: {
        'editor.background': '#111112',
        'editor.lineHighlightBackground': '#1a1a1c',
        'editorLineNumber.foreground': '#454545',
        'editorBracketMatch.background': '#2ea04333',
        'editorBracketMatch.border': '#2ea043',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#2ea043',
      }
    });
  }, []);

  const closeTab = (e, tabId) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
    }
  };

  const executeAiEdit = async () => {
    if (!instruction.trim()) return;
    const editor = monacoEditorRef.current;
    if (!editor) return;
    
    const model = editor.getModel();
    const selection = currentSelection || editor.getSelection();
    const selectedText = model.getValueInRange(selection);
    
    setIsAiProcessing(true);
    try {
      const res = await ipcRenderer.invoke('ask-ai-to-fix-selection', {
        text: selectedText,
        instruction: instruction,
        language: activeTab?.language || 'javascript'
      });

      if (res && res.success && res.fixedText) {
        editor.executeEdits("ai-assist", [{
          range: selection,
          text: res.fixedText,
          forceMoveMarkers: true
        }]);
        editor.revealRangeInCenter(selection);
      }
    } catch (err) {
      console.error("AI Error:", err);
    } finally {
      setIsAiProcessing(false);
      setShowAiInput(false);
      setInstruction("");
      editor.focus();
    }
  };

  // إنشاء المحرر واختصارات لوحة المفاتيح
  useEffect(() => {
    if (!containerRef.current || tabs.length === 0) return;

    const editor = monaco.editor.create(containerRef.current, {
      value: activeTab?.content || "",
      language: activeTab?.language || 'javascript',
      theme: 'note-studio-theme',
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'Fira Code', monospace",
      cursorSmoothCaretAnimation: "on",
      smoothScrolling: true,
      padding: { top: 10 },
      scrollBeyondLastLine: false,
      // Minimap "Clean" التنسيق النظيف
      minimap: { 
        enabled: true, 
        renderCharacters: false, 
        maxColumn: 200,
        showSlider: 'mouseover' 
      },
    });

    monacoEditorRef.current = editor;
    if (editorRef) editorRef.current = editor;

    // تحديث مكان المؤشر في الـ StatusBar
    editor.onDidChangeCursorPosition((e) => {
        setCursorPos({ ln: e.position.lineNumber, col: e.position.column });
    });

    // نظام الـ Dirty Files: عند التغيير تظهر النقطة الخضراء
    editor.onDidChangeModelContent(() => {
        setTabs(prev => prev.map(t => 
            t.id === activeTabId ? { ...t, isDirty: true } : t
        ));
    });

    // نظام الـ Save: عند الضغط على Ctrl+S تختفي النقطة ويظهر إشعار
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        setTabs(prev => prev.map(t => 
            t.id === activeTabId ? { ...t, isDirty: false } : t
        ));
        setShowSavedHint(true);
        setTimeout(() => setShowSavedHint(false), 2000);
    });

    // إضافة اختصار F1 لفتح نافذة AI
    editor.addCommand(monaco.KeyCode.F1, () => {
      const selection = editor.getSelection();
      setCurrentSelection(selection);
      setShowAiInput(true);
    });

    // --- بقاء الأكشن في قائمة الماوس اليمين ---
    editor.addAction({
      id: 'ai-assist-prompt',
      label: 'AI Assist: Edit or Generate',
      contextMenuGroupId: 'navigation',
      run: (ed) => {
        setCurrentSelection(ed.getSelection());
        setShowAiInput(true);
      }
    });

    return () => editor.dispose();
  }, [tabs.length === 0]); 

  // تحديث الموديل عند تغيير التبويب
  useEffect(() => {
    if (monacoEditorRef.current && activeTab) {
      const uri = monaco.Uri.parse(`file:///${activeTab.path?.replace(/\\/g, '/') || activeTab.id}`);
      let model = monaco.editor.getModel(uri);
      if (!model) {
        model = monaco.editor.createModel(activeTab.content || "", activeTab.language, uri);
      } else {
        monaco.editor.setModelLanguage(model, activeTab.language || 'javascript');
      }
      monacoEditorRef.current.setModel(model);
    }
  }, [activeTabId, activeTab]);

  return (
    <main className="editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111112', overflow: 'hidden', position: 'relative' }}>
      
      {tabs.length > 0 && (
        <div className="tabs-header" style={{ display: 'flex', background: '#111112', height: '38px', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div className="tabs-wrapper-scroll" style={{ display: 'flex', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {tabs.map(tab => (
              <div 
                key={tab.id} 
                onClick={() => setActiveTabId(tab.id)} 
                className={`tab-item ${activeTabId === tab.id ? 'active' : ''}`}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', minWidth: '130px', maxWidth: '220px', height: '100%',
                  color: activeTabId === tab.id ? '#fff' : '#666', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.03)',
                  borderBottom: activeTabId === tab.id ? '2px solid #2ea043' : '2px solid transparent', fontSize: '12px', transition: '0.15s', whiteSpace: 'nowrap'
                }}
              >
                <FileCode size={14} color={activeTabId === tab.id ? "#2ea043" : "#555"} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.name}</span>
                
                {/* أيقونة الإغلاق أو النقطة الخضراء (Dirty System) */}
                <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }} onClick={(e) => closeTab(e, tab.id)}>
                    {tab.isDirty ? (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ea043' }} title="Unsaved Changes" />
                    ) : (
                        <X size={14} className="tab-close-icon" style={{ opacity: activeTabId === tab.id ? 0.6 : 0 }} />
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {tabs.length > 0 ? (
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        ) : (
            <div className="welcome-screen" style={{ textAlign: 'center', color: '#444', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: '#1a1a1c', padding: '20px', borderRadius: '50%', marginBottom: '20px', border: '1px solid #2d2d2d' }}>
                <Terminal size={48} color="#2ea043" strokeWidth={1.5} />
            </div>
            <h2 style={{ color: '#eee', marginBottom: '8px', fontSize: '24px', letterSpacing: '-0.5px' }}>Note Studio</h2>
            <p style={{ fontSize: '14px', marginBottom: '30px', opacity: 0.7 }}>ابدأ مشروعاً جديداً أو افتح ملفاً للبدء</p>
            
            <div style={{ display: 'grid', gap: '10px', width: '280px', marginBottom: '40px' }}>
                <div style={welcomeItemStyle}><Plus size={16}/> New File <span style={keyStyle}>Ctrl+N</span></div>
                <div style={welcomeItemStyle}><FolderOpen size={16}/> Open Folder <span style={keyStyle}>Ctrl+O</span></div>
                <div style={welcomeItemStyle}><Sparkles size={16}/> AI Command <span style={keyStyle}>F1</span></div>
            </div>

            <div style={{ 
                fontSize: '11px', 
                color: '#333', 
                letterSpacing: '2px', 
                fontWeight: 'bold',
                textTransform: 'uppercase',
                borderTop: '1px solid #1a1a1c',
                paddingTop: '15px'
            }}>
                YASSER 27 ON GITHUB
            </div>
            </div>
        )}

        {/* تصميم الـ AI المحسن بـ backdropFilter */}
        {showAiInput && (
          <div style={{
            position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
            width: '450px', 
            background: 'rgba(28, 28, 30, 0.8)', 
            backdropFilter: 'blur(10px)', 
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 1000, padding: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ea043', fontSize: '11px', fontWeight: 'bold' }}>
                <Sparkles size={14} /> AI GENERATOR / EDITOR
              </div>
              <X size={14} color="#666" style={{cursor: 'pointer'}} onClick={() => setShowAiInput(false)} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                   if(e.key === 'Enter') executeAiEdit();
                   if(e.key === 'Escape') setShowAiInput(false);
                }}
                placeholder="Ask AI to write code or fix it..."
                style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid #333', color: 'white', padding: '8px 12px', borderRadius: '6px', outline: 'none' }}
              />
              <button 
                onClick={executeAiEdit} 
                style={{ background: '#2ea043', border: 'none', color: 'white', width: '40px', borderRadius: '6px', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              >
                {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* إشعار الحفظ المؤقت */}
        {showSavedHint && (
            <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: '#2ea043', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2000 }}>
                <CheckCircle2 size={14} /> All changes saved!
            </div>
        )}
      </div>

      {/* StatusBar التفاعلي */}
      <div className="status-bar" style={{
          height: '24px', background: '#0e0e0e', borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px',
          fontSize: '11px', color: '#666', userSelect: 'none'
      }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <span style={{ color: '#2ea043', fontWeight: 'bold' }}>YASSER 27</span>
              <span>Ln {cursorPos.ln}, Col {cursorPos.col}</span>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <span style={{ textTransform: 'uppercase' }}>{activeTab?.language || 'Plain Text'}</span>
              <span>UTF-8</span>
          </div>
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .tab-item:hover .tab-close-icon { opacity: 1 !important; }
        .tab-close-icon:hover { background: #e81123 !important; color: white !important; }
        .tabs-wrapper-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}

const welcomeItemStyle = {
  display: 'flex', alignItems: 'center', gap: '12px', background: '#1a1a1c', padding: '10px 15px', borderRadius: '8px', fontSize: '13px', color: '#aaa', border: '1px solid #262628', cursor: 'default'
};

const keyStyle = {
  marginLeft: 'auto', fontSize: '10px', background: '#2d2d2d', padding: '2px 6px', borderRadius: '4px', color: '#2ea043', fontWeight: 'bold'
};