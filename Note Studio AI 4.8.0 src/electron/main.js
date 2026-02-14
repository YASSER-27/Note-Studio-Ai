const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const axios = require('axios');
const { exec, spawn } = require('child_process');
const os = require('os');
const archiver = require('archiver'); 
const chokidar = require('chokidar');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // إذا كنت تستخدم نسخة قديمة من Node

// --- 1. إعداد المسارات الذكية (تعريف لمرة واحدة فقط) ---
const serverExePath = app.isPackaged 
  ? path.join(process.resourcesPath, 'cpp', 'llama-server.exe') 
  : path.join(__dirname, '../cpp', 'llama-server.exe');

const modelPathForAI = app.isPackaged 
  ? path.join(process.resourcesPath, 'models', 'qwen2.5-coder-0.5b-instruct-q4_k_m.gguf') 
  : path.join(__dirname, '../models', 'qwen2.5-coder-0.5b-instruct-q4_k_m.gguf');

// --- 2. المتغيرات العامة ---
let serverProcess = null;
let aiProcess = null;
let isUndoOperating = false;
let watcher = null;
let mainWindow;
let currentProjectPath = "";
let clipboard = { type: null, path: null };
let autoSaveInterval = null;
let autoSaveEnabled = true;
let backupFolder = path.join(app.getPath('userData'), 'backups');
let watchDebounceTimer = null;
let lastDeleted = null;

console.log("AI Server path detected at:", serverExePath);

// --- 3. الدوال المساعدة ---
function shouldIgnorePath(filePath) {
  const ignoredPatterns = ['node_modules', '.git', 'dist', 'build', '.DS_Store', 'AppData'];
  return ignoredPatterns.some(pattern => filePath.includes(pattern));
}

function startAIServer(modelPath) {
  if (serverProcess) return; // منع التشغيل المكرر

  if (!fsSync.existsSync(serverExePath)) {
    console.error("❌ AI Server EXE not found at:", serverExePath);
    return;
  }

  console.log("🚀 Starting AI Server in background...");
  serverProcess = spawn(serverExePath, [
    '--model', modelPath,
    '--port', '8080',
    '--threads', '4',
    '--ctx-size', '2048'
  ], { 
    windowsHide: true,
    stdio: 'ignore' 
  });

  serverProcess.on('error', (err) => {
    console.error('❌ Failed to start server process:', err);
    serverProcess = null;
  });
}

// --- 4. دالة إنشاء النافذة (تأكد أن التكملة تبدأ من هنا) ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, app.isPackaged ? '../assets/icon.png' : 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const key = input.key.toLowerCase();
      
      if (input.alt && key === 'a') {
        mainWindow.webContents.send('command-add-file');
        event.preventDefault();
      }
      
      if (input.alt && key === 'z') {
        mainWindow.webContents.send('command-add-folder');
        event.preventDefault();
      }
    }
  });

  if (app.isPackaged) {
    // الخروج من مجلد electron للوصول إلى dist
    const productionPath = path.join(__dirname, '..', 'dist', 'index.html');
    
    mainWindow.loadFile(productionPath).catch((err) => {
      console.error("Path Error:", err);
      // محاولة أخيرة في حال كان الهيكل مسطحاً
      mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  setupAppMenu();
  ensureBackupFolder();
  initAutoSave();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setTimeout(() => {
      if (fsSync.existsSync(modelPathForAI)) {
        startAIServer(modelPathForAI);
      }
    }, 4000);
  });

  mainWindow.on('close', () => {
    if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
    if (watcher) { watcher.close(); watcher = null; }
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  });
}

// --- أحداث التطبيق الأساسية ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

