/**
 * 설비·금형 찾기 — 공용 부품의 문구. 금형은 공장마다 수백 건이라 선택칸 대신 찾아서 고른다.
 */
export const resourcePicker = {
  title: { equipment: '설비 선택', mold: '금형 선택' },
  open: '코드·이름으로 찾기',
  clear: { equipment: '설비 지우기', mold: '금형 지우기' },
  keywordLabel: '검색어',
  keywordPlaceholder: '코드 또는 이름',
  search: '찾기',
  columns: { select: '선택', code: '코드', name: '이름' },
  inactive: '미사용',
  noResult: '검색 결과가 없습니다.',
  searchFailed: '목록을 불러오지 못했습니다.',
  searching: '찾는 중입니다…',
  page: {
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / 전체 ${String(total)}건`,
    previous: '이전',
    next: '다음',
  },
  cancel: '취소',
  pick: '선택',
};
