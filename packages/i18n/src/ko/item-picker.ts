/**
 * 품목 선택 대화상자 — 화면 슬라이스가 아니라 **공용 부품**의 문구다.
 *
 * 품목 마스터는 수천 건이라 선택칸에 담을 수 없다. 검색해서 고르는 자리를 대화상자로 두고,
 * 그 규칙 둘을 문구가 함께 말한다 — **검색어가 비면 조회하지 않는다**, **「찾기」로만 조회한다.**
 */
export const itemPicker = {
  title: '품목 선택',

  /** 유형은 코드 그룹에서 받는다 — 여기에 값 목록을 적지 않는다(공유계약 G-32). */
  typeLabel: '유형',
  typeAll: '전체',
  typeLoading: '유형을 불러오는 중입니다…',
  typeFailed: '유형 목록을 불러오지 못했습니다. 「전체」로 찾을 수 있습니다.',

  keywordLabel: '검색어',
  keywordPlaceholder: '품목 코드 또는 이름',
  search: '찾기',

  columns: {
    select: '선택',
    itemCode: '코드',
    itemName: '이름',
    itemType: '유형',
    availableQty: '가용',
  },

  /** ⛔ 「없다」와 「모른다」를 서로 다른 문구로 가른다(공유계약 G-9). */
  noResult: '검색 결과가 없습니다. 코드나 이름의 일부로 다시 찾아보세요.',
  searchFailed: '품목을 찾지 못했습니다.',
  searching: '찾는 중입니다…',

  availability: {
    loading: '조회 중',
    failed: '확인 못 함',
  },

  /** 이미 라인에 담긴 품목 — **막지 않고 표식만 단다**(같은 품목 두 라인이 허용된다). */
  alreadyAdded: '담김',

  page: {
    /** 「1–20 / 전체 37건」 */
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / 전체 ${String(total)}건`,
    previous: '이전',
    next: '다음',
  },

  selectedCount: (count: number): string => `${String(count)}개 선택`,
  cancel: '취소',
  /** 여는 자리에 따라 단추 이름이 다르다 — 「라인 추가」와 「바꾸기」. */
  add: '라인 추가',
  replace: '바꾸기',
  /** 고르지 않으면 왜 누를 수 없는지 말한다 — 비활성만 두면 고장으로 읽는다. */
  needsSelection: '품목을 고르면 누를 수 있습니다.',
} as const;
