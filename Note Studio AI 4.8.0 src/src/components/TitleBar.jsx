import React from 'react';
import { Minimize2, Square, X, Bot, Sparkles } from 'lucide-react'; 
import logo from '../assets/logo.png'; 

const { ipcRenderer } = window.require('electron');

export default function TitleBar({ isChatVisible, setIsChatVisible }) {
  return (
    <div className="custom-title-bar" style={styles.container}>
      
      {/* جهة الشعار واسم البرنامج */}
      <div className="brand-zone" style={styles.brandZone}>
        <img 
          src={logo} 
          alt="Logo" 
          style={styles.logo} 
        />
        <span style={styles.brandName}>Note Studio</span>
      </div>
      
      {/* جهة الأزرار والتحكم */}
      <div className="window-actions" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        
        {/* زر مساعد الذكاء الاصطناعي المطور */}
        <button 
          onClick={() => setIsChatVisible(!isChatVisible)}
          style={{
            ...styles.aiToggle,
            background: isChatVisible ? 'rgba(46, 160, 67, 0.15)' : 'transparent',
            color: isChatVisible ? '#2ea043' : '#777',
            border: isChatVisible ? '1px solid rgba(46, 160, 67, 0.3)' : '1px solid transparent',
          }}
        >
          {isChatVisible ? <Sparkles size={14} /> : <Bot size={14} />}
          <span style={{ marginLeft: '6px' }}>{isChatVisible ? 'AI Active' : 'AI Assistant'}</span>
        </button>

        {/* أزرار التحكم في النافذة (Windows Controls) */}
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag', height: '100%' }}>
          <button 
            className="title-btn"
            onClick={() => ipcRenderer.send('minimize-window')}
            style={styles.windowBtn}
          >
            <Minimize2 size={12}/>
          </button>
          <button 
            className="title-btn"
            onClick={() => ipcRenderer.send('maximize-window')}
            style={styles.windowBtn}
          >
            <Square size={12}/>
          </button>
          <button 
            className="title-btn close-btn-hover" 
            onClick={() => ipcRenderer.send('close-window')}
            style={{...styles.windowBtn, padding: '0 15px'}}
          >
            <X size={14}/>
          </button>
        </div>
      </div>

      <style>{`
        .title-btn {
          background: transparent;
          border: none;
          color: #666;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.2s;
          -webkit-app-region: no-drag;
        }
        .title-btn:hover {
          background: #1c1c1e;
          color: #fff;
        }
        .close-btn-hover:hover {
          background: #e81123 !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    height: '35px',
    background: '#111112', // اللون المستهدف
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 0 0 12px',
    WebkitAppRegion: 'drag',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    userSelect: 'none'
  },
  brandZone: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logo: {
    width: '16px', 
    height: '16px', 
    objectFit: 'contain',
    filter: 'brightness(0.9)'
  },
  brandName: {
    fontWeight: '700', 
    fontSize: '11px', 
    color: '#555',
    letterSpacing: '0.8px',
    textTransform: 'uppercase'
  },
  aiToggle: {
    WebkitAppRegion: 'no-drag',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    padding: '4px 12px',
    marginRight: '12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    transition: 'all 0.3s ease'
  },
  windowBtn: {
    height: '35px',
    width: '45px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};