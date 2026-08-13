import { messages } from '@omf-mes/i18n';

import { normalizeText, readDateFilter, readNumberFilter } from './filters';

/**
 * 「처리 이력」 탭의 조회 조건 — **주소가 정본이다.**
 *
 * **대상 조건과 파일을 가른다.** 한 주소가 두 탭의 조건을 함께 싣지만, 비우는 규칙은 서로
 * 다르다 — 대상 조건이 바뀌면 `gr`가 풀리고 이력 조건·`gi`는 그대로이며(수명 표 1~3행),
 * 이력 조건이 바뀌면 `gi`가 풀리고 대상 쪽은 그대로다(9행). 한 모듈에 섞으면 한쪽 조건을
 * 비우는 규칙이 다른 쪽까지 끌고 간다.
 *
 * **주소 키에 `i` 접두를 붙인다.** 두 탭이 같은 뜻의 조건(기간·상태·검색어)을 각자 갖는데
 * 키가 겹치면 한 탭의 조회가 다른 탭의 조건으로 나간다.
 *
 * **값 판정(`readNumberFilter`·`readDateFilter`·`normalizeText`)은 `filters.ts`에서 가져다
 * 쓴다.** 조건 목록은 갈라 두되 「이 값이 뜻이 있는가」는 한 곳에서만 정한다 — 갈리면 같은
 * 주소를 손으로 고쳐도 탭에 따라 다른 요청이 나간다.
 *
 * **고른 품의(`gi`)는 이 모듈이 만들지 않는다.** 조건·쪽이 바뀌면 그 품의가 새 결과에 없을
 * 수 있어 함께 비워져야 하고(수명 표 9행), 고르는 쪽만 이 결과에 덧붙인다.
 * 읽기(`readSelectedIssueId`)는 여기 두되 쓰기는 두지 않는 비대칭이 그 규칙이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

export interface IssueFilters {
  /** 출고일 범위. `DatePicker mode="range"` 한 컨트롤이 `YYYY-MM-DD` 두 값을 준다. */
  from: string;
  to: string;
  /** 출고 유형 코드. 선택지가 자리표시라 지금은 주소를 손으로 고칠 때만 들어온다. */
  issueType: string;
  /** 폐기 사유 코드. **이 탭의 조건 축이다**(계획 §5.5). 같은 위. */
  reason: string;
  /** 전표 상태 코드. 같은 위. */
  status: string;
  /** 출고번호 검색어 */
  q: string;
}

/**
 * 이력 탭이 아무 조건도 걸지 않은 상태.
 *
 * **기본 기간을 심지 않는다**(대상 탭과 같은 규칙). 심으면 첫 진입 요청에 날짜가 실리고,
 * 사용자는 왜 그 기간만 보이는지 화면 어디에서도 읽을 수 없다.
 */
export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  from: '',
  to: '',
  issueType: '',
  reason: '',
  status: '',
  q: '',
};

const HISTORY_URL_KEYS = {
  from: 'ifrom',
  to: 'ito',
  issueType: 'ity',
  reason: 'irs',
  status: 'ist',
  q: 'iq',
  page: 'ipage',
} as const;

/**
 * `toHistorySearchParams`가 **만들지 않는** 키. 고르는 쪽이 덧붙이고, 조건이 바뀌면 함께 사라진다.
 * 이름을 여기 한 번만 적어 두면 화면과 이 모듈이 같은 문자열을 쓴다.
 */
export const HISTORY_SELECTION_KEYS = {
  goodsIssue: 'gi',
} as const;

export const readIssueFilters = (params: URLSearchParams): IssueFilters => ({
  from: readDateFilter(params.get(HISTORY_URL_KEYS.from) ?? ''),
  to: readDateFilter(params.get(HISTORY_URL_KEYS.to) ?? ''),
  issueType: normalizeText(params.get(HISTORY_URL_KEYS.issueType) ?? ''),
  reason: normalizeText(params.get(HISTORY_URL_KEYS.reason) ?? ''),
  status: normalizeText(params.get(HISTORY_URL_KEYS.status) ?? ''),
  /*
   * **검색어만 원문 그대로 읽는다** — 이 값은 검색칸에 그대로 서야 하므로(친 공백이 말없이
   * 사라지면 사용자가 자기가 무엇을 쳤는지 되짚을 수 없다) 다듬기는 **쓰는 자리**가 한다.
   */
  q: params.get(HISTORY_URL_KEYS.q) ?? '',
});

/** 이력 목록이 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readIssuePage = (params: URLSearchParams): number => {
  const raw = params.get(HISTORY_URL_KEYS.page) ?? '';

  return readNumberFilter(raw) === '' ? 1 : Number(raw);
};

/**
 * 고른 품의(출고 전표)의 번호. **요청 쿼리에 실리지 않는다** — 출고 상세의 경로 조각이고,
 * 그 상세가 실어 주는 승인 요청 값이 결재 진행 조회의 뿌리가 된다.
 *
 * **목록 소속으로 판정하지 않는다**(계획 결정 3) — 조건이 좁아 목록에 없는 품의를 고른 상태가
 * 조용히 지워지면 안 된다. 그 품의가 있는가는 상세 조회가 답한다.
 */
export const readSelectedIssueId = (params: URLSearchParams): number | null => {
  const raw = readNumberFilter(params.get(HISTORY_SELECTION_KEYS.goodsIssue) ?? '');

  return raw === '' ? null : Number(raw);
};

