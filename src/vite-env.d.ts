/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    platform: string;
    isElectron: boolean;
    versions: {
      electron: string;
      chrome: string;
      node: string;
    };
    updater: {
      check: () => Promise<null>;
      download: () => Promise<null>;
      install: () => Promise<null>;
      onStatus: (cb: (payload: UpdateStatusPayload) => void) => () => void;
    };
    qz: {
      getSecurity: () => Promise<{ certificate: string | null; algorithm: string; dir: string | null }>;
      sign: (toSign: string) => Promise<string>;
      log: (message: string) => Promise<null>;
    };
  };
}

type UpdateStatusPayload =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'error'; message: string }
  | { type: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded'; version: string };

// QZ Tray: se carga como script global en index.html (public/vendor/qz-tray.js).
// Tipado mínimo de las APIs que usamos para impresión térmica.
interface QzSocketConfig {
  host?: string;
  port?: number;
  usingSecure?: boolean;
  retries?: number;
  delay?: number;
}

interface QzPrintConfig {
  encoding?: string;
  forceRaw?: boolean;
  spool?: boolean;
}

interface Qz {
  security: {
    setSignatureAlgorithm: (algorithm: string) => void;
    setCertificatePromise: (promiseFactory: (resolve: (cert: string) => void, reject: (err: unknown) => void) => void) => void;
    setSignaturePromise: (
      promiseFactory: (toSign: string) => (resolve: (signature: string) => void, reject: (err: unknown) => void) => void
    ) => void;
  };
  websocket: {
    connect: (config?: QzSocketConfig) => Promise<void>;
    disconnect: () => Promise<void>;
  };
  printers: {
    getDefault: () => Promise<string>;
    find: (query?: string) => Promise<string[]>;
  };
  configs: {
    create: (printer: string, options?: QzPrintConfig) => QzPrintConfig;
  };
  print: (config: QzPrintConfig, data: string[]) => Promise<void>;
}

interface Window {
  qz?: Qz;
}
