/**
 * 좌측 검사 대상 목록의 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를
 * 내려면 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **이 파일이 소유하는 규칙 다섯**
 *
 * | 규칙 | 어디에 |
 * | --- | --- |
 * | **고정 축 하나가 늘 실린다** — `inspectionTypeCode=OQC` | `toListQuery` |
 * | 기본값은 주소에 적지 않는다(첫 쪽 · 좁히지 않음 · 대기·진행만 **켜짐**) | `toSearchParams` |
 * | 조건이 바뀌면 **고른 의뢰가 사라지고 첫 쪽으로 간다** | `toSearchParams` 가 그 자리를 만들지 않는다 |
 * | 식별자는 **1 이상 정수**만 조건이 된다 | `readIdentifier` |
 * | **기간을 만들지 않는다** | 아래 단락 |
 *
 * ⭐ **검사 유형만 고정 축이다.** 이 화면은 OQC 출하검사의 판정 자리이므로 검사 유형은 화면이
 * 정하는 것이고(IQC·PQC 는 다른 화면이다) 사용자가 끄고 켤 것이 아니다.
 *
 * ⭐ **`pendingOnly` 는 고정 축이 아니라 사용자 조건이다.** 계약이 정의를 값으로 못박았다 —
 * `pendingOnly=true ⇔ statusCode ∈ { REQUESTED, IN_PROGRESS }`. 끄면 판정이 끝난 의뢰도 함께
 * 와서 지나간 판정을 되짚을 수 있다. ⛔ 그래서 **상태 코드를 조건 줄에 두지 않는다** — 두려면
 * 값 목록이 필요하고, 값 목록을 화면에 고정하는 것은 금지다(공유계약 G-6).
 *
 * ⛔ **기간 조건을 만들지 않는다.** 이 경로의 질의 파라미터에 기간이 **없고**, 의뢰가 가진
 * 날짜는 `requestedAt`(의뢰가 만들어진 시각) 하나다. 스펙 §3 이 가리키는 날짜는 **검사일**이라
 * 결과(`inspectedAt`)의 것이므로, 클라이언트에서 기간을 걸면 **스펙이 뜻한 것과 다른 날짜로
 * 거르게 된다** — 화면은 멀쩡히 돌고 값만 틀린다. 지나간 검사를 기간으로 훑는 일은
 * W-03-05(검사 결과 목록)의 몫이다.
 *
 * ⛔ **공급사를 조건으로 두지 않는다** — 입고 축이다. 출하검사에 뜻이 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
export const URL_KEYS = {
  itemId: 'it',
  keyword: 'q',
  pendingOnly: 'pd',
  page: 'page',
  selected: 'ir',
} as const;

/**
 * 이 화면이 정하는 고정 축. **사용자가 바꿀 수 없다** — 바꾸면 다른 화면이 된다.
 *
 * 값을 여기 한 자리에만 두는 이유는 요청 만드는 자리에 리터럴로 흩으면 나중에 전부 찾아야
 * 하기 때문이다.
 */
export const FIXED_AXES = {
  inspectionTypeCode: 'OQC',
} as const;

/** 계약이 정한 기본 쪽 크기다(`size` 설명: 기본 50). 주소에 적지 않는다. */
export const PAGE_SIZE = 50;

const FIRST_PAGE = 1;

/** 「대기·진행만 보기」의 기본값. 이 화면에 들어오는 이유가 아직 판정하지 않은 것이라 켜져 있다. */
const PENDING_ONLY_DEFAULT = true;

/** 기본값을 뒤집었을 때만 주소에 적는 값. 켜짐은 적지 않는다. */
const PENDING_ONLY_OFF = '0';

const POSITIVE_INTEGER = /^\d+$/;

/**
 * 식별자로 쓸 수 있는 값인가. 자원 번호는 1부터 매겨지므로 `0`·음수·소수·문자는 **어떤 자원도
 * 가리키지 않는다.** 그대로 실어 보내면 서버가 무엇을 하는지 계약이 말하지 않는다.
 */
const readIdentifier = (raw: string | null): number | null => {
  if (raw === null || !POSITIVE_INTEGER.test(raw)) return null;

  const value = Number(raw);

  return value >= 1 ? value : null;
};

/** 쪽 번호. 1 미만이거나 숫자가 아니면 첫 쪽으로 읽는다 — 주소를 손으로 고쳐도 화면이 선다. */
export const readPage = (params: URLSearchParams): number =>
  readIdentifier(params.get(URL_KEYS.page)) ?? FIRST_PAGE;

