/**
 * 좌측 검사 대기 큐의 조회 조건 — **주소가 정본이다.** 새로고침·뒤로가기·공유가 같은 결과를
 * 내려면 화면 상태가 아니라 주소가 조건을 들고 있어야 한다.
 *
 * **이 파일이 소유하는 규칙 다섯**
 *
 * | 규칙 | 어디에 |
 * | --- | --- |
 * | **고정 축 둘이 늘 실린다** — `inspectionTypeCode=IQC` · `pendingOnly=true` | `toListQuery` |
 * | 기본값은 주소에 적지 않는다(첫 쪽·좁히지 않음) | `toSearchParams` |
 * | 조건이 바뀌면 **고른 의뢰가 사라지고 첫 쪽으로 간다** | `toSearchParams` 가 그 자리를 만들지 않는다 |
 * | 식별자는 **1 이상 정수**만 조건이 된다 | `readIdentifier` |
 * | **기간을 보내지 않는다** | 계약에서 사라졌다 — 아래 단락 |
 *
 * ⭐ **고정 축 둘은 사용자 조건이 아니다.** 이 화면은 **IQC 수입검사**의 대기 큐이므로
 * 검사 유형은 화면이 정하는 것이고(PQC·OQC 는 다른 화면이다), 「대기 큐」라는 말 자체가
 * `pendingOnly` 다. 사용자가 끄고 켤 것이 아니라 **이 화면이 무엇인지의 정의**라서 조건 줄에
 * 두지 않고 여기서 늘 싣는다. 전례가 같은 형태를 쓴다(`iqc-skip-approval/filters.ts` 의
 * `assignedToMe` — 「이 화면은 판정하는 자리다」).
 *
 * ⭐ **`pendingOnly` 덕분에 상태 코드값을 화면이 몰라도 된다.** 계약이 정의를 값으로 못박았다 —
 * `pendingOnly=true ⇔ statusCode ∈ { REQUESTED, IN_PROGRESS }`. 큐가 「대기」와 「진행」을
 * 함께 보여야 하는데 `statusCode` 하나로는 못 고르는 자리라 설계가 신설했다(omf-mes#170).
 * ⛔ 그래서 **상태를 조건 줄에 두지 않는다** — 두려면 값 목록이 필요하고, 값 목록을 화면에
 * 고정하는 것은 금지다(공유계약 G-6).
 *
 * ⛔ **기간이 없다.** 계약 설명이 「기간 필수」라고 적고 있었으나 이 경로를 부르는 화면이
 * 0이었고 강제 근거인 파티션 테이블에 이 표가 없었다 — 설계가 파라미터를 삭제했다(omf-mes#170).
 * 이 목록은 지나간 일이 아니라 **아직 처리하지 않은 작업 대기열**이라, 기간을 심었다면 오래
 * 밀린 의뢰가 화면에서 사라졌을 자리다.
 *
 * ⚠ **공급사는 화면이 푸는 조건이 아니다.** 계약 설명이 적어 두었듯 `trace.lot` 에 공급사가
 * 없어 서버가 2단 조인으로 푼다. 화면은 식별자만 실어 보낸다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 주소 키는 짧게 쓰고 계약 이름과 분리한다 — 주소는 사람이 읽고 고치는 자리다. */
export const URL_KEYS = {
  itemId: 'it',
  supplierId: 'sp',
  keyword: 'q',
  page: 'page',
  selected: 'ir',
} as const;

/**
 * 이 화면이 정하는 고정 축. **사용자가 바꿀 수 없다** — 바꾸면 다른 화면이 된다.
 *
 * 값을 여기 한 자리에만 두는 이유는, 나중에 이 화면이 PQC·OQC 도 다루게 되면 **여기만**
 * 조건으로 승격하면 되기 때문이다. 요청 만드는 자리에 리터럴로 흩으면 그때 전부 찾아야 한다.
 */
export const FIXED_AXES = {
  inspectionTypeCode: 'IQC',
  pendingOnly: true,
} as const;

/** 계약이 정한 기본 쪽 크기다(`size` 설명: 기본 50). 주소에 적지 않는다. */
export const PAGE_SIZE = 50;

const FIRST_PAGE = 1;

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
  supplierId: number | null;
  keyword: string;
}

export const EMPTY_FILTERS: QueueFilters = {
  itemId: null,
  supplierId: null,
  keyword: '',
};

export const readFilters = (params: URLSearchParams): QueueFilters => ({
  itemId: readIdentifier(params.get(URL_KEYS.itemId)),
  supplierId: readIdentifier(params.get(URL_KEYS.supplierId)),
  keyword: params.get(URL_KEYS.keyword) ?? '',
});

/** 서버로 보내는 질의. **비어 있는 조건은 키 자체를 싣지 않는다** — 빈 문자열은 조건이 아니다. */
export interface QueueListQuery {
  inspectionTypeCode: string;
  pendingOnly: boolean;
  itemId?: number;
  supplierId?: number;
  q?: string;
  page: number;
  size: number;
}

export const toListQuery = (filters: QueueFilters, page: number): QueueListQuery => {
  const query: QueueListQuery = {
    inspectionTypeCode: FIXED_AXES.inspectionTypeCode,
    pendingOnly: FIXED_AXES.pendingOnly,
    page,
    size: PAGE_SIZE,
  };

  if (filters.itemId !== null) query.itemId = filters.itemId;
  if (filters.supplierId !== null) query.supplierId = filters.supplierId;
  if (filters.keyword !== '') query.q = filters.keyword;

  return query;
};

/**
 * 주소를 다시 쓴다.
 *
 * **고른 의뢰(`ir`)를 싣지 않는다.** 조건이나 쪽이 바뀌면 그 의뢰가 목록에서 사라질 수 있는데,
 * 주소에 남아 있으면 우측 창이 **목록에 없는 건**을 계속 열어 둔다. 고르는 일은 목록에서 다시 한다.
 *
 * **고정 축을 적지 않는다.** 주소에 `ty=IQC&pd=1` 을 적으면 사용자가 그것을 조건으로 읽고
 * 지우려 든다 — 지울 수 없는 것을 조건처럼 보이면 안 된다.
 */
export const toSearchParams = (
  filters: QueueFilters,
  page: number = FIRST_PAGE,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.itemId !== null) params.set(URL_KEYS.itemId, String(filters.itemId));
  if (filters.supplierId !== null) params.set(URL_KEYS.supplierId, String(filters.supplierId));
  if (filters.keyword !== '') params.set(URL_KEYS.keyword, filters.keyword);
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
