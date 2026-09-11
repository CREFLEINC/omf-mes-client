import type { paths } from '@omf-mes/api-client';

import { isSourceCode, isStage, type SourceCode, type Stage } from './codes';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 목록을 내게 하려면 화면 상태가
 * 아니라 주소가 조건을 들고 있어야 한다.
 *
 * ⚠ **기간이 없다.** 이 목록은 「지금 판정을 기다리는 것」이라 재고성이고, 기간을 강제하면 오래된
 * 미처리 건이 화면에서 사라진다 — 계약이 그 이유로 기간을 필수로 두지 않았다.
 */
export interface TargetFilters {
  warehouseId: string;
  sourceCode: string;
  stage: string;
  q: string;
}

export const EMPTY_FILTERS: TargetFilters = { warehouseId: '', sourceCode: '', stage: '', q: '' };

type CandidateQueryParams = NonNullable<
  paths['/quality/disposition-candidates']['get']['parameters']['query']
>;
type NonconformanceQueryParams = NonNullable<
  paths['/quality/nonconformances']['get']['parameters']['query']
>;

/** 판정 대상 목록 질의 — 「전체」·「부적합 없음」이 이 경로다. */
export interface CandidateListQuery {
  sourceCode?: CandidateQueryParams['sourceCode'];
  withoutNonconformanceOnly?: true;
  warehouseId?: number;
  q?: string;
  page?: number;
}

/**
 * 부적합 목록 질의 — 「의뢰 전·판정 대기·판정 완료」가 이 경로다(요구서 §3-7 둘째 행).
 *
 * ⛔ **이 갈래는 지금 부를 수 없다** — 임시 서버 기준선이 `openedFrom`·`openedTo`를
 * `required`로 올렸다(통보 186). 화면은 기간 조건을 갖지 않으므로 보낼 값이 없다.
 *
 * **값을 지어내 채우지 않는다.** 「먼 과거부터 먼 미래까지」로 두 칸을 메우면 계약은 만족하지만
 * 공유계약 L-3이 막으려는 바로 그 조회가 된다 — L-3의 근거는 성능이 아니라 **「파티션 키 없이
 * 조회하면 전 파티션을 스캔한다」**이고, L-3-2 ⑶은 「⛔ 어떤 목록도 무계로 두지 않는다」를
 * 이름으로 금지한다. 형식만 채운 기간은 무계 목록을 감춘 것이지 없앤 것이 아니다.
 *
 * ⭐ **설계는 이 자리를 이미 예외로 다뤘다** — L-3-2 ⑷ 「적체 관리 화면은 예외다 — 기본이
 * 「미처리 전건」이라 기간을 걸 수 없다(L-12). 그 자리는 「미처리만」 축이 유계를 대신한다」.
 * 「의뢰 전 · 판정 대기 · 판정 완료」가 그 적체 관리다. 형제 오퍼레이션
 * `GET /quality/disposition-candidates`의 계약 설명이 든 이유(기간을 강제하면 오래된 미처리
 * 건이 사라진다)도 같은 조항의 표현이다.
 *
 * 그래서 이것은 클라이언트가 값을 채워 덮을 문제가 아니라 **서버팀에 돌려보낼 불일치**다.
 * 그때까지 이 갈래는 요청을 세우지 않는다(`queries.ts`의 `enabled`). 서버가 기간 쌍을 조건부
 * 필수로 되돌리거나 적체 예외를 인정하면 이 가드와 아래 `isPeriodContractBlocked`를 걷어낸다.
 */
export interface NonconformanceListQuery {
  statusCode: string;
  sourceCode?: NonconformanceQueryParams['sourceCode'];
  warehouseId?: number;
  page?: number;
}

export type ListQuery =
  | { source: 'candidates'; query: CandidateListQuery }
  | { source: 'nonconformances'; query: NonconformanceListQuery };

/**
 * 주소에 실리는 이름.
 *
 * ⭐ `nonconformanceId`만 줄여 쓰지 않는다 — W-03-10이 같은 이름으로 부적합을 지목하므로(진입 규약)
 * 두 화면 사이를 오갈 때 값을 옮겨 적기 쉽다. 나머지는 이 화면 안에서만 쓰여 짧게 둔다.
 */
const KEYS = {
  warehouseId: 'wh',
  sourceCode: 'src',
  stage: 'st',
  q: 'q',
  page: 'page',
  lot: 'lot',
  nonconformanceId: 'nonconformanceId',
} as const;

/**
 * 이 화면의 정식 주소. 라우트에 등록된 값과 **같아야 한다** — 라우트 감지기가 그것을 고정한다.
 * 화면 슬라이스는 `routes/`를 참조할 수 없으므로(의존 방향) 값을 여기 둔다.
 */
export const DISPOSITION_REQUEST_SCREEN_PATH = '/shipment/disposition-requests';

const POSITIVE_INTEGER = /^\d+$/;

const isIdentifier = (raw: string): boolean => {
  const parsed = Number(raw);
  return POSITIVE_INTEGER.test(raw) && Number.isSafeInteger(parsed) && parsed >= 1;
};

const identifierOf = (raw: string | null): string => {
  const value = raw?.trim() ?? '';
  return isIdentifier(value) ? value : '';
};

