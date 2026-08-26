import { beforeEach, describe, expect, it, vi } from 'vitest';

const getItem = vi.fn();
const setItem = vi.fn();
const remove = vi.fn();

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    getItem: (...args: unknown[]) => getItem(...args),
    setItem: (...args: unknown[]) => setItem(...args),
    remove: (...args: unknown[]) => remove(...args),
  },
}));

const { readDeviceToken, writeDeviceToken, clearDeviceToken } = await import('./device-token');

describe('단말 토큰 보관', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    remove.mockReset();
  });

  it('보관된 토큰을 읽는다', async () => {
    getItem.mockResolvedValue('SYN-TOKEN-01');

    await expect(readDeviceToken()).resolves.toBe('SYN-TOKEN-01');
    expect(getItem).toHaveBeenCalledWith('device-token');
  });

  it('보관된 토큰이 없으면 null 을 준다', async () => {
    getItem.mockResolvedValue(null);

    await expect(readDeviceToken()).resolves.toBeNull();
  });

  it('토큰을 보관한다', async () => {
    setItem.mockResolvedValue(undefined);

    await writeDeviceToken('SYN-TOKEN-02');

    expect(setItem).toHaveBeenCalledWith('device-token', 'SYN-TOKEN-02');
  });

  it('토큰을 지운다', async () => {
    remove.mockResolvedValue(true);

    await clearDeviceToken();

    expect(remove).toHaveBeenCalledWith('device-token');
  });

  it('보관 실패를 삼키지 않는다', async () => {
    setItem.mockRejectedValue(new Error('키 저장 실패'));

    await expect(writeDeviceToken('SYN-TOKEN-03')).rejects.toThrow('키 저장 실패');
  });
});
