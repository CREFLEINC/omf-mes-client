import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const TOKEN_KEY = 'device-token';

export const readDeviceToken = async (): Promise<string | null> => {
  return SecureStorage.getItem(TOKEN_KEY);
};

export const writeDeviceToken = async (token: string): Promise<void> => {
  await SecureStorage.setItem(TOKEN_KEY, token);
};

export const clearDeviceToken = async (): Promise<void> => {
  await SecureStorage.remove(TOKEN_KEY);
};
