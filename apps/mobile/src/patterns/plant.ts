import { readLocal, removeLocal, writeLocal } from './local-store';

const PLANT_KEY = 'plant-id';

/* 저장소 읽기는 비동기인데 쓰는 쪽은 동기다. 마지막으로 읽거나 쓴 값을 여기 둔다. */
let cached: number | null = null;

/**
 * 이 단말이 선 공장.
 *
 * ⛔ **토큰에서 읽지 않는다**(#1103). 단말 토큰이 싣고 오는 것은 단말 «번호» 하나뿐이라
 * 토큰에서 공장을 꺼내려 하면 언제나 null 이 나오고, 공장을 알아야 하는 쓰기 화면이 전부
 * 막힌다. 등록할 때 «서버가 말해 준» 공장을 단말에 남겨 두고 그것을 읽는다.
 *
 * 아직 읽기 전이거나 남겨 둔 적이 없으면 null 이다. 그때 0 이나 1 로 채우면 다른 공장의
 * 재고가 는다 — 모르는 것은 모르는 채로 내고, 부르는 쪽이 막는다.
 */
export const currentPlantId = (): number | null => cached;

/** 남겨 둔 공장을 읽어 둔다. **화면을 세우기 전에 한 번 부른다.** */
export const readPlantId = async (): Promise<number | null> => {
  const stored = await readLocal(PLANT_KEY);
  const parsed = stored === null ? Number.NaN : Number(stored);

  cached = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;

  return cached;
};

/** 등록이 확인된 뒤 그 단말의 공장을 남긴다. */
export const rememberPlant = async (plantId: number): Promise<void> => {
  await writeLocal(PLANT_KEY, String(plantId));
  cached = plantId;
};

/** 등록이 풀리면 함께 잊는다 — 남겨 두면 다음 등록까지 옛 공장으로 쓴다. */
export const forgetPlant = async (): Promise<void> => {
  await removeLocal(PLANT_KEY);
  cached = null;
};
