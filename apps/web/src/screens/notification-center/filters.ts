import { PERIOD_URL_KEYS, type NotificationPeriod } from './period';

/**
 * 주소가 조회 조건의 정본이다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * 조건은 셋이다 — 기간 · 「안 읽음만」 · 유형. 기간은 **풀 수 없는 조건**이라 수명이 달라
 * `period.ts`가 소유하고, 나머지 둘과 쪽이 이 파일에 있다.
 *
 * **주소 키는 짧게 쓰고 계약 이름과 분리한다** — 주소는 사람이 읽고 고치는 자리다.
 */

const ON = '1';
const OFF = '0';

/**
 * 「안 읽음만」의 기본값.
 *
 * ⭐ **켜진 채로 시작한다**(화면 스펙 §4의 배치). 알림은 계속 쌓이므로 「아직 안 본 것」이
 * 먼저 보여야 이 화면이 하는 일과 맞는다.
 *
 * ⚠ **형제 화면들의 boolean 조건과 기본값이 반대다.** `stocktaking`의 `inProgressOnly`와
 * `putaway-rule`의 `activeOnly`는 `params.get(key) === ON` 한 줄로 읽는데, **그 형태가 참인
 * 이유는 그 화면들의 기본값이 꺼짐이기 때문**이다. 여기서 그 줄을 그대로 베끼면 기본값이
 * 조용히 뒤집힌다. 그래서 읽기를 갈래 함수로 두고 **기본값을 이 상수 한 곳**에 모은다.
 */
export const DEFAULT_UNREAD_ONLY = true;

/** 이 화면이 쓰는 주소 키 전부. 기간 두 키는 `period.ts`가 소유한다. */
export const URL_KEYS = {
  ...PERIOD_URL_KEYS,
  unreadOnly: 'unread',
  eventCode: 'ev',
  page: 'page',
} as const;

export interface NotificationFilters {
  unreadOnly: boolean;
  /** 알림 유형 코드. 빈 문자열이 「전체」다 */
  eventCode: string;
}

export const DEFAULT_FILTERS: NotificationFilters = {
  unreadOnly: DEFAULT_UNREAD_ONLY,
  eventCode: '',
};

/**
 * 주소의 값을 「안 읽음만」의 켜짐/꺼짐으로 읽는다.
 *
 * **키가 없거나 모르는 값이면 기본값이다.** 주소는 손으로 고쳐지는 자리라 `unread=아무거나`가
 * 올 수 있는데, 그것을 꺼짐으로 읽으면 사용자가 만들지 않은 조건이 걸린다.
 */
const readUnreadOnly = (raw: string | null): boolean => {
  if (raw === ON) return true;
  if (raw === OFF) return false;

  return DEFAULT_UNREAD_ONLY;
};

/** 공백만 친 값은 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다. */
const normalizeText = (raw: string): string => raw.trim();

export const readFilters = (params: URLSearchParams): NotificationFilters => ({
  unreadOnly: readUnreadOnly(params.get(URL_KEYS.unreadOnly)),
  eventCode: normalizeText(params.get(URL_KEYS.eventCode) ?? ''),
});

const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다.
 *
 * ⚠ **자릿수 상한을 형제 사본보다 하나 더 본다.** 전례들은 `/^\d+$/`와 `>= 1`만 보는데,
 * 그 형태로는 22자리(`1111111111111111111111`)가 통과해 `1.1111111111111112e+21`이 요청에
 * 실린다 — 자바스크립트 정수 범위를 넘겨 `Number`가 지수 표기로 바꾼 값이라 서버가 읽지 못한다.
 * 안전 정수까지 확인해 그 자리를 막는다.
 */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  if (!NON_NEGATIVE_INTEGER.test(raw)) return 1;

  const page = Number(raw);

  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};

/**
 * 조건 전체를 주소로 옮긴다.
 *
 * **기본값은 주소에 적지 않는다** — 적으면 같은 화면의 주소가 두 가지가 되어 공유·비교가
 * 어긋난다. 「안 읽음만」은 기본과 다를 때만, 유형은 고른 것이 있을 때만, 쪽은 첫 쪽이
 * 아닐 때만 키가 생긴다.
 *
 * ⚠ **기간은 늘 실린다** — 계약이 필수로 두어 비어 있을 수 없다(다른 조건과 갈리는 자리다).
 */
export const toSearchParams = (
  period: NotificationPeriod,
  filters: NotificationFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams({
    [URL_KEYS.from]: period.from,
    [URL_KEYS.to]: period.to,
  });

  if (filters.unreadOnly !== DEFAULT_UNREAD_ONLY) {
    next.set(URL_KEYS.unreadOnly, filters.unreadOnly ? ON : OFF);
  }

  const eventCode = normalizeText(filters.eventCode);
  if (eventCode !== '') next.set(URL_KEYS.eventCode, eventCode);

  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 기간을 주소에 심는다.
 *
 * ⭐ **받은 주소를 통째로 갈아 끼우지 않는다.** 기간 두 키만 덮고 나머지는 그대로 둔다 —
 * 새 주소를 만들어 넣으면 사용자가 걸어 둔 다른 조건이 **기본값을 채우는 김에 함께 사라진다.**
 * 전례 `master-change/screen.tsx`가 같은 이유로 같은 형태를 쓴다.
 */
export const withPeriod = (
  params: URLSearchParams,
  period: NotificationPeriod,
): URLSearchParams => {
  const next = new URLSearchParams(params);

  next.set(URL_KEYS.from, period.from);
  next.set(URL_KEYS.to, period.to);

  return next;
};

/** 계약이 쓰는 쿼리 이름. **고른 것만 키가 생긴다.** */
export interface NotificationFilterQuery {
  unreadOnly?: true;
  eventCode?: string;
}

/**
 * 조건을 요청 쿼리로 옮긴다.
 *
 * ⭐ **「전체」에는 키 자체를 싣지 않는다** — `unreadOnly=false`를 실으면 요청 URL이 조건이
 * 걸린 것처럼 보이고, 서버가 그 값을 어떻게 다룰지도 계약에 없다.
 */
export const toFilterQuery = (filters: NotificationFilters): NotificationFilterQuery => {
  const eventCode = normalizeText(filters.eventCode);

  return {
    ...(filters.unreadOnly ? { unreadOnly: true as const } : {}),
    ...(eventCode === '' ? {} : { eventCode }),
  };
};