async function ensureBackupFolder() {
  try {
    if (!fsSync.existsSync(backupFolder)) {
      await fs.mkdir(backupFolder, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating backup folder:', err);
  }
}

function initAutoSave() {
  if (!autoSaveEnabled) return;
  if (autoSaveInterval) return; // already running
  autoSaveInterval = setInterval(async () => {
    if (currentProjectPath) {
      await createBackup(currentProjectPath);
    }
  },10 * 60 * 1000); // every 5 minutes
}

async function createBackup(projectPath) {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const projectName = path.basename(projectPath);
    const backupName = `${projectName}_${timestamp}`;
    const backupPath = path.join(backupFolder, backupName);
    
    await fs.cp(projectPath, backupPath, { recursive: true });
    console.log('Backup created:', backupPath);
    
    // delete old backups (keep last 10)
    await cleanOldBackups();
  } catch (err) {
    console.error('Backup error:', err);
  }
}

async function cleanOldBackups() {
  try {
    const backups = await fs.readdir(backupFolder);
    if (backups.length > 10) {
      backups.sort();
      const toDelete = backups.slice(0, backups.length - 10);
      for (const backup of toDelete) {
        try {
          await fs.rm(path.join(backupFolder, backup), { recursive: true, force: true });
        } catch (e) {
          console.error('Failed deleting backup:', backup, e);
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning backups:', err);
  }
}

function setupAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow.webContents.send('new-project-trigger') },
        { label: 'New File', accelerator: 'Alt+A', click: () => mainWindow.webContents.send('new-file-trigger') },
        { label: 'New Tab', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('new-blank-tab') },
        { label: 'Open Folder', accelerator: 'CmdOrCtrl+O', click: () => handleOpenFolder() },
        { label: 'Load Project', accelerator: 'CmdOrCtrl+L', click: () => handleLoadProject() },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('save-trigger') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('save-as-trigger') },
        { type: 'separator' },
        { label: 'Export as ZIP', accelerator: 'CmdOrCtrl+E', click: () => handleExportProject() },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => mainWindow.webContents.send('close-tab') },
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => mainWindow.webContents.send('copy-file-trigger') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => mainWindow.webContents.send('paste-file-trigger') },
        { label: 'Delete', accelerator: 'Delete', click: () => mainWindow.webContents.send('delete-file-trigger') },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll' },
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => mainWindow.webContents.send('next-tab') },
        { label: 'Prev Tab', accelerator: 'Ctrl+Shift+Tab', click: () => mainWindow.webContents.send('prev-tab') },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => mainWindow.webContents.send('toggle-sidebar') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Terminal',
      submenu: [
        { label: 'Open Terminal Here', accelerator: 'Alt+R', click: () => ipcMain.emit('open-terminal-trigger') }
      ]
    },
    {
      label: 'Recovery',
      submenu: [
        { label: 'Auto-Save Settings', click: () => toggleAutoSave() },
        { label: 'Restore Backup', click: () => handleRestoreBackup() },
        { type: 'separator' },
        { label: 'View All Backups', click: () => shell.openPath(backupFolder) }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
  if (autoSaveEnabled) {
    initAutoSave();
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Auto-Save',
      message: 'Auto-Save is now ENABLED (every 5 minutes)'
    });
  } else {
    if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Auto-Save',
      message: 'Auto-Save is now DISABLED'
    });
  }
}

async function handleRestoreBackup() {
  try {
    const backups = await fs.readdir(backupFolder);
    if (backups.length === 0) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'No backups found'
      });
      return;
    }

    backups.sort();
    const recent = backups.slice(-5).reverse();

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: recent,
      title: 'Restore Backup',
      message: 'Select a backup to restore:'
    });

    const selectedBackup = recent[response];
    if (!selectedBackup) return;

    const backupPath = path.join(backupFolder, selectedBackup);
    
    currentProjectPath = backupPath;
    const files = await fetchDirectory(backupPath);
    mainWindow.webContents.send('folder-opened', { path: backupPath, files });
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'Backup restored successfully!'
    });
  } catch (err) {
    dialog.showErrorBox('Error', 'Failed to restore backup: ' + (err && err.message ? err.message : err));
  }
}

