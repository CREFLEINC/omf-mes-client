import { Preferences } from '@capacitor/preferences';

export const readLocal = async (key: string): Promise<string | null> => {
  const { value } = await Preferences.get({ key });
  return value;
};

export const writeLocal = async (key: string, value: string): Promise<void> => {
  await Preferences.set({ key, value });
};

export const removeLocal = async (key: string): Promise<void> => {
  await Preferences.remove({ key });
};
