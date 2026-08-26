import { beforeEach, describe, expect, it } from 'vitest';

import {
  type BlobStore,
  EncryptionUnavailableError,
  type SafeStorageLike,
  SecureStore,
} from './secure-store';

/**
 * OS 자격증명 저장소 대역.
 *
 * 되돌릴 수 있으면서 **평문이 바이트에 그대로 남지 않는** 변환이어야 한다 — 접두사만 붙이는
 * 대역을 쓰면 「평문이 저장소에 남지 않는다」 감지기가 대역 때문에 울려 무엇도 재지 못한다.
 * base64는 암호가 아니지만 이 감지기가 재려는 것(SecureStore가 safeStorage를 우회해
 * 평문을 직접 쓰지 않는가)에는 충분하다.
 */
function fakeSafeStorage(available = true): SafeStorageLike {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plain) => Buffer.from(Buffer.from(plain, 'utf8').toString('base64'), 'utf8'),
    decryptString: (buf) => Buffer.from(buf.toString('utf8'), 'base64').toString('utf8'),
  };
}

/** 앱 재시작을 흉내 내려면 저장소가 SecureStore 바깥에 살아 있어야 한다. */
function memoryBlobs(): BlobStore {
  const map = new Map<string, Buffer>();
  return {
    read: (k) => map.get(k),
    write: (k, v) => void map.set(k, v),
    delete: (k) => void map.delete(k),
  };
}

describe('단말 토큰 보관', () => {
  let blobs: BlobStore;

  beforeEach(() => {
    blobs = memoryBlobs();
  });

  it('저장한 적이 없으면 undefined다', () => {
    expect(new SecureStore(fakeSafeStorage(), blobs).get()).toBeUndefined();
  });

  it('저장한 값을 그대로 되읽는다', () => {
    const store = new SecureStore(fakeSafeStorage(), blobs);
    store.set('device-token-abc');
    expect(store.get()).toBe('device-token-abc');
  });

  it('앱을 재시작해도 값이 남는다', () => {
    // 같은 저장소를 물려받은 새 인스턴스 = 프로세스 재시작
    new SecureStore(fakeSafeStorage(), blobs).set('token-survives');
    const afterRestart = new SecureStore(fakeSafeStorage(), blobs);
    expect(afterRestart.get()).toBe('token-survives');
  });

  it('평문이 저장소에 남지 않는다', () => {
    new SecureStore(fakeSafeStorage(), blobs).set('secret-value');
    const raw = blobs.read('device-token');
    expect(raw).toBeDefined();
    expect(raw!.toString('utf8')).not.toContain('secret-value');
  });

  it('clear 뒤에는 다시 undefined다', () => {
    const store = new SecureStore(fakeSafeStorage(), blobs);
    store.set('gone');
    store.clear();
    expect(store.get()).toBeUndefined();
  });
});

describe('암호화를 쓸 수 없을 때', () => {
  it('저장은 평문으로 떨어뜨리지 않고 던진다', () => {
    const blobs = memoryBlobs();
    const store = new SecureStore(fakeSafeStorage(false), blobs);
    expect(() => store.set('never-plain')).toThrow(EncryptionUnavailableError);
    expect(blobs.read('device-token')).toBeUndefined();
  });

  it('읽기도 던진다 — 값이 있는데 복호화할 수 없으면 조용히 넘기지 않는다', () => {
    const blobs = memoryBlobs();
    new SecureStore(fakeSafeStorage(), blobs).set('stored-earlier');
    const broken = new SecureStore(fakeSafeStorage(false), blobs);
    expect(() => broken.get()).toThrow(EncryptionUnavailableError);
  });
});
