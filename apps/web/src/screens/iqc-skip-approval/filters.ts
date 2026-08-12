import { messages } from '@omf-mes/i18n';

import type { RequestFilters } from './types';

/**
 * 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를 내게 하려면
 * 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **이 파일이 소유하는 규칙 다섯**
 *
 * | 규칙 | 어디에 |
 * | --- | --- |
 * | **실존하는 날짜만** 조건이다 | `isExistingDate` — 읽는 자리·주소·요청 세 곳이 모두 이 판정을 지난다 |
 * | 조건·확인칸·쪽이 바뀌면 고른 요청(`rq`)이 사라진다 | `toSearchParams`가 그 자리를 **만들지 않는다** |
 * | 기본값은 주소에 적지 않는다(켜진 확인칸·첫 쪽) | `toSearchParams` |
 * | **고정 축 `assignedToMe`가 늘 실린다** | `toRequestListQuery` — 이 화면은 판정하는 자리다 |
 * | 상신일을 **`YYYY-MM-DD` 그대로** 보낸다 | `toRequestListQuery` |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 * 날짜 조건을 다루는 화면이 이미 있으나 그중에는 계약이 `date-time`이라 RFC3339로 바꿔
 * 보내는 것이 있다. **여기서 그 변환을 베끼면 틀린다** — 이 계약의 두 파라미터는 `format: date`다.
 */

const t = messages.iqcSkipApproval;

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
const URL_KEYS = {
  statusCode: 'st',
  from: 'from',
  to: 'to',
  q: 'q',
  pendingOnly: 'pd',
  page: 'page',
  selected: 'rq',
} as const;

/**
 * 「결재 대기만 보기」의 기본값 — **켜짐**이다.
 *
 * 이 화면에 들어오는 이유가 「지금 내가 판정할 것」이라, 첫 화면이 끝난 건까지 함께 보이면
 * 사용자가 매번 좁혀야 한다. 기본값이라 **켜져 있을 때는 주소에 적지 않는다.**
 */
export const PENDING_ONLY_DEFAULT = true;

/** 확인칸을 **끈** 상태만 주소에 적는다. 켜진 것은 기본값이라 적을 것이 없다. */
const PENDING_ONLY_OFF = '0';

const POSITIVE_INTEGER = /^\d+$/;

/** 식별자로 쓸 수 있는 값인가. 1부터 매겨지므로 0·음수·소수·문자는 어떤 자원도 가리키지 않는다. */
const isIdentifier = (raw: string): boolean => POSITIVE_INTEGER.test(raw) && Number(raw) >= 1;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 자릿수가 맞고 **실제로 있는 날짜**인가.
 *
 * 자릿수만 보면 `2026-13-45`·`2026-02-31`이 통과해 그대로 요청에 실린다. 계약의 목록 응답에는
 * **400이 없어** 서버가 그런 값에 무엇을 하는지 정해져 있지도 않다 — 화면이 보내기 전에 막는다.
 *
 * 실존 판정은 **되짚기**로 한다: 만든 날짜의 해·달·일이 넣은 값과 같으면 그 날짜가 있는 것이다.
 * `Date`가 넘치는 값을 다음 달로 굴리므로(2월 31일 → 3월 3일) 되짚으면 달라진다.
 * 인자를 모두 주므로 실행 환경의 시각을 읽지 않는다 — 이 파일은 순수하게 남는다.
 */
const isExistingDate = (value: string): boolean => {
  const matched = DATE_PATTERN.exec(value);
  if (matched === null) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const made = new Date(year, month - 1, day);

  return made.getFullYear() === year && made.getMonth() === month - 1 && made.getDate() === day;
};

/** 날짜로 쓸 수 있는 값만 남긴다. 아니면 「비어 있는 것」과 같이 다룬다. */
const dateOf = (value: string): string => (isExistingDate(value) ? value : '');

/** 검색어로 쓸 수 있는가. 공백만인 값은 조건이 아니다 — 주소에도 요청에도 칩에도 서지 않는다. */
const keywordOf = (q: string): string => q.trim();

/**
 * 조건으로 실을 수 있는 코드인가. **공백만인 값은 채워지지 않은 것으로 본다** —
 * 그 값으로 좁히면 어떤 요청도 걸리지 않는데 사용자에게는 「대기가 없다」로 읽힌다.
 */
const codeOf = (value: string | null): string => (value === null ? '' : value.trim());

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_FILTERS: RequestFilters = {
  statusCode: '',
  from: '',
  to: '',
  q: '',
};

/**
 * 주소가 담은 조회 조건. **뜻을 잃은 값은 읽는 자리에서 걷어 낸다.**
 *
 * 네 조건이 **모두** 위생 판정을 지난다 — 상태 코드는 `codeOf`, 날짜는 `dateOf`, 검색어는
 * 뒤이어 `keywordOf`가 받는다. 한 축만 판정 밖에 두면 그 축으로만 「어떤 요청도 걸리지 않는
 * 조건」이 주소·요청·칩 세 자리에 그대로 흘러간다.
 *
 * **여기 한 자리에서 거르는 이유**: 주소·요청·칩은 이 함수의 결과를 받으므로 읽는 자리가
 * 막으면 셋이 함께 낫는다. 자리마다 따로 적으면 한쪽만 고쳐져 「요청에는 안 실리는데 칩은
 * 서 있는」 어긋남이 생긴다.
 */
