/**
 * W-04-02 출하 예정 목록. 관리웹 · 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **「요약」 구획을 두지 않는다.** 스펙(§4-B)은 필터 전체 기준의 집계 구획을 요구하지만
 * 계약(`GET /logistics/shipment-requests`)에 집계를 실을 자리가 없다 — 계산해서 만들면
 * 공유계약 L-2(파생 값은 서버가 계산)를 화면이 스스로 어긴다. 설계 검토 요청(omf-mes#232)
 * 등록 후 이번 슬라이스는 그 구획을 뺐다.
 *
 * **「검사」 열은 서버 롤업(`shippingInspectionStatusCode`)을 그대로 옮긴다**(omf-mes#232 ·
 * omf-mes#235). `REJECTED`·`HELD` 전용 문구는 이번 슬라이스에서 두지 않는다 — 「대기」로 같이
 * 표시한다(다음 착수에서 분리).
 */
export const shipmentSchedule = {
  title: '출하 예정 목록',
  breadcrumbRoot: '영업 / 출하 관리',
  panes: {
    list: '출하 예정 목록',
    fulfillmentPlant: '출하 공장 지정',
  },
  fields: {
    /** 두 칸을 한 묶음으로 읽히게 하는 이름(사용자 지시 2026-09-22). 칸마다의 이름은 아래 둘. */
    period: '출하 기간',
    periodSeparator: '~',
    /** 값이 비었을 때 칸 안에 보이는 말 — 무엇을 고르는 칸인지 칸 스스로 말한다. */
    periodFromPlaceholder: '시작일 선택',
    periodToPlaceholder: '종료일 선택',
    periodFrom: '출하일 시작',
    periodTo: '출하일 종료',
    customer: '고객',
    shipToPartner: '납품처',
    progress: '진행 상태',
    inspection: '검사 상태',
    fulfillmentPlant: '출하 담당 공장',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    assignPlant: '공장 지정',
    changePlant: '변경',
    savePlant: '저장',
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다. */
  reasons: {
    periodRequired: '출하일 시작은 반드시 입력해야 합니다.',
    periodInvalid: '출하일은 있는 날짜여야 합니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '출하일 종료는 시작보다 앞설 수 없습니다.',
    referencesFailed: '고객·납품처 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  loading: {
    list: '출하 예정 목록을 불러오는 중',
    detail: '출하작업지시를 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/shipment-schedule/shipment-table.tsx에 있다. */
  table: {
    requestedShipDate: '출하일',
    shipmentRequestNo: '작업지시번호',
    customer: '고객',
    shipToPartner: '납품처',
    qty: '목표 / 피킹 / 출하',
    pickingWarehouses: '피킹 창고',
    marks: '표시',
    openDetail: (shipmentRequestNo: string): string => `${shipmentRequestNo} 상세 보기`,
    inspection: '검사',
    progress: '진행',
    fulfillmentPlant: '출하 담당 공장',
  },
  /**
   * 진행 상태 6값의 표시명.
   *
   * ⛔ **새 업무 낱말을 만들지 않는다** — 출하 처리(W-04-04)가 이미 쓰는 말을 그대로 옮겼다
   * (사용자 지시 2026-09-22). 계약이 닫은 값이라 표시명은 화면이 갖는다.
   */
  progressCodes: {
    NOT_ALLOCATED: '미편성',
    PARTIALLY_ALLOCATED: '부분 편성',
    PICKING: '피킹중',
    PICKED: '피킹 완료',
    PARTIALLY_SHIPPED: '부분 출하',
    SHIPPED: '출하 완료',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    unknown: '알 수 없음',
    referenceLoading: '이름 불러오는 중',
    referenceFailed: '이름을 불러오지 못했습니다',
    inspectionPending: '대기',
    inspectionPassed: '합격',
    /** 피처 010 — 목표(배정)를 넘긴 피킹. 초과는 마지막 LOT 에서만 생긴다. */
    over: (qty: number): string => `초과 ${String(qty)}`,
    /** 검사 칸은 가장 나쁜 LOT 판정 하나와 그 수(불합격 > 보류 > 미검사 > 합격). */
    judgmentRejected: (count: number): string => `불합격 ${String(count)}`,
    judgmentHeld: (count: number): string => `보류 ${String(count)}`,
    judgmentNotInspected: (count: number): string => `미검사 ${String(count)}`,
    judgmentAccepted: '합격',
    completionReady: '완료 대기',
    blocked: (count: number): string => `막힘 ${String(count)}`,
    replacement: (count: number): string => `LOT 교체 ${String(count)}`,
  },
  filters: {
    all: '전체',
    inspectionRequired: '대상',
    inspectionNotRequired: '대상 아님',
    /*
     * ⛔ 시간대 필터 안내를 걷어냈다(사용자 지시 2026-09-22) — 없는 기능의 «없는 이유»를
     * 설명하는 자리였다. 저장 컬럼이 없다는 사실은 스펙 §5-2 와 코드 주석에 남아 있다.
     */
    /** 집계 자리를 비워 둔 사실만 말한다 — 왜 비었는지(설계·계약 사정)는 말하지 않는다. */
    summaryNote: '집계는 준비 중입니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    chipCustomer: (value: string): string => `고객: ${value}`,
    chipShipToPartner: (value: string): string => `납품처: ${value}`,
    chipProgress: (value: string): string => `진행: ${value}`,
    chipInspection: (value: string): string => `검사: ${value}`,
    chipRemoveCustomer: '고객 조건 제거',
    chipRemoveShipToPartner: '납품처 조건 제거',
    chipRemoveProgress: '진행 조건 제거',
    chipRemoveInspection: '검사 조건 제거',
    q: '검색어',
    qPlaceholder: '지시서 번호, 고객, 품목',
    readyOnly: '완료 대기만',
    hasReplacement: 'LOT 교체 있음',
    chipQ: (value: string): string => `검색어: ${value}`,
    chipRemoveQ: '검색어 조건 제거',
    chipRemoveReadyOnly: '완료 대기 조건 제거',
    chipRemoveHasReplacement: 'LOT 교체 조건 제거',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 출하 예정이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    /* 출하일 시작이 없어 조회 자체가 나가지 않은 상태 — 「결과 없음」과 다른 안내를 낸다. */
    notQueriedTitle: '조회할 조건을 입력해 주세요',
    notQueriedDescription: '출하일을 입력한 후 조회하면 결과가 표시됩니다.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  /**
   * 피처 010 — 지시서 상세 창(시안 W0402-After). 보기만 한다 — 출하 완료는 POP P-04-07 에서만(FR-018).
   * ⛔ ERP 송신 여부를 보이지 않는다(출하 완료 단계 화면 · 결정 2026-11-18).
   */
  detail: {
    title: '출하 지시서 상세',
    print: '지시서 인쇄',
    close: '닫기',
    loadFailed: '출하작업지시를 불러오지 못했습니다',
    printNeedsDetail: '[지시서 인쇄]는 상세를 받은 뒤에 열립니다.',
    fields: {
      shipmentRequestNo: '작업지시번호',
      customer: '고객',
      shipToPartner: '납품처',
      shipDate: '출하일',
      fulfillmentPlant: '출하 담당 공장',
      progress: '진행',
      code: '지시서 코드',
      pickingWarehouses: '피킹 창고',
      completedShipment: '출하',
    },
    noPickingWarehouse: '아직 없음',
    popOnly: '출하 완료는 POP 「출하 완료」(P-04-07)에서 합니다. 이 화면은 보기만 합니다.',
    completed: (shipmentNo: string, completedAt: string): string =>
      `POP 에서 출하 완료했습니다(${shipmentNo}, ${completedAt}). 취소는 「출하 내역」에서 요청합니다.`,
    blockersTitle: (count: number): string => `출하 완료를 막는 이유 ${String(count)}건`,
    blockers: {
      PICKING_SHORT: (lineNo: string): string =>
        `피킹 부족: 라인 ${lineNo}. PDA 「제품 피킹」에서 LOT 을 더 스캔하세요.`,
      NOT_INSPECTED: (lotNo: string): string =>
        `미검사: LOT ${lotNo}. OQC 결과에 이 LOT 을 매칭해 판정을 넣으세요.`,
      REJECTED: (lotNo: string): string =>
        `불합격: LOT ${lotNo}. PDA 에서 [교체]로 빼고 다른 LOT 을 피킹하세요.`,
      HELD: (lotNo: string): string =>
        `보류: LOT ${lotNo}. OQC 재검 결과로 판정을 바꾸거나, 불합격이면 교체하세요.`,
      /** FR-028b — 푸는 경로가 없어 안내만 둔다. */
      SALES_ORDER_LINE_CANCELLED: (lineNo: string): string =>
        `수주 라인 취소: 라인 ${lineNo} 의 수주 라인이 ERP 에서 취소됐습니다. 담당자에게 문의하세요.`,
      ALREADY_COMPLETED: '이미 출하 완료한 지시서입니다.',
    },
    lines: '라인',
    lineColumns: {
      lineNo: '라인',
      item: '품목',
      inspection: '출하 검사',
      requested: '요청',
      target: '목표',
      picked: '피킹',
      over: '초과',
      shipped: '출하',
    },
    inspectionRequired: '필요',
    inspectionNotRequired: '불필요',
    short: (qty: number): string => `부족 ${String(qty)}`,
    lotColumns: {
      lot: 'LOT',
      qty: '수량',
      portions: '창고, 위치별 몫',
      status: '상태',
      oqc: 'OQC 판정',
      code: '출하 관리 코드',
      picked: '피킹, 교체',
    },
    lotStatus: {
      PICKED: '피킹',
      REPLACED: '교체됨',
      SHIPPED: '출하됨',
    },
    oqc: {
      NOT_REQUIRED: '대상 아님',
      SKIPPED: '검사 생략',
      NOT_INSPECTED: '미검사',
      ACCEPTED: '합격',
      REJECTED: '불합격',
      HELD: '보류',
    },
    noLots: '피킹한 LOT 이 없습니다.',
    replacedAt: (at: string, nonconformanceNo: string | null): string =>
      nonconformanceNo === null ? `${at} 교체` : `${at} 교체, ${nonconformanceNo}`,
    replacements: 'LOT 교체 이력',
    replacementColumns: {
      at: '교체 시각',
      worker: '작업자',
      line: '라인',
      lot: '뺀 LOT, 수량',
      result: '근거 OQC 결과',
      nonconformance: '부적합',
    },
    noReplacements: '교체한 LOT 이 없습니다.',
  },
  /** 피처 010 — 지시서 인쇄(시안 Print-Preview). A4 세로 · 출력 언어를 고른다. ERP 표시 없음. */
  printPreview: {
    title: '지시서 인쇄 미리 보기',
    language: '출력 언어',
    print: '인쇄',
    close: '닫기',
  },
  /** 인쇄 양식의 글 — 화면 언어와 따로 고른 출력 언어로 찍는다(ko · vi 를 둘 다 읽는다). */
  print: {
    title: '출하 지시서',
    qrLabel: '출하 지시서 코드 QR',
    scanHint: 'POP 「출하 완료」에서 이 QR 을 스캔하세요.',
    shipmentRequestNo: '지시서 번호',
    customer: '고객',
    shipToPartner: '납품처',
    shipDate: '출하일',
    fulfillmentPlant: '출하 담당 공장',
    items: '품목',
    lineNo: '라인',
    item: '품목',
    target: '목표',
    picked: '피킹',
    inspection: '출하 검사',
    inspectionRequired: '필요',
    inspectionNotRequired: '불필요',
    lots: '피킹 LOT(인쇄 시점)',
    lot: 'LOT',
    qty: '수량',
    places: '창고, 위치',
    managementCode: '출하 관리 코드',
    noLots: '아직 피킹한 LOT 이 없습니다.',
    signatures: ['작성', '피킹', '출하 검사', '출하 확인'],
    printedAt: (value: string): string => `인쇄 ${value}`,
  },
} as const;
