import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentPlantId, forgetPlant, readPlantId, rememberPlant } from './plant';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('./local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

/*
 * ⭐ **공장은 토큰에서 읽지 않는다**(#1103). 실제 단말 토큰은 단말 «번호» 하나만 싣고 오므로,
 * 토큰에서 `plantId` 를 꺼내려 하면 언제나 null 이 나온다 — 공장을 알아야 하는 쓰기 화면이
 * 전부 막힌다. 등록할 때 서버가 말해 준 공장을 단말에 남겨 두고 그것을 읽는다.
 */
describe('단말이 선 공장', () => {
  beforeEach(async () => {
    store.clear();
    await forgetPlant();
  });

  it('등록할 때 남겨 둔 공장을 낸다', async () => {
    await rememberPlant(7);

    expect(currentPlantId()).toBe(7);
  });

  it('앱을 다시 켜도 남아 있다', async () => {
    await rememberPlant(7);
    await forgetPlant();
    expect(currentPlantId()).toBeNull();

    /* 다시 켠 것과 같다 — 저장소에는 남아 있고 읽어 오면 돌아온다. */
    store.set('plant-id', '7');
    expect(await readPlantId()).toBe(7);
    expect(currentPlantId()).toBe(7);
  });

  /* 모르는 것을 0 이나 1 로 채우면 다른 공장의 재고가 는다. */
  it('남겨 둔 적이 없으면 지어내지 않는다', async () => {
    expect(await readPlantId()).toBeNull();
    expect(currentPlantId()).toBeNull();
  });

  it('등록을 지우면 공장도 잊는다', async () => {
    await rememberPlant(7);
    await forgetPlant();

    expect(currentPlantId()).toBeNull();
    expect(await readPlantId()).toBeNull();
  });

  it('저장된 값이 수가 아니면 지어내지 않는다', async () => {
    store.set('plant-id', 'seven');

    expect(await readPlantId()).toBeNull();
  });
});