export const readFilters = (params: URLSearchParams): RequestFilters => ({
  statusCode: codeOf(params.get(URL_KEYS.statusCode)),
  from: dateOf(params.get(URL_KEYS.from) ?? ''),
  to: dateOf(params.get(URL_KEYS.to) ?? ''),
  q: params.get(URL_KEYS.q) ?? '',
});

/**
 * 주소가 가리키는 「결재 대기만 보기」.
 *
 * **끈 것만 주소에 적히므로 판정도 그 한 값으로 한다** — 모르는 값(`pd=엉뚱한값`)은 기본값으로
 * 본다. 주소는 손으로 고쳐지는 자리이고, 알 수 없는 값을 「꺼진 것」으로 읽으면 사용자가
 * 끈 적 없는데 끝난 건까지 보이게 된다.
 */
export const readPendingOnly = (params: URLSearchParams): boolean =>
  params.get(URL_KEYS.pendingOnly) !== PENDING_ONLY_OFF;

/** 주소가 가리키는 쪽. 이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다. */
export const readPage = (params: URLSearchParams): number => {
  const raw = params.get(URL_KEYS.page) ?? '';

  return isIdentifier(raw) ? Number(raw) : 1;
};

/** 주소가 가리키는 요청. 식별자가 아니면 아무것도 고르지 않은 것이다. */
export const readSelectedRequestId = (params: URLSearchParams): number | null => {
  const raw = params.get(URL_KEYS.selected) ?? '';

  return isIdentifier(raw) ? Number(raw) : null;
};

/**
 * 조건·확인칸·쪽 전체를 주소로 옮긴다. **빈 조건과 기본값은 키 자체를 두지 않는다** —
 * 주소가 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있고,
 * 같은 화면의 주소가 두 가지가 되면 공유·뒤로가기가 갈린다.
 *
 * **고른 요청(`rq`)을 담지 않는다.** 조건·확인칸·쪽이 바뀌면 보이는 행이 달라지므로
 * 이 함수의 결과로 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다 —
 * 목록에 없는 요청의 상세가 아래에 남으면 그것이 어디서 왔는지 알 수 없다.
 */
export const toSearchParams = (
  filters: RequestFilters,
  pendingOnly: boolean,
  page: number,
): URLSearchParams => {
  const next = new URLSearchParams();
  const keyword = keywordOf(filters.q);
  const from = dateOf(filters.from);
  const to = dateOf(filters.to);

  if (filters.statusCode !== '') next.set(URL_KEYS.statusCode, filters.statusCode);
  if (from !== '') next.set(URL_KEYS.from, from);
  if (to !== '') next.set(URL_KEYS.to, to);
  if (keyword !== '') next.set(URL_KEYS.q, keyword);
  if (!pendingOnly) next.set(URL_KEYS.pendingOnly, PENDING_ONLY_OFF);
  if (page > 1) next.set(URL_KEYS.page, String(page));

  return next;
};

/**
 * 선택을 얹은 주소.
 *
 * **조건·확인칸·쪽은 그대로 두고 선택 자리만 다시 세운다** — 요청을 고르는 것은 보이는 행을
 * 바꾸지 않으므로 조건을 비울 이유가 없다(비우는 규칙은 `toSearchParams`가 갖는다).
 */
export const toSelectionSearchParams = (
  filters: RequestFilters,
  pendingOnly: boolean,
  page: number,
  approvalRequestId: number | null,
): URLSearchParams => {
  const next = toSearchParams(filters, pendingOnly, page);

  if (approvalRequestId !== null) next.set(URL_KEYS.selected, String(approvalRequestId));

  return next;
};

/**
 * 고른 요청만 주소에서 뺀다. **조건·확인칸·쪽은 손대지 않는다.**
 *
 * `toSearchParams`로 다시 만들지 않고 **지금 주소에서 한 칸만 빼는** 이유: 이 길은 뒤 회차에서
 * 상세가 404일 때 지나는 자리라, 화면이 아는 조건으로 주소를 다시 조립하면 주소에만 있고
 * 화면은 모르는 값(다른 화면이 붙였을 수 있다)이 함께 사라진다.
 */
export const withoutSelection = (params: URLSearchParams): URLSearchParams => {
  const next = new URLSearchParams(params);

  next.delete(URL_KEYS.selected);

  return next;
};

/**
 * 계약이 쓰는 쿼리 이름.
 *
 * **`size`가 없다.** 서버 기본값을 쓴다 — 화면이 정한 크기를 심으면 그것이 계약처럼 굳는다.
 *
 * **`requestedByMe`·`myTurnOnly`가 없다.** 이 화면은 상신하지 않으므로 「내가 올린 것」 축이
 * 존재할 수 없고, 대기 건수는 **결재함이 세는 자리**라 같은 수를 여기서 다시 세지 않는다.
 */
