/**
 * P-02-13 PQC 제품 검사·검사 결과 입력.
 *
 * 현장 단말(터치)에서 작업자·품질담당이 쓰는 화면이라 문구를 **짧고 곧게** 쓴다 —
 * 좁은 칸에서 줄이 접히면 읽지 않고 지나친다.
 *
 * ⛔ 구현 어휘(멱등 키·낙관적 잠금·큐)를 화면에 내지 않는다.
 */
export const pqcInspection = {
  title: 'PQC 제품 검사',
  breadcrumbRoot: '생산실행',

  queue: {
    heading: '검사 대기',
    columns: {
      inspectionRequestNo: '의뢰번호',
      workOrderId: '작업지시',
      statusCode: '상태',
      requestedAt: '의뢰 일시',
    },
    emptyValue: '—',
    openRow: (inspectionRequestNo: string): string => `검사 의뢰 ${inspectionRequestNo} 열기`,
    caption: '검사 대기 목록',
    empty: '조건에 맞는 검사 의뢰가 없습니다. 조건을 넓혀 보세요.',
    unavailable: '목록을 표시할 수 없습니다.',
    loading: '검사 의뢰를 불러오는 중입니다.',
  },

  /**
   * 조건 셋. 검사 유형(PQC)과 「아직 안 끝난 것만」은 조건이 아니라 **이 화면이 무엇인지의
   * 정의**라서 조건 줄에 두지 않는다.
   */
  filters: {
    workOrder: '작업지시',
    workOrderPlaceholder: '작업지시 번호',
    lot: '생산 LOT',
    lotPlaceholder: 'LOT 번호',
    keyword: '의뢰번호',
    keywordPlaceholder: '의뢰번호로 검색',
    apply: '조회',
    reset: '초기화',
    identifierInvalid: '번호는 1 이상의 정수로 넣어 주세요.',
  },

  status: {
    requested: '대기',
    inProgress: '진행',
  },

  detail: {
    heading: '대상',
    nothingSelected: '왼쪽 목록에서 검사할 의뢰를 고르세요.',
    loading: '의뢰를 불러오는 중입니다.',
    fields: {
      inspectionRequestNo: '의뢰번호',
      inspectionPlanVersionId: '검사기준 버전',
      lotId: '대상 LOT',
      itemId: '품목',
      workOrderId: '작업지시',
      targetQty: '검사수량',
    },
    planVersionNote: '검사 시점의 기준 버전으로 고정됩니다.',

    /**
     * ⚠ **샘플 수의 단위가 확정되지 않았다** — 「샘플 30」이 30개인지 30%인지 상류가 정하지
     * 않았다(스펙 §8 #5). 화면은 **단위를 반드시 함께 표기**해 사용자가 무엇을 보고 있는지
     * 알게 한다(공유계약 A-8). ⛔ 어느 한쪽으로 읽어 계산하지 않는다.
     */
    sampleUnitPending: '샘플 수의 단위(개/%)가 확정되지 않았습니다. 검사기준을 함께 확인하세요.',
  },

  /**
   * 적용 생산구간 — 이 검사 결과가 **어느 시간대의 생산분을 대표하는가**(스펙 §5-5).
   * 표본 검사라 불합격 시 회수 범위가 이 구간으로 정해진다.
   */
  coverage: {
    heading: '적용 생산구간',
    from: '시작',
    to: '종료',
    /** 자동으로 채우되 사람이 고칠 수 있다는 사실을 밝힌다 — 고칠 수 있는 줄 모르면 안 고친다. */
    note: '검사 시작·종료 시각으로 채워집니다. 필요하면 고칠 수 있습니다.',
    /** 끝이 시작보다 앞설 수 없다. 조용히 뒤집지 않는다 — 사용자가 뭘 넣었는지 알아야 한다. */
    invalidOrder: '종료가 시작보다 앞설 수 없습니다.',
  },

  result: {
    heading: '수량 판정',
    round: (round: number): string => `${round}회차`,
    notStarted: '아직 입력된 검사 결과가 없습니다.',
    loading: '검사 결과를 불러오는 중입니다.',
    confirmed: '이 회차는 확정되어 고칠 수 없습니다. 다시 검사하려면 재검사 회차를 추가합니다.',
    fields: {
      inspectedQty: '검사수량',
      accepted: '합격수량',
      rejected: '불합격수량',
      held: '보류수량',
    },
    sum: '합계',
    remaining: '잔여',
    matched: '검사수량과 일치합니다.',
    short: (remaining: string): string => `검사수량보다 ${remaining} 모자랍니다.`,
    over: (over: string): string => `검사수량보다 ${over} 많습니다.`,
    quantityInvalid: '수량은 0 이상, 소수점 여섯 자리까지 넣을 수 있습니다.',
    save: '임시 저장',
    saving: '저장 중',
    saved: '저장했습니다.',
    saveBlockedByInvalid: '수량 칸을 고친 뒤 저장할 수 있습니다.',

    judgment: '종합 판정',
    judgmentPlaceholder: '판정을 고르세요',
    judgmentUnavailable: '판정 값 목록이 아직 준비되지 않았습니다. 담당자에게 문의하세요.',
    judgmentUnknown: (code: string): string => `저장된 판정(${code})이 목록에 없습니다.`,

    confirm: '검사 확정',
    confirming: '확정 중',
    confirmNote: '확정하면 LOT 상태가 바뀌고 되돌릴 수 없습니다.',
    confirmBlockedByTotals: '검사 확정 — 수량 합계가 검사수량과 맞아야 확정할 수 있습니다.',
    confirmBlockedByJudgment: '검사 확정 — 종합 판정을 골라야 확정할 수 있습니다.',
    confirmBlockedByConfirmed: '검사 확정 — 이미 확정된 회차입니다.',
    confirmBlockedByUnsaved: '검사 확정 — 먼저 임시 저장을 해야 확정할 수 있습니다.',
    /**
     * ⛔ 단말에 검사 입력 권한이 없다(스펙 §5-1 · 공유계약 F-1). **감추지 않는다** —
     * 어떻게 푸는지를 함께 말한다(G-3).
     */
    confirmBlockedByTerminal:
      '검사 확정 — 이 단말은 이 공정의 검사 입력 권한이 없습니다. 단말 설정에서 권한을 부여하세요.',
    confirmSucceeded: '검사를 확정했습니다.',

    reinspect: '재검사 회차 추가',
    reinspectCancel: '재검사 그만두기',
    reinspectRound: '새 회차 (재검사)',
    reinspectNote: '수량을 넣고 임시 저장하면 새 회차가 만들어집니다. 앞 회차는 그대로 남습니다.',
    reinspectReasonPending:
      '재검사 사유는 아직 고를 수 없습니다. 사유 목록이 정해지면 이 자리에 추가됩니다.',
  },

  /**
   * 불합격 처분 — ⚠ **잠정이다.** 확정 판정은 불량창고 입고 후 별도 화면이 한다
   * (✅REQ-PR-0025 · 스펙 §5-8). ⛔ 고른 값을 **서버로 보내지 않는다** — 보내면 정본이 둘이 된다.
   */
  disposition: {
    heading: '불합격 처분',
    rework: '재작업 가능',
    scrap: '폐기',
    /** 순서가 뒤집힌다는 사실을 화면이 먼저 말한다 — 안 말하면 고른 값이 확정인 줄 안다. */
    note: '처분은 불량창고 입고 후 확정됩니다. 여기서 고른 값은 저장되지 않습니다.',
    /** 불합격이 0이면 고를 것이 없다. 감추지 않고 왜 비활성인지 밝힌다. */
    disabledNote: '불합격 처분 — 불합격수량이 있어야 고를 수 있습니다.',
  },

  history: {
    heading: '이전 회차',
    caption: '이전 검사 회차',
    columns: {
      round: '회차',
      judgment: '종합 판정',
      accepted: '합격',
      rejected: '불합격',
      held: '보류',
      confirmedAt: '확정 시각',
    },
    notConfirmed: '미확정',
  },

  measurements: {
    heading: '검사 항목',
    caption: '항목별 측정치',
    loading: '검사 항목을 불러오는 중입니다.',
    noItems: '이 검사기준 버전에는 검사 항목이 없습니다. 기준정보 담당자에게 문의하세요.',
    columns: {
      item: '항목',
      spec: '규격',
      sample: '샘플',
      value: '측정치',
      judgment: '판정',
    },
    requiredMark: '필수',
    sampleOf: (sampleNo: number, count: number): string => `${count} 중 ${sampleNo}`,
    range: (lower: number, upper: number): string => `${lower} ~ ${upper}`,
    atLeast: (lower: number): string => `${lower} 이상`,
    atMost: (upper: number): string => `${upper} 이하`,
    target: (value: number): string => `목표 ${value}`,
    notMeasured: '—',
    /**
     * ⚠ 규격을 벗어난 값이다. ⛔ **자동으로 불합격을 매기지 않는다**(스펙 §6) — 표시하고
     * 사람이 판정한다. 문구도 「불합격」이라고 말하지 않는다.
     */
    outOfSpec: '규격 밖',
    outOfSpecNote: '규격을 벗어난 값이 있습니다. 확인 후 직접 판정하세요.',
    calibrationWarningTitle: '교정이 만료된 계측기로 잰 값이 있습니다',
    calibrationWarning:
      '해당 측정치를 다시 확인하세요. 검사를 막지는 않습니다 — 계측기 교정은 설비 담당자에게 문의하세요.',
    calibrationExpired: '교정 만료',
  },

  pageNav: {
    label: '검사 대기 목록 쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${start}–${end} / 전체 ${total}건`,
    totalOnly: (total: number): string => `전체 ${total}건`,
    previous: '이전',
    next: '다음',
    beyondLast: '이 쪽에는 결과가 없습니다. 앞쪽으로 돌아가 보세요.',
    toFirstPage: '첫 쪽으로',
  },
} as const;
