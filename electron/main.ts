import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createSign, constants } from 'node:crypto';
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

function sendUpdateStatus(payload: Record<string, unknown>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', payload);
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'CantoBar · Punto de venta',
    backgroundColor: '#F4F4F5',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  win.on('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  // Los enlaces externos se abren en el navegador del sistema, nunca dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Carga la app: en desarrollo usamos el servidor de Vite, en producción el build local.
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ---------------------------------------------------------------
// Auto-updater
// ---------------------------------------------------------------
autoUpdater.on('checking-for-update', () => {
  sendUpdateStatus({ type: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  sendUpdateStatus({ type: 'available', version: info.version });
});

autoUpdater.on('update-not-available', () => {
  sendUpdateStatus({ type: 'not-available' });
});

autoUpdater.on('error', (err) => {
  sendUpdateStatus({ type: 'error', message: err?.message ?? String(err) });
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus({
    type: 'downloading',
    percent: Math.round(progress.percent),
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateStatus({ type: 'downloaded', version: info.version });
});

ipcMain.handle('update:check', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err) => {
      sendUpdateStatus({ type: 'error', message: err?.message ?? String(err) });
    });
  }
  return null;
});

ipcMain.handle('update:download', () => {
  if (app.isPackaged) {
    autoUpdater.downloadUpdate().catch((err) => {
      sendUpdateStatus({ type: 'error', message: err?.message ?? String(err) });
    });
  }
  return null;
});

ipcMain.handle('update:install', () => {
  if (app.isPackaged) {
    setImmediate(() => autoUpdater.quitAndInstall());
  }
  return null;
});

// ---------------------------------------------------------------
// QZ Tray: firma de mensajes (silent printing)
//
// QZ Tray muestra el diálogo "¿Permitir?" en cada impresión salvo que
// los requests vengan FIRMADOS con el par de claves que QZ tiene como
// confiable (demo cert de "Site Manager", o el override.crt que
// distribuyamos con la app). La firma se hace acá (proceso principal,
// node:crypto) para no exponer la clave privada en el bundle web.
//
// Ubicación de los archivos:
//   - producción: %APPDATA%\CantoBar POS\auth\digital-certificate.txt
//                 y  ...\auth\private-key.pem
//   - desarrollo: ./auth/  (raíz del proyecto)
// ---------------------------------------------------------------
function getQzAuthDir(): string {
  return app.isPackaged ? join(app.getPath('userData'), 'auth') : join(process.cwd(), 'auth');
}

async function readQzSecurity(): Promise<{ certificate: string; key: string } | null> {
  const dir = getQzAuthDir();
  try {
    const [certificate, key] = await Promise.all([
      readFile(join(dir, 'digital-certificate.txt'), 'utf8'),
      readFile(join(dir, 'private-key.pem'), 'utf8'),
    ]);
    return { certificate: certificate.trim(), key };
  } catch {
    return null;
  }
}

ipcMain.handle('qz:get-security', async () => {
  const sec = await readQzSecurity();
  return {
    certificate: sec?.certificate ?? null,
    algorithm: 'SHA512',
  };
});

ipcMain.handle('qz:sign', async (_event, toSign: string) => {
  const sec = await readQzSecurity();
  if (!sec) throw new Error('No se encontraron las claves de firma de QZ Tray');
  const signer = createSign('sha512');
  signer.update(toSign, 'utf8');
  return signer.sign({ key: sec.key, padding: constants.RSA_PKCS1_PADDING }).toString('base64');
});

app.whenReady().then(() => {
  createWindow();

  // Chequea actualizaciones en segundo plano al arrancar (solo producción).
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
