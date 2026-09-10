import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  HOLD_REASON_CACHE_KEY,
  readHoldReasons,
  writeHoldReasons,
  type HoldReason,
} from './reason-cache';

const REASONS: HoldReason[] = [
  { code: 'MOLD_CHANGE', name: '금형 교체' },
  { code: 'EQUIPMENT_FAILURE', name: '설비 고장' },
];

/** 셸이 여는 통로를 흉내 낸다. 담긴 값을 그대로 들고 있는다. */
const putBridge = (): { store: Map<string, string>; get: ReturnType<typeof vi.fn> } => {
  const store = new Map<string, string>();
  const get = vi.fn(async (key: string) => store.get(key));

  (globalThis as { pop?: unknown }).pop = {
    cache: {
      get,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };

  return { store, get };
};

afterEach(() => {
  delete (globalThis as { pop?: unknown }).pop;
});

describe('중단 사유를 셸에 받아 둔다 — #1005', () => {
  it('받아 둔 목록을 그대로 되찾는다', async () => {
    putBridge();

    await writeHoldReasons(REASONS, '2026-09-10T00:00:00.000Z');

    expect(await readHoldReasons()).toEqual(REASONS);
  });

  it('정해진 열쇠에 담는다 — 다른 화면의 캐시와 섞이지 않는다', async () => {
    const { store } = putBridge();

    await writeHoldReasons(REASONS, '2026-09-10T00:00:00.000Z');

    expect(store.has(HOLD_REASON_CACHE_KEY)).toBe(true);
  });

  /*
   * ⛔ 「받은 적이 없다」와 「받았는데 사유가 없다」는 화면이 할 말이 다르다. 앞은 `null`,
   *    뒤는 빈 배열이다 — 뭉개면 마스터를 채워야 할 상황을 다시 받아 보라고 말하게 된다.
   */
  it('받은 적이 없으면 빈 배열이 아니라 null 이다', async () => {
    putBridge();

    expect(await readHoldReasons()).toBeNull();
  });

  it('받았는데 사유가 0건인 것은 빈 배열로 남는다', async () => {
    putBridge();

    await writeHoldReasons([], '2026-09-10T00:00:00.000Z');

    expect(await readHoldReasons()).toEqual([]);
  });

  it('셸 밖(브라우저)에서는 통로가 없어 받아 둔 것도 없다', async () => {
    expect(await readHoldReasons()).toBeNull();
  });

  it('통로가 없어도 담기가 던지지 않는다', async () => {
    await expect(writeHoldReasons(REASONS, '2026-09-10T00:00:00.000Z')).resolves.toBeUndefined();
  });

  /* ⛔ 반쯤 읽은 목록으로 라디오를 세우지 않는다 — 고를 수 없는 줄이 섞인다. */
  it('모양이 아닌 줄이 섞이면 통째로 버린다', async () => {
    const { store } = putBridge();

    store.set(HOLD_REASON_CACHE_KEY, JSON.stringify([{ code: 'A', name: '가' }, { code: 'B' }]));

    expect(await readHoldReasons()).toBeNull();
  });

  it('깨진 캐시를 받아도 던지지 않는다', async () => {
    const { store } = putBridge();

    store.set(HOLD_REASON_CACHE_KEY, '{ 깨진 값');

    await expect(readHoldReasons()).resolves.toBeNull();
  });

  it('읽기가 실패해도 던지지 않는다', async () => {
    const { get } = putBridge();
    get.mockRejectedValueOnce(new Error('통로가 끊겼다'));

    await expect(readHoldReasons()).resolves.toBeNull();
  });
});
