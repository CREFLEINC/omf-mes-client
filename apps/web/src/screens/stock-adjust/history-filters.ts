import { messages } from '@omf-mes/i18n';

/**
 * 「처리 이력」 탭의 조회 조건 — **주소가 정본이다.**
 *
 * 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면 화면 상태가 아니라 주소가 조건을 들고
 * 있어야 한다.
 *
 * ⛔ **승인 대기 조건(`pendingApprovalOnly`)을 만들지 않는다**(조심 ① · D-3 · C41).
 * 계약의 조정 목록 조회에 그 조건이 **남아 있고** 설명이 「승인 대기 탭」이다 — 자리를 두면
 * 저절로 실리므로, 이 파일의 조건 목록에 그 이름이 **아예 없다**는 것이 방어의 형태다.
 * 승인·반려는 결재함(W-CO-09)이 소유한다.
 *
 * **주소 키에 `h` 접두를 붙인다.** 등록 탭이 진입 맥락으로 `count`를 쓰므로(`entry.ts`),
 * 이력의 실사 조건이 같은 키를 쓰면 **재고실사에서 넘어온 주소가 곧 이력의 조건이 된다** —
 * 사용자가 걸지 않은 조건으로 목록이 좁혀지고, 그 사정은 화면 어디에도 적혀 있지 않다.
 *
 * **고른 전표(`ia`)는 이 모듈이 만들지 않는다.** 조건·쪽이 바뀌면 그 전표가 새 결과에 없을 수
 * 있어 함께 비워져야 하고, 고르는 쪽만 이 결과에 덧붙인다. 읽기(`readSelectedAdjustmentId`)는
 * 여기 두되 쓰기는 두지 않는 비대칭이 그 규칙이다.
 *
 * **검색어 칸이 없다** — 계약의 조정 목록 조회에 검색어 조건이 없다(실측). 만들면 쳐도 아무것도
 * 좁혀지지 않는 칸이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stockAdjust;

export interface AdjustmentFilters {
  /** 대상 실사 번호. **선택칸의 값이고 화면이 이름으로 풀어 그린다**(`omf-mes#44`) */
  count: string;
  /** 조정 사유 코드. 선택지가 자리표시라 지금은 주소를 손으로 고칠 때만 들어온다(D-9) */
  reason: string;
  /** 전표 상태 코드. 같은 위 */
  status: string;
  /** 전기일 범위. `DatePicker mode="range"` 한 컨트롤이 `YYYY-MM-DD` 두 값을 준다 */
  from: string;
  to: string;
}

/**
 * 이력 탭이 아무 조건도 걸지 않은 상태.
 *
 * **기본 기간을 심지 않는다.** 심으면 첫 진입 요청에 날짜가 실리고, 사용자는 왜 그 기간만
 * 보이는지 화면 어디에서도 읽을 수 없다. 게다가 이 조건은 **전기일**이라 기본값을 심으면
 * **아직 전기되지 않은 전표가 통째로 사라진다** — 이 화면이 만든 전표의 대부분이 그렇다.
 */
