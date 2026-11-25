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
    salesOrderNo: '수주 번호',
    customer: '고객사',
    orderDate: '수주일',
    status: '상태',
    progress: '진행 상태',
    lineNo: '순번',
    item: '품목',
    itemCode: '품목코드',
    itemName: '품목명',
    orderedQty: '수주 수량',
    shippedQty: '출하 수량',
    /** 수주 수량 − 출하 수량(사용자 지시 2026-11-24 — 「잔량」을 뜻이 분명한 이름으로). */
    remainingQty: '미출하 수량',
    uom: '단위',
    requestedDeliveryDate: '납기 요청일',
    unassignedOnly: '미편성만',
    q: '수주 번호 검색',
    orderType: '수주 유형',
    movementType: '이동 유형',
    salesGroup: '영업 그룹',
    storageLocation: '창고',
    cancelled: '취소 여부',
  },
  panes: {
    filters: '수주정보 조회 조건',
    list: '수주 목록',
    detail: '수주 상세',
    lines: '수주 품목',
  },
  filters: {
    all: '전체',
    /* 조회 상자 선택칸 이름(#358). 목록 열 · 칩은 `fields` 이름 그대로. */
    customerSelect: '고객사 검색',
    /** 수주일 칸의 흐린 안내(사용자 지시 2026-11-24). */
    statusSelect: '상태 선택',
    /** 조회 줄 날짜 칸 이름 — 다른 칸처럼 「검색」을 붙인다(사용자 지시 2026-11-25). 목록 열 이름은 `fields.orderDate` 그대로. */
    orderDateFrom: '수주 시작일',
    orderDateTo: '수주 종료일',
    /** 「조건 더보기」에 접힌 조건의 칩 — 「상태: 반려」처럼 칸 이름과 값을 한 줄로. */
    chip: (label: string, value: string): string => `${label}: ${value}`,
  },
  /**
   * 진행 — 출하가 다 됐는가(사용자 지시 2026-10-28). 조건 단추와 목록 열이 같은 낱말을 쓴다.
   * 표지는 서버 `shipStatusCode` 의 넷이다.
   */
  progress: {
    group: '진행 상태',
    all: '전체',
    open: '미완료',
    done: '완료',
    withCount: (label: string, count: number): string => `${label} ${String(count)}`,
    status: {
      NOT_STARTED: '출하 전',
      PARTIAL: '일부 출하',
      COMPLETED: '출하 완료',
      CANCELLED: '취소',
    },
  },
  values: {
    searchPlaceholder: '수주 번호를 입력하세요',
    missing: '-',
    unknown: '등록 정보 없음',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    cancelled: '취소',
  },
  empty: {
    title: '조건에 맞는 수주가 없습니다',
    beyondTitle: '이 쪽에는 수주가 없습니다',
    notSelectedTitle: '수주를 선택하세요.',
    notSelectedDescription: '목록에서 수주를 고르면 수주 정보와 품목을 볼 수 있습니다.',
    linesTitle: '품목이 없습니다',
  },
  loading: '수주를 불러오는 중',
  listLoadFailedTitle: '수주 목록을 불러오지 못했습니다',
  detailLoadFailedTitle: '수주 상세를 불러오지 못했습니다',
  loadFailedDescription: '잠시 후 다시 시도하세요. 계속되면 관리자에게 문의하세요.',
} as const;
