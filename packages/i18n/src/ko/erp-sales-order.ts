/**
 * 수주정보 조회(ERP). ERP 가 내려 준 수주(출하지시서 수신본)를 **읽기만** 하는 화면이다.
 *
 * ⚠ **고칠 수 없다는 사실을 문구가 진다** — `values.erpReadOnlyNotice`.
 */
export const erpSalesOrder = {
  title: '수주정보 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  fields: {
    salesOrderNo: '수주번호',
    erpSalesOrderNo: 'ERP 원번호',
    customer: '고객사',
    shipTo: '납품처',
    orderDate: '수주일',
    status: '상태',
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
    integrationSync: '연계 현황 보기',
  },
  values: {
    erpReadOnlyNotice:
      'ERP에서 받은 정보라 이 화면에서는 수정할 수 없습니다. ERP에서 수정한 뒤 다시 동기화하세요.',
    erpSyncHint: '동기화 결과는 연계 현황에서 확인할 수 있습니다.',
    searchPlaceholder: '수주번호 · ERP 원번호',
    missing: '-',
    unknown: '알 수 없음',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    cancelled: '취소',
  },
  empty: {
    title: '조건에 맞는 수주가 없습니다',
    description: '조회 조건을 바꿔 다시 조회하세요.',
    beyondTitle: '이 쪽에는 수주가 없습니다',
    beyondDescription: '첫 쪽으로 돌아가 다시 보세요.',
    notSelectedTitle: '수주를 고르세요',
    notSelectedDescription: '목록에서 수주번호를 누르면 상세와 라인이 보입니다.',
    linesTitle: '라인이 없습니다',
    linesDescription: '이 수주에는 받은 라인이 없습니다.',
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
