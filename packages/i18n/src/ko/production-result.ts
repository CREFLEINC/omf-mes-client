/**
 * P-02-04 작업실적 등록(LOT·제품 선택).
 *
 * 이 화면의 말은 「실적」이고 받는 수량은 **양품 하나**다 — 불량·손실은 이 화면에 오지 않는다.
 */
export const productionResult = {
  title: '작업실적 등록',

  entry: {
    workOrderLabel: '작업지시',
    itemLabel: '품목',
    workerLabel: '사번',
    missingWorkOrder: '작업지시를 받지 못해 실적을 등록할 수 없습니다.',
    missingWorker: '사번이 확인되지 않아 저장할 수 없습니다. 사번 인증을 먼저 하세요.',
    loadFailed: '작업지시를 불러오지 못했습니다.',
  },

  /** 단말 기능 구성 판정. 「확인할 수 없다」와 「권한이 없다」를 다르게 말한다. */
  gate: {
    checking: '실적 입력 권한을 확인하는 중입니다.',
    denied: '이 단말은 이 공정의 실적 입력 권한이 없습니다. 담당자에게 문의하세요.',
    unavailable: '실적 입력 권한을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    unidentified: '단말이 확인되지 않아 실적을 등록할 수 없습니다.',
    retry: '다시 시도',
  },

  /** 연결 상태와 미동기 건수 — 상시 표시가 필수 요건이다(공유계약 C-1). */
  sync: {
    pending: (count: number) => `미전송 ${String(count)}건`,
    /* 자동 재전송을 멈춘 상태 — 실적은 그대로 있고, 다시 보낼 계기만 사람이 준다. */
    stalledTitle: '서버가 계속 받지 않습니다',
    stalledBody:
      '저장한 실적은 그대로 남아 있습니다. 서버 상태를 확인한 뒤 「다시 보내기」를 누르세요.',
    retry: '다시 보내기',
  },

  /** 검사 선행(R54). 대상인데 아직 안 했으면 실적을 먼저 넣지 않는다. */
  pqc: {
    blockedTitle: 'PQC 검사가 남아 있습니다',
    blockedBody: '이 작업지시의 제품 검사를 먼저 마쳐야 실적을 등록할 수 있습니다.',
    goInspect: '검사 화면으로',
    loadFailed: '검사 의뢰를 확인할 수 없어 실적 입력을 열지 않습니다.',
  },

  lot: {
    sectionLabel: '대상 LOT',
    lotLabel: '대상 LOT',
    itemLabel: '제품',
    change: '변경',
    select: '선택',
    selected: '선택됨',
    empty: '이 작업지시에 대상 LOT 이 없습니다.',
    loadFailed: '대상 LOT 을 불러오지 못했습니다.',
    /** 34자리 무구분 숫자는 육안 대조가 안 된다 — 표시만 분절한다(저장은 원문 그대로). */
    groupedNote: '화면 표시는 읽기 쉽게 끊어 보입니다. 저장되는 번호는 끊지 않은 원문입니다.',
    unselected: '대상 LOT 을 먼저 고르세요.',
  },

  quantity: {
    sectionLabel: '실적 입력',
    goodQtyLabel: '양품수량',
    remarksLabel: '비고',
    keypadLabel: '수량 키패드',
    quickAdd: (step: number) => `＋${String(step)}`,
    /**
     * 잔여 / 지시 — 스펙 §3 의 「잔여수량 380 / 500」.
     *
     * ⚠ **숫자 둘을 빗금으로만 잇지 않는다.** 어느 쪽이 잔여이고 어느 쪽이 지시인지 화면에서
     * 알 수 없어 읽는 사람이 멈춘다(실기 확인에서 나온 지적). 각 숫자에 이름을 붙인다.
     */
    remaining: '잔여수량',
    remainingValue: (remaining: string, ordered: string) => `잔여 ${remaining} / 지시 ${ordered}`,
    remainingUnknown: '잔여수량을 확인할 수 없습니다.',
    empty: '양품수량을 입력하세요.',
    zero: '양품수량은 0보다 커야 합니다.',
  },

  /** 초과 생산은 허용이다 — 막지 않고 한 번 확인한다(✓확정 QA #27). */
  overrun: {
    title: '잔여수량을 넘습니다',
    body: (qty: string, remaining: string) =>
      `입력한 ${qty}이(가) 잔여 ${remaining}을(를) 넘습니다. 초과 생산으로 저장할까요?`,
    confirm: '초과로 저장',
    cancel: '다시 입력',
  },

  actions: {
    save: '저장',
    cancel: '취소',
  },

  save: {
    successTitle: '실적을 저장했습니다',
    /** 오프라인이어도 즉시 성공이다 — 큐에 담긴 사실을 함께 말한다(C-1 #2·#4). */
    queuedBody: '연결되면 자동으로 보냅니다.',
    failTitle: '실적을 저장하지 못했습니다',
    /** 저장 후 분기 — 잔여가 남으면 이어서, 0 이면 LOT 완료로. */
    continueBody: '잔여수량이 남아 있습니다. 이어서 입력하세요.',
    lotDoneTitle: '이 LOT 의 잔여수량이 없습니다',
    lotDoneBody: '생산LOT 완료 처리로 넘어가세요.',
  },
} as const;
