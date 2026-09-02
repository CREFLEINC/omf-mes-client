/**
 * P-02-06 생산LOT 완료 처리.
 *
 * ⭐ **「완료 처리」와 「미달 마감」을 끝까지 다른 말로 쓴다.** 두 결말은 되돌릴 수 없고 뜻이
 * 달라서, 문구가 뭉치면 사용자가 미달을 인지하지 못한 채 끝낸다(스펙 §3 · R71).
 */
export const productionLotComplete = {
  title: '생산LOT 완료',

  entry: {
    workOrderLabel: '작업지시',
    workerLabel: '사번',
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
    terminalUnknown: '확인되지 않음',
  },

  lotList: {
    sectionLabel: 'LOT 목록',
    lotNoColumn: 'LOT',
    goodQtyColumn: '양품',
    /**
     * 양품 열을 채우지 못하는 사유. **비워 두고 말한다** — 값이 없는 칸을 말없이 두면
     * 「양품이 없다」로 읽힌다.
     */
    goodQtyPending: '목록에서는 양품 수를 표시할 수 없습니다. LOT 을 고르면 오른쪽에 나옵니다.',
    goodQtyPlaceholder: '—',
    select: '선택',
    selected: '선택됨',
    empty: '이 작업지시에 완료할 LOT 이 없습니다.',
    loadFailed: '대상 LOT 을 불러오지 못했습니다.',
    /** 계획 슬롯 수를 상한으로 읽지 않게 한다(§3 · R27). */
    slotNotice: '선발행 슬롯 수는 계획값이며 상한이 아닙니다.',
  },

  detail: {
    sectionLabel: '완료 판정',
    lotLabel: 'LOT',
    targetLabel: '목표 양품',
    goodQtyLabel: '누적 양품',
    achievementLabel: '달성률',
    varianceLabel: '차이',
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
    required: '미달 마감은 사유가 필요합니다.',
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

  /**
   * ⛔ **되돌릴 수 없다는 것을 누르기 «전»에 말한다.** 완료를 되돌리는 화면이 인벤토리에 없다
   * (스펙 §8-5 · `omf-mes#87`) — 끝난 뒤에 알리면 사용자가 할 수 있는 것이 없다.
   */
  warning: {
    irreversible: '완료·미달 마감은 되돌릴 수 없습니다.',
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
