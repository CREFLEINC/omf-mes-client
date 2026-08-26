import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileBlobStore } from './file-blob-store';
import { SecureStore, type SafeStorageLike } from './secure-store';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pop-blobs-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('BlobStore 계약 — 실제 파일에 대해 잰다', () => {
  it('쓴 적 없는 키는 undefined다', () => {
    expect(createFileBlobStore(dir).read('device-token')).toBeUndefined();
  });

  it('쓴 값을 그대로 읽는다', () => {
    const store = createFileBlobStore(dir);
    store.write('device-token', Buffer.from([1, 2, 3]));
    expect(Array.from(store.read('device-token')!)).toEqual([1, 2, 3]);
  });

  it('baseDir이 없어도 만들어 쓴다', () => {
    const nested = join(dir, 'a', 'b');
    const store = createFileBlobStore(nested);
    store.write('k', Buffer.from([9]));
    expect(store.read('k')).toBeDefined();
  });

  // ⛔ 이 감지기가 M1의 재발을 막는다. 이전 판은 파일을 지우지 않고 빈 내용을 써서
  //    read가 길이 0 버퍼를 돌려주었고, 메모리 대역으로만 재던 감지기는 통과했다.
  it('delete 뒤의 read는 undefined다', () => {
    const store = createFileBlobStore(dir);
    store.write('device-token', Buffer.from([1, 2, 3]));
    store.delete('device-token');
    expect(store.read('device-token')).toBeUndefined();
  });

  it('delete는 파일 자체를 없앤다 — 빈 파일을 남기지 않는다', () => {
    const store = createFileBlobStore(dir);
    store.write('device-token', Buffer.from([1]));
    store.delete('device-token');
    expect(() => readFileSync(join(dir, 'device-token.bin'))).toThrow();
  });

  it('없는 키를 delete해도 던지지 않는다', () => {
    expect(() => createFileBlobStore(dir).delete('never-written')).not.toThrow();
  });

  it('빈 파일은 값 없음으로 읽는다 — 빈 바이트를 복호화로 넘기지 않는다', () => {
    writeFileSync(join(dir, 'device-token.bin'), Buffer.alloc(0));
    expect(createFileBlobStore(dir).read('device-token')).toBeUndefined();
  });
});

describe('SecureStore와 실제 파일 저장소를 함께 태운다', () => {
  const base64SafeStorage: SafeStorageLike = {
    isEncryptionAvailable: () => true,
    encryptString: (plain) => Buffer.from(Buffer.from(plain, 'utf8').toString('base64'), 'utf8'),
    decryptString: (buf) => Buffer.from(buf.toString('utf8'), 'base64').toString('utf8'),
  };

  it('clear 뒤 get이 예외가 아니라 undefined다', () => {
    const store = new SecureStore(base64SafeStorage, createFileBlobStore(dir));
    store.set('device-token-abc');
    store.clear();
    expect(store.get()).toBeUndefined();
  });

  it('앱 재시작을 넘어 값이 남는다 — 저장소가 파일이므로 인스턴스와 무관하다', () => {
    new SecureStore(base64SafeStorage, createFileBlobStore(dir)).set('survives-restart');
    const afterRestart = new SecureStore(base64SafeStorage, createFileBlobStore(dir));
    expect(afterRestart.get()).toBe('survives-restart');
  });

  it('평문이 디스크에 남지 않는다', () => {
    new SecureStore(base64SafeStorage, createFileBlobStore(dir)).set('secret-value');
    const raw = readFileSync(join(dir, 'device-token.bin')).toString('utf8');
    expect(raw).not.toContain('secret-value');
  });
});
