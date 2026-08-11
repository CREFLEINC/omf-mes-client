import { messages } from '@omf-mes/i18n';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **고른 실사(`ct`)와 위치(`loc`)는 이 모듈이 만들지 않는다.** 조건·쪽이 바뀌면 그 둘이
 * 새 결과에 없을 수 있어 함께 비워져야 하고(수명 표 1~3행), 고르는 쪽만 이 결과에 덧붙인다.
 * 읽기(`readSelectedCountId`·`readSelectedLocationId`)는 여기 두되 쓰기는 두지 않는 비대칭이
 * 그 규칙이다(계획 결정 3의 구현 규칙 1).
 *
 * **초안은 주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을
 * 같은 통로로 다루게 된다. 이 화면의 초안은 둘(개시·라인)이며 PR ②·③에서 생긴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stocktaking;

export interface CountFilters {
  /** 창고 번호. 정수만 뜻이 있다 — 계약이 `warehouseId`를 정수로 요구한다. */
  warehouse: string;
  /** 계획일 범위. `<input type="date">`가 주는 `YYYY-MM-DD` 그대로다. */
  from: string;
  to: string;
  /** 실사 유형 코드. 선택지가 자리표시라 지금은 주소를 손으로 고칠 때만 들어온다(계획 결정 10). */
  countType: string;
  /** 상태 코드. 같은 위. */
  status: string;
  /** 진행 중인 실사만. **참일 때만** 주소와 요청에 실린다. */
  inProgressOnly: boolean;
}

/**
 * 화면이 아무 조건도 걸지 않은 상태.
 *
 * **기본 기간을 심지 않는다**(W-01-09가 세운 규칙). 심으면 첫 진입 요청에 날짜가 실리고,
 * 사용자는 왜 그 기간만 보이는지 화면 어디에서도 읽을 수 없다.
 *
 * **「진행 중만」도 기본으로 켜지 않는다.** 켜 두면 이미 마감된 실사를 찾을 방법이 첫 화면에
 * 없고, 걸린 조건을 사용자가 고른 적이 없다.
 */
export const DEFAULT_FILTERS: CountFilters = {
  warehouse: '',
  from: '',
  to: '',
  countType: '',
  status: '',
  inProgressOnly: false,
};

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  warehouse: 'wh',
  from: 'from',
  to: 'to',
  countType: 'ty',
  status: 'st',
  inProgressOnly: 'prog',
  page: 'page',
} as const;

/**
 * `toSearchParams`가 **만들지 않는** 키. 고르는 쪽이 덧붙이고, 조건이 바뀌면 함께 사라진다.
 * 이름을 여기 한 번만 적어 두면 화면과 이 모듈이 같은 문자열을 쓴다.
 */
export const SELECTION_KEYS = {
  count: 'ct',
  location: 'loc',
} as const;

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
const ON = '1';

const POSITIVE_INTEGER = /^\d+$/;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 정수가 아닌 번호는 조건으로 받지 않는다. 그대로 `Number()`에 넘기면 `NaN`이 요청 URL에 실려
 * **조회 전체가 400으로 실패**하고, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
 * 주소를 손으로 고친 경우가 이 자리다.
 */
const readNumberFilter = (raw: string): string =>
  POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? raw : '';

/**
 * **자릿수뿐 아니라 실제로 있는 날짜인지도 본다.** `2026-02-31`은 자릿수가 맞지만 없는 날이라
 * 그대로 보내면 조회가 늘 실패하는데 화면에는 조건이 걸린 것처럼 보인다.
 * `Date`로 되짚어 같은 날짜가 나오는지 확인한다.
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
 * **실사 유형과 상태 코드가 같은 규칙을 쓴다.** 자유 문자열 조건이 둘인데 한쪽만 다듬으면
 * `?st=%20`이 `statusCode: ' '`로 요청에 실리고 칩도 「상태:  」로 뜬다 —
 * 사용자가 만들 수 없는 값이지만(선택지가 비어 있다) 주소는 손으로 고쳐지는 자리다.
 */
