/**
 * ERP W/O 조회(W-06-23). ERP 가 보낸 W/O(`production_order`)를 **받은 그대로 읽기만** 하는 화면이다.
 *
 * ⚠ 용어 — 이 화면의 대상은 「ERP W/O」다. P/O(구매오더)·W/O(MES 작업지시)와 다르다.
 * 생산오더·제조오더·작업지시라고 부르지 않는다(서버 CONTEXT.md).
 */
export const erpProductionOrder = {
  title: 'ERP W/O 조회',
  breadcrumbRoot: '시스템 관리',
  readOnlyNote: 'ERP 에서 받은 정보입니다. MES 에서는 고칠 수 없습니다.',
  fields: {
    productionOrderNo: 'ERP W/O 번호',
    erpOrderNo: 'ERP 원번호',
    businessUnit: '사업부',
    plant: '공장',
    item: '품목',
    orderQty: '지시 수량',
    uom: '단위',
    plannedStartDate: '계획 시작일',
    dueDate: '납기',
    operationNo: '공정번호',
    storageLocation: '창고',
    rework: '재작업',
    status: '상태',
    remarks: '비고',
    plannedStartFrom: '계획 시작일 시작',
    plannedStartTo: '계획 시작일 종료',
    q: 'ERP W/O 번호',
    lastChange: '최근 ERP 변경',
    lastChangeReceivedAt: '수신 시각',
  },
  panes: {
    filters: 'ERP W/O 조회 조건',
    list: 'ERP W/O 목록',
    detail: 'ERP W/O 상세',
  },
  filters: {
    all: '전체',
    dateRangeError: '계획 시작일 시작이 종료보다 늦습니다. 기간을 바로잡으세요.',
    itemPlaceholder: '품목을 검색해 고르세요',
    itemClear: '품목 지우기',
    itemPick: '고르기',
  },
  actions: {
    select: (orderNo: string): string => `${orderNo} 선택`,
    firstPage: '첫 쪽',
    prevPage: '이전',
    nextPage: '다음',
  },
  values: {
    searchPlaceholder: 'ERP W/O 번호 일부',
    missing: '-',
    unknown: '알 수 없음',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    reworkYes: '예',
    reworkNo: '아니오',
    qtyWithUom: (qty: string, uom: string): string => `${qty} ${uom}`,
    changeArrow: (before: string, after: string): string => `${before} → ${after}`,
    noChangedFields: '바뀐 항목이 목록에 없습니다(그 밖의 항목이 바뀌었습니다).',
    noLastChange: '받은 변경이 없습니다.',
  },
  empty: {
    title: '조건에 맞는 ERP W/O 가 없습니다',
    description: '조회 조건을 바꿔 다시 조회하세요.',
    beyondTitle: '이 쪽에는 ERP W/O 가 없습니다',
    beyondDescription: '첫 쪽으로 돌아가 다시 보세요.',
    notSelectedTitle: 'ERP W/O 를 고르세요',
    notSelectedDescription: '목록에서 ERP W/O 번호를 누르면 받은 내용 전체가 보입니다.',
  },
  loading: 'ERP W/O 를 불러오는 중',
  listLoadFailedTitle: 'ERP W/O 목록을 불러오지 못했습니다',
  detailLoadFailedTitle: 'ERP W/O 상세를 불러오지 못했습니다',
  loadFailedDescription: '잠시 후 다시 시도하세요. 계속되면 관리자에게 문의하세요.',
  page: {
    label: 'ERP W/O 쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
} as const;
