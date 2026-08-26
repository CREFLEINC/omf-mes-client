/**
 * 렌더러로 나가는 **유일한 통로**(#441 결정 — `contextBridge` 하나).
 *
 * 여기 적힌 것 말고는 렌더러가 메인 프로세스에 닿을 수 없다. 새 기능이 필요하면
 * 이 파일에 함수를 더하고 메인의 `ipcMain.handle`을 짝으로 추가한다 —
 * `nodeIntegration`을 켜거나 통로를 하나 더 여는 방식으로 풀지 않는다.
 */
import { contextBridge, ipcRenderer } from 'electron';

export interface QueuedRequest {
  id: number;
  endpoint: string;
  payload: string;
  createdAt: string;
}

const api = {
  deviceToken: {
    get: (): Promise<string | undefined> => ipcRenderer.invoke('device-token:get'),
    set: (value: string): Promise<void> => ipcRenderer.invoke('device-token:set', value),
  },
  cache: {
    get: (key: string): Promise<string | undefined> => ipcRenderer.invoke('cache:get', key),
    put: (key: string, value: string, fetchedAt: string): Promise<void> =>
      ipcRenderer.invoke('cache:put', key, value, fetchedAt),
  },
  outbox: {
    enqueue: (endpoint: string, payload: string, createdAt: string): Promise<void> =>
      ipcRenderer.invoke('outbox:enqueue', endpoint, payload, createdAt),
    peek: (limit?: number): Promise<QueuedRequest[]> => ipcRenderer.invoke('outbox:peek', limit),
    size: (): Promise<number> => ipcRenderer.invoke('outbox:size'),
  },
  label: {
    printToPdf: (bytes: Uint8Array, label: string, filePath: string): Promise<void> =>
      ipcRenderer.invoke('label:print-pdf', bytes, label, filePath),
  },
};

export type PopApi = typeof api;

contextBridge.exposeInMainWorld('pop', api);