const normalizeText = (raw: string): string => raw.trim();

export const readFilters = (params: URLSearchParams): CountFilters => ({
  warehouse: readNumberFilter(params.get(URL_KEYS.warehouse) ?? ''),
  from: readDateFilter(params.get(URL_KEYS.from) ?? ''),
  to: readDateFilter(params.get(URL_KEYS.to) ?? ''),
  countType: normalizeText(params.get(URL_KEYS.countType) ?? ''),
  status: normalizeText(params.get(URL_KEYS.status) ?? ''),
  inProgressOnly: params.get(URL_KEYS.inProgressOnly) === ON,
});

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return readNumberFilter(raw) === '' ? 1 : Number(raw);
};

/**
 * 고른 실사의 번호. **요청 쿼리에 실리지 않는다** — 상세·라인·쓰기 경로의 **조각**으로만 쓴다.
 *
 * 주소에 두는 이유는 새로고침·뒤로가기·공유가 같은 실사를 열어야 하기 때문이다.
 */
export const readSelectedCountId = (params: URLSearchParams): number | null => {
  const raw = readNumberFilter(params.get(SELECTION_KEYS.count) ?? '');

  return raw === '' ? null : Number(raw);
};

/**
 * 고른 위치의 번호. 라인 조회와 치환 요청이 쓰는 축이며 그 자리는 PR ③에 있다.
 *
 * **이 PR에서도 읽는다** — 조건·쪽·실사가 바뀔 때 함께 비워지는지 주소로 판정해야 하고
 * (수명 표 1~4행), 그 규칙은 라인 표가 생기기 전에도 지켜져야 한다.
 */
export const readSelectedLocationId = (params: URLSearchParams): number | null => {
  const raw = readNumberFilter(params.get(SELECTION_KEYS.location) ?? '');

  return raw === '' ? null : Number(raw);
};

/**
 * 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * 첫 쪽이면 `page`를 적지 않는다. 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다.
 *
 * **`ct`·`loc`를 만들지 않는다.** 조건·쪽이 바뀌면 고른 실사와 위치가 새 결과에 없을 수
 * 있어 함께 비워져야 하고(수명 표 1~3행), 고르는 쪽만 이 결과에 덧붙인다.
 */
