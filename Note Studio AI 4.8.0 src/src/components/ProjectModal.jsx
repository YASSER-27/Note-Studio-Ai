import React from 'react';
import { Monitor, Box, Loader, FileCode, X, Smartphone, FileText, Terminal } from 'lucide-react'; 

export default function ProjectModal({
  showProjectModal,
  isLoading,
  projectType,
  projectName,
  setProjectType,
  setProjectName,
  setShowProjectModal,
  handleCreateProject
}) {
  
  if (!showProjectModal) return null;

  const closeAll = () => {
    setProjectType(null);
    setProjectName('');
    setShowProjectModal(false);
  };

  const projectOptions = [
    { id: 'basic_txt', label: 'Basic TXT', icon: <FileText size={32} color="#4fc3f7" />, desc: 'Simple Text' },
    { id: 'basic', label: 'HTML Web', icon: <FileCode size={32} color="#4caf50" />, desc: 'Modern Web' },
    { id: 'android', label: 'Android', icon: <Smartphone size={32} color="#a4c639" />, desc: 'Mobile App' },
    { id: 'electron', label: 'Electron', icon: <Monitor size={32} color="#90caf9" />, desc: 'Desktop UI' },
    { id: 'python', label: 'Python Pro', icon: <Box size={32} color="#ffd54f" />, desc: 'Automation' },
    { id: 'api_service', label: 'Backend', icon: <Terminal size={32} color="#ff8a65" />, desc: 'Node.js API' },
  ];

  return (
    <div className="modal-overlay" style={styles.overlay}>
      <div className="modal-content" style={styles.modal}>
        
        {/* Header Section */}
        <div style={styles.header}>
          <h3 style={styles.title}>NEW PROJECT</h3>
          {!isLoading && (
            <button onClick={closeAll} style={styles.closeBtn}>
              <X size={18} color="#666" />
            </button>
          )}
        </div>
        
        {isLoading ? (
          <div style={styles.loadingContainer}>
            <Loader size={40} className="spin-anim" color="#2ea043" />
            <p style={{marginTop: 20, color: '#888', fontSize: '14px'}}>
              Initializing <span style={{color: '#fff'}}>{projectType}</span> template...
            </p>
          </div>
        ) : (
          <>
            {!projectType ? (
              <div style={styles.grid}>
                {projectOptions.map((option) => (
                  <div 
                    key={option.id} 
                    style={styles.card} 
                    className="p-card-styled"
                    onClick={() => setProjectType(option.id)}
                  >
                    <div style={styles.iconWrapper}>{option.icon}</div>
                    <span style={styles.cardLabel}>{option.label}</span>
                    <small style={styles.cardDesc}>{option.desc}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.formContainer}>
                <div style={styles.selectionInfo}>
                   <span style={{color: '#666'}}>Template:</span>
                   <span style={styles.badge}>{projectOptions.find(p => p.id === projectType)?.label}</span>
                </div>
                
                <input 
                  type="text" 
                  placeholder="Enter project name..." 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value.replace(/\s/g, '-'))}
                  autoFocus
                  style={styles.input}
                />

                <div style={styles.actions}>
                  <button 
                    disabled={!projectName.trim()} 
                    onClick={handleCreateProject}
                    style={{...styles.btnPrimary, opacity: !projectName.trim() ? 0.5 : 1}}
                  >
                    Create Project
                  </button>
                  <button onClick={() => setProjectType(null)} style={styles.btnSecondary}>
                    Go Back
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .p-card-styled {
          transition: all 0.2s ease;
          border: 1px solid #222;
        }
        .p-card-styled:hover {
          background: #1c1c1e !important;
          border-color: #2ea043 !important;
          transform: translateY(-2px);
        }
        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
    backdropFilter: 'blur(4px)'
  },
  modal: {
    width: '550px', background: '#111112', border: '1px solid #222', borderRadius: '12px',
    padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
  title: { fontSize: '11px', fontWeight: '800', color: '#555', letterSpacing: '2px', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' },
  
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  card: {
    background: '#161618', padding: '20px 10px', borderRadius: '8px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
  },
  iconWrapper: { marginBottom: '12px', opacity: 0.9 },
  cardLabel: { fontSize: '13px', fontWeight: '600', color: '#eee', marginBottom: '4px' },
  cardDesc: { fontSize: '10px', color: '#555' },
  
  formContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
  selectionInfo: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' },
  badge: { background: '#1c1c1e', color: '#2ea043', padding: '4px 10px', borderRadius: '4px', border: '1px solid #2ea04333' },
  input: {
    background: '#161618', border: '1px solid #333', color: '#fff', padding: '12px',
    borderRadius: '6px', outline: 'none', fontSize: '14px', width: '100%'
  },
  actions: { display: 'flex', gap: '10px', marginTop: '10px' },
  btnPrimary: { flex: 2, background: '#2ea043', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnSecondary: { flex: 1, background: 'transparent', color: '#666', border: '1px solid #333', padding: '12px', borderRadius: '6px', cursor: 'pointer' },
  loadingContainer: { padding: '40px 0', textAlign: 'center' }
};