async function handleExportProject() {
  if (!currentProjectPath) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      message: 'No project is currently open!'
    });
    return;
  }

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Project as ZIP',
    defaultPath: path.join(app.getPath('desktop'), path.basename(currentProjectPath) + '.zip'),
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });

  if (!filePath) return;

  try {
    const output = fsSync.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: `Project exported successfully!\nSize: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(currentProjectPath, false);
    await archive.finalize();
  } catch (err) {
    dialog.showErrorBox('Export Error', err && err.message ? err.message : String(err));
  }
}

async function handleLoadProject() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });

  if (canceled || !filePaths || filePaths.length === 0) return;

  const zipPath = filePaths[0];
  const extractPath = path.join(app.getPath('temp'), 'note-studio-extract');

  try {
    if (fsSync.existsSync(extractPath)) {
      fsSync.rmSync(extractPath, { recursive: true, force: true });
    }
    await fs.mkdir(extractPath, { recursive: true });

    const extract = require('extract-zip');
    await extract(zipPath, { dir: extractPath });

    currentProjectPath = extractPath;
    const files = await fetchDirectory(extractPath);
    mainWindow.webContents.send('folder-opened', { path: extractPath, files });

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'Project loaded successfully!'
    });
  } catch (err) {
    dialog.showErrorBox('Load Error', err && err.message ? err.message : String(err));
  }
}

async function fetchDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let results = [];
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', '.DS_Store'].includes(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children: await fetchDirectory(fullPath)
        });
      } else {
        results.push({ name: entry.name, path: fullPath, isDirectory: false });
      }
    }
    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    return results;
  } catch (err) { 
    console.error('fetchDirectory error', err);
    return []; 
  }
}

async function refreshFileTree() {
  if (currentProjectPath && mainWindow) {
    const files = await fetchDirectory(currentProjectPath);
    mainWindow.webContents.send('folder-opened', { path: currentProjectPath, files });
  }
}

async function handleOpenFolderFromArgs(folderPath) {
  if (mainWindow && folderPath) {
    currentProjectPath = folderPath;
    const files = await fetchDirectory(folderPath);
    mainWindow.webContents.send('folder-opened', { path: folderPath, files });
    
    if (watcher) { await watcher.close(); watcher = null; }
    setupWatcherForPath(currentProjectPath);
  }
}

async function handleOpenFolder() {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || !filePaths || filePaths.length === 0) return;
  
  currentProjectPath = filePaths[0];
  
  if (watcher) { await watcher.close(); watcher = null; }
  setupWatcherForPath(currentProjectPath);

  const files = await fetchDirectory(filePaths[0]);
  mainWindow.webContents.send('folder-opened', { path: filePaths[0], files });
}

function setupWatcherForPath(projectPath) {
  try {
    if (watcher) { watcher.close(); }

    watcher = chokidar.watch(projectPath, { 
      ignoreInitial: true, 
      depth: 10, 
      persistent: true,
      ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      atomic: true,
      awaitWriteFinish: {
        stabilityThreshold: 100, // التأكد من اكتمال الكتابة قبل القراءة
        pollInterval: 100
      }
    });

    watcher.on('all', async (event, changedPath) => {
      // 1. تحديث شجرة الملفات (Sidebar)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await refreshFileTree();
      }, 150);

      // 2. إذا كان التغيير هو "تعديل" (change) على ملف
      if (event === 'change') {
        try {
          // قراءة المحتوى الجديد للملف الذي تغير خارجياً
          const content = await fs.readFile(changedPath, 'utf-8');
          
          // إرسال المحتوى الجديد إلى الواجهة (الحدث الذي ينتظره EditorContainer)
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('file-changed-external', { 
              path: changedPath, 
              content: content 
            });
          }
        } catch (err) {
          console.error('Failed to read changed file:', err);
        }
      }
    });

    watcher.on('error', (err) => console.error('Watcher error', err));
  } catch (err) {
    console.error('Failed to setup watcher', err);
  }
}
// --- IPC Handlers ---

ipcMain.handle('open-folder-at-path', async (e, dirPath) => {
  try {
    const files = await fetchDirectory(dirPath);
    return { success: true, files };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});
ipcMain.handle('export-zip', async (event, folderPath) => {
  if (!folderPath) return { success: false, error: "No folder path provided" };

  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Project as ZIP',
    defaultPath: path.join(app.getPath('downloads'), 'project.zip'),
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });

  if (!filePath) return { success: false, error: "Canceled" };

  return new Promise((resolve, reject) => {
    try {
      // التعديل هنا: استخدم fsSync بدلاً من fs
      if (!fsSync.existsSync(folderPath)) {
        return resolve({ success: false, error: "Source folder does not exist" });
      }

      // التعديل هنا: استخدم fsSync لإنشاء الـ Stream
      const output = fsSync.createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('progress', (data) => {
        const percentage = Math.round((data.fs.processedBytes / data.fs.totalBytes) * 100);
        event.sender.send('export-progress-update', percentage);
      });

      output.on('close', () => resolve({ success: true, path: filePath }));
      archive.on('error', (err) => reject({ success: false, error: err.message }));

      archive.pipe(output);
      archive.directory(folderPath, false);
      archive.finalize();

    } catch (err) {
      reject({ success: false, error: err.message });
    }
  });
});
// في ملف main.js
// استبدل الجزء الخاص بـ search-in-files بهذا في main.js
ipcMain.handle('search-in-files', async (event, { folderPath, searchTerm }) => {
  if (!folderPath || !searchTerm) return [];
  const results = [];
  const fs = require('fs');
  const path = require('path');

  function searchRecursive(dir) {
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            // تخطي المجلدات الضخمة وغير الضرورية
            if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
              searchRecursive(fullPath);
            }
          } else {
            // البحث داخل الملفات النصية فقط (اختياري ولكن يفضل)
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes(searchTerm.toLowerCase())) {
              const index = content.toLowerCase().indexOf(searchTerm.toLowerCase());
              // تحسين المعاينة (Preview) لتكون أوضح
              const start = Math.max(0, index - 30);
              const end = Math.min(content.length, index + 50);
              const preview = content.substring(start, end).replace(/\n/g, ' ');

              results.push({
                fileName: file,
                path: fullPath,
                preview: preview
              });
            }
          }
        } catch (e) { continue; } // تخطي الملف إذا تعذرت قراءته
      }
    } catch (e) { return; }
  }

  searchRecursive(folderPath);
  return results;
});
ipcMain.handle('delete-item', async (e, itemPath) => {
  try {
    if (!itemPath) return { success: false, error: 'No path' };
    if (!fsSync.existsSync(itemPath)) return { success: false, error: 'Not found' };

    // 1. إيقاف المراقب عن هذا المسار فوراً لمنع التحديثات المزعجة
    if (watcher) watcher.unwatch(itemPath);

    const trashFolder = path.join(backupFolder, 'trash');
    await fs.mkdir(trashFolder, { recursive: true });

    const dest = path.join(trashFolder, `${Date.now()}_${path.basename(itemPath)}`);

    // 2. تنفيذ النقل
    try {
      await fs.rename(itemPath, dest);
    } catch (err) {
      if (err.code === 'EXDEV') {
        const stat = fsSync.statSync(itemPath);
        if (stat.isDirectory()) {
          await fs.cp(itemPath, dest, { recursive: true });
          await fs.rm(itemPath, { recursive: true, force: true });
        } else {
          await fs.copyFile(itemPath, dest);
          await fs.unlink(itemPath);
        }
      } else throw err;
    }

    lastDeleted = { originalPath: itemPath, trashPath: dest, time: Date.now() };

    // 3. تحديث الواجهة مرة واحدة فقط بعد تأخير بسيط لضمان استقرار النظام
    setTimeout(async () => {
      await refreshFileTree();
      if (mainWindow) mainWindow.webContents.send('fs-event', { event: 'deleted', path: itemPath });
    }, 100);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('undo-delete', async () => {
  // منع الاستعادة التلقائية أو المكررة
  if (isUndoOperating || !lastDeleted) return { success: false };
  
  isUndoOperating = true; 
  try {
    const { originalPath, trashPath } = lastDeleted;
    if (!fsSync.existsSync(trashPath)) return { success: false };

    await fs.mkdir(path.dirname(originalPath), { recursive: true });
    
    // استعادة الملف
    await fs.rename(trashPath, originalPath);

    lastDeleted = null;
    await refreshFileTree();
    
    return { success: true };
  } catch (err) {
    return { success: false };
  } finally {
    isUndoOperating = false; // فتح القفل
  }
});

ipcMain.handle('open-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (canceled || !filePaths || filePaths.length === 0) return null;
  
  currentProjectPath = filePaths[0];
  const files = await fetchDirectory(currentProjectPath);
  return { path: currentProjectPath, files };
});

ipcMain.handle('read-file', async (e, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) { 
    return { success: false, error: err && err.message ? err.message : String(err) }; 
  }
});
ipcMain.handle('ai:chat', async (event, { prompt }) => {
  try {
    const response = await axios({
      method: 'post',
      url: 'http://127.0.0.1:8080/completion',
      data: {
        prompt: `<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`,
        n_predict: 1024,
        stream: true,
        stop: ["<|im_start|>", "<|im_end|>", "###", "\n\n\n"],
        temperature: 0.7,
      },
      responseType: 'stream'
    });

    currentResponseStream = response.data; // حفظ البث الحالي

    currentResponseStream.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.replace('data: ', ''));
            // إرسال التوكن فقط إذا كان البث لا يزال نشطاً
            if (currentResponseStream) {
              event.sender.send('ai:token', parsed.content);
            }
          } catch (e) {}
        }
      }
    });

    currentResponseStream.on('end', () => {
      currentResponseStream = null;
    });

    return { success: true };
  } catch (error) {
    currentResponseStream = null;
    return { success: false, error: "Server is not responding" };
  }
});

// زر الإيقاف المحسن
ipcMain.on('ai:stop', () => {
  console.log("🔴 Force Stopping AI...");

  // 1. تدمير البث فوراً لمنع وصول أي بيانات للواجهة (حل مشكلة التجمد)
  if (currentResponseStream) {
    currentResponseStream.destroy();
    currentResponseStream = null;
  }

  // 2. إرسال إشارة للواجهة لتتوقف عن حالة "Thinking"
  if (mainWindow) {
    mainWindow.webContents.send('ai:stopped-completely');
  }

  // 3. قتل العملية من نظام التشغيل كحل نهائي
  if (serverProcess) {
    const pid = serverProcess.pid;
    exec(`taskkill /pid ${pid} /T /F`, (err) => {
      console.log("AI Process Terminated.");
      // إعادة التشغيل ليكون جاهزاً للسؤال التالي
      startAIServer(modelPathForAI);
    });
  }
});

ipcMain.handle('save-file', async (e, { filePath, content }) => {
  try {
    // Ensure parent exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    // notify renderer if needed
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fs-event', { event: 'saved', path: filePath });
    }
    return { success: true };
  } catch (err) { return { success: false, error: err && err.message ? err.message : String(err) }; }
});

ipcMain.handle('save-file-as', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File',
    defaultPath: path.join(app.getPath('documents'), 'Untitled.txt')
  });
  if (canceled || !filePath) return { success: false };
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fs-event', { event: 'saved', path: filePath });
    }
    return { success: true, path: filePath, name: path.basename(filePath) };
  } catch (err) { return { success: false, error: err && err.message ? err.message : String(err) }; }
});

ipcMain.handle('copy-file', async (e, itemPath) => {
  clipboard = { type: 'copy', path: itemPath };
  return { success: true };
});

ipcMain.handle('cut-file', async (e, itemPath) => {
  clipboard = { type: 'cut', path: itemPath };
  return { success: true };
});

ipcMain.handle('paste-file', async (e, targetDir) => {
  if (!clipboard.path) return { success: false, error: 'Nothing to paste' };
  try {
    const itemName = path.basename(clipboard.path);
    let newPath = path.join(targetDir, itemName);
    
    if (fsSync.existsSync(newPath)) {
      const ext = path.extname(itemName);
      const base = path.basename(itemName, ext);
      let i = 1;
      while (fsSync.existsSync(newPath)) {
        newPath = path.join(targetDir, `${base}_copy${i}${ext}`);
        i++;
      }
    }
    
    if (clipboard.type === 'copy') {
      if (fsSync.statSync(clipboard.path).isDirectory()) {
        await fs.cp(clipboard.path, newPath, { recursive: true });
      } else {
        await fs.copyFile(clipboard.path, newPath);
      }
    } else if (clipboard.type === 'cut') {
      try {
        await fs.rename(clipboard.path, newPath);
      } catch (err) {
        if (err && err.code === 'EXDEV') {
          if (fsSync.statSync(clipboard.path).isDirectory()) {
            await fs.cp(clipboard.path, newPath, { recursive: true });
            await fs.rm(clipboard.path, { recursive: true, force: true });
          } else {
            await fs.copyFile(clipboard.path, newPath);
            await fs.unlink(clipboard.path);
          }
        } else throw err;
      }
      clipboard = { type: null, path: null };
    }
    
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fs-event', { event: 'pasted', path: newPath });
    }
    await refreshFileTree();
    return { success: true, path: newPath };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});
ipcMain.handle('ask-ai-to-fix-selection', async (event, { text, instruction, language }) => {
  try {
    const response = await axios({
      method: 'post',
      url: 'http://127.0.0.1:8080/completion',
      data: {
        // الـ Prompt يدمج الكود مع تعليمات المستخدم
        prompt: `<|im_start|>system
You are a professional code editor.
User will provide a code snippet and an instruction.
Modify the code exactly as requested.
Return ONLY the modified code. No explanations. No backticks.<|im_end|>
<|im_start|>user
Code:
${text}

Instruction:
${instruction}

Language: ${language}<|im_end|>
<|im_start|>assistant
`,
        n_predict: 1024,
        stream: false,
        temperature: 0.3,
        stop: ["<|im_start|>", "<|im_end|>", "###"],
      },
      timeout: 30000 
    });

    if (response.data && response.data.content) {
      let fixedText = response.data.content.trim();
      fixedText = fixedText.replace(/^```[a-z]*\n/i, "").replace(/\n```$/, "");
      return { success: true, fixedText: fixedText };
    }
    return { success: false, error: "Empty AI response" };
  } catch (error) {
    return { success: false, error: "AI Server Error" };
  }
});
ipcMain.handle('move-file', async (e, { sourcePath, targetDir }) => {
  try {
    // 1. تحديد الوجهة: إذا لم يتم إرسال targetDir (إسقاط في مساحة فارغة)، نستخدم جذر المشروع
    const finalTargetDir = targetDir || currentProjectPath;
    
    if (!finalTargetDir) {
      return { success: false, error: 'No project root detected' };
    }

    const fileName = path.basename(sourcePath);
    const newPath = path.join(finalTargetDir, fileName);
    
    // 2. التحقق من صحة المسارات
    if (sourcePath === finalTargetDir || newPath === sourcePath) {
      return { success: false, error: 'Cannot move to same location' };
    }
    
    // منع نقل مجلد داخل نفسه
    if (newPath.startsWith(sourcePath + path.sep)) {
      return { success: false, error: 'Cannot move folder into itself' };
    }
    
    // 3. عملية النقل الفعلية
    try {
      await fs.rename(sourcePath, newPath);
    } catch (err) {
      // معالجة النقل بين الأقراص المختلفة (Cross-device move)
      if (err && err.code === 'EXDEV') {
        if (fsSync.statSync(sourcePath).isDirectory()) {
          await fs.cp(sourcePath, newPath, { recursive: true });
          await fs.rm(sourcePath, { recursive: true, force: true });
        } else {
          await fs.copyFile(sourcePath, newPath);
          await fs.unlink(sourcePath);
        }
      } else {
        throw err;
      }
    }

    // 4. تحديث شجرة الملفات
    await refreshFileTree();
    return { success: true, newPath };
  } catch (err) {
    console.error('Move Error:', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('rename-item', async (e, { oldPath, newPath }) => {
  try {
    await fs.rename(oldPath, newPath);
    await refreshFileTree();
    return { success: true };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('check-file', async (e, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const content = stats.isFile() ? await fs.readFile(filePath, 'utf-8') : null;
    return {
      success: true,
      info: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
        lines: content ? content.split('\n').length : 0
      }
    };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('open-terminal', async (e, dirPath) => {
  try {
    const platform = os.platform();
    
    if (platform === 'win32') {
      exec(`start cmd /K cd /d "${dirPath}"`);
    } else if (platform === 'darwin') {
      exec(`open -a Terminal "${dirPath}"`);
    } else {
      exec(`x-terminal-emulator --working-directory="${dirPath}"`, (err) => {
        if (err) exec(`gnome-terminal --working-directory="${dirPath}"`);
      });
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('create-project', async (e, { type, name, basePath }) => {
  // إذا لم يرسل المستخدم مساراً، نستخدم سطح المكتب كافتراضي
  const targetRoot = basePath || app.getPath('desktop');
  const projectPath = path.join(targetRoot, name);

  try {
    // 1. التحقق من وجود المجلد أو إنشاؤه (يدعم التحويل لمجلد مشروع)
    if (!fsSync.existsSync(projectPath)) {
      await fs.mkdir(projectPath, { recursive: true });
    }

    // --- حالة مشروع Basic TXT (الذي طلبته) ---
    if (type === 'basic_txt') {
      const welcomeContent = "welcome - thank you for use this program";
      await fs.writeFile(path.join(projectPath, 'welcome.txt'), welcomeContent);
    }

    // --- حالة مشروع Android ---
    else if (type === 'android') {
      // إنشاء هيكل مجلدات أندرويد بسيط
      const folders = ['app/src/main/java', 'app/src/main/res', 'gradle'];
      for (const f of folders) {
        await fs.mkdir(path.join(projectPath, f), { recursive: true });
      }
      await fs.writeFile(path.join(projectPath, 'android_note.txt'), "Android Project Structure Created.");
    }

    // --- حالة مشروع Electron (Vite) ---
    else if (type === 'electron') {
      const command = `npm create vite@latest . -- --template react`;
      await new Promise((resolve, reject) => {
        exec(command, { cwd: projectPath }, (error) => {
          if (error) reject(new Error("Vite failed. Ensure Node.js is installed."));
          else resolve();
        });
      });
    }

    // --- حالة مشروع Python ---
    else if (type === 'python') {
      await fs.writeFile(path.join(projectPath, 'main.py'), `# Project: ${name}\nprint("Hello World")`);
      await fs.writeFile(path.join(projectPath, 'requirements.txt'), "");
    }

    // --- حالة مشروع Basic Web (HTML) ---
    else if (type === 'basic') {
      const htmlContent = `<!DOCTYPE html>\n<html>\n<head><title>${name}</title></head>\n<body><h1>Hello</h1></body>\n</html>`;
      await fs.writeFile(path.join(projectPath, 'index.html'), htmlContent);
      await fs.writeFile(path.join(projectPath, 'style.css'), "body { background: #1e1e1e; color: white; }");
    }

    // إضافة ملف ترحيب عام NoteAI لجميع المشاريع
    await fs.writeFile(path.join(projectPath, 'NoteAI_Info.json'), JSON.stringify({
      projectName: name,
      created: new Date().toISOString(),
      type: type
    }, null, 2));

    // تحديث الحالة لفتح المجلد الجديد في البرنامج فوراً
    currentProjectPath = projectPath;
    if (watcher) { await watcher.close(); watcher = null; }
    setupWatcherForPath(currentProjectPath);

    const files = await fetchDirectory(projectPath);
    mainWindow.webContents.send('folder-opened', { path: projectPath, files });

    return { success: true, projectPath };
  } catch (err) {
    console.error("Project Creation Error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('create-folder', async (e, { parentPath, folderName }) => {
  try {
    const newFolderPath = path.join(parentPath, folderName);
    await fs.mkdir(newFolderPath, { recursive: true });
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('fs-event', { event: 'folder-created', path: newFolderPath });
    }
    await refreshFileTree();
    return { success: true, path: newFolderPath };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

// IPC Listeners for Menu Bar (forwarding)
ipcMain.on('open-folder-trigger', handleOpenFolder);
ipcMain.on('load-project-trigger', handleLoadProject);
ipcMain.on('export-project-trigger', handleExportProject);
ipcMain.on('auto-save-settings-trigger', toggleAutoSave);
ipcMain.on('restore-backup-trigger', handleRestoreBackup);
ipcMain.on('show-backups-trigger', () => shell.openPath(backupFolder));
ipcMain.on('show-shortcuts-trigger', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Keyboard Shortcuts',
    message: `
Ctrl+Shift+N - New Project
Ctrl+N - New Tab
Ctrl+O - Open Folder
Ctrl+S - Save
Ctrl+E - Export ZIP
Ctrl+L - Load Project
Alt+A - New File
Alt+R - Terminal
Ctrl+B - Toggle Sidebar
    `
  });
});

ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('maximize-window', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('close-window', () => mainWindow.close());

const forwardEvents = [
  'new-project-trigger',
  'new-file-trigger',
  'new-blank-tab',
  'toggle-sidebar',
  'next-tab',
  'prev-tab',
  'copy-file-trigger',
  'paste-file-trigger',
  'delete-file-trigger'
];

forwardEvents.forEach(event => {
  ipcMain.on(event, () => {
    if (mainWindow) mainWindow.webContents.send(event);
  });
});
ipcMain.on('open-terminal-trigger', () => {
  const pathTarget = currentProjectPath || os.homedir(); 
  
  const platform = os.platform();
  if (platform === 'win32') {
    exec(`start cmd /K cd /d "${pathTarget}"`);
  } else if (platform === 'darwin') {
    exec(`open -a Terminal "${pathTarget}"`);
  } else {
    exec(`gnome-terminal --working-directory="${pathTarget}"`);
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
