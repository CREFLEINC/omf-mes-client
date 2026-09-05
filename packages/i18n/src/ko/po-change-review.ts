/**
 * W-02-06 P/O 변경 관리자 확인.
 *
 * ⚠ **변경은 이미 반영된 뒤에 화면에 온다**(§5-1). P/O 는 ERP 발행·MES 수신본이라(R07) 화면이
 * 열릴 때 수량은 «이미» 바뀐 값이다. 그래서 「무엇이 바뀌었나」는 서버가 내리는
 * `lastChange` 로만 말할 수 있다.
 *
 * ⛔ **이것은 승인 워크플로우가 아니라 «확인» 행위다**(§5-4) — 결재선이 없고 단일 액션이다.
 */
export const poChangeReview = {
  title: 'P/O 변경 관리자 확인',
  breadcrumbRoot: '생산',
  panes: {
    list: '변경 알림 목록',
    diff: '무엇이 바뀌었나',
    workOrders: '영향 받는 W/O',
    decision: '판정',
  },
  header: {
    /** §6 — 미확인이 쌓이는 것을 헤더가 상시 말한다. 알림 엔티티가 아직 없어 건수로 시작한다. */
    unacknowledged: (count: number): string => `미확인 ${String(count)}건`,
  },
  list: {
    loading: '변경 알림 불러오는 중',
    loadFailed: '변경 알림을 불러오지 못했습니다',
    empty: '확인할 P/O 변경이 없습니다',
    emptyDescription: 'ERP가 변경을 보내면 여기에 나타납니다.',
    selectRow: (productionOrderNo: string): string => `${productionOrderNo} 선택`,
    fields: {
      receivedAt: '수신시각',
      productionOrderNo: 'P/O',
      changedFields: '변경 항목',
      acknowledged: '확인',
    },
    /** 변경 내역을 못 받은 행 — 지어내지 않고 모른다고 적는다(G-9). */
    changedFieldsUnknown: '변경 내역 없음',
    /** 열거 밖 항목만 바뀐 행 — 서버가 빈 배열을 내린다. */
    changedFieldsOutOfScope: '항목 미상',
    unacknowledgedChip: '미확인',
    acknowledgedChip: '확인됨',
  },
  diff: {
    columns: {
      field: '항목',
      before: '기존(MES)',
      after: '변경(ERP)',
      note: '비고',
    },
    receivedAt: (at: string): string => `수신 시각 ${at}`,
    /** 감소량은 화면이 뺀다(§4-A) — 단순 뺄셈이라 실패가 성립하지 않는다. */
    decrease: (qty: string): string => `▼ ${qty} 감소`,
    increase: (qty: string): string => `▲ ${qty} 증가`,
    same: '(동일)',
    selectFirst: '변경 알림 목록에서 변경 알림을 선택하세요',
    /** 목록은 미확인 기준이라 뜨는데 변경 내역이 함께 오지 않은 갈래 — 다시 불러와도 없으면 원문으로. */
    noLastChange:
      '변경 내역이 함께 오지 않았습니다. 다시 불러와도 없으면 연계 동기화 현황에서 원문을 확인하세요.',
    /** §5-1 — 항목은 열거 셋(수량·납기·상태)이다. 그 밖이 바뀌면 빈 배열로 오고 화면은 이 사실을 적는다(G-9). */
    outOfScope: '이 변경의 항목을 낼 수 없습니다 — 원문은 연계 동기화 현황에서 봅니다.',
  },
  workOrders: {
    loading: '영향 받는 W/O 불러오는 중',
    loadFailed: '영향 받는 W/O를 불러오지 못했습니다',
    empty: '이 P/O로 전개된 W/O가 없습니다',
    fields: {
      workOrderNo: 'W/O',
      qty: '수량',
      status: '상태',
      produced: '실적',
      mismatch: '불일치',
      adjustQty: '조정 수량',
    },
    /** §6 — 실적이 이미 붙은 W/O 는 반영이 계획을 실적 아래로 내린다. 막지 않고 경고한다(A-9 ⓑ). */
    alreadyProduced: '이미 생산됨',
    mismatchChip: 'P/O와 불일치',
    producedOverWarning: (produced: string, changed: string): string =>
      `이미 ${produced}개가 생산됐습니다. 반영하면 계획(${changed})이 실적보다 작아집니다.`,
    /** 서버가 스스로 나누지 않는다 — 어느 W/O 를 얼마나 줄일지는 여기서 사람이 정한다(계약). */
    adjustHelp: '반영할 W/O에만 새 지시 수량을 적습니다. 비우면 그 W/O는 그대로 둡니다.',
    adjustLabel: (workOrderNo: string): string => `${workOrderNo} 조정 수량`,
    adjustLocked: '판번호가 없어 이 W/O는 조정할 수 없습니다',
    adjustNotNumber: '숫자로 입력하세요',
    adjustNegative: '0 이상 입력하세요',
  },
  decision: {
    label: '판정',
    apply: '변경 반영 — W/O 수량을 조정한다',
    proceed: '기존 유지(강행) — 불일치를 남기고 계속한다',
    reasonLabel: '사유',
    /** ⛔ 강행 사유는 **화면이 막는다** — DB 는 강제하지 않는다(§6). */
    reasonHelp: '강행하면 사유가 필요합니다. 나중에 이 판단의 근거가 됩니다.',
    reasonRequired: '강행 사유를 입력하세요',
    reasonTooLong: '사유가 너무 깁니다. 500자까지 입력하세요',
    /** ⓘ 강행의 파급을 저장 «전»에 말한다(G-19). 서버가 플래그를 세우고 마감 화면이 읽는다. */
    proceedNote: '강행하면 영향 받는 W/O에 P/O 불일치 표식이 남습니다.',
    /** §6 — 반영인데 조정을 하나도 적지 않은 상태. 중단·취소 반영이 정당하게 이 상태라 막지 않는다. */
    applyWithoutAdjustment:
      '조정 수량을 적지 않은 작업지시는 그대로 두고, 그 W/O에는 P/O 불일치 표식이 남습니다. 중단·취소 반영처럼 조정할 수량이 없으면 그대로 진행해도 됩니다.',
    submit: '확인 처리',
    submitted: '확인 처리를 저장했습니다.',
  },
  lock: {
    selectNone: '변경 알림을 선택하세요',
    decisionNone: '반영 또는 강행을 고르세요',
    reason: '강행 사유를 입력하세요',
    adjustment: '조정 수량 오류를 고치세요',
    saving: '확인 처리를 저장하는 중입니다',
  },
  /**
   * §5-3 · §9-2 — ⚠ **「남이 고쳤다」가 아니다.** 여기서 부딪치는 상대는 사람이 아니라 **ERP
   * 배치**다. 공유계약 G-1 의 저장 충돌 문구를 그대로 쓰면 사용자가 동료를 찾으러 간다.
   */
  conflict: {
    title: 'ERP가 다시 변경했습니다',
    description:
      '판정하는 사이에 ERP가 이 P/O를 또 바꿔 보냈습니다. 다시 불러와 새 변경분으로 판정하세요.',
    reload: '다시 불러오기',
  },
  /** A-11 — 물러난 수준. **문구만 두지 않고 화면에 낸다.** */
  withdrawn: {
    /** §5-5 — 중단·취소 반영의 후속은 W/O 취소이고, 그것은 건별 액션이라 이 화면에 두지 않는다. */
    cancelFollowUp:
      '중단·취소를 반영한 뒤 작업지시를 취소하는 일은 이 화면에 두지 않았습니다. 취소는 선발행 LOT 슬롯을 함께 폐번하므로 건별로 확인하고 진행합니다.',
  },
} as const;