export const DEFAULT_ADJUSTMENT_FILTERS: AdjustmentFilters = {
  count: '',
  reason: '',
  status: '',
  from: '',
  to: '',
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const HISTORY_URL_KEYS = {
  count: 'hc',
  reason: 'hrs',
  status: 'hst',
  from: 'hfrom',
  to: 'hto',
  page: 'hpage',
} as const;

/**
 * `toHistorySearchParams`가 **만들지 않는** 키. 고르는 쪽이 덧붙이고, 조건이 바뀌면 함께 사라진다.
 * 이름을 여기 한 번만 적어 두면 화면과 이 모듈이 같은 문자열을 쓴다.
 */
export const HISTORY_SELECTION_KEYS = {
  adjustment: 'ia',
} as const;

/**
 * 조건으로 받아들이는 번호의 모양.
 *
 * **자릿수에 상한을 둔다.** `^\d+$`만 두면 22자리 이상이 통과하는데, 그 값을 `Number()`에
 * 넘기면 `1e+21`이 되고 요청 URL에 **`hc=1e%2B21`**로 실린다 — 막겠다고 적은 「이상한 값이
 * URL에 실려 조회 전체가 실패한다」가 상한 쪽에서 그대로 되살아난다.
 *
 * **15자리로 끊는 이유**: 안전 정수 범위 안이라 `Number()`가 값을 조용히 바꾸지 않고, 지수
 * 표기가 나타나는 21자리에도 한참 못 미친다. 계약의 식별자는 64비트 정수이므로 더 짧게 끊으면
 * 서버가 낼 수 있는 정당한 번호를 화면이 조용히 버릴 수 있다.
 */
const POSITIVE_INTEGER = /^\d{1,15}$/;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * **조회 전체가 400으로 실패**하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 */
const readNumberFilter = (raw: string): string =>
  POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? raw : '';

/**
 * **자릿수뿐 아니라 실제로 있는 날짜인지도 본다.** `2026-02-31`은 자릿수가 맞지만 없는 날이라
 * 그대로 보내면 조회가 늘 실패하는데 화면에는 조건이 걸린 것처럼 보인다.
 */
const readDateFilter = (raw: string): string => {
  const matched = DATE_PATTERN.exec(raw);

  if (matched === null) return '';

  const [, year, month, day] = matched;
  const at = new Date(`${String(year)}-${String(month)}-${String(day)}T00:00:00Z`);

  if (Number.isNaN(at.getTime())) return '';

  return at.toISOString().slice(0, 10) === raw ? raw : '';
};

/**
 * 공백만 친 값은 조건이 아니다 — 주소에 남기면 조건이 걸린 것처럼 보인다.
 *
 * 선택지가 비어 있어 사용자가 만들 수 없는 값이지만(D-9) **주소는 손으로 고쳐지는 자리다.**
 */
const normalizeText = (raw: string): string => raw.trim();

export const readAdjustmentFilters = (params: URLSearchParams): AdjustmentFilters => ({
  count: readNumberFilter(params.get(HISTORY_URL_KEYS.count) ?? ''),
  reason: normalizeText(params.get(HISTORY_URL_KEYS.reason) ?? ''),
  status: normalizeText(params.get(HISTORY_URL_KEYS.status) ?? ''),
  from: readDateFilter(params.get(HISTORY_URL_KEYS.from) ?? ''),
  to: readDateFilter(params.get(HISTORY_URL_KEYS.to) ?? ''),
});

/** 이력 목록이 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readAdjustmentPage = (params: URLSearchParams): number => {
  const raw = params.get(HISTORY_URL_KEYS.page) ?? '';

  return readNumberFilter(raw) === '' ? 1 : Number(raw);
};

/**
 * 고른 조정 전표의 번호. **요청 쿼리에 실리지 않는다** — 상세 조회의 경로 조각이다.
 *
 * **목록 소속으로 판정하지 않는다** — 조건이 좁아 목록에 없는 전표를 고른 상태가 조용히
 * 지워지면 안 된다. 그 전표가 있는가는 상세 조회가 답한다.
 */
export const readSelectedAdjustmentId = (params: URLSearchParams): number | null => {
  const raw = readNumberFilter(params.get(HISTORY_SELECTION_KEYS.adjustment) ?? '');

  return raw === '' ? null : Number(raw);
};

/**
 * 이력 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다.**
 *
 * **`ia`를 만들지 않는다** — 조건·쪽이 바뀌면 고른 전표가 새 결과에 없을 수 있어 함께
 * 비워져야 한다. **등록 탭의 `count`도 만들지 않는다** — 두 탭의 값을 합치는 것은 화면의
 * 주소 조립 한 문이 한다.
 */
export const toHistorySearchParams = (
  filters: AdjustmentFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    [HISTORY_URL_KEYS.count, readNumberFilter(filters.count)],
    [HISTORY_URL_KEYS.reason, normalizeText(filters.reason)],
    [HISTORY_URL_KEYS.status, normalizeText(filters.status)],
    [HISTORY_URL_KEYS.from, readDateFilter(filters.from)],
    [HISTORY_URL_KEYS.to, readDateFilter(filters.to)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (page > 1) next.set(HISTORY_URL_KEYS.page, String(page));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름 — **넷뿐이다**(실측).
 *
 * ⛔ **`pendingApprovalOnly`가 이 타입에 없다**(D-3 · C41). 계약이 그 조건을 아직 정의하고
 * 있으나 이 화면에는 승인 대기 탭이 없다 — **거짓으로 싣는 것도 싣는 것이다**(그 조건이 요청
 * URL에 서고, 그 순간 없는 탭이 계약 수준에서 되살아난다). 뮤테이션 M-4가 겨누는 자리다.
 *
 * `size`는 싣지 않는다 — 서버 기본값을 쓴다.
 */
export interface AdjustmentFilterQuery {
  inventoryCountId?: number;
  reasonCode?: string;
  statusCode?: string;
  adjustedAtFrom?: string;
  adjustedAtTo?: string;
}

export const toAdjustmentFilterQuery = (filters: AdjustmentFilters): AdjustmentFilterQuery => {
  const count = readNumberFilter(filters.count);
  const reason = normalizeText(filters.reason);
  const status = normalizeText(filters.status);
  const from = readDateFilter(filters.from);
  const to = readDateFilter(filters.to);

  return {
    ...(count === '' ? {} : { inventoryCountId: Number(count) }),
    ...(reason === '' ? {} : { reasonCode: reason }),
    ...(status === '' ? {} : { statusCode: status }),
    ...(from === '' ? {} : { adjustedAtFrom: from }),
    ...(to === '' ? {} : { adjustedAtTo: to }),
  };
};

/** 칩이 되는 조건. **기간은 칩 하나다** — 시작과 종료가 한 조건이다. */
export type AdjustmentChipKey = 'period' | 'count' | 'reason' | 'status';

/**
 * ×로 풀 수 있는 조건. **기간이 빠져 있다** — 날짜 컨트롤이 값을 개별로 비우는 수단을 주지
 * 않아 기간을 푸는 길은 「초기화」뿐이다. ×를 달아 두면 눌러도 값이 남아 **칩은 사라졌는데
 * 조건은 걸려 있는** 상태가 된다.
 */
export type RemovableAdjustmentChipKey = Exclude<AdjustmentChipKey, 'period'>;

/** 조건 칩 하나. 갈래로 나눠 두어야 ×가 있는 칩만 해제 핸들러를 받는다. */
export type AdjustmentFilterChip =
  | { key: 'period'; label: string; removeLabel: null }
  | { key: RemovableAdjustmentChipKey; label: string; removeLabel: string };

/**
 * 참조 조건의 표시 이름. **화면이 이름으로 풀어 넘긴다.**
 *
 * 이 모듈이 번호를 문구로 바꾸지 않는 것이 `omf-mes#44`를 구조로 막는 형태다 — 내부 번호를
 * 문자열로 만드는 자리가 아예 없으면 그 값이 화면에 샐 경로도 없다.
 */
export interface AdjustmentChipNames {
  count: string;
}

/** 기간 칩의 문구. 한쪽만 넣은 기간도 조건이므로 세 갈래로 갈린다. */
const periodLabel = (from: string, to: string): string => {
  if (from !== '' && to !== '') return t.historyFilters.chipPeriodBoth(from, to);

  return from !== '' ? t.historyFilters.chipPeriodFrom(from) : t.historyFilters.chipPeriodTo(to);
};

/**
 * 적용된 조건마다 칩 하나. 차례는 조건 줄의 컨트롤 차례와 같다.
 *
 * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 둘이 갈리면 손으로 고친 주소
 * (`?hrs=%20`·`?hfrom=2026-13-01`)에서 **조건은 걸리지 않는데 칩만 뜬다** — 사용자는 칩을 보고
 * 조건이 걸린 줄 알고, 결과가 그대로인 이유를 화면 어디에서도 읽을 수 없다.
 */
export const toAdjustmentFilterChips = (
  filters: AdjustmentFilters,
  names: AdjustmentChipNames,
): AdjustmentFilterChip[] => {
  const count = readNumberFilter(filters.count);
  const reason = normalizeText(filters.reason);
  const status = normalizeText(filters.status);
  const from = readDateFilter(filters.from);
  const to = readDateFilter(filters.to);

  const candidates: [AdjustmentFilterChip, string][] = [
    [{ key: 'period', label: periodLabel(from, to), removeLabel: null }, from === '' ? to : from],
    [
      {
        key: 'count',
        label: t.historyFilters.chipCount(names.count),
        removeLabel: t.historyFilters.chipRemoveCount,
      },
      count,
    ],
    [
      {
        key: 'reason',
        label: t.historyFilters.chipReason(reason),
        removeLabel: t.historyFilters.chipRemoveReason,
      },
      reason,
    ],
    [
      {
        key: 'status',
        label: t.historyFilters.chipStatus(status),
        removeLabel: t.historyFilters.chipRemoveStatus,
      },
      status,
    ],
  ];

  return candidates.filter(([, value]) => value !== '').map(([chip]) => chip);
};

/** 칩 하나를 푼다. **기간은 여기 들어오지 않는다** — 푸는 길이 「초기화」뿐이다. */
export const clearAdjustmentFilter = (
  filters: AdjustmentFilters,
  key: RemovableAdjustmentChipKey,
): AdjustmentFilters => ({
  ...filters,
  [key]: '',
});
