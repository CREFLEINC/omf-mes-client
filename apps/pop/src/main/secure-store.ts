/**
 * 단말 토큰 보관 — Electron 내장 `safeStorage`로 OS 자격증명 저장소에 맡긴다(#441 결정).
 * 직접 암호화를 구현하지 않는다.
 *
 * ⚠ 실제 저장소가 OS마다 다르다 — macOS는 Keychain, Windows는 DPAPI다.
 * 여기 감지기가 통과해도 Windows 동작이 증명되지는 않는다. Windows 실확인이 따로 필요하다.
 */

/** Electron `safeStorage`에서 우리가 쓰는 부분만. 테스트에서 대역을 넣는다. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/** 암호문이 실제로 남는 자리. 파일이든 메모리든 이 모양이면 된다. */
export interface BlobStore {
  read(key: string): Buffer | undefined;
  write(key: string, value: Buffer): void;
  delete(key: string): void;
}

export class EncryptionUnavailableError extends Error {
  constructor() {
    super('OS 자격증명 저장소를 쓸 수 없다 — 단말 토큰을 평문으로 두지 않는다');
    this.name = 'EncryptionUnavailableError';
  }
}

const DEVICE_TOKEN_KEY = 'device-token';

export class SecureStore {
  constructor(
    private readonly safeStorage: SafeStorageLike,
    private readonly blobs: BlobStore,
  ) {}

  /**
   * 암호화를 쓸 수 없으면 **평문으로 떨어뜨리지 않고 던진다.**
   * 토큰을 못 지키느니 저장을 실패시키는 편이 안전하다.
   */
  set(value: string): void {
    if (!this.safeStorage.isEncryptionAvailable()) throw new EncryptionUnavailableError();
    this.blobs.write(DEVICE_TOKEN_KEY, this.safeStorage.encryptString(value));
  }

  /** 저장된 적이 없으면 `undefined`. 복호화 실패는 그대로 던진다 — 조용히 삼키지 않는다. */
  get(): string | undefined {
    const blob = this.blobs.read(DEVICE_TOKEN_KEY);
    if (blob === undefined) return undefined;
    if (!this.safeStorage.isEncryptionAvailable()) throw new EncryptionUnavailableError();
    return this.safeStorage.decryptString(blob);
  }

  clear(): void {
    this.blobs.delete(DEVICE_TOKEN_KEY);
  }
}