export const toSearchParams = (filters: CountFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    [URL_KEYS.warehouse, readNumberFilter(filters.warehouse)],
    [URL_KEYS.from, readDateFilter(filters.from)],
    [URL_KEYS.to, readDateFilter(filters.to)],
    [URL_KEYS.countType, normalizeText(filters.countType)],
    [URL_KEYS.status, normalizeText(filters.status)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (filters.inProgressOnly) next.set(URL_KEYS.inProgressOnly, ON);

  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름.
 *
 * `size`는 싣지 않는다 — 목록의 쪽 크기는 서버 기본값을 쓴다. 라인 조회만 예외로 상수를
 * 싣는데(계획 결정 8) 그 자리는 PR ③이다.
 */
export interface CountFilterQuery {
  warehouseId?: number;
  plannedDateFrom?: string;
  plannedDateTo?: string;
  countTypeCode?: string;
  statusCode?: string;
  /** **참일 때만 실린다.** 거짓을 실으면 「조건을 걸지 않았다」와 「끄기로 골랐다」가 뭉개진다. */
  inProgressOnly?: true;
}

export const toFilterQuery = (filters: CountFilters): CountFilterQuery => {
  const warehouse = readNumberFilter(filters.warehouse);
  const from = readDateFilter(filters.from);
  const to = readDateFilter(filters.to);
  const countType = normalizeText(filters.countType);
  const status = normalizeText(filters.status);

  return {
    ...(warehouse === '' ? {} : { warehouseId: Number(warehouse) }),
    ...(from === '' ? {} : { plannedDateFrom: from }),
    ...(to === '' ? {} : { plannedDateTo: to }),
    ...(countType === '' ? {} : { countTypeCode: countType }),
    ...(status === '' ? {} : { statusCode: status }),
    ...(filters.inProgressOnly ? { inProgressOnly: true as const } : {}),
  };
};

/**
 * 칩이 되는 조건. **기간은 칩 하나다** — 시작과 종료가 한 조건이라 따로 떼면
 * 한쪽만 지웠을 때 남은 쪽이 무엇을 뜻하는지 읽기 어렵다.
 */
export type ChipFilterKey = 'warehouse' | 'period' | 'countType' | 'status' | 'inProgress';

export interface FilterChip {
  key: ChipFilterKey;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/**
 * 참조 조건의 표시 이름. **화면이 이름으로 풀어 넘긴다.**
 *
 * 이 모듈이 번호를 문구로 바꾸지 않는 것이 #44를 구조로 막는 형태다 —
 * 내부 번호를 문자열로 만드는 자리가 아예 없으면 그 값이 화면에 샐 경로도 없다.
 */
export interface FilterChipNames {
  warehouse: string;
}

/** 기간 칩의 문구. 한쪽만 넣은 기간도 조건이므로 세 갈래로 갈린다. */
const periodLabel = (from: string, to: string): string => {
  if (from !== '' && to !== '') return t.filters.chipPeriodBoth(from, to);

  return from !== '' ? t.filters.chipPeriodFrom(from) : t.filters.chipPeriodTo(to);
};

/**
 * 적용된 조건마다 칩 하나. 순서는 조건 줄의 컨트롤 순서와 같다.
 *
 * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 둘이 갈리면 손으로 고친 주소
 * (`?st=%20%20`·`?from=2026-13-01`)에서 **조건은 걸리지 않는데 칩만 뜬다** —
 * 사용자는 칩을 보고 조건이 걸린 줄 알고, 결과가 그대로인 이유를 화면 어디에서도 읽을 수 없다.
 */
export const toFilterChips = (filters: CountFilters, names: FilterChipNames): FilterChip[] => {
  const from = readDateFilter(filters.from);
  const to = readDateFilter(filters.to);
  const countType = normalizeText(filters.countType);
  const status = normalizeText(filters.status);

  const candidates: [FilterChip, boolean][] = [
    [
      {
        key: 'warehouse',
        label: t.filters.chipWarehouse(names.warehouse),
        removeLabel: t.filters.chipRemoveWarehouse,
      },
      readNumberFilter(filters.warehouse) !== '',
    ],
    [
      {
        key: 'period',
        label: periodLabel(from, to),
        removeLabel: t.filters.chipRemovePeriod,
      },
      from !== '' || to !== '',
    ],
    [
      {
        key: 'countType',
        label: t.filters.chipCountType(countType),
        removeLabel: t.filters.chipRemoveCountType,
      },
      countType !== '',
    ],
    [
      {
        key: 'status',
        label: t.filters.chipStatus(status),
        removeLabel: t.filters.chipRemoveStatus,
      },
      status !== '',
    ],
    [
      {
        key: 'inProgress',
        label: t.filters.chipInProgress,
        removeLabel: t.filters.chipRemoveInProgress,
      },
      filters.inProgressOnly,
    ],
  ];

  return candidates.filter(([, applied]) => applied).map(([chip]) => chip);
};

/**
 * 칩 하나를 푼다. **기간은 두 조건을 함께 푼다** — 칩이 하나인데 한쪽만 풀면
 * 칩을 지웠는데 조건이 남아 결과가 그대로다.
 */
export const clearFilter = (filters: CountFilters, key: ChipFilterKey): CountFilters => {
  switch (key) {
    case 'period':
      return { ...filters, from: '', to: '' };
    case 'inProgress':
      return { ...filters, inProgressOnly: false };
    default:
      return { ...filters, [key]: '' };
  }
};