const keywordOf = (raw: string | null): string => raw?.trim() ?? '';

/** 주소의 값이 허용 목록 밖이면 «없음»으로 읽는다 — 손으로 고친 주소가 서버 400을 만들지 않게 한다. */
export const readFilters = (params: URLSearchParams): TargetFilters => {
  const sourceCode = params.get(KEYS.sourceCode)?.trim() ?? '';
  const stage = params.get(KEYS.stage)?.trim() ?? '';

  return {
    warehouseId: identifierOf(params.get(KEYS.warehouseId)),
    sourceCode: isSourceCode(sourceCode) ? sourceCode : '',
    stage: isStage(stage) ? stage : '',
    q: keywordOf(params.get(KEYS.q)),
  };
};

export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(KEYS.page) ?? '';
  return isIdentifier(raw) ? Number(raw) : 1;
};

/** 고른 대상. LOT과 부적합 중 있는 것만 든다 — 둘 다 없으면 고른 것이 없다. */
export interface Selection {
  lotId: number | null;
  nonconformanceId: number | null;
}

export const NO_SELECTION: Selection = { lotId: null, nonconformanceId: null };

export const readSelection = (params: URLSearchParams): Selection => {
  const lot = identifierOf(params.get(KEYS.lot));
  const nonconformance = identifierOf(params.get(KEYS.nonconformanceId));

  return {
    lotId: lot === '' ? null : Number(lot),
    nonconformanceId: nonconformance === '' ? null : Number(nonconformance),
  };
};

export const hasSelection = (selection: Selection): boolean =>
  selection.lotId !== null || selection.nonconformanceId !== null;

const replace = (params: URLSearchParams, key: string, value: string): void => {
  if (value === '') params.delete(key);
  else params.set(key, value);
};

export const toAppliedSearchParams = (
  current: URLSearchParams,
  filters: TargetFilters,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams(current);

  replace(next, KEYS.warehouseId, identifierOf(filters.warehouseId));
  replace(next, KEYS.sourceCode, isSourceCode(filters.sourceCode) ? filters.sourceCode : '');
  replace(next, KEYS.stage, isStage(filters.stage) ? filters.stage : '');
  replace(next, KEYS.q, keywordOf(filters.q));
  replace(next, KEYS.page, page > 1 ? String(page) : '');
  // 조건이 바뀌면 앞서 고른 대상은 목록에 없을 수 있다 — 고른 것을 지우고 다시 고르게 한다.
  next.delete(KEYS.lot);
  next.delete(KEYS.nonconformanceId);

  return next;
};

export const withSelection = (current: URLSearchParams, selection: Selection): URLSearchParams => {
  const next = new URLSearchParams(current);
  replace(next, KEYS.lot, selection.lotId === null ? '' : String(selection.lotId));
  replace(
    next,
    KEYS.nonconformanceId,
    selection.nonconformanceId === null ? '' : String(selection.nonconformanceId),
  );
  return next;
};

/**
 * 조건을 요청 질의로 옮긴다 — **상태가 소스를 가른다.**
 *
 * - 비움 · `NONE` → 판정 대상 목록. `NONE`은 `withoutNonconformanceOnly=true`로 서버가 거른다
 *   (⛔ 화면이 응답을 걸러 대신하지 않는다 — 쪽 단위라 쪽 안에서만 걸러진다).
 * - 부적합 상태 셋 → 부적합 목록에 `statusCode`로. 검색어는 그 경로에 축이 없어 싣지 않는다.
 */
export const toListQuery = (filters: TargetFilters, page: number): ListQuery => {
  const warehouseId =
    filters.warehouseId === '' ? {} : { warehouseId: Number(filters.warehouseId) };
  const sourceCode: { sourceCode?: SourceCode } = isSourceCode(filters.sourceCode)
    ? { sourceCode: filters.sourceCode }
    : {};
  const pageQuery = page > 1 ? { page } : {};
  const stage: Stage | '' = isStage(filters.stage) ? filters.stage : '';

  if (stage === '' || stage === 'NONE') {
    return {
      source: 'candidates',
      query: {
        ...sourceCode,
        ...(stage === 'NONE' ? { withoutNonconformanceOnly: true as const } : {}),
        ...warehouseId,
        ...(filters.q === '' ? {} : { q: filters.q }),
        ...pageQuery,
      },
    };
  }

  return {
    source: 'nonconformances',
    query: { statusCode: stage, ...sourceCode, ...warehouseId, ...pageQuery },
  };
};

/**
 * 지금 이 조건으로 목록을 부를 수 없는가 — 위 `NonconformanceListQuery` 주석의 사유(통보 186 ·
 * 공유계약 L-3-2 ⑷)다.
 *
 * **조회 실패가 아니라 「부를 수 없음」이다.** 둘을 뭉뚱그리면 화면이 빈 목록을 내고 사용자가
 * 「부적합이 없다」로 읽는다 — 적체 관리 화면에서 그 오독은 미처리 건을 없는 것으로 만든다.
 */
export const isPeriodContractBlocked = (query: ListQuery): boolean =>
  query.source === 'nonconformances';
