import type { WorkerResponse } from './verify';

/**
 * 셸(POP)이 여는 통로 중 **이 화면이 쓰는 자리만** 좁게 읽는다 — 캐시와 미전송 큐다.
 *
 * ⭐ **브라우저에서는 통로가 없다.** 같은 코드 한 벌이 브라우저·Electron 양쪽에서 도니
 * 없을 때가 정상이고, 없으면 `null`·`0`을 돌려준다. ⛔ 없다고 던지지 않는다 — 관리웹에서
 * 이 화면을 열어 보는 것만으로 화면이 깨진다.
 *
 * ⛔ **통로를 넓히지 않는다.** 셸의 `contextBridge` 가 유일한 통로라는 결정(#441)을
 * 지키기 위해, 여기서는 이미 열려 있는 함수만 읽고 새 자리를 요구하지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

interface PopBridge {
  cache: {
    get: (key: string) => Promise<string | undefined>;
    put: (key: string, value: string, fetchedAt: string) => Promise<void>;
  };
  outbox: {
    size: () => Promise<number>;
  };
}

/** 캐시 열쇠. 공장별로 갈라 두 공장 단말이 서로의 목록을 읽지 않게 한다. */
export const workerDirectoryKey = (plantId: number | null): string =>
  `worker-directory:${plantId ?? 'all'}`;

const bridge = (): PopBridge | null => {
  const pop = (globalThis as { pop?: unknown }).pop;

  return isBridge(pop) ? pop : null;
};

const isBridge = (value: unknown): value is PopBridge => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<PopBridge>;

  return (
    typeof candidate.cache?.get === 'function' &&
    typeof candidate.cache?.put === 'function' &&
    typeof candidate.outbox?.size === 'function'
  );
};

/**
 * 미리 받아 둔 작업자 목록. **통로가 없거나 아직 한 번도 받지 못했으면 `null`이다** —
 * 빈 배열과 구분한다(§6). 빈 배열은 「받았는데 아무도 없다」이고, `null` 은 「받은 적이
 * 없다」라서 화면이 할 말이 다르다.
 */
export const readWorkerDirectory = async (
  plantId: number | null,
): Promise<WorkerResponse[] | null> => {
  const pop = bridge();

  if (pop === null) return null;

  try {
    const raw = await pop.cache.get(workerDirectoryKey(plantId));

    if (raw === undefined) return null;

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as WorkerResponse[]) : null;
  } catch {
    /* 깨진 캐시는 «받지 못한 것»으로 본다 — 반쯤 읽은 목록으로 사번을 확인하지 않는다. */
    return null;
  }
};

/**
 * 온라인에 닿은 김에 목록을 갈아 둔다. 통로가 없으면 아무 일도 하지 않는다.
 *
 * ⛔ **던지지 않는다.** 셸 쪽에서 실패하면 약속이 거부되는데, 부르는 자리가 화면 그리기
 * 도중이라 그대로 새면 아무도 받지 않는 오류가 된다 — 다음 오프라인 확인이 근거 없이
 * 막히는데 그 이유가 어디에도 남지 않는다. 대신 **성공 여부를 돌려준다.**
 */
export const writeWorkerDirectory = async (
  plantId: number | null,
  workers: readonly WorkerResponse[],
  fetchedAt: string,
): Promise<boolean> => {
  const pop = bridge();

  if (pop === null) return false;

  try {
    await pop.cache.put(workerDirectoryKey(plantId), JSON.stringify(workers), fetchedAt);

    return true;
  } catch {
    return false;
  }
};

/**
 * 아직 보내지 못한 기록 수. 교대 경고가 이 값을 쓴다(§6).
 *
 * ⛔ **큐의 사번을 바꾸지 않는다**(B-3 이력 불변). 세는 것이 전부다.
 */
export const readOutboxSize = async (): Promise<number> => {
  const pop = bridge();

  if (pop === null) return 0;

  try {
    return await pop.outbox.size();
  } catch {
    /*
     * ⛔ **던지지 않는다** — 세지 못했다고 교대 자체가 막히면 안 된다. 세지 못한 것은
     * 「없다」와 다르지만, 화면이 할 수 있는 일은 경고를 못 내는 것뿐이다.
     */
    return 0;
  }
};
