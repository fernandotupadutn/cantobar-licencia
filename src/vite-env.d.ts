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
  };
}

type UpdateStatusPayload =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'error'; message: string }
  | { type: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded'; version: string };
