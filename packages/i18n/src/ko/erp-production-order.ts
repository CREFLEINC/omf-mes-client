/**
 * ERP W/O 조회(W-06-23). ERP 가 보낸 W/O(`production_order`)를 **받은 그대로 읽기만** 하는 화면이다.
 *
 * ⚠ 용어 — 이 화면의 대상은 「ERP W/O」다. P/O(구매오더)·W/O(MES 작업지시)와 다르다.
 * 생산오더·제조오더·작업지시라고 부르지 않는다(서버 CONTEXT.md).
 *
 * 상세는 두지 않는다 — 상세가 목록 줄과 겹쳐 두지 않는다(사용자 지시 2026-10-27). 목록 한 구획뿐이라 고르기
 * 문구도 없다.
 */
export const erpProductionOrder = {
  title: 'ERP W/O 조회',
  breadcrumbRoot: '시스템 관리',
  fields: {
    productionOrderNo: 'ERP W/O 번호',
    item: '품목',
    orderQty: '지시 수량',
    plannedStartDate: '계획 시작일',
    dueDate: '납기',
    operationNo: '공정번호',
    storageLocation: '창고',
    rework: '재작업',
    status: '상태',
    progress: '진행',
    plannedStartFrom: '계획 시작일 시작',
    plannedStartTo: '계획 시작일 종료',
    q: 'ERP W/O 번호',
  },
  panes: {
    filters: 'ERP W/O 조회 조건',
    list: 'ERP W/O 목록',
  },
  filters: {
    all: '전체',
    dateRangeError: '계획 시작일 시작이 종료보다 늦습니다. 기간을 바로잡으세요.',
    itemPlaceholder: '품목을 검색해 고르세요',
    itemClear: '품목 지우기',
    itemPick: '고르기',
  },
  actions: {
    firstPage: '첫 쪽',
    prevPage: '이전',
    nextPage: '다음',
  },
  /**
   * 진행 — 이 W/O 에서 펼친 MES 작업지시가 다 닫혔는가(사용자 지시 2026-10-28). 조건 단추와 목록 열이 같은 낱말을 쓴다.
   * 표지는 서버 `progressStatusCode` 의 넷이다.
   */
  progress: {
    group: '진행 조건',
    all: '전체',
    open: '미완료',
    done: '완료',
    status: {
      NOT_STARTED: '생산 전',
      PARTIAL: '생산 중',
      COMPLETED: '생산 완료',
      CANCELLED: '취소',
    },
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
  },
  empty: {
    title: '조건에 맞는 ERP W/O 가 없습니다',
    beyondTitle: '이 쪽에는 ERP W/O 가 없습니다',
  },
  loading: 'ERP W/O 를 불러오는 중',
  listLoadFailedTitle: 'ERP W/O 목록을 불러오지 못했습니다',
  loadFailedDescription: '잠시 후 다시 시도하세요. 계속되면 관리자에게 문의하세요.',
  page: {
    label: 'ERP W/O 쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
} as const;
