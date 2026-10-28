/**
 * 수주정보 조회(ERP). ERP 가 내려 준 수주(출하지시서 수신본)를 **읽기만** 하는 화면이다.
 *
 * 읽기 전용 안내·조작 설명 문구는 두지 않는다(사용자 지시 2026-10-27) — 수정 컨트롤이 없는 것으로 충분하다.
 * ERP 원번호·납품처는 보이지 않는다 — 수주번호·고객사와 같은 값이라 겹친다.
 */
export const erpSalesOrder = {
  title: '수주정보 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  fields: {
    salesOrderNo: '수주번호',
    customer: '고객사',
    orderDate: '수주일',
    status: '상태',
    progress: '진행',
    lineNo: '라인',
    item: '품목',
    orderedQty: '수주수량',
    shippedQty: '출하수량',
    remainingQty: '잔량',
    uom: '단위',
    requestedDeliveryDate: '납기 요청일',
    orderDateFrom: '수주일 시작',
    orderDateTo: '수주일 종료',
    unassignedOnly: '미편성만',
    q: '수주번호',
    orderType: '수주 유형',
    movementType: '이동 유형',
    salesGroup: '영업그룹',
    storageLocation: '창고',
    cancelled: '취소',
  },
  /** 두 구획 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: '끌어서 목록·상세 폭 조절',
  /** 막대 위쪽 끝의 단추 — 목록을 왼쪽으로 완전히 접고 편다. */
  listCollapse: '수주 목록 접기',
  listExpand: '수주 목록 펼치기',
  panes: {
    filters: '수주정보 조회 조건',
    list: '수주 목록',
    detail: '수주 상세',
    lines: '수주 라인',
  },
  filters: {
    all: '전체',
    dateRangeError: '수주일 시작이 종료보다 늦습니다. 기간을 바로잡으세요.',
  },
  actions: {
    select: (orderNo: string): string => `${orderNo} 선택`,
    firstPage: '첫 쪽',
    prevPage: '이전',
    nextPage: '다음',
  },
  /**
   * 진행 — 출하가 다 됐는가(사용자 지시 2026-10-28). 조건 단추와 목록 열이 같은 낱말을 쓴다.
   * 표지는 서버 `shipStatusCode` 의 넷이다.
   */
  progress: {
    group: '진행 조건',
    all: '전체',
    open: '미완료',
    done: '완료',
    status: {
      NOT_STARTED: '출하 전',
      PARTIAL: '일부 출하',
      COMPLETED: '출하 완료',
      CANCELLED: '취소',
    },
  },
  values: {
    searchPlaceholder: '수주번호',
    missing: '-',
    unknown: '알 수 없음',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    cancelled: '취소',
  },
  empty: {
    title: '조건에 맞는 수주가 없습니다',
    beyondTitle: '이 쪽에는 수주가 없습니다',
    notSelectedTitle: '수주를 고르세요',
    linesTitle: '라인이 없습니다',
  },
  loading: '수주를 불러오는 중',
  listLoadFailedTitle: '수주 목록을 불러오지 못했습니다',
  detailLoadFailedTitle: '수주 상세를 불러오지 못했습니다',
  loadFailedDescription: '잠시 후 다시 시도하세요. 계속되면 관리자에게 문의하세요.',
  page: {
    label: '수주 쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
} as const;
