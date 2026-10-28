/**
 * 구매발주 조회(ERP). ERP 가 내려 준 P/O(구매오더)를 **읽기만** 하는 화면이다.
 *
 * 읽기 전용 안내·조작 설명 문구는 두지 않는다(사용자 지시 2026-10-27) — 수정 컨트롤이 없는 것으로 충분하다.
 * ERP 발주번호는 보이지 않는다 — P/O 번호와 같은 값이라 겹친다.
 */
export const erpPurchaseOrder = {
  title: '구매발주 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  fields: {
    purchaseOrderNo: 'P/O 번호',
    supplier: '공급사',
    plant: '공장',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
    status: '상태',
    lineNo: '라인',
    item: '품목',
    orderedQty: '발주수량',
    receivedQty: '입하수량',
    remainingQty: '잔량',
    uom: '단위',
    tolerance: '허용치(초과/부족)',
    orderType: '발주 유형',
    purchaseGroup: '구매그룹',
    ioType: '입출고 유형',
    storageLocation: '창고',
    cancelled: '취소',
    orderDateFrom: '발주일 시작',
    orderDateTo: '발주일 종료',
    openOnly: '입하 미완료만',
    q: '발주번호',
  },
  /** 두 구획 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: '끌어서 목록·상세 폭 조절',
  /** 막대 위쪽 끝의 단추 — 목록을 왼쪽으로 완전히 접고 편다. */
  listCollapse: '구매발주 목록 접기',
  listExpand: '구매발주 목록 펼치기',
  panes: {
    filters: '구매발주 조회 조건',
    list: '구매발주 목록',
    detail: '구매발주 상세',
    lines: '구매발주 라인',
  },
  filters: {
    all: '전체',
    dateRangeError: '발주일 시작이 종료보다 늦습니다. 기간을 바로잡으세요.',
  },
  actions: {
    select: (orderNo: string): string => `${orderNo} 선택`,
    firstPage: '첫 쪽',
    prevPage: '이전',
    nextPage: '다음',
  },
  values: {
    searchPlaceholder: 'P/O 번호',
    missing: '-',
    unknown: '알 수 없음',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    cancelled: '취소',
  },
  empty: {
    title: '조건에 맞는 구매발주가 없습니다',
    beyondTitle: '이 쪽에는 구매발주가 없습니다',
    notSelectedTitle: '구매발주를 고르세요',
    linesTitle: '라인이 없습니다',
  },
  loading: '구매발주를 불러오는 중',
  listLoadFailedTitle: '구매발주 목록을 불러오지 못했습니다',
  detailLoadFailedTitle: '구매발주 상세를 불러오지 못했습니다',
  loadFailedDescription: '잠시 후 다시 시도하세요. 계속되면 관리자에게 문의하세요.',
  page: {
    label: '구매발주 쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
} as const;
