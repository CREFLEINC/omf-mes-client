/**
 * 품목정보 조회 (ERP). ERP 에서 받은 품목 원본을 읽기만 한다 — MES 확장 속성은 여기서 보이지 않는다.
 *
 * 품목유형 이름은 공통코드(ITEM_TYPE)가 갖는다 — 여기에 값 목록을 적지 않는다.
 */
export const erpItem = {
  title: '품목정보 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  panes: {
    filter: '조회 조건',
    list: '품목 목록',
  },
  fields: {
    q: '품목코드·품목명',
    itemType: '품목유형',
    includeInactive: '미사용 포함',
  },
  filters: {
    all: '전체',
  },
  table: {
    itemCode: '품목코드',
    itemName: '품목명',
    itemType: '품목유형',
    erpSpec: '규격',
    erpItemGroupCode: '품목그룹',
    baseUom: '기준 단위',
    isActive: '사용',
  },
  values: {
    empty: '—',
    active: '사용',
    inactive: '미사용',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  loading: {
    list: '품목 목록을 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 품목이 없습니다',
    beyondLastTitle: '이 쪽에는 품목이 없습니다',
  },
} as const;
