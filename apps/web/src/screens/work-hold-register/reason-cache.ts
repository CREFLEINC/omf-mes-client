/**
 * 중단 사유 목록을 셸에 받아 둔다 — **끊긴 뒤에 고를 수 있게**(#1005).
 *
 * ## 왜 필요한가
 *
 * 중단·재개·종료 기록은 outbox 에 담기게 돼 있다. 그런데 **사유 목록은 서버에서만 받았다.**
 * 망이 끊기면 사유 라디오가 한 줄도 그려지지 않아 등록 자체가 불가능했다 — 큐를 둔 이유와
 * 정면으로 어긋난다. **설비가 멈춘 바로 그 순간**에 기록을 못 남기는 것이 이 결함의 값이다.
 *
 * ⭐ **연결돼 있을 때 받아 두는 것 말고 방법이 없다.** 사유는 공통코드라 단말이 지어낼 수
 *    없고, 목록 없이 코드만 받으면 작업자가 무엇을 고르는지 알 수 없다.
 *
 * ⛔ **통로가 없으면 아무 일도 하지 않는다.** 같은 코드가 브라우저(관리웹·개발 확인)에서도
 *    도는데, 셸 통로는 Electron 에만 있다. 없는 것이 정상이므로 던지지 않는다.
 *
 * ⚠ 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다
 *   (`worker-assignment/pop-bridge` 가 같은 규율로 선 전례다).
 */

/** 셸이 여는 통로 중 **이 자리가 쓰는 것만** 좁게 읽는다(#441 — 통로를 넓히지 않는다). */
interface PopCacheBridge {
  cache: {
    get: (key: string) => Promise<string | undefined>;
    put: (key: string, value: string, fetchedAt: string) => Promise<void>;
  };
}

/** 한 줄의 사유. 화면이 쓰는 것은 이 둘뿐이다. */
export interface HoldReason {
  code: string;
  name: string;
}

/** 캐시 열쇠. 사유 목록은 공장·단말로 갈리지 않는 공통코드라 한 벌이면 된다. */
export const HOLD_REASON_CACHE_KEY = 'hold-reasons';

const isBridge = (value: unknown): value is PopCacheBridge => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as { cache?: { get?: unknown; put?: unknown } };

  return typeof candidate.cache?.get === 'function' && typeof candidate.cache?.put === 'function';
};

const bridge = (): PopCacheBridge | null => {
  const pop = (globalThis as { pop?: unknown }).pop;

  return isBridge(pop) ? pop : null;
};

/** 한 줄이 사유의 모양인가. 깨진 캐시로 라디오를 세우지 않는다. */
const isReason = (value: unknown): value is HoldReason => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as { code?: unknown; name?: unknown };

  return typeof candidate.code === 'string' && typeof candidate.name === 'string';
};

/**
 * 받아 둔 사유 목록. **통로가 없거나 받은 적이 없으면 `null`** 이다 — 빈 배열과 구분한다.
 * 빈 배열은 「받았는데 사유가 없다」이고 `null` 은 「받은 적이 없다」라서 화면이 할 말이 다르다.
 */
export const readHoldReasons = async (): Promise<HoldReason[] | null> => {
  const pop = bridge();

  if (pop === null) return null;

  try {
    const raw = await pop.cache.get(HOLD_REASON_CACHE_KEY);

    if (raw === undefined) return null;

    const parsed: unknown = JSON.parse(raw);

    /* ⛔ 반쯤 읽은 목록으로 사유를 고르게 하지 않는다 — 한 줄이라도 모양이 아니면 버린다. */
    return Array.isArray(parsed) && parsed.every(isReason) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * 온라인에 닿은 김에 목록을 갈아 둔다. 통로가 없으면 아무 일도 하지 않는다.
 *
 * ⛔ **던지지 않는다.** 받아 두기가 실패했다고 지금의 조회까지 실패로 만들면, 연결된 상태에서
 *    사유를 고르는 정상 경로가 캐시 때문에 막힌다 — 순서가 뒤바뀐다.
 */
export const writeHoldReasons = async (
  reasons: readonly HoldReason[],
  fetchedAt: string,
): Promise<void> => {
  const pop = bridge();

  if (pop === null) return;

  try {
    await pop.cache.put(HOLD_REASON_CACHE_KEY, JSON.stringify(reasons), fetchedAt);
  } catch {
    /* 받아 두지 못한 것은 다음 연결에서 다시 시도된다. */
  }
};
