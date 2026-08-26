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
    /** 전송이 확정된 뒤에만 부른다 — 보내기 전에 지우면 현장 실적이 사라진다. */
    dequeue: (id: number): Promise<void> => ipcRenderer.invoke('outbox:dequeue', id),
  },
  rendition: {
    /**
     * 서버가 그려 준 출력물을 파일로 저장하고 만들어진 경로를 돌려준다.
     *
     * `format`은 서버에 요청한 것과 같은 값을 넘긴다(`rendition?format=png|pdf`) —
     * 확장자가 그 값을 따라가고, 내용이 그 형식이 아니면 저장하지 않고 던진다.
     *
     * ⛔ 저장 경로를 렌더러가 정하지 않는다 — 메인이 소유한다.
     * ⛔ 셸이 출력물을 다시 그리지 않는다(설계 결정 18).
     */
    save: (bytes: Uint8Array, label: string, now: string, format: 'png' | 'pdf'): Promise<string> =>
      ipcRenderer.invoke('rendition:save', bytes, label, now, format),
  },
};

export type PopApi = typeof api;

contextBridge.exposeInMainWorld('pop', api);
