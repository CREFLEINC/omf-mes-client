/**
 * W-04-01 출하작업지시 생성(ERP S/O 로 편성하거나 ERP S/O 없이 생성).
 *
 * 좌측은 고객사 출하지시서(SalesOrder) 목록, 우측은 출하작업지시(ShipmentRequest) 편성 폼이다.
 * 지시서를 고르면 「지시서 경유」 모드(고객·납품처 잠김·라인 고정)가 되고, 지시서 없이
 * 「단독 생성」을 누르면 전부 직접 입력한다. 두 모드가 `POST /logistics/shipment-requests`
 * 하나를 공유한다 — `salesOrderId`를 비우면 단독 생성이다.
 */
export const shipmentRequestCreate = {
  title: '출하작업지시 생성',
  panes: {
    source: 'ERP S/O 목록',
    header: '출하작업지시 정보',
    lines: '출하작업지시 라인',
  },
  filters: {
    customer: '고객',
    periodFrom: '주문 시작일',
    periodTo: '주문 종료일',
    unassignedOnly: '미편성만',
    search: '조회',
    reset: '초기화',
    all: '전체',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    chipCustomer: (value: string): string => `고객: ${value}`,
    chipPeriod: (from: string, to: string): string => `주문일: ${from} ~ ${to}`,
    chipUnassignedOnly: '미편성만',
    chipRemoveCustomer: '고객 조건 제거',
    chipRemovePeriod: '주문일 조건 제거',
    chipRemoveUnassignedOnly: '미편성만 조건 제거',
  },
  table: {
    salesOrderNo: 'ERP S/O',
    customer: '고객',
    orderDate: '주문일',
    status: '상태',
    selectRow: (label: string): string => `${label} 선택`,
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    startStandalone: 'ERP S/O 없이 생성',
    addLine: '라인 추가',
    removeLine: (rowIndex: number): string => `${String(rowIndex)}행 삭제`,
    /** S/O 줄 하나를 창고별 지시서 줄로 나눈다(피처 012 FR-005). */
    splitLine: '나누기',
    splitLineLabel: (rowIndex: number): string => `${String(rowIndex)}행 나누기`,
    removeSplitLine: (rowIndex: number): string => `${String(rowIndex)}행 나눈 줄 삭제`,
    submit: '출하작업지시 편성',
  },
  fields: {
    businessUnit: '사업부',
    customer: '고객',
    shipToPartner: '납품처',
    requestedShipDate: '출하요청일',
  },
  lineTable: {
    item: '품목',
    itemLabel: (rowIndex: number): string => `${String(rowIndex)}행 품목`,
    /** 아직 고르지 않은 줄 — 누르면 팝업이 열린다는 것을 그 자리가 말한다. */
    itemUnpicked: '품목 고르기',
    uom: '단위',
    uomLabel: (rowIndex: number): string => `${String(rowIndex)}행 단위`,
    requestedQty: '요청 수량',
    requestedQtyLabel: (rowIndex: number): string => `${String(rowIndex)}행 요청 수량`,
    availableQty: '가용 수량',
    allocatedQty: '배정 수량',
    allocatedQtyLabel: (rowIndex: number): string => `${String(rowIndex)}행 배정 수량`,
    inspection: '검사',
    inspectionLabel: (rowIndex: number): string => `${String(rowIndex)}행 출하검사 대상`,
    rowActions: '행 조작',
    warehouse: '출고 창고',
    warehouseLabel: (rowIndex: number): string => `${String(rowIndex)}행 출고 창고`,
    /** 사업부를 고르기 전 — 창고 칸이 잠긴다(US1-2). */
    warehouseNeedsBusinessUnit: '사업부를 먼저 고르세요',
    warehousePlaceholder: '출고 창고를 선택하세요',
    /** 사업부를 바꿔 비운 줄(FR-004). */
    warehouseReselect: '다시 고르세요',
    warehouseFilledFromFirst: '첫 줄 창고로 채움',
    warehouseOption: (warehouseName: string, plantName: string): string => `${warehouseName} (${plantName})`,
    warehouseGroup: (businessUnitName: string): string => `${businessUnitName} 활성 창고(불량창고 제외)`,
    /** ERP S/O 줄의 ERP 창고 코드 — 참고로만 보인다, 자동 연결하지 않는다(FR-006). */
    erpWarehouseHint: (code: string): string => `ERP 창고 ${code} (참고)`,
    splitRowLabel: (source: string): string => `나눈 줄 (${source})`,
    salesOrderLineRef: (salesOrderNo: string, lineNo: number): string => `${salesOrderNo} ${String(lineNo)}행`,
    /** 나눈 줄 묶음 끝 합계(FR-005). */
    splitTotal: (source: string, remaining: number, total: number, parts: string): string =>
      `${source} 잔여 ${String(remaining)}, 나눈 줄 합 ${String(total)} (${parts})`,
    splitPart: (warehouseName: string, qty: number): string => `${warehouseName} ${String(qty)}`,
  },
  values: {
    empty: '—',
    unknown: '알 수 없음',
    referenceLoading: '이름 불러오는 중',
    referenceFailed: '이름을 불러오지 못했습니다',
    availableQtyLoading: '조회 중',
    availableQtyFailed: '조회 실패',
    erpNotMatched: '—',
  },
  errors: {
    businessUnitRequired: '사업부를 고르세요.',
    warehouseRequired: '출고 창고를 고르세요.',
    splitOverRemaining: (total: number, remaining: number, parts: string): string =>
      `나눈 줄 합 ${String(total)} 이 S/O 잔여 수량 ${String(remaining)} 을 넘습니다 — ${parts}. 한쪽을 줄이세요.`,
    customerRequired: '고객을 선택하세요.',
    shipToPartnerRequired: '납품처를 선택하세요.',
    requestedShipDateRequired: '출하요청일을 입력하세요.',
    requestedQtyNotPositive: '요청 수량은 0보다 커야 합니다.',
    qtyNotNumber: '숫자로 입력하세요.',
    allocatedQtyNegative: '배정 수량은 0 이상이어야 합니다.',
    allocatedQtyOverRequested: (requestedQty: number): string =>
      `배정 수량은 요청 수량(${String(requestedQty)}) 을 넘을 수 없습니다.`,
  },
  actionReasons: {
    saving: '전송 중입니다.',
    alreadySubmitted: '이미 편성했습니다.',
    noTarget: '먼저 ERP S/O 를 고르거나 [ERP S/O 없이 생성]을 누르세요.',
    noAllocatedLine: '배정 수량이 1 이상인 라인이 하나도 없습니다.',
    lineInvalid: '라인 입력을 확인하세요.',
    /*
     * ⛔ **아직 안 채운 칸은 줄마다 붉게 적지 않는다**(사용자 지시 2026-09-18) — 라인을 막 추가한
     *    사람에게 경고가 먼저 서면 아무것도 안 했는데 잘못한 것처럼 읽힌다. 대신 막는 사유를
     *    편성 단추 옆에 한 번 적는다.
     */
    lineIncomplete: '라인의 품목·단위·요청 수량을 채우세요.',
    headerIncomplete: '필수 항목을 입력하세요.',
    businessUnitMissing: '사업부를 고르세요',
    splitOverRemaining: (refs: string): string => `S/O 잔여 수량을 넘는 줄이 있습니다: ${refs}`,
    warehouseMissing: (rows: string): string => `출고 창고를 고르세요: 라인 ${rows}`,
    splitRowTag: (rowIndex: number): string => `${String(rowIndex)}(나눈 줄)`,
  },
  notes: {
    fromOrderLocked: 'ERP S/O 로 편성하는 중이라 고객, 납품처, 라인 품목과 수량은 고칠 수 없습니다.',
    requestedQtyFixed: '요청 수량은 ERP S/O 잔여 수량으로 자동 채워지며 고칠 수 없습니다.',
    /* 출고 창고 칸 머리 ⓘ(관리웹 정리 시안 A — 늘 보이는 규칙 문장은 ⓘ 로). */
    warehouseRule: '출고 창고는 고른 사업부의 활성 창고만 고를 수 있습니다(불량창고 제외).',
    businessUnitAutoFilled: '계정 범위의 사업부가 하나라 자동으로 채웠습니다',
    addLineWarehouse:
      '새 줄의 출고 창고는 첫 줄 창고로 채웁니다. 같은 품목을 두 창고에서 내려면 줄을 따로 담습니다.',
    erpUnmatched: 'ERP S/O 없이 생성한 작업지시에는 ERP S/O 번호가 없습니다.',
    networkUnconfirmed:
      '응답을 받지 못했습니다. 반영됐는지 목록에서 확인한 뒤 다시 시도하세요.',
  },
  /** 사업부를 바꿔 다른 사업부 창고를 고른 줄을 비웠을 때(FR-004 · US1-7). */
  warehouseCleared: {
    title: (count: number): string => `사업부를 바꿔 출고 창고 ${String(count)}줄을 비웠습니다`,
    description: (businessUnitName: string): string =>
      `노란 줄의 출고 창고를 ${businessUnitName} 의 창고로 다시 고르세요.`,
  },
  shortage: {
    title: '가용 재고가 부족한 라인이 있습니다',
    description: (count: number): string =>
      `배정 수량이 가용 수량보다 많은 줄이 ${String(count)}건 있습니다. 배정 수량을 낮추거나 그대로 진행하세요.`,
  },
  result: {
    title: '출하작업지시를 편성했습니다',
    shipmentRequestNo: (no: string): string => `작업지시번호: ${no}`,
    lineCount: (count: number): string => `라인 ${String(count)}건`,
  },
  loading: {
    sourceList: 'ERP S/O 목록을 불러오는 중',
    sourceDetail: 'ERP S/O 상세를 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 ERP S/O 가 없습니다',
    noResultDescription: '조건을 바꾸거나 초기화한 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noTargetTitle: 'ERP S/O 를 고르거나 [ERP S/O 없이 생성]을 누르세요',
    noTargetDescription:
      '왼쪽 목록에서 ERP S/O 를 고르면 그 S/O 로 편성하고, ERP S/O 없이 만들려면 아래 버튼을 누르세요.',
  },
} as const;
