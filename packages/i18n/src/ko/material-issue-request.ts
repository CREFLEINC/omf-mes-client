/**
 * W-02-10 추가 출고 요청(수동). 표기는 #76 「출고 요청」으로 통일(피처 003, 검토 1).
 *
 * 현장이 자재를 무절차로 가져가는 대신, 부족분을 정식 출고 요청으로 경유시킨다. 대상 W/O 를
 * 고르고 BOM 소요량을 불러와 요청 수량을 정한 뒤 사유·비고를 적어 한 번에 발행한다.
 * 발행은 되돌릴 수 없다 — 이 화면에 취소 경로가 없다.
 */
export const materialIssueRequest = {
  title: '추가 출고 요청',
  breadcrumbRoot: '구매 / 자재 관리',
  /**
   * ⭐ **규칙을 알리는 문장이다.** 앞 문장이 「금지」를 그대로 말하고, 뒤 문장이 그 대신 무엇을
   * 하면 되는지를 말한다. 결과 설명(「재고가 어긋난다」)으로 바꾸면 규범 선언이 사라진다 —
   * 이 화면의 존재 이유가 앞 문장이다.
   */
  policyNotice: {
    title: '절차를 거치지 않은 자재 반출은 금지입니다',
    description:
      '창고의 자재를 요청 없이 가져갈 수 없습니다. 부족한 자재도 이 화면에서 요청해 정식 출고를 거쳐 받습니다.',
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
    existingRequestsTruncated: '앞쪽 일부만 보입니다. 전체는 출고 요청 현황에서 확인하세요.',
  },
  values: {
    empty: '—',
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
    title: '출고 요청을 발행했습니다',
    issueRequestNo: (no: string): string => `요청번호: ${no}`,
    statusCode: (code: string): string => `상태: ${code}`,
    lineCount: (count: number): string => `품목 ${String(count)}건`,
    /** 생산 창고 공장 — 창고별로 나눈 결과(screens/W-02-10.md 「발행 흐름」). */
    splitTitle: (count: number): string =>
      count > 1
        ? `출고 요청 ${String(count)}장을 발행했습니다. 출발 생산 창고별로 나눴습니다`
        : '출고 요청을 발행했습니다',
    overrideNote: '예정분을 가져간 요청에 부족이 표시되고 이력이 남았습니다.',
    unsourcedNote: '부족 목록의 그 행이 「보충 요청됨」으로 바뀝니다.',
  },
  /** 피처 003 — 출발 생산 창고(검토 4) · 예정 재고 경고(US4-7 · US4-8). */
  sourceWarehouse: {
    label: '출발 생산 창고',
    auto: '자동 — 자재마다 재고가 있고 쓸 수 있는 양이 많은 생산 창고',
    autoHelp: (count: number): string =>
      `연결한 생산 창고 ${String(count)}곳 중 자재마다 재고가 있고 쓸 수 있는 양이 가장 많은 곳에서 냅니다. 같으면 오래된 재고가 있는 곳입니다. 창고가 다르면 요청이 창고별로 나뉩니다.`,
    fixedHelp: (warehouse: string): string => `모든 품목을 ${warehouse}에서 냅니다.`,
    destination: '입고지(생산 현장)',
    destinationHelp: '비우면 라인의 생산 현장으로 채웁니다.',
  },
  reasonHelp:
    '긴급 대응과 부족 보충은 남은 수량이 모자라면 경고를 확인한 뒤 다른 요청의 예정분을 가져갈 수 있습니다. 그 밖의 사유는 남은 수량까지만 요청할 수 있습니다.',
  prefilled: '출고 요청 현황의 부족에서 연 요청입니다. W/O, 품목, 수량, 사유를 채웠습니다.',
  override: {
    title: '다른 W/O 의 출고 예정분을 가져갑니다',
    body: '남은 수량보다 많이 요청했습니다. 그래도 요청하면 아래 요청의 예정분을 가져가고, 그 요청에 부족이 표시됩니다.',
    blockedTitle: '남은 수량이 없어 요청할 수 없습니다',
    blockedBody: '이 사유로는 남은 수량까지만 요청할 수 있습니다. 긴급 대응이나 부족 보충만 다른 요청의 예정분을 가져갈 수 있습니다.',
    noStockedBody: '재고 있는 생산 창고가 없는 자재가 있어 요청할 수 없습니다. 생산 창고를 채운 뒤 요청하세요.',
    tableLabel: '넘는 품목',
    columns: {
      item: '품목',
      warehouse: '생산 창고',
      requested: '요청',
      free: '남은 수량',
      take: '가져갈 수량',
      affected: '영향받는 요청',
    },
    noStockedWarehouse: '재고 있는 생산 창고 없음',
    affected: (requestNo: string, workOrderNo: string, date: string): string =>
      `${requestNo} (${workOrderNo}, ${date})`,
    fix: '수량 다시 고치기',
    submit: '그래도 요청',
  },
  status: {
    WAITING: '대기',
    RELEASED: '배포',
    IN_PROGRESS: '진행 중',
    DONE: '완료',
    CANCELLED: '취소',
  } as Record<string, string>,
} as const;
