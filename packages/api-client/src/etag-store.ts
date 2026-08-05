/**
 * 낙관적 잠금 토큰 보관소 — 공유계약 A-4·B-1.
 * ETag는 헤더로만 오가고 화면에 표시하지 않으므로, 화면 상태가 아니라 여기서 경로별로 보관한다.
 */
export interface EtagStore {
  capture(path: string, etag: string): void;
  ifMatch(path: string): string | undefined;
  clear(path: string): void;
}

export const createEtagStore = (): EtagStore => {
  const etagsByPath = new Map<string, string>();

  return {
    capture(path, etag) {
      etagsByPath.set(path, etag);
    },
    ifMatch(path) {
      return etagsByPath.get(path);
    },
    clear(path) {
      etagsByPath.delete(path);
    },
  };
};
