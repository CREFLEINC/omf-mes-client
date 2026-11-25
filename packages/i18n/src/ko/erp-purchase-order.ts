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
    purchaseOrderNo: '발주 번호',
    supplier: '공급사',
    plant: '공장',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
    /** 발주 문서의 등록 상태(LOGISTICS_DOCUMENT_STATUS) — 입고 「진행 상태」와 갈라 부른다(사용자 지시 2026-11-24). */
    status: '등록 상태',
    progress: '진행 상태',
    lineNo: '순번',
    item: '품목',
    itemCode: '품목코드',
    itemName: '품목명',
    orderedQty: '발주 수량',
    receivedQty: '입하 수량',
    remainingQty: '미입하 수량',
    uom: '단위',
    tolerance: '허용 수량(초과/부족)',
    orderType: '발주 유형',
    purchaseGroup: '구매 그룹',
    ioType: '입출고 유형',
    storageLocation: '창고',
    cancelled: '취소 여부',
    /** 외자 발주(발주 유형 `PO`) 라인의 ERP 통관번호 / 순번(서버 장부 P-143). */
    customsClearance: '통관번호',
    q: '발주 번호 검색',
  },
  panes: {
    filters: '구매발주 조회 조건',
    list: '구매발주 목록',
    detail: '구매발주 상세',
    lines: '발주 품목',
  },
  filters: {
    orderDateFromPlaceholder: '발주 시작일을 입력하세요',
    orderDateToPlaceholder: '발주 종료일을 입력하세요',
    all: '전체',
    /* 조회 상자 선택칸 이름(#358). 목록 열 · 칩은 `fields` 이름 그대로. */
    supplierSelect: '공급사 검색',
    plantSelect: '공장 검색',
    statusSelect: '등록 상태 선택',
    /** 조회 줄 날짜 칸 이름 — 다른 칸처럼 「검색」을 붙인다(사용자 지시 2026-11-25). 목록 열 이름은 `fields.orderDate` 그대로. */
    orderDateFrom: '발주 시작일',
    orderDateTo: '발주 종료일',
    /** 발주일 칸의 흐린 안내(사용자 지시 2026-11-24). */
    orderTypeSelect: '발주 유형 선택',
    /** 「조건 더보기」에 접힌 조건의 칩 — 「상태: 반려」처럼 칸 이름과 값을 한 줄로. */
    chip: (label: string, value: string): string => `${label}: ${value}`,
  },
  /**
   * 진행 — 입하가 다 됐는가(사용자 지시 2026-10-28). 조건 단추와 목록 열이 같은 낱말을 쓴다.
   * 표지는 서버 `receiptStatusCode` 의 넷이다.
   */
  /** 등록 상태 표시명(사용자 지시 2026-11-24) — 코드값별. */
  registrationStatus: {
    OPEN: '진행',
    CLOSED: '완료',
    CANCELLED: '취소',
  },
  progress: {
    group: '진행 상태',
    all: '전체',
    open: '미완료',
    done: '완료',
    withCount: (label: string, count: number): string => `${label} ${String(count)}`,
    status: {
      NOT_STARTED: '입하 전',
      PARTIAL: '일부 입하',
      COMPLETED: '입하 완료',
      CANCELLED: '취소',
    },
  },
  /**
   * 외자 발주 통관번호 받아오기(omf-all-around#206 · 서버 장부 P-143). 받지 않아도 구매입고 송신 때 서버가 받는다 —
   * 미리 받아 확인하는 단추다. 결과 표지는 서버 `result` 의 셋이다.
   */
  customs: {
    fetch: '통관번호 받아오기',
    fetchFailedTitle: '통관번호를 받아오지 못했습니다',
    notFoundOrder: '발주를 찾을 수 없습니다.',
    summary: (total: number, saved: number, notFound: number, multiple: number): string =>
      [
        `${String(total)}줄 중 ${String(saved)}줄 받음`,
        ...(notFound > 0 ? [`${String(notFound)}줄 통관 전`] : []),
        ...(multiple > 0 ? [`${String(multiple)}줄 확인 필요`] : []),
      ].join(' · '),
    multipleTitle: '통관번호가 여럿이라 저장하지 않은 라인이 있습니다 — 확인 필요',
    multipleLine: (lineNo: number, candidates: string): string =>
      `라인 ${String(lineNo)}: ${candidates}`,
  },
  values: {
    searchPlaceholder: '발주 번호를 입력하세요',
    missing: '-',
    unknown: '등록 정보 없음',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    cancelled: '취소',
  },
  empty: {
    title: '조건에 맞는 구매발주가 없습니다',
    beyondTitle: '이 쪽에는 구매발주가 없습니다',
    notSelectedTitle: '구매발주를 선택하세요.',
    notSelectedDescription: '목록에서 구매발주를 고르면 발주 정보와 품목을 볼 수 있습니다.',
    linesTitle: '품목이 없습니다',
  },
  loading: '구매발주를 불러오는 중',
  listLoadFailedTitle: '구매발주 목록을 불러오지 못했습니다',
  detailLoadFailedTitle: '구매발주 상세를 불러오지 못했습니다',
  loadFailedDescription: '잠시 후 다시 시도하세요. 계속되면 관리자에게 문의하세요.',
} as const;
