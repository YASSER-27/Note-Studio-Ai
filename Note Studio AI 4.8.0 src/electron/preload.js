const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // فتح اختيار الملفات
  openModelFile: () => ipcRenderer.invoke('dialog:openFile'),
  
  // التحكم في المحرك
  startLlama: (modelPath) => ipcRenderer.send('llama:start', modelPath),
  stopLlama: () => ipcRenderer.send('llama:stop'),
  
  // قراءة محتوى الملفات
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  
  // التحكم في النافذة
  closeApp: () => ipcRenderer.send('window:close'),
  minimizeApp: () => ipcRenderer.send('window:minimize'),
  maximizeApp: () => ipcRenderer.send('window:maximize'),
  
  // استقبال الحالة
  onStatus: (callback) => {
    const subscription = (_event, value) => callback(_event, value);
    ipcRenderer.on('llama:status', subscription);
    return () => ipcRenderer.removeListener('llama:status', subscription);
  }
});