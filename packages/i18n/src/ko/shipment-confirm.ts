/**
 * W-04-12 출하 내역(피처 010 · omf-all-around#305 — 옛 이름 「출하 확정·취소」).
 *
 * ⭐ 출하는 POP 「출하 완료」(P-04-07)에서 끝난다. 이 화면은 출하를 보고, ERP 로 보내기 «전»이면
 * 취소를 요청한다. 옛 흐름·긴급 직행으로 만든 미확정 출하만 상세에서 한 건씩 확정한다.
 *
 * ⛔ 출하 완료 단계 화면(PDA 피킹·P-04-07·W-04-02·인쇄)에는 ERP 송신 표시가 없다 — ERP 송신
 * 상태는 이 화면에만 보인다(사용자 결정 2026-11-18).
 */
export const shipmentConfirm = {
  title: '출하 내역',
  breadcrumbRoot: '영업 / 출하 관리',
  /** 출하 목록 제목 옆 ⓘ — 출하가 어디서 끝나고 무엇만 여기서 확정하는지(관리웹 정리 시안 A). */
  flowRule:
    '출하는 POP 「출하 완료」에서 끝납니다. 옛 흐름이나 긴급 직행으로 만든 미확정 출하만 여기서 확정합니다.',
  panes: {
    list: '출하 목록',
    detail: '출하 상세',
  },
  filter: {
    period: '완료(출하)일',
    q: '출하번호, 지시서, 고객',
    qPlaceholder: '검색어 입력',
    erp: 'ERP 송신',
    all: '전체',
    search: '조회',
    reset: '초기화',
    /** 거르기 칩 — 이름과 건수(시안 「대기 2」). */
    chip: (label: string, count: number): string => `${label} ${String(count)}`,
    /** L-3 — 기간은 비울 수 없다. */
    periodRequired: '기간을 선택해야 조회할 수 있습니다',
    periodReversed: '시작일이 종료일보다 뒤입니다. 두 날짜를 바꿔 주세요',
  },
  /** 응답 `erpSendStatus` 6가지(결정 2026-11-18). */
  erp: {
    NOT_QUEUED: '확정 전',
    PENDING: '대기',
    SENT: '보냄',
    SEND_ERROR: '송신 오류',
    NOT_SENT_NO_SALES_ORDER: '송신 안 함',
    CANCELLED: '취소됨',
  },
  flow: {
    completed: '출하 완료',
    legacyUnconfirmed: '옛 흐름 미확정',
    expeditedUnconfirmed: '긴급 직행 미확정',
    /** 옛 흐름에서 확정된 출하는 「확정」 그대로(시안 확인할 것). */
    confirmed: '확정',
    cancelled: '취소',
    cancelPending: '취소 상신 중',
  },
  /** 취소 상신 중이면 그동안 ERP 송신을 보류한다(FR-024). */
  hold: '송신 보류',
  list: {
    loading: '출하 내역 불러오는 중',
    loadFailed: '출하 내역을 불러오지 못했습니다',
    empty: '조건에 맞는 출하가 없습니다',
    emptyDescription: '기간을 넓히거나 ERP 송신 거르기를 풀어 보세요.',
    fields: {
      shipmentNo: '출하번호',
      shippedAt: '완료(출하) 시각',
      customerRequest: '고객과 지시서',
      warehouse: '창고',
      completedBy: '완료 단말과 작업자',
      erp: 'ERP 송신',
    },
    warehouseCount: (count: number): string => `창고 ${String(count)}곳`,
    /** 옛 흐름 출하는 관리웹에서 만들었다 — 완료 단말이 없다. */
    webCreated: '관리웹',
    open: (shipmentNo: string): string => `${shipmentNo} 상세 보기`,
    page: (page: number, total: number): string => `${String(page)}쪽, 전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
    shippedAtUnknown: '실물 출하 시각이 없습니다',
    /** 경과·셀 수 없는 값은 0 으로 접지 않는다. */
    elapsedUnknown: '—',
  },
  elapsed: {
    days: (days: number, hours: number): string => `${String(days)}일 ${String(hours)}시간`,
    hours: (hours: number): string => `${String(hours)}시간`,
  },
  detail: {
    empty: '목록에서 출하를 고르세요',
    loading: '출하 상세 불러오는 중',
    loadFailed: '출하 상세를 불러오지 못했습니다',
    fields: {
      shipmentRequest: '출하 지시서',
      salesOrder: '수주',
      customer: '고객',
      shipTo: '납품처',
      completedAt: '완료(출하) 시각',
      terminal: 'POP 단말',
      worker: '작업자',
      erpDeliveryNo: 'ERP 납품번호',
    },
    erpDeliveryNone: '— (아직 송신 전)',
    noSalesOrder: '수주 없음',
    /* 재고가 빠진 창고(시안 W0412) — 출고 전표는 창고마다 한 장이다. */
    warehouses: '재고가 빠진 창고',
    warehousesNote: '출고 전표는 창고마다 한 장입니다.',
    goodsIssue: (goodsIssueNos: string): string => `출고 전표 ${goodsIssueNos}`,
    noGoodsIssue: '출고 전표 없음(확정 전)',
    staging: '적치 대기',
    lines: '라인과 LOT',
    linesNote: '출하 수량은 LOT 통째입니다. 출하 관리 코드는 보기만 합니다.',
    columns: {
      lot: '라인 / LOT',
      shipped: '출하',
      managementCode: '출하 관리 코드',
      places: '재고가 빠진 곳',
      oqc: 'OQC',
    },
    line: (lineNo: number, itemCode: string): string => `라인 ${String(lineNo)}: ${itemCode}`,
    lineQty: (target: string, shipped: number): string => `목표 ${target}, 출하 ${String(shipped)}`,
    over: (qty: number): string => `초과 +${String(qty)}`,
    /** 수주 없는 라인 — 이 라인은 ERP 로 보내지 않는다(US7-4 · FR-026). */
    lineNotSent: 'ERP 송신 안 함',
    /** 송신 대기 — 다음 송신 때 나갈 수주 연결 라인 수와 수주 번호(시안 「라인 n행(수주 SO-…)」). */
    erpPending: (lineCount: number, salesOrderNos: string): string =>
      `아직 ERP 로 보내지 않았습니다. 다음 송신 때 수주 연결 라인 ${String(lineCount)}행(수주 ${salesOrderNos})이 나갑니다.`,
    replaced: '교체됨 — 출하에 들지 않음',
    replacedNote: (replacedAt: string, nonconformanceNo: string | null): string =>
      nonconformanceNo === null
        ? `불합격으로 교체 ${replacedAt}`
        : `불합격으로 교체 ${replacedAt}, 부적합 ${nonconformanceNo}`,
    noValue: '—',
    erp: 'ERP 송신',
    erpMessage: {
      NOT_QUEUED:
        '확정 전입니다. 확정하면 ERP 전표 송신이 대기열에 실립니다 — 즉시 전송이 아닙니다.',
      PENDING: '아직 ERP 로 보내지 않았습니다. 다음 송신 때 수주 연결 라인이 나갑니다.',
      SENT: 'ERP 로 보냈습니다.',
      SEND_ERROR:
        'ERP 송신에 실패해 아직 ERP 에 반영되지 않았습니다. 취소를 요청할 수 있습니다 — 취소가 실행되면 이 송신은 다시 시도하지 않습니다.',
      NOT_SENT_NO_SALES_ORDER: '수주 없이 나간 출하라 ERP 로 보내지 않습니다.',
      CANCELLED: '취소된 출하입니다. ERP 송신 대기도 지워졌습니다.',
    },
    cancelPendingBanner:
      '취소 요청이 결재 중이라 이 출하는 ERP 로 보내지 않고 기다립니다. 승인 뒤 취소가 실행되면 송신 대기도 지워집니다. 반려되면 다음 송신 때 나갑니다.',
    legacyBanner:
      '배포 전에 관리웹 출하 처리로 만든 출하입니다. 지금처럼 확정해야 ERP 출고 송신이 쌓입니다. 확정 전에는 취소를 요청할 수 있습니다.',
    expeditedBanner:
      '긴급 직행으로 만든 출하입니다. 확정해야 ERP 출고 송신이 쌓입니다. 확정 전에는 취소를 요청할 수 있습니다.',
  },
  /** 피킹 LOT 의 OQC 판정 6종(FR-007). */
  oqc: {
    NOT_REQUIRED: '검사 불필요',
    SKIPPED: '검사 생략',
    NOT_INSPECTED: '미검사',
    ACCEPTED: '합격',
    REJECTED: '불합격',
    HELD: '보류',
  },
  /** 취소는 ERP 로 보내기 전에만 된다 — 그 사실을 취소 요청 옆에 둔다. */
  cancelNote:
    'ERP 로 보내기 전(송신 오류 포함)에만 취소할 수 있습니다. 취소가 승인되면 이 화면에서 [취소 실행]으로 실행합니다.',
  actions: {
    confirm: '확정',
    requestCancel: '취소 요청',
    executeCancel: '취소 실행',
  },
  lock: {
    sent: 'ERP 로 이미 보냈습니다. ERP 에서 처리하세요',
    cancelPending: '취소 요청이 결재 중입니다',
    confirmedLegacy: '확정 후에는 취소할 수 없습니다',
    cancelled: '취소된 출하입니다',
    running: '확정을 처리하는 중입니다',
    /** 승인된 취소가 아직 실행되지 않았다 — 다시 요청하지 않고 실행한다. */
    cancelApproved: '취소가 승인됐습니다. [취소 실행]으로 실행하세요',
  },
  confirmDialog: {
    title: '출하 확정',
    target: (count: number): string => `출하 ${String(count)}건을 확정합니다.`,
    list: '확정할 출하',
    irreversible: '확정은 되돌릴 수 없습니다 — 확정 취소 경로가 없습니다.',
    erpQueued: 'ERP 전표 송신이 대기열에 실립니다. 즉시 전송이 아닙니다.',
    cancel: '취소',
    confirm: '확정',
  },
  cancelDialog: {
    title: '출하 취소 요청',
    target: (shipmentNo: string): string => `${shipmentNo}의 취소를 요청합니다.`,
    /** §5-8 — 요청과 실행이 다른 액션이다. 그 사실을 요청하는 자리에서 말한다. */
    approvalNote: '요청은 결재로 올라갑니다. 승인된 뒤에 취소가 실행됩니다.',
    /** FR-024 — 상신 중에는 러너가 그 출하를 보내지 않는다. */
    hold: '요청하면 승인되고 실행될 때까지 이 출하는 ERP 로 보내지 않습니다.',
    whatTitle: '취소가 실행되면',
    what: {
      stock: (qty: number, warehouses: string): string =>
        `재고 ${String(qty)} 이(가) 빠진 자리로 돌아갑니다(${warehouses}).`,
      documents: '출고 전표가 취소되고, ERP 송신 대기가 지워집니다.',
      salesOrder: '수주의 출하 수량이 그만큼 줄어듭니다.',
      request: (shipmentRequestNo: string): string =>
        `지시서 ${shipmentRequestNo} 은(는) 「출하 완료 전」으로 돌아갑니다. 피킹과 OQC 기록은 남고, 피킹 LOT 은 다시 예약됩니다(다시 잡지 못한 LOT 은 풀린 채로 표시).`,
    },
    reasonLabel: '취소 사유',
    reasonHelp: '왜 취소하는지 남기세요. 승인자가 이것을 읽고 판단합니다.',
    reasonRequired: '취소 사유를 입력하세요',
    reasonTooLong: '취소 사유가 너무 깁니다. 500자까지 입력하세요',
    /** 요청하는 사이 송신이 먼저 끝났다 — 409 ERP_ALREADY_SENT. */
    erpAlreadySent:
      '취소 요청을 올리지 못했습니다. 요청하는 사이 ERP 송신이 먼저 끝났습니다 — ERP 로 이미 보냈습니다. ERP 에서 처리하세요.',
    cancel: '닫기',
    submit: '취소 요청',
  },
  /** 승인된 취소의 실행 확인 창(FR-023 — 결재함은 승인만 하고 실행은 이 화면에서 한다). */
  executeDialog: {
    title: '출하 취소 실행',
    target: (shipmentNo: string): string => `${shipmentNo}의 승인된 취소를 실행합니다.`,
    irreversible: '실행하면 되돌릴 수 없습니다. 다시 내보내려면 POP 에서 출하를 다시 완료하세요.',
    erpAlreadySent: '실행하지 못했습니다. 그 사이 ERP 로 이미 보냈습니다. ERP 에서 처리하세요.',
    failed: (message: string): string => `실행하지 못했습니다. ${message}`,
    cancel: '닫기',
    submit: '취소 실행',
  },
  result: {
    allConfirmed: (count: number): string => `출하 ${String(count)}건을 확정했습니다.`,
    partial: (confirmed: number, failed: number): string =>
      `${String(confirmed)}건 확정 · ${String(failed)}건 실패`,
    allFailed: (count: number): string => `${String(count)}건 모두 확정하지 못했습니다.`,
    reasons: {
      alreadyConfirmed: '이미 확정된 출하입니다',
      cancelInProgress: '취소 요청이 결재 중입니다',
      versionConflict: '다른 처리가 먼저 반영됐습니다. 다시 조회한 뒤 확정하세요',
      lockUnavailable: '확정에 필요한 정보를 받지 못했습니다. 다시 시도하세요',
      unknown: '확정하지 못했습니다',
    },
    executeCancelDone: (shipmentNo: string): string =>
      `${shipmentNo}의 취소를 실행했습니다. 재고와 출고 전표가 되돌려졌습니다.`,
    requestCancelDone: (shipmentNo: string): string =>
      `${shipmentNo}의 취소 요청을 올렸습니다. 승인 뒤에 취소가 실행됩니다.`,
  },
} as const;
