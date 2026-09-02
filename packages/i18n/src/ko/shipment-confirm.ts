/**
 * W-04-12 출하 확정·취소.
 *
 * ⭐⭐ **이 화면이 「확정 후 취소」 문제를 없앤다.** 되돌릴 수 있는 구간을 ERP 에 보내기 «전»으로
 * 옮겨, 분산 트랜잭션·ERP 거부·불일치가 구조적으로 사라진다.
 *
 * ⛔ **확정은 되돌릴 수 없다.** 그러나 확정 전 관문을 두껍게 하지 않는다 — 경고를 늘리면 경고
 * 피로로 오히려 안 읽는다. 화면의 몫은 **「확정 후에는 취소할 수 없습니다」를 결과 구획에
 * 적는 것**까지다(§5-3).
 */
export const shipmentConfirm = {
  title: '출하 확정·취소',
  breadcrumbRoot: '출하',
  panes: {
    summary: '미확정 현황',
    list: '미확정 출하',
    outcome: '확정하면 일어나는 것',
  },
  summary: {
    unconfirmed: '미확정',
    overdue: '24시간 경과',
    critical: '3일 경과',
    unit: (count: number): string => `${String(count)}건`,
    /**
     * ⚠ **총계와 구간별 수의 출처가 다르다**(공유계약 L-11). 총계는 서버가 준 값이고 경과
     * 구간은 이 쪽에 받은 것으로만 센다 — 감추면 「26건 중 4건만 늦었구나」로 잘못 읽는다.
     */
    pageScoped: '경과 건수는 지금 보고 있는 쪽에 받은 것만 셉니다.',
    /**
     * §5-7 — ⚠ **이유가 회계가 아니다.** 회계 전기일은 ERP 소관이고, 적체가 위험한 이유는
     * **마감된 기간을 연계가 거부**하기 때문이다. 잘못된 이유를 적으면 남의 일로 읽힌다.
     */
    monthEndWarning: (count: number): string =>
      `이달 미확정이 ${String(count)}건 남았습니다. 월말까지 확정하지 않으면 연계가 거부될 수 있습니다.`,
  },
  filter: {
    shipDate: '출하일',
    customer: '고객',
    unconfirmedOnly: '미확정만',
    sort: '정렬',
    /**
     * ⚠ **기본값이 최신순이 아니다.** 목록의 관행은 최신순인데 적체 관리 화면에서는
     * **오래된 것이 위험하다** — 관행을 따르면 가장 위험한 건이 마지막 쪽에 숨는다(§5-7).
     */
    sortNote: '오래된 것이 위험해 경과일 긴 순이 기본입니다.',
    sortOptions: {
      elapsed: '경과일 긴 순',
      shipDate: '출하일 순',
      customer: '고객 순',
    },
    search: '조회',
    reset: '초기화',
    /** L-3 — 기간은 비울 수 없다. */
    periodRequired: '출하일 기간을 선택해야 조회할 수 있습니다',
    periodReversed: '시작일이 종료일보다 뒤입니다. 두 날짜를 바꿔 주세요',
  },
  list: {
    loading: '미확정 출하 불러오는 중',
    loadFailed: '미확정 출하를 불러오지 못했습니다',
    empty: '조건에 맞는 미확정 출하가 없습니다',
    emptyDescription: '기간을 넓히거나 다른 조건으로 조회하세요.',
    selectAll: '이 쪽에서 함께 확정할 수 있는 건 모두 선택',
    selectRow: (shipmentNo: string): string => `${shipmentNo} 선택`,
    fields: {
      shipmentNo: '출하번호',
      customer: '고객',
      shippedAt: '실물 출하',
      elapsed: '경과',
      status: '상태',
      erpDeliveryNo: 'ERP 납품번호',
    },
    /** G-9 — 확정 직후에는 아직 번호가 없다. 빈칸으로 두면 「실패」로 읽힌다. */
    erpPending: '전송 대기',
    shippedAtUnknown: '실물 출하 시각이 없습니다',
    /** 경과·자동 확정 예정을 셀 수 없다는 사실을 감추지 않는다. */
    elapsedUnknown: '—',
    selected: (count: number, quantity: string): string =>
      `선택 ${String(count)}건 · 합계 ${quantity}`,
  },
  elapsed: {
    /** 지난 시간을 사람의 말로. 초 단위는 이 화면에서 뜻이 없다. */
    days: (days: number, hours: number): string => `${String(days)}일 ${String(hours)}시간`,
    hours: (hours: number): string => `${String(hours)}시간`,
    overdue: '24시간 경과',
    critical: '3일 경과',
  },
  hold: {
    /** ⛔ 일괄에서 빼되 개별로는 할 수 있다 — 못 하게 막는 것이 아니다(§6). */
    excludedFromBatch: '함께 확정하지 않습니다. 하나씩 확인하고 확정하세요.',
  },
  outcome: {
    /** ⭐ 아직 아무것도 안 골랐을 때도 화면의 성격을 먼저 알려 준다. */
    idle: '확정할 출하를 선택하세요.',
    confirmed: (count: number): string => `출하 ${String(count)}건이 확정됩니다.`,
    /**
     * ⛔ **「전송됨」이라 쓰지 않는다**(§6 · 공유계약 B-8 보강). 대기열에 실리는 것과 실제로
     * 나가는 것은 다르고, 「전송됨」이라 적으면 실패했을 때 화면이 거짓말을 한 것이 된다.
     */
    erpQueued: 'ERP 전표 송신이 대기열에 실립니다 — 즉시 전송이 아닙니다.',
    irreversible: '확정 후에는 취소할 수 없습니다. 예외 경로를 두지 않습니다.',
    /** §5-3 — 취소는 확정 «전»에만 된다. 그 사실이 확정 버튼 옆에 있어야 뜻이 산다. */
    cancelBeforeOnly: '취소가 필요하면 확정 전에 하세요.',
  },
  actions: {
    confirm: '확정',
    requestCancel: '취소 요청',
    retry: '다시 시도',
  },
  lock: {
    selectNone: '확정할 출하를 선택하세요',
    selectOneForCancel: '취소 요청은 한 건씩 합니다. 한 건만 선택하세요',
    running: '확정을 처리하는 중입니다',
  },
  confirmDialog: {
    title: '출하 확정',
    /** 몇 건인지를 제목이 아니라 본문에 둔다 — 제목은 무엇을 하는지만 말한다. */
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
    reasonLabel: '취소 사유',
    reasonHelp: '왜 취소하는지 남기세요. 승인자가 이것을 읽고 판단합니다.',
    reasonRequired: '취소 사유를 입력하세요',
    reasonTooLong: '취소 사유가 너무 깁니다. 500자까지 입력하세요',
    /** A-11 — 취소한 사람·시각을 담을 자리가 없어 승인 기록이 이력을 대신한다. */
    traceWithdrawn: '취소한 사람과 시각은 결재 기록으로 남습니다.',
    cancel: '닫기',
    submit: '취소 요청',
  },
  result: {
    /**
     * §6 — ⚠ **성공분을 유지한다.** 건별 호출이라 함께 되돌리지 않으며, 확정을 되돌릴 경로가
     * 아예 없다(§5-3). 그래서 「전부 실패했다」로 뭉뚱그리면 **이미 확정된 건을 다시 확정하러
     * 간다.**
     */
    allConfirmed: (count: number): string => `출하 ${String(count)}건을 확정했습니다.`,
    partial: (confirmed: number, failed: number): string =>
      `${String(confirmed)}건 확정 · ${String(failed)}건 실패`,
    allFailed: (count: number): string => `${String(count)}건 모두 확정하지 못했습니다.`,
    /** 행마다 사유를 붙인다 — 무엇을 다시 시도할 수 있는지가 건마다 다르다. */
    reasons: {
      alreadyConfirmed: '이미 확정된 출하입니다',
      cancelInProgress: '취소 요청이 결재 중입니다',
      versionConflict: '다른 처리가 먼저 반영됐습니다. 다시 조회한 뒤 확정하세요',
      lockUnavailable: '확정에 필요한 정보를 받지 못했습니다. 다시 시도하세요',
      unknown: '확정하지 못했습니다',
    },
    requestCancelDone: (shipmentNo: string): string =>
      `${shipmentNo}의 취소 요청을 올렸습니다. 승인 뒤에 취소가 실행됩니다.`,
  },
  /**
   * §5-6 — ⛔ 확정 시각·확정자를 담을 컬럼이 없다. A-11 대로 **물러난 수준을 적는다.**
   * ⚠ 자동 확정과 손으로 한 확정을 가를 수 없다는 것이 이 부재의 실제 결과다.
   */
  withdrawn: {
    confirmedBy: '확정한 사람은 표시하지 않습니다. 자동 확정과 손으로 한 확정도 가리지 못합니다.',
    /**
     * ⚠ 결재 대상 유형과 승인 상태의 코드 값이 아직 정해지지 않아(G-2) 화면이 「이 출하에
     * 취소 요청이 걸려 있는가」를 판정하지 못한다. **막지는 못해도 조용하지는 않는다** —
     * 확정을 시도하면 서버가 막고 그 사유가 행에 붙는다.
     */
    cancelPendingUnknown:
      '취소 요청이 결재 중인지는 아직 목록에서 가리지 못합니다. 확정을 시도하면 결재 중인 건은 서버가 막고 사유를 보여 줍니다.',
    /** 승인 완료를 가릴 축이 없어 이 화면은 요청까지만 한다(§5-8). */
    executeCancel: '승인된 취소의 실행은 이 화면에 두지 않았습니다. 결재함에서 진행하세요.',
    /**
     * ⚠ 「출하 자동 확정」 정책 코드가 계약의 값 목록에 아직 없어(§4-C 「값 미정」) 설정을
     * 읽을 수 없다. **자동 확정이 도는 것 자체는 서버의 일**이고, 화면은 그것을 보여 주지
     * 못한다는 사실만 적는다 — 「꺼져 있다」로 지어내면 있는 기능을 없다고 말하게 된다.
     */
    autoConfirm:
      '자동 확정 설정과 예정 시각은 아직 이 화면에서 보여 드리지 못합니다. 자동 확정 자체는 설정에 따라 서버에서 돕니다.',
  },
} as const;