export interface RequestListQuery {
  assignedToMe?: boolean;
  pendingOnly?: boolean;
  approvalTypeCode?: string;
  statusCode?: string;
  requestedAtFrom?: string;
  requestedAtTo?: string;
  q?: string;
  page?: number;
}

/**
 * 서버로 보낼 조회 쿼리. **고정 축 둘과 조건 넷이 여기서 한 벌로 합쳐진다.**
 *
 * | 축 | 실리는 것 | 근거 |
 * | --- | --- | --- |
 * | 고정 ① | `assignedToMe=true` | 계약: 「로그인 사용자가 승인자인 단계가 있는 요청」. 이 화면은 **판정하는 자리**다 |
 * | 고정 ② | `approvalTypeCode` | 이 화면의 정체. **값이 없는 동안은 실리지 않는다**(`code-options.ts`) |
 *
 * **유형 코드를 인자로 받는다.** 상수를 여기서 직접 읽으면 「값이 확정되면 조건이 실린다」는
 * 전환을 잴 수 없다 — 인자로 두면 두 방향을 단위 시험이 고정하고, 화면은 상수를 넘기기만 한다.
 *
 * **상신일을 그대로 싣는다.** 계약이 `format: date`(날짜)라 시각·시간대를 붙이면 400이다.
 */
export const toRequestListQuery = (
  filters: RequestFilters,
  pendingOnly: boolean,
  page: number,
  approvalTypeCode: string | null,
): RequestListQuery => {
  const keyword = keywordOf(filters.q);
  const from = dateOf(filters.from);
  const to = dateOf(filters.to);
  const typeCode = codeOf(approvalTypeCode);

  return {
    /* 고정 축 — 조건이 아니라 이 화면의 전제라 사용자가 풀 수 없다. */
    assignedToMe: true,
    ...(pendingOnly ? { pendingOnly: true } : {}),
    ...(typeCode === '' ? {} : { approvalTypeCode: typeCode }),
    ...(filters.statusCode === '' ? {} : { statusCode: filters.statusCode }),
    ...(from === '' ? {} : { requestedAtFrom: from }),
    ...(to === '' ? {} : { requestedAtTo: to }),
    ...(keyword === '' ? {} : { q: keyword }),
    ...(page > 1 ? { page } : {}),
  };
};

/**
 * 조건 칩의 키. **`RequestFilters`의 키와 같지 않다** — 상신일 구간은 두 필드지만
 * 사용자에게는 조건 하나라, 칩도 하나이고 풀 때도 두 끝이 함께 풀려야 한다.
 *
 * **「결재 대기만 보기」는 칩이 아니다.** 칩은 「모아서 걸고 하나씩 푸는」 조건의 표시인데
 * 확인칸은 자기 상태를 스스로 보이고 즉시 반영된다 — 칩을 두면 같은 사실이 두 자리에 서고,
 * 그 둘이 갈리는 순간 어느 쪽이 지금 걸린 것인지 알 수 없다.
 */
export type FilterChipKey = 'statusCode' | 'period' | 'q';

export interface RequestFilterChip {
  key: FilterChipKey;
  label: string;
  /** 제거 버튼의 접근 이름. 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  removeLabel: string;
}

/** 적용된 조건마다 칩 하나. 차례는 조건 줄의 컨트롤 차례와 같다. */
export const toFilterChips = (filters: RequestFilters): RequestFilterChip[] => {
  const chips: RequestFilterChip[] = [];
  const keyword = keywordOf(filters.q);
  const from = dateOf(filters.from);
  const to = dateOf(filters.to);

  if (filters.statusCode !== '') {
    chips.push({
      key: 'statusCode',
      label: t.filters.chipStatus(filters.statusCode),
      removeLabel: t.filters.chipRemoveStatus,
    });
  }

  /*
   * 한쪽만 있는 구간을 **양쪽 있는 것처럼 적지 않는다.** 주소를 손으로 고치면 실제로 생기는
   * 상태이고, 그때 없는 끝을 지어내면 사용자가 걸지 않은 조건을 걸었다고 읽는다.
   */
  if (from !== '' || to !== '') {
    const label =
      from !== '' && to !== ''
        ? t.filters.chipPeriod(from, to)
        : from !== ''
          ? t.filters.chipPeriodFrom(from)
          : t.filters.chipPeriodTo(to);

    chips.push({ key: 'period', label, removeLabel: t.filters.chipRemovePeriod });
  }

  if (keyword !== '') {
    chips.push({
      key: 'q',
      label: t.filters.chipKeyword(keyword),
      removeLabel: t.filters.chipRemoveKeyword,
    });
  }

  return chips;
};

/**
 * 조건 하나만 푼다. 칩의 제거 버튼이 쓴다.
 *
 * **기간은 두 끝을 함께 푼다** — 칩 하나가 두 필드를 대표하므로 한쪽만 지우면
 * 칩이 사라진 뒤에도 조회를 좁히는 조건이 남는다.
 */
export const clearFilter = (filters: RequestFilters, key: FilterChipKey): RequestFilters =>
  key === 'period' ? { ...filters, from: '', to: '' } : { ...filters, [key]: '' };
