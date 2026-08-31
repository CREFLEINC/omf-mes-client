/**
 * W-02-10 추가 자재 출고 요청(수동).
 *
 * 현장이 자재를 무절차로 가져가는 대신, 부족분을 정식 출고 요청으로 경유시킨다. 대상 W/O 를
 * 고르고 BOM 소요량을 불러와 요청 수량을 정한 뒤 사유·비고를 적어 한 번에 발행한다.
 * 발행은 되돌릴 수 없다 — 이 화면에 취소 경로가 없다.
 */
export const materialIssueRequest = {
  title: '추가 자재 출고 요청',
  breadcrumbRoot: '생산',
  policyNotice: {
    title: '자재는 출고 요청을 거쳐 반출합니다',
    description:
      '요청 없이 가져간 자재는 장부에 남지 않아 재고와 실물이 어긋납니다. 부족분은 이 화면에서 요청해 정식 출고로 받으세요.',
  },
  panes: {
    target: '대상 W/O',
    lines: '요청 품목',
    reason: '사유',
    result: '요청 발행',
  },
  formFields: {
    workOrderSearch: 'W/O 검색',
    workOrder: 'W/O',
    warehouse: '창고',
    destinationLocation: '도착 위치',
    requiredDate: '필요 일자',
    requiredTime: '필요 시각',
    reason: '요청 사유',
    remarks: '비고',
  },
  placeholders: {
    workOrderSearch: 'W/O 번호로 검색한 뒤 Enter',
    select: '선택하세요',
  },
  lineTable: {
    item: '품목',
    itemLabel: (rowIndex: number): string => `${String(rowIndex)}행 품목`,
    requiredQty: 'BOM 소요',
    issuedQty: '기출고',
    shortageQty: '부족',
    requestedQty: '요청 수량',
    requestedQtyLabel: (rowIndex: number): string => `${String(rowIndex)}행 요청 수량`,
    uom: '단위',
    uomLabel: (rowIndex: number): string => `${String(rowIndex)}행 단위`,
    rowActions: '행 조작',
  },
  actions: {
    search: '검색',
    loadShortage: 'BOM 소요량 불러오기',
    addLine: '+ 품목 추가',
    removeLine: (rowIndex: number): string => `${String(rowIndex)}행 삭제`,
    publish: '요청 발행',
    retry: '다시 시도',
  },
  actionReasons: {
    noWorkOrder: '대상 W/O 를 먼저 고르세요.',
    noDestination: '도착 위치를 고르세요. 창고를 먼저 고르면 그 창고의 위치가 나옵니다.',
    noRequestableLine: '요청 수량이 0보다 큰 품목이 하나도 없습니다.',
    noReasonOrRemarks: '사유를 고르거나 비고를 적으세요.',
    lineInvalid: '요청 품목의 입력을 확인하세요.',
    requiredAtIncomplete: '필요 일자와 시각을 함께 입력하거나 둘 다 비우세요.',
    saving: '전송 중입니다.',
    alreadyPublished: '이 W/O 앞으로 이미 발행했습니다.',
  },
  errors: {
    destinationRequired: '도착 위치를 고르세요.',
    requiredDateMissing: '필요 일자를 함께 입력하세요.',
    requiredTimeMissing: '필요 시각을 함께 입력하세요.',
    itemRequired: '품목을 고르세요.',
    uomRequired: '단위를 고르세요.',
    requestedQtyNotNumber: '숫자로 입력하세요.',
    requestedQtyNotPositive: '요청 수량은 0 이상이어야 합니다.',
  },
  warnings: {
    outsideBom: 'BOM 밖',
    outsideBomTitle: 'BOM 에 없는 품목이 있습니다',
    outsideBomCount: (count: number): string =>
      `BOM 에 없는 품목이 ${String(count)}건 있습니다. 투입 시 오투입 검증에 걸릴 수 있습니다. 요청은 막지 않습니다.`,
    existingRequestsTitle: '이 W/O 앞으로 이미 발행된 요청이 있습니다',
    existingRequests: (count: number): string =>
      `이 W/O 앞으로 발행된 요청이 ${String(count)}건 있습니다. 중복 요청을 막지는 않습니다 — 아래 목록을 확인한 뒤 진행하세요.`,
    existingRequestRow: (issueRequestNo: string, statusCode: string, requiredAt: string): string =>
      `${issueRequestNo} · ${statusCode} · ${requiredAt}`,
  },
  values: {
    empty: '—',
    unknown: '알 수 없음',
    workOrderType: (code: string): string => `유형 ${code}`,
    workOrderOption: (workOrderNo: string, operation: string, itemCode: string): string =>
      `${workOrderNo} · ${operation} · ${itemCode}`,
    orderQty: (qty: string, uom: string): string => `지시수량 ${qty} ${uom}`,
  },
  codes: {
    reasonEmpty: '선택할 사유가 없습니다.',
    reasonFailed: '사유 목록을 불러오지 못했습니다.',
  },
  filters: {
    lookupFailed: '선택지를 불러오지 못했습니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 검색어로 좁히세요.',
    workOrderTruncated: '검색 결과가 앞쪽 일부만 보입니다. 검색어로 좁히세요.',
  },
  loading: {
    workOrders: 'W/O 를 불러오는 중',
    shortage: 'BOM 소요량을 불러오는 중',
  },
  empty: {
    noWorkOrderTitle: '먼저 대상 W/O 를 고르세요',
    noWorkOrderDescription: 'W/O 를 골라야 요청 품목과 사유를 적을 수 있습니다.',
    noWorkOrderOption: '검색 결과가 없습니다.',
    noLinesTitle: '요청할 품목이 없습니다',
    noLinesDescription: 'BOM 소요량을 불러오거나 품목을 직접 추가하세요.',
  },
  notes: {
    lineNoAssignedByServer: '줄번호는 서버가 부여합니다.',
    shortageColumnsReadOnly: 'BOM 소요·기출고·부족은 시스템이 낸 값이라 고칠 수 없습니다.',
    warehouseAutoFilled: 'W/O 의 기본 재공 위치로 채웠습니다. 필요하면 바꿀 수 있습니다.',
  },
  result: {
    title: '추가 자재 출고 요청을 발행했습니다',
    issueRequestNo: (no: string): string => `요청번호: ${no}`,
    statusCode: (code: string): string => `상태: ${code}`,
    lineCount: (count: number): string => `품목 ${String(count)}건`,
  },
} as const;
