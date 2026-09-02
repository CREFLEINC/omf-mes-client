import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const TOKEN_KEY = 'device-token';

/* Keystore 읽기는 비동기인데 요청 가로채기는 동기다. 마지막으로 읽거나 쓴 값을 여기 둔다. */
let cached: string | null = null;

export const readDeviceToken = async (): Promise<string | null> => {
  cached = await SecureStorage.getItem(TOKEN_KEY);
  return cached;
};

export const writeDeviceToken = async (token: string): Promise<void> => {
  await SecureStorage.setItem(TOKEN_KEY, token);
  cached = token;
};

export const clearDeviceToken = async (): Promise<void> => {
  await SecureStorage.remove(TOKEN_KEY);
  cached = null;
};

/** 요청에 실을 토큰. 아직 읽기 전이면 null 이며 그 사이 요청은 인증 없이 나간다. */
export const currentDeviceToken = (): string | null => cached;
