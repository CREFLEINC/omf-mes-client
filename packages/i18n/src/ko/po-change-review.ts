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
      productionOrderNo: 'P/O',
      changedFields: '변경 항목',
      acknowledged: '확인',
    },
    unacknowledgedChip: '미확인',
    acknowledgedChip: '확인됨',
  },
  diff: {
    /**
     * ⚠ **지금 확실히 아는 값은 「변경 «후»」 하나다.** 왼쪽(기존)은 `lastChange` 가 와야
     * 채워진다 — 2열 비교표와 「▼ 1,000 감소」 표기, 그리고 항목이 빈 배열일 때의 문구는
     * **그 계약과 함께 선다.** 지금 적어 두면 아무 데서도 읽지 않는 글이 남는다.
     */
    columns: {
      after: '변경(ERP)',
    },
    selectFirst: '변경 알림 목록에서 변경 알림을 선택하세요',
    /**
     * ⚠ **아직 안 오는 것이지 만들지 않은 것이 아니다.** 변경 항목을 담아 내릴 계약 자리가
     * 생성물에 아직 반영되지 않았다 — 도착하면 이 구획이 그대로 채워진다.
     */
    pendingContract:
      '변경 항목을 아직 받지 못합니다. 계약이 반영되면 이 자리에 기존 값과 변경 값이 나란히 표시됩니다.',
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
    },
    /** §6 — 실적이 이미 붙은 W/O 는 반영이 계획을 실적 아래로 내린다. 막지 않고 경고한다(A-9 ⓑ). */
    alreadyProduced: '이미 생산됨',
    mismatchChip: 'P/O와 불일치',
    producedOverWarning: (produced: string, changed: string): string =>
      `이미 ${produced}개가 생산됐습니다. 반영하면 계획(${changed})이 실적보다 작아집니다.`,
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
    /**
     * §6 — ⚠ **반영인데 조정을 하나도 지정하지 않은 상태**. 지금은 조정 입력을 아직 못 만들어
     * **항상 이 상태다.** 막지 않고 파급을 말한다 — 중단·취소 반영이 정당하게 이 상태다.
     */
    applyWithoutAdjustment:
      '조정하지 않은 작업지시에는 불일치 표식이 남습니다. 수량·계획 시각 조정은 계약이 반영된 뒤에 이 화면에서 함께 보낼 수 있습니다.',
    submit: '확인 처리',
    submitted: '확인 처리를 저장했습니다.',
  },
  lock: {
    selectNone: '변경 알림을 선택하세요',
    decisionNone: '반영 또는 강행을 고르세요',
    reason: '강행 사유를 입력하세요',
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
    /** ⛔ W/O 조정 입력은 계약이 반영된 뒤에 붙인다. 자리만 잡아 둔다. */
    adjustment:
      'W/O별 수량·계획 시각 조정은 아직 이 화면에서 보내지 못합니다. 계약이 반영되면 여기에 붙습니다.',
    /** §5-5 — 중단·취소 반영의 후속은 W/O 취소이고, 그것은 건별 액션이라 이 화면에 두지 않는다. */
    cancelFollowUp:
      '중단·취소를 반영한 뒤 작업지시를 취소하는 일은 이 화면에 두지 않았습니다. 취소는 선발행 LOT 슬롯을 함께 폐번하므로 건별로 확인하고 진행합니다.',
  },
} as const;
