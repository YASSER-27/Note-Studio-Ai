import React, { useState, useEffect, useRef } from 'react';
import { Logic } from './utils/logic';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const { ipcRenderer } = window.require('electron');

const ChatComponent = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // تعديل ارتفاع الـ textarea تلقائياً
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // استقبال التوقف من العملية الرئيسية
  useEffect(() => {
    const handleForceStop = () => setIsLoading(false);
    ipcRenderer.on('ai:stopped-completely', handleForceStop);
    return () => ipcRenderer.removeListener('ai:stopped-completely', handleForceStop);
  }, []);

  // استقبال النصوص (Tokens) من الذكاء الاصطناعي
  useEffect(() => {
    const handleToken = (event, token) => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'ai') {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            ...lastMsg,
            content: lastMsg.content + token,
          };
          return newMessages;
        }
        return [...prev, { role: 'ai', content: token }];
      });
    };

    ipcRenderer.on('ai:token', handleToken);
    return () => ipcRenderer.removeListener('ai:token', handleToken);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input;
    setInput('');
    setIsLoading(true);

    const newMessages = [...messages, { role: 'user', content: userQuery }];
    setMessages(newMessages);

    // تنسيق الـ Prompt باستخدام Logic.js
    const formattedPrompt = Logic.getFormattedPrompt(
      newMessages.map(m => ({ role: m.role, text: m.content })), 
      "qwen" 
    );

    try {
      await ipcRenderer.invoke('ai:chat', { 
        prompt: formattedPrompt,
        params: Logic.defaultParams 
      });
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "⚠️ " + error.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    ipcRenderer.send('ai:stop');
    setIsLoading(false);
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the conversation?")) {
      setMessages([]);
      if (isLoading) handleStop();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // مكون مخصص لعرض كتل البرمجة مع زر نسخ
  const CodeBlock = ({ language, value }) => {
    const [copied, setCopied] = useState(false);
    const copyToClipboard = () => {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div style={{ position: 'relative', margin: '12px 0' }}>
        <button onClick={copyToClipboard} style={styles.codeCopyBtn}>
          {copied ? '✔️' : '📋'}
        </button>
        <SyntaxHighlighter
          language={language || 'javascript'}
          style={vscDarkPlus}
          customStyle={{ borderRadius: '8px', padding: '15px', fontSize: '13px', border: '1px solid #333' }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.statusDot}></div>
        <span style={styles.headerTitle}>AI CHAT</span>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {messages.length > 0 && (
            <button onClick={handleClearChat} style={styles.clearBtn}>🗑️ Clear</button>
          )}
          {isLoading && <span style={styles.loadingPulse}>Thinking...</span>}
        </div>
      </div>
      
      <div style={styles.messagesArea}>
        {messages.length === 0 && (
          <div style={styles.emptyContainer}>
            <div style={styles.emptyIcon}>💬</div>
            <p>Ready to help with your code.</p>
            <small style={{color: '#555'}}>Shift+Enter for new line.</small>
          </div>
        )}
        
        {messages.map((msg, i) => {
          const { thinking, content } = msg.role === 'ai' 
            ? Logic.parseResponse(msg.content) 
            : { thinking: null, content: msg.content };

          return (
            <div key={i} style={{ 
              ...styles.messageRow, 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' 
            }}>
              <div style={{ 
                ...styles.messageBubble, 
                backgroundColor: '#2d2d30',
                borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                maxWidth: msg.role === 'ai' ? '90%' : '80%'
              }}>
                
                {thinking && (
                  <div style={styles.thinkingContainer}>
                    <div style={styles.thinkingTitle}>💭 Thought Process</div>
                    <div style={styles.thinkingContent}>{thinking}</div>
                  </div>
                )}

                <div style={styles.content}>
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} />
                        ) : (
                          <code className={className} {...props} style={styles.inlineCode}>{children}</code>
                        );
                      }
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
                
                {msg.role === 'ai' && (
                  <div style={styles.bubbleFooter}>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(content);
                        setCopiedIndex(i);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }} 
                      style={styles.actionLink}
                    >
                      {copiedIndex === i ? '✔️ Copied' : '🔸 Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <div style={styles.inputContainer}>
          <textarea
            ref={textareaRef}
            rows="1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            style={styles.textarea}
          />
          
          <div style={styles.buttonGroup}>
            {isLoading ? (
              <button onClick={handleStop} style={styles.stopBtn}>🔸</button>
            ) : (
              <button 
                onClick={handleSend} 
                disabled={!input.trim()} 
                style={{...styles.sendBtn, opacity: !input.trim() ? 0.3 : 1}}
              >
                🔸
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { 
    display: 'flex', 
    flexDirection: 'column', 
    height: '100%', 
    background: '#111112', 
    color: '#ccc',
    zoom: '0.79' // تصغير بسيط لواجهة التطبيق ككل
  },
  header: { padding: '10px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', background: '#111112' },
  statusDot: { width: '8px', height: '8px', background: '#4caf50', borderRadius: '50%', marginRight: '8px' },
  headerTitle: { fontSize: '11px', fontWeight: '800', color: '#888', letterSpacing: '1px' },
  clearBtn: { background: 'transparent', border: '1px solid #333', color: '#888', fontSize: '12px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' },
  loadingPulse: { fontSize: '10px', color: '#0078d4' },
  
  messagesArea: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '1px 5px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '20px' 
  },
  messageRow: { display: 'flex', width: '100%' },
  
  messageBubble: { 
    // تم تغيير maxWidth ليعطي مساحة أكبر للأكواد
    maxWidth: '92%', 
    minWidth: '100px',
    padding: '12px 16px', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    overflow: 'hidden' // لمنع خروج الكود عن الفقاعة
  },
  
  content: { 
    fontSize: '15px', // تصغير الخط الأساسي
    lineHeight: '2', 
    color: '#e0e0e0',
    wordBreak: 'break-word' 
  },
  
  inlineCode: { 
    background: '#333', 
    padding: '2px 5px', 
    borderRadius: '4px', 
    fontFamily: 'monospace',
    fontSize: '1.5px' 
  },
  
  codeCopyBtn: { 
    position: 'absolute', 
    top: '9px', 
    right: '8px', 
    zIndex: 10, 
    background: 'rgba(60, 60, 60, 0.8)', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '4px', 
    padding: '4px 8px', 
    cursor: 'pointer', 
    fontSize: '11px',
    backdropFilter: 'blur(4px)'
  },
  
  thinkingContainer: { 
    background: 'rgba(0,0,0,0.2)', 
    padding: '10px', 
    borderRadius: '8px', 
    marginBottom: '10px', 
    borderLeft: '2px solid #555' 
  },
  thinkingTitle: { fontSize: '10px', color: '#666', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' },
  thinkingContent: { fontSize: '11.5px', color: '#888', fontStyle: 'italic' },

  bubbleFooter: { marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '5px' },
  actionLink: { background: 'transparent', border: 'none', color: '#777', fontSize: '10px', cursor: 'pointer' },
  
  inputArea: { padding: '15px', background: '#1e1e1e', borderTop: '1px solid #2d2d2d' },
  inputContainer: { 
    display: 'flex', 
    alignItems: 'flex-end', 
    background: '#252526', 
    borderRadius: '12px', // جعل الزوايا أقل حدة لتناسب الخط الأصغر
    padding: '10px', 
    border: '1px solid #333' 
  },
  textarea: { 
    flex: 1, 
    background: 'transparent', 
    border: 'none', 
    color: '#fff', 
    resize: 'none', 
    outline: 'none', 
    fontSize: '13px', 
    maxHeight: '150px' 
  },
  
  sendBtn: { background: '#111112', color: 'white', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', marginLeft: '10px', fontSize: '14px' },
  stopBtn: { background: '#111112', color: '#ff8888', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', marginLeft: '10px' },
  
  emptyContainer: { textAlign: 'center', marginTop: '60px', color: '#444' },
  emptyIcon: { fontSize: '40px', marginBottom: '10px', opacity: 0.5 }
};

export default ChatComponent;