/** 고른 의뢰. 없거나 식별자가 아니면 아무것도 고르지 않은 상태다. */
export const readSelectedId = (params: URLSearchParams): number | null =>
  readIdentifier(params.get(URL_KEYS.selected));

/** 사용자가 좁히는 조건. 값이 없으면 `''`·`null` 로 두어 「좁히지 않음」을 뜻한다. */
export interface QueueFilters {
  itemId: number | null;
  keyword: string;
  /** 「대기·진행만 보기」. **기본이 켜짐이라 꺼졌을 때만 주소에 적는다** */
  pendingOnly: boolean;
}

export const EMPTY_FILTERS: QueueFilters = {
  itemId: null,
  keyword: '',
  pendingOnly: PENDING_ONLY_DEFAULT,
};

/**
 * 주소에서 조건을 읽는다.
 *
 * ⭐ **`pd` 는 「꺼짐」만 적힌다.** 그래서 없거나 알아볼 수 없는 값이면 기본값(켜짐)으로 읽는다 —
 * 주소를 손으로 고쳐도 화면이 「아직 판정하지 않은 것」을 먼저 보인다.
 */
export const readFilters = (params: URLSearchParams): QueueFilters => ({
  itemId: readIdentifier(params.get(URL_KEYS.itemId)),
  keyword: params.get(URL_KEYS.keyword) ?? '',
  pendingOnly: params.get(URL_KEYS.pendingOnly) !== PENDING_ONLY_OFF,
});

/** 서버로 보내는 질의. **비어 있는 조건은 키 자체를 싣지 않는다** — 빈 문자열은 조건이 아니다. */
export interface QueueListQuery {
  inspectionTypeCode: string;
  pendingOnly: boolean;
  itemId?: number;
  q?: string;
  page: number;
  size: number;
}

/**
 * 질의를 만든다.
 *
 * ⭐ **`pendingOnly` 는 꺼져 있어도 싣는다.** 주소에는 기본값을 적지 않지만 서버에는 늘 값을
 * 준다 — 계약의 기본값이 `false` 라 빼면 「전부」로 읽히고, 이 화면의 기본은 그 반대다.
 */
export const toListQuery = (filters: QueueFilters, page: number): QueueListQuery => {
  const query: QueueListQuery = {
    inspectionTypeCode: FIXED_AXES.inspectionTypeCode,
    pendingOnly: filters.pendingOnly,
    page,
    size: PAGE_SIZE,
  };

  if (filters.itemId !== null) query.itemId = filters.itemId;
  if (filters.keyword !== '') query.q = filters.keyword;

  return query;
};

/**
 * 주소를 다시 쓴다.
 *
 * **고른 의뢰(`ir`)를 싣지 않는다.** 조건이 바뀌면 그 의뢰가 목록에서 사라질 수 있는데, 주소에
 * 남아 있으면 우측 창이 **목록에 없는 건**을 계속 열어 둔다. 고르는 일은 목록에서 다시 한다.
 *
 * **고정 축을 적지 않는다.** 주소에 `ty=OQC` 를 적으면 사용자가 그것을 조건으로 읽고 지우려
 * 든다 — 지울 수 없는 것을 조건처럼 보이면 안 된다.
 */
export const toSearchParams = (
  filters: QueueFilters,
  page: number = FIRST_PAGE,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.itemId !== null) params.set(URL_KEYS.itemId, String(filters.itemId));
  if (filters.keyword !== '') params.set(URL_KEYS.keyword, filters.keyword);
  /* 기본값(켜짐)은 적지 않는다 — 적으면 주소가 길어지고 「끈 사람」과 구분되지 않는다. */
  if (!filters.pendingOnly) params.set(URL_KEYS.pendingOnly, PENDING_ONLY_OFF);
  if (page !== FIRST_PAGE) params.set(URL_KEYS.page, String(page));

  return params;
};

/** 쪽만 옮긴다 — 조건과 고른 의뢰는 그대로다. 조건이 안 바뀌었으니 선택을 버릴 이유가 없다. */
export const toPageParams = (params: URLSearchParams, page: number): URLSearchParams => {
  const next = new URLSearchParams(params);

  if (page === FIRST_PAGE) next.delete(URL_KEYS.page);
  else next.set(URL_KEYS.page, String(page));

  return next;
};
