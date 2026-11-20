/**
 * M-04-01 제품 피킹 — 오늘 출하 지시서의 LOT 을 통째로 집는다(피처 010).
 *
 * LOT 을 스캔하면 수량을 묻지 않고 공장 안 그 LOT 전부를 피킹한다. 라인 피킹 합이 목표보다
 * 작을 때만 받아 초과는 마지막 LOT 에서만 생긴다. 출하 완료는 POP 에서만 한다 — 이 화면은
 * 「지시서 코드 보기」로 POP 에 비출 QR 을 띄운다.
 *
 * LOT 상태와 검사 판정을 캐시하지 않는다. 그래서 연결이 있어야만 선다.
 */
export const productPicking = {
  title: '제품 피킹',
  offline: {
    title: '오프라인이라 피킹할 수 없습니다',
    description: 'LOT 상태와 검사 판정을 확인할 수 없습니다',
    retry: '다시 시도',
  },
  requests: {
    legend: '오늘 출하 지시서',
    loading: '오늘 출하 지시서를 불러오는 중입니다',
    loadFailed: '오늘 출하 지시서를 확인할 수 없습니다',
    /* 고르던 지시서가 목록에서 빠졌다. 말없이 나가면 무슨 일이 있었는지 알 수 없다. */
    dropped: '고르던 지시서가 오늘 출하 지시서에서 빠졌습니다',
    none: '오늘 피킹할 출하 지시서가 없습니다',
    /* 출하 완료된 지시서는 목록에 세우지 않는다 — 더 집을 일이 없다. */
    completedHidden: '출하 완료된 지시서는 목록에서 빠집니다',
    noSalesOrder: '수주 없음',
    salesOrder: (salesOrderNo: string) => `수주 ${salesOrderNo}`,
    shipDate: (date: string) => `출하 예정 ${date}`,
    lineSummary: (lineNo: number, item: string, picked: string, target: string) =>
      `${String(lineNo)}. ${item} 피킹 ${picked} / 목표 ${target}`,
    pickingLots: (count: number) => `피킹 중, LOT ${String(count)}`,
    notStarted: '피킹 전',
  },
  request: {
    customer: '고객',
    shipTo: '납품처',
    salesOrder: '수주',
    shipDate: '출하 예정',
    change: '다른 지시서 고르기',
    showCode: '지시서 코드 보기',
  },
  line: {
    title: (lineNo: number, itemCode: string) => `라인 ${String(lineNo)}, ${itemCode}`,
    inspection: '출하검사 대상',
    noInspection: '출하검사 없음',
    reached: '목표 채움',
    target: '목표',
    picked: '피킹',
    remaining: '남음',
    over: '초과',
    noLots: '아직 피킹한 LOT 이 없습니다. LOT 라벨을 스캔하세요',
    itemFailed: '품목을 확인할 수 없습니다',
    /* 자유 텍스트라 해석하지 않는다. 사람이 읽고 집는다. */
    customerRequirement: '고객 LOT 요구',
    minimumShelfLife: (days: number) => `잔여 유효기간 요구 ${String(days)}일 이상`,
  },
  lot: {
    qty: (qty: string, uom: string) => `${qty} ${uom}`,
    portion: (warehouse: string, location: string | null) =>
      location === null ? warehouse : `${warehouse}, ${location}`,
    /* 적치 대기 자리(PUTAWAY_STAGING) 몫 — 아직 선반에 놓지 않은 재고다. */
    staging: '적치 대기',
    /* 판정을 정한 결과 — 불합격 줄에서 「어느 결과로 불합격인가」를 보인다. */
    oqcResult: (round: number, at: string) => `OQC 결과 ${String(round)}, ${at}`,
    replace: '교체',
    replaced: '교체됨',
    replacedDetail: (nonconformanceNo: string | null, worker: string, at: string) =>
      nonconformanceNo === null
        ? `불량, ${worker} ${at}`
        : `불량, 부적합 ${nonconformanceNo}, ${worker} ${at}`,
  },
  /** LOT OQC 판정 6종(FR-007). 보류는 막기만 하고 [교체]가 없다. */
  oqc: {
    NOT_INSPECTED: '미검사',
    ACCEPTED: '합격',
    REJECTED: '불합격',
    HELD: '보류',
    NOT_REQUIRED: '검사 불필요',
    SKIPPED: '검사 생략',
  },
  scan: {
    label: '제품 LOT 스캔',
    hint: 'LOT 라벨을 스캔하면 바로 피킹합니다',
    placeholder: '제품 LOT QR을 스캔하세요',
    manualLabel: '직접 입력',
    manualSubmit: '피킹',
    pending: (lotNo: string) => `${lotNo} 피킹 중입니다`,
  },
  picked: {
    title: (lotNo: string, qty: string, uom: string) => `${lotNo} ${qty} ${uom} 를 피킹했습니다`,
    reached: (lineNo: number, target: string) =>
      `라인 ${String(lineNo)} 목표 ${target} 을 채웠습니다`,
    reachedOver: (lineNo: number, target: string, over: string) =>
      `라인 ${String(lineNo)} 목표 ${target} 을 채웠습니다, 초과 ${over}`,
    remaining: (lineNo: number, left: string) => `라인 ${String(lineNo)} 남음 ${left}`,
  },
  /** 거절은 서버 409 `code` 로 가른다. 실제로는 한 번에 하나만 뜬다. */
  rejected: {
    notPicked: '피킹하지 않았습니다',
    LOT_TARGET_REACHED: '목표 수량을 채웠습니다',
    targetReachedDetail: (lineNo: number, target: string, picked: string) =>
      `라인 ${String(lineNo)} 은 목표 ${target} 에 피킹 ${picked} 입니다. LOT 을 더 받지 않습니다`,
    LOT_ALREADY_RESERVED: '다른 작업에 잡힌 LOT 입니다',
    reservedDetail: '다른 출하 지시서나 출고에 예약된 몫이 있어 통째로 집을 수 없습니다',
    LOT_ALREADY_PICKED: '이미 이 지시서에 피킹한 LOT 입니다',
    NO_LINE_FOR_ITEM: '이 지시서에 이 품목 라인이 없습니다',
    /** 피처 013(시안 M0401) — 원래 · 새 LOT 모두 해당. */
    LOT_SPLIT_UNCONFIRMED: '분리 확인 전인 LOT 입니다',
    splitUnconfirmedDetail:
      'POP 에서 나눈 뒤 PDA 「LOT 분리 확인」을 하지 않았습니다. 두 라벨을 스캔해 확인한 뒤 다시 스캔하세요',
    notFound: '이 공장의 LOT 이 아닙니다',
    notFoundDetail: '번호를 확인하고 다시 스캔하세요',
    failed: '피킹을 기록하지 못했습니다',
    failedDetail: '연결을 확인하고 같은 LOT 을 다시 스캔하세요. 두 번 기록되지 않습니다',
    /** 전송 실패 띠의 단추 — 실패한 그 LOT 을 같은 멱등 키로 다시 보낸다(시안 ⑩). */
    retry: '다시 시도',
  },
  replace: {
    confirmTitle: (lotNo: string) => `${lotNo} 을 교체할까요?`,
    effectPicked: (qty: string, uom: string, lineNo: number, before: string, after: string) =>
      `피킹에서 ${qty} ${uom} 가 빠집니다(라인 ${String(lineNo)} 피킹 ${before} → ${after})`,
    effectDefect: 'LOT 이 불량 상태가 되고 부적합 1건이 생깁니다',
    effectReceive: (lineNo: number, qty: string, uom: string) =>
      `라인 ${String(lineNo)} 이 ${qty} ${uom} 를 다시 받습니다`,
    irreversible: '되돌릴 수 없습니다',
    cancel: '취소',
    proceed: '교체',
    done: (lotNo: string) => `${lotNo} 을 교체했습니다`,
    nonconformance: (no: string) => `부적합 ${no} 이 생겼습니다`,
    receiveMore: (lineNo: number, qty: string, uom: string) =>
      `라인 ${String(lineNo)} 이 ${qty} ${uom} 를 더 받습니다. 다른 LOT 을 스캔하세요`,
    notRejected: '교체하지 않았습니다',
    notRejectedDetail:
      '교체 전에 이 LOT 의 재검 합격이 들어와 교체할 필요가 없습니다. LOT 은 피킹된 채 남습니다',
    failed: '교체하지 못했습니다. 연결을 확인하고 다시 누르세요',
  },
  /** 출하 관리 코드(FR-020) — LOT 마다 하나, 선택, 100자 이하, 중복·형식 검사 없음. */
  code: {
    label: '출하 관리 코드(선택)',
    labelLimit: '출하 관리 코드(선택), 100자 이하',
    empty: '없음',
    edit: (lotNo: string) => `${lotNo} 출하 관리 코드 고치기`,
    noCheck: '중복과 형식은 검사하지 않습니다',
    count: (length: number) => `${String(length)}/100`,
    tooLong: '100자까지 넣을 수 있습니다',
    cancel: '취소',
    save: '저장',
    failed: '코드를 저장하지 못했습니다. 다시 스캔하거나 입력하세요',
  },
  /**
   * 방금 찍은 결과 칸(사용자 지시 2026-11-20 — 입하 등록 시안 A 를 제품 피킹에도). 한 칸이 결과마다 바뀐다:
   * 피킹됨 초록 · 이미 피킹함 회색(보내지 않고 몇 번 라인인지) · 피킹 안 됨 빨강.
   */
  result: {
    picked: '피킹됨',
    reached: '목표 채움',
    duplicate: '이미 피킹한 LOT입니다',
    duplicateRow: (lineNo: number) => `피킹 라인 No ${String(lineNo)}에 있습니다`,
    rejected: '피킹 안 됨',
    replaced: '교체됨',
    replaceRefused: '교체 안 됨',
  },
  /** 피킹 라인 표 — 라인 한 줄씩, 줄을 누르면 그 라인 시트. */
  tally: {
    title: '피킹 라인',
    total: (count: number) => `${String(count)}개`,
    columns: { no: 'No', item: '품목', lots: 'LOT', qty: '피킹 / 목표' },
    open: (itemCode: string, itemName: string) => `${itemCode} ${itemName} 라인 열기`,
    rejected: (count: number) => `불합격 ${String(count)}`,
  },
  /** 라인 시트 — 이름표 칸과 그 라인의 LOT. 교체 · 출하 관리 코드는 여기에만 둔다. */
  sheet: {
    title: '피킹 라인',
    fields: {
      itemCode: '품목코드',
      itemName: '품목명',
      picked: '피킹',
      inspection: '출하검사',
      requirement: '고객 LOT 요구',
      shelfLife: '잔여 유효기간',
    },
    pickedOfTarget: (picked: string, target: string, uom: string) =>
      `${picked} / 목표 ${target} ${uom}`,
    over: (over: string) => `초과 ${over}`,
    inspection: '대상',
    noInspection: '없음',
    shelfLife: (days: number) => `${String(days)}일 이상`,
    lots: '피킹한 LOT',
  },
  /** 「지시서 코드 보기」 — POP 「출하 완료」 화면의 스캐너에 비출 QR. */
  qr: {
    title: '지시서 코드',
    label: (no: string) => `출하 지시서 ${no} QR`,
    guide: 'POP 「출하 완료」 화면의 스캐너에 비추세요',
    guideDetail: '출하 완료는 POP 에서만 합니다',
    blockedTitle: '아직 완료할 수 없습니다',
    close: '닫기',
  },
  /** 막는 이유(completionBlockers). 수주 라인 취소는 푸는 길이 없어 문의만 안내한다(FR-028b). */
  blocker: {
    PICKING_SHORT: (lineNo: number) => `라인 ${String(lineNo)} 피킹이 목표 수량에 못 미칩니다`,
    NOT_INSPECTED: (lotNo: string) => `미검사 LOT ${lotNo}`,
    REJECTED: (lotNo: string) => `불합격 LOT ${lotNo}`,
    HELD: (lotNo: string) => `보류 LOT ${lotNo}`,
    SALES_ORDER_LINE_CANCELLED: (lineNo: number) =>
      `라인 ${String(lineNo)} 수주 라인이 취소되었습니다. 담당자에게 문의하세요`,
    ALREADY_COMPLETED: '이미 출하 완료된 지시서입니다',
  },
} as const;
