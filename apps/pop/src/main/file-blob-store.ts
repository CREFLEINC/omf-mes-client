/**
 * 암호문을 파일로 보관하는 `BlobStore` 구현.
 *
 * `index.ts` 안에 인라인으로 두었더니 **감지기가 하나도 붙지 않았고**, 그 사이 `delete`가
 * 계약을 어기고 있었다(파일을 지우지 않고 빈 내용을 썼다 — `read`가 `undefined` 대신
 * 길이 0 버퍼를 돌려주어 `SecureStore.get()`이 빈 바이트를 복호화하려 들었다).
 * 메모리 대역으로만 재던 감지기는 그 어긋남을 가려 주었다.
 *
 * 그래서 여기로 뺐다. 계약은 하나다 — **`delete` 뒤의 `read`는 `undefined`다.**
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BlobStore } from './secure-store';

export function createFileBlobStore(baseDir: string): BlobStore {
  const pathFor = (key: string) => join(baseDir, `${key}.bin`);

  return {
    read(key) {
      const path = pathFor(key);
      if (!existsSync(path)) return undefined;
      const bytes = readFileSync(path);
      // 빈 파일은 「값 없음」으로 다룬다. 빈 바이트를 암호문으로 넘기면 복호화가 던진다 —
      // 이전 판이 남긴 파일이나 쓰다 만 파일에도 이 경로로 걸린다.
      return bytes.length === 0 ? undefined : bytes;
    },

    write(key, value) {
      mkdirSync(baseDir, { recursive: true });
      writeFileSync(pathFor(key), value);
    },

    delete(key) {
      rmSync(pathFor(key), { force: true });
    },
  };
}
