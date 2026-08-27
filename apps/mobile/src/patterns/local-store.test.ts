import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const set = vi.fn();
const remove = vi.fn();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: (...args: unknown[]) => get(...args),
    set: (...args: unknown[]) => set(...args),
    remove: (...args: unknown[]) => remove(...args),
  },
}));

const { readLocal, writeLocal, removeLocal } = await import('./local-store');

describe('로컬 저장소', () => {
  beforeEach(() => {
    get.mockReset();
    set.mockReset();
    remove.mockReset();
  });

  it('보관된 값을 읽는다', async () => {
    get.mockResolvedValue({ value: 'SYN-VALUE-01' });

    await expect(readLocal('syn-key')).resolves.toBe('SYN-VALUE-01');
    expect(get).toHaveBeenCalledWith({ key: 'syn-key' });
  });

  it('없는 값은 null 로 온다', async () => {
    get.mockResolvedValue({ value: null });

    await expect(readLocal('syn-missing')).resolves.toBeNull();
  });

  it('값을 보관한다', async () => {
    set.mockResolvedValue(undefined);

    await writeLocal('syn-key', 'SYN-VALUE-02');

    expect(set).toHaveBeenCalledWith({ key: 'syn-key', value: 'SYN-VALUE-02' });
  });

  it('값을 지운다', async () => {
    remove.mockResolvedValue(undefined);

    await removeLocal('syn-key');

    expect(remove).toHaveBeenCalledWith({ key: 'syn-key' });
  });
});
