/**
 * P-02-06 생산LOT 완료 처리.
 *
 * ⭐ **「완료 처리」와 「미달 마감」을 끝까지 다른 말로 쓴다.** 두 결말은 되돌릴 수 없고 뜻이
 * 달라서, 문구가 뭉치면 사용자가 미달을 인지하지 못한 채 끝낸다(스펙 §3 · R71).
 */
export const productionLotComplete = {
  title: '생산LOT 완료',

  entry: {
    /** 머리줄 왼쪽의 맥락 — 「무엇을 보고 있는가」다(스펙 §3 머리줄). */
    workOrderLabel: '작업지시',
    /**
     * 머리줄 맥락 — **스펙 §3 의 「`WO-…013 · ABC-123 · 사출`」**.
     *
     * ⛔ **라벨을 붙이지 않는다.** POP 스펙들은 맥락 값(작업지시·품목·공정)을 값만 두고
     * 가운뎃점으로 잇는다 — 라벨은 사번에만 붙는다(`P-02-01`·`P-02-02` §3).
     * ⛔ 못 받은 조각은 «빼고» 잇는다 — 「—」를 끼워 넣으면 없는 값이 있는 것처럼 읽힌다.
     */
    headerContext: (parts: readonly string[]): string => parts.filter(Boolean).join(' · '),
    /** 아직 못 받았을 때. 주소의 식별자 숫자를 그대로 내지 않는다. */
    workOrderUnknown: '작업지시 —',
    missingWorkOrder: '작업지시를 받지 못해 대상 LOT 을 불러올 수 없습니다.',
  },

  /** 단말 기능 구성 판정. 「확인할 수 없다」와 「권한이 없다」를 다르게 말한다. */
  gate: {
    checking: '완료 권한을 확인하는 중입니다.',
    denied: '이 단말에서는 작업을 완료할 수 없습니다. 담당자에게 문의하세요.',
    unavailable: '완료 권한을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    unidentified: '단말이 확인되지 않아 완료할 수 없습니다.',
    retry: '다시 확인',
  },

  device: {
    terminalLabel: '단말',
    /* 값 없음 표기는 POP 한 벌로 「— 」다(사용자 확정 · 전례 `P-CO-01` 의 「단말 —」). */
    terminalUnknown: '—',
  },

  lotList: {
    sectionLabel: 'LOT 목록',
    lotNoColumn: 'LOT',
    goodQtyColumn: '양품',
    goodQtyPlaceholder: '—',
    select: '선택',
    empty: '이 작업지시에 완료할 LOT 이 없습니다.',
    /**
     * 작업지시를 받지 못했을 때의 빈 목록 문구.
     *
     * ⛔ **`empty` 를 그대로 쓰지 않는다** — 「이 작업지시에」가 가리킬 작업지시가 없는데도
     * 있는 것처럼 말해, 위쪽 띠의 「작업지시를 받지 못했다」와 서로 다른 이야기가 된다(실측).
     */
    emptyNoWorkOrder: '작업지시를 고르면 대상 LOT 이 나옵니다.',
    loadFailed: '대상 LOT 을 불러오지 못했습니다.',
    /**
     * 계획 슬롯 수를 상한으로 읽지 않게 한다(§3 도면 · R27).
     *
     * ⛔ **수 없이 「계획값이며 상한이 아닙니다」만 두지 않는다** — 무엇이 계획값인지 가리킬
     * 대상이 없어 사용자가 뜻을 잡지 못한다(실측 — 사용자 확인에서 잡혔다). 도면도 수와 함께
     * 적었다.
     *
     * ⚠ 세는 것은 **아직 완료하지 않은 LOT** 이다. 도면의 「슬롯 10개 중 2개 진행」에서 뒤쪽
     * (진행 수)은 목록이 진척을 내리지 않아 낼 수 없다.
     */
    slotNotice: (remaining: number): string =>
      `이 작업지시에 아직 완료하지 않은 LOT 이 ${String(remaining)}개 있습니다. 미리 발행해 둔 수는 계획값이며 상한이 아니라, 더 만들어도 됩니다.`,
    /**
     * 한 쪽에 다 담기지 않았을 때. ⛔ **잘린 사실을 말하지 않으면** 사용자는 목록에 보이는 것이
     * 전부라고 읽고, 화면에 없는 LOT 을 완료하지 못한 채 넘어간다.
     */
    truncated: (shown: number): string => `지금 목록에는 ${String(shown)}개만 보입니다.`,
  },

  detail: {
    sectionLabel: '완료 판정',
    lotLabel: 'LOT',
    targetLabel: '목표 양품',
    goodQtyLabel: '누적 양품',
    achievementLabel: '달성률',
    unknownValue: '확인할 수 없음',
    notSelected: 'LOT 을 고르면 완료 판정이 나옵니다.',
    loadFailed: '고른 LOT 의 진척을 불러오지 못했습니다.',
    progressUnavailable: '누적 양품을 받지 못해 완료 여부를 판정할 수 없습니다.',
  },

  /** 서버가 준 판정을 그대로 옮긴 말. 화면이 다시 계산하지 않는다. */
  judgment: {
    under: '미달',
    normal: '목표 달성',
    over: '초과 달성',
    /** 초과를 막지 않는다(§5-4 · R27) — 경고가 아니라 안내다. */
    overNotice: '목표를 넘었습니다. 초과분도 실적으로 인정되며 완료할 수 있습니다.',
  },

  reason: {
    label: '미달 사유',
    placeholder: '사유를 고르세요',
    loadFailed: '미달 사유 목록을 불러오지 못했습니다. 미달 마감을 할 수 없습니다.',
    empty: '고를 수 있는 미달 사유가 없습니다. 담당자에게 문의하세요.',
  },

  action: {
    complete: '완료 처리',
    closeUnder: '미달 마감',
    submitting: '처리하는 중입니다',
  },

  /**
   * 버튼이 막힌 사유. **사유마다 사용자가 할 일이 다르므로 문구를 나눈다** — 뭉치면 무엇을
   * 고쳐야 다시 눌리는지 알 수 없다.
   */
  blocked: {
    missingWorker: '사번이 확인되지 않아 완료할 수 없습니다. 사번 인증을 먼저 하세요.',
    notSelected: 'LOT 을 먼저 고르세요.',
    progressUnknown: '누적 양품을 확인할 수 없어 완료할 수 없습니다.',
    nothingProduced: '누적 양품이 없어 마감할 것이 없습니다. 폐번은 W/O 마감에서 처리합니다.',
    alreadyCompleted: '이미 완료된 LOT 입니다.',
    reasonRequired: '미달 사유를 고르면 미달 마감을 할 수 있습니다.',
    targetNotMet: '목표에 미달해 완료 처리할 수 없습니다. 미달 마감을 쓰세요.',
    targetMet: '목표를 채워 미달 마감 대상이 아닙니다.',
  },

  result: {
    completed: '완료 처리했습니다.',
    closedUnder: '미달 마감했습니다.',
    /** 라벨은 이 화면이 찍지 않는다(§5-5 · K-4). 다음에 할 일만 알린다. */
    nextStep: 'LOT 라벨 출력은 다음 화면에서 합니다.',
  },

  error: {
    completeTitle: '완료하지 못했습니다',
    forbidden: '이 단말에는 완료 권한이 없습니다. 담당자에게 문의하세요.',
    /** 다른 단말이 먼저 완료했다. 다시 읽으면 목록에서 빠져 있다. */
    conflict: '다른 곳에서 이미 처리된 LOT 입니다. 목록을 다시 불러오세요.',
    notFound: '대상 LOT 을 찾을 수 없습니다. 목록을 다시 불러오세요.',
    rejected: '요청이 반려됐습니다. 입력한 값을 확인하세요.',
    reload: '다시 불러오기',
  },
} as const;
