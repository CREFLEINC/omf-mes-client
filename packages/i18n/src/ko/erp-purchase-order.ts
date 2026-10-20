/**
 * 구매발주 조회(ERP). ERP 가 내려 준 P/O(구매오더)를 **읽기만** 하는 화면이다.
 *
 * ⚠ **고칠 수 없다는 사실을 문구가 진다.** 화면에 수정 컨트롤이 없으므로, 왜 없는지와 어디서
 * 고치는지를 `values.erpReadOnlyNotice` 가 대신 말한다.
 */
export const erpPurchaseOrder = {
  title: '구매발주 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  fields: {
    purchaseOrderNo: 'P/O 번호',
    erpPurchaseOrderNo: 'ERP 발주번호',
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
    integrationSync: '연계 현황 보기',
  },
  values: {
    erpReadOnlyNotice:
      'ERP에서 받은 정보라 이 화면에서는 수정할 수 없습니다. ERP에서 수정한 뒤 다시 동기화하세요.',
    erpSyncHint: '동기화 결과는 연계 현황에서 확인할 수 있습니다.',
    searchPlaceholder: 'P/O · ERP 발주번호',
    missing: '-',
    unknown: '알 수 없음',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    cancelled: '취소',
  },
  empty: {
    title: '조건에 맞는 구매발주가 없습니다',
    description: '조회 조건을 바꿔 다시 조회하세요.',
    beyondTitle: '이 쪽에는 구매발주가 없습니다',
    beyondDescription: '첫 쪽으로 돌아가 다시 보세요.',
    notSelectedTitle: '구매발주를 고르세요',
    notSelectedDescription: '목록에서 P/O 번호를 누르면 상세와 라인이 보입니다.',
    linesTitle: '라인이 없습니다',
    linesDescription: '이 구매발주에는 받은 라인이 없습니다.',
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
