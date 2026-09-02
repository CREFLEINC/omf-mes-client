/**
 * W-04-01 출하지시서 Import·작업지시 생성.
 *
 * 좌측은 고객사 출하지시서(SalesOrder) 목록, 우측은 출하작업지시(ShipmentRequest) 편성 폼이다.
 * 지시서를 고르면 「지시서 경유」 모드(고객·납품처 잠김·라인 고정)가 되고, 지시서 없이
 * 「단독 생성」을 누르면 전부 직접 입력한다. 두 모드가 `POST /logistics/shipment-requests`
 * 하나를 공유한다 — `salesOrderId`를 비우면 단독 생성이다.
 */
export const shipmentRequestCreate = {
  title: '출하지시서 Import·작업지시 생성',
  breadcrumbRoot: '출하',
  panes: {
    source: '출하지시서 목록',
    header: '출하작업지시 정보',
    lines: '출하작업지시 라인',
  },
  filters: {
    customer: '고객',
    period: '주문일',
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
    salesOrderNo: '지시서번호',
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
    startStandalone: '지시서 없이 단독 생성',
    importOrderFile: '지시서 가져오기',
    addLine: '라인 추가',
    removeLine: (rowIndex: number): string => `${String(rowIndex)}행 삭제`,
    submit: '출하작업지시 편성',
  },
  fields: {
    customer: '고객',
    shipToPartner: '납품처',
    requestedShipDate: '출하요청일',
  },
  lineTable: {
    item: '품목',
    itemLabel: (rowIndex: number): string => `${String(rowIndex)}행 품목`,
    requestedQty: '요청 수량',
    requestedQtyLabel: (rowIndex: number): string => `${String(rowIndex)}행 요청 수량`,
    availableQty: '가용 수량',
    allocatedQty: '배정 수량',
    allocatedQtyLabel: (rowIndex: number): string => `${String(rowIndex)}행 배정 수량`,
    inspection: '검사',
    inspectionLabel: (rowIndex: number): string => `${String(rowIndex)}행 출하검사 대상`,
    customerLotRequirement: '고객 LOT 요구',
    customerLotRequirementLabel: (rowIndex: number): string =>
      `${String(rowIndex)}행 고객 LOT 요구`,
    minimumRemainingShelfLifeDays: '잔여 유효기간(일)',
    minimumRemainingShelfLifeDaysLabel: (rowIndex: number): string =>
      `${String(rowIndex)}행 잔여 유효기간`,
    rowActions: '행 조작',
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
    customerRequired: '고객을 선택하세요.',
    shipToPartnerRequired: '납품처를 선택하세요.',
    requestedShipDateRequired: '출하요청일을 입력하세요.',
    itemRequired: '품목을 선택하세요.',
    uomRequired: '단위를 선택하세요.',
    requestedQtyRequired: '요청 수량을 입력하세요.',
    requestedQtyNotPositive: '요청 수량은 0보다 커야 합니다.',
    qtyNotNumber: '숫자로 입력하세요.',
    allocatedQtyNegative: '배정 수량은 0 이상이어야 합니다.',
    allocatedQtyOverRequested: (requestedQty: number): string =>
      `배정 수량은 요청 수량(${String(requestedQty)}) 을 넘을 수 없습니다.`,
    shelfLifeNegative: '잔여 유효기간은 0일 이상이어야 합니다.',
  },
  actionReasons: {
    saving: '전송 중입니다.',
    alreadySubmitted: '이미 편성했습니다.',
    noTarget: '먼저 지시서를 고르거나 단독 생성을 시작하세요.',
    noAllocatedLine: '배정 수량이 1 이상인 라인이 하나도 없습니다.',
    lineInvalid: '라인 입력을 확인하세요.',
    headerIncomplete: '필수 항목을 입력하세요.',
    importFileNotSupported:
      '지시서 가져오기는 파일 형식이 아직 확정되지 않아 사용할 수 없습니다. 형식이 정해지면 이 버튼을 쓸 수 있습니다.',
  },
  notes: {
    fromOrderLocked: '지시서 경유 편성이라 고객·납품처와 라인 품목·수량은 고칠 수 없습니다.',
    requestedQtyFixed: '요청 수량은 지시서 잔여 수량으로 자동 채워지며 고칠 수 없습니다.',
    lineNoAssignedByServer: '줄번호는 서버가 부여합니다.',
    erpUnmatched: 'ERP 지시서 번호는 단독 생성분에는 없습니다.',
    networkUnconfirmed:
      '응답을 받지 못했습니다. 서버에 실제로 반영됐는지 다시 확인한 뒤 재시도하세요.',
  },
  shortage: {
    title: '가용 재고가 부족한 라인이 있습니다',
    description: (count: number): string =>
      `배정 수량이 가용 수량을 넘는 라인이 ${String(count)}건 있습니다. 편성은 막지 않습니다 — 배정 수량을 낮추거나 그대로 진행할 수 있습니다.`,
  },
  result: {
    title: '출하작업지시를 편성했습니다',
    shipmentRequestNo: (no: string): string => `작업지시번호: ${no}`,
    lineCount: (count: number): string => `라인 ${String(count)}건`,
  },
  loading: {
    sourceList: '출하지시서 목록을 불러오는 중',
    sourceDetail: '출하지시서 상세를 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 출하지시서가 없습니다',
    noResultDescription: '조건을 바꾸거나 초기화한 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noTargetTitle: '지시서를 고르거나 단독 생성을 시작하세요',
    noTargetDescription:
      '왼쪽 목록에서 출하지시서를 고르면 그 지시서로 편성하고, 지시서 없이 만들려면 아래 버튼을 누르세요.',
  },
} as const;