/**
 * 이력 조건 전체를 주소로 옮긴다. **빈 조건은 키 자체를 두지 않는다.**
 *
 * **`gi`를 만들지 않는다.** 조건·쪽이 바뀌면 고른 품의가 새 결과에 없을 수 있어 함께
 * 비워져야 한다(수명 표 9행).
 *
 * **대상 탭의 키도 만들지 않는다.** 두 탭의 조건을 합치는 것은 화면의 주소 조립 한 문이 한다 —
 * 여기서 함께 만들면 이력 조건 하나를 바꿀 때 대상 조건까지 이 모듈이 정하게 된다.
 */
export const toHistorySearchParams = (filters: IssueFilters, page: number): URLSearchParams => {
  const next = new URLSearchParams();

  const entries: [string, string][] = [
    [HISTORY_URL_KEYS.from, readDateFilter(filters.from)],
    [HISTORY_URL_KEYS.to, readDateFilter(filters.to)],
    [HISTORY_URL_KEYS.issueType, normalizeText(filters.issueType)],
    [HISTORY_URL_KEYS.reason, normalizeText(filters.reason)],
    [HISTORY_URL_KEYS.status, normalizeText(filters.status)],
    [HISTORY_URL_KEYS.q, normalizeText(filters.q)],
  ];

  for (const [key, value] of entries) {
    if (value !== '') next.set(key, value);
  }

  if (page > 1) next.set(HISTORY_URL_KEYS.page, String(page));

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름.
 *
 * **`supplierId`를 쓰지 않는다** — 반품 축이다(계획 §5.4-19). 실으면 폐기 품의가 공급사로
 * 걸러진다. **`sourceWarehouseId`도 조건으로 열지 않는다** — 이 탭의 조건 축은 폐기 사유이고
 * 창고는 열로만 보인다(계획 §5.5).
 *
 * `size`는 싣지 않는다 — 서버 기본값을 쓴다.
 */
export interface IssueFilterQuery {
  issuedAtFrom?: string;
  issuedAtTo?: string;
  issueTypeCode?: string;
  reasonCode?: string;
  statusCode?: string;
  q?: string;
}

export const toIssueFilterQuery = (filters: IssueFilters): IssueFilterQuery => {
  const from = readDateFilter(filters.from);
  const to = readDateFilter(filters.to);
  const issueType = normalizeText(filters.issueType);
  const reason = normalizeText(filters.reason);
  const status = normalizeText(filters.status);
  const query = normalizeText(filters.q);

  return {
    ...(from === '' ? {} : { issuedAtFrom: from }),
    ...(to === '' ? {} : { issuedAtTo: to }),
    ...(issueType === '' ? {} : { issueTypeCode: issueType }),
    ...(reason === '' ? {} : { reasonCode: reason }),
    ...(status === '' ? {} : { statusCode: status }),
    ...(query === '' ? {} : { q: query }),
  };
};

/** 칩이 되는 조건. **기간은 칩 하나다** — 시작과 종료가 한 조건이다. */
export type IssueChipFilterKey = 'period' | 'issueType' | 'reason' | 'status' | 'q';

/**
 * ×로 풀 수 있는 조건. **기간이 빠져 있다** — 날짜 컨트롤이 값을 개별로 비우는 수단을 주지
 * 않아 기간을 푸는 길은 「초기화」뿐이다.
 */
export type RemovableIssueChipKey = Exclude<IssueChipFilterKey, 'period'>;

/** 조건 칩 하나. 갈래로 나눠 두어야 ×가 있는 칩만 해제 핸들러를 받는다. */
export type IssueFilterChip =
  | { key: 'period'; label: string; removeLabel: null }
  | { key: RemovableIssueChipKey; label: string; removeLabel: string };

/** 기간 칩의 문구. 한쪽만 넣은 기간도 조건이므로 세 갈래로 갈린다. */
const periodLabel = (from: string, to: string): string => {
  if (from !== '' && to !== '') return t.historyFilters.chipPeriodBoth(from, to);

  return from !== '' ? t.historyFilters.chipPeriodFrom(from) : t.historyFilters.chipPeriodTo(to);
};

/**
 * 적용된 조건마다 칩 하나. 차례는 조건 줄의 컨트롤 차례와 같다.
 *
 * **칩의 판정 기준을 요청의 판정 기준과 같게 둔다.** 둘이 갈리면 손으로 고친 주소에서
 * **조건은 걸리지 않는데 칩만 뜬다.**
 *
 * **참조 이름을 받지 않는다** — 이 탭의 조건은 전부 코드와 글자라 번호를 이름으로 풀 자리가
 * 없다(창고는 조건이 아니다).
 */
export const toIssueFilterChips = (filters: IssueFilters): IssueFilterChip[] => {
  const from = readDateFilter(filters.from);
  const to = readDateFilter(filters.to);
  const issueType = normalizeText(filters.issueType);
  const reason = normalizeText(filters.reason);
  const status = normalizeText(filters.status);
  const query = normalizeText(filters.q);

  const candidates: [IssueFilterChip, string][] = [
    [{ key: 'period', label: periodLabel(from, to), removeLabel: null }, from === '' ? to : from],
    [
      {
        key: 'issueType',
        label: t.historyFilters.chipIssueType(issueType),
        removeLabel: t.historyFilters.chipRemoveIssueType,
      },
      issueType,
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
    [
      {
        key: 'q',
        label: t.historyFilters.chipQ(query),
        removeLabel: t.historyFilters.chipRemoveQ,
      },
      query,
    ],
  ];

  return candidates.filter(([, value]) => value !== '').map(([chip]) => chip);
};

/** 칩 하나를 푼다. **기간은 여기 들어오지 않는다** — 푸는 길이 「초기화」뿐이다. */
export const clearIssueFilter = (
  filters: IssueFilters,
  key: RemovableIssueChipKey,
): IssueFilters => ({
  ...filters,
  [key]: '',
});
