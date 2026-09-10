/**
 * M-01-05 적치·입고 완료 — 받아 둔 자재를 제자리에 두고 그 사실을 남긴다.
 *
 * 권장 위치가 있으면 그곳만 받는다. 다른 곳에 두면 다음 사람이 찾지 못한다.
 *
 * 권장이 없는 품목까지 막으면 미등록 품목이 적치 자체를 못 해 현장이 선다. 확인을 받고
 * 통과시키되 어디에 두었는지는 반드시 남긴다.
 */
export const putaway = {
  title: '적치·입고 완료',
  /** 전송 실패한 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '적치 완료',
  worker: {
    loading: '사번을 확인하는 중입니다',
    loadFailed: '사번을 확인할 수 없습니다. 연결을 확인하세요.',
    /** 비우고 물으면 남의 지시까지 온다. 찾지 못하면 목록을 열지 않는다. */
    notFound: (workerNo: string) => `${workerNo} 사번의 작업자를 찾지 못했습니다`,
  },
  tasks: {
    legend: '내 적치 지시',
    loading: '적치 지시를 불러오는 중입니다',
    loadFailed: '적치 지시를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '받은 적치 지시가 없습니다',
    count: (count: string) => `적치 대기 ${count}건`,
    from: (code: string) => `현재 ${code}`,
    recommended: (code: string) => `권장 위치 ${code}`,
    /*
     * 라벨과 눈으로 대조할 값이다. 지시 번호만으로는 무엇을 집는지 알 수 없다. 계약이 목록
     * 줄에 LOT 번호를 싣지 않아 지시 번호를 함께 둔다.
     */
    item: (itemCode: string, taskNo: string, qty: string) => `${itemCode} · ${taskNo} · ${qty}`,
    /** 목록에서는 위치 코드를 아직 받지 못했다. 있고 없고만 말한다. */
    hasRule: '권장 위치 있음',
    /** 권장이 없는 것과 확인하지 못한 것은 다르다. 앞엣것만 이렇게 적는다. */
    noRule: '권장 위치 없음',
    /** 규칙이 왜 이 자리를 냈는지. 사람이 판단하려면 근거가 보여야 한다. */
    rule: (priority: string) => `적치 규칙 우선순위 ${priority}`,
    change: '다른 지시 고르기',
  },
  location: {
    legend: '① 적치 위치',
    scanLabel: '위치 코드 스캔',
    scanPlaceholder: '위치 라벨을 스캔하세요',
    /** 위치를 관리하지 않는 창고에는 스캔할 라벨이 없어 목록에서 고른다. */
    pickLabel: '적치 위치',
    pickPlaceholder: '위치를 고르세요',
    loading: '위치를 불러오는 중입니다',
    loadFailed: '위치를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '이 창고에 등록된 위치가 없습니다',
    notFound: (code: string) => `${code} 위치를 이 창고에서 찾지 못했습니다`,
    chosen: (code: string, name: string) => `${code} ${name}`,
    manual: '직접 입력',
    manualSubmit: '입력한 위치로',
  },
  lot: {
    legend: '② 자재 LOT 스캔',
    scanLabel: 'LOT 라벨 스캔',
    scanPlaceholder: '자재 라벨을 스캔하세요',
    manual: '직접 입력',
    manualSubmit: '입력한 LOT 으로',
    loading: 'LOT 번호를 불러오는 중입니다',
    loadFailed: 'LOT 번호를 확인할 수 없습니다. 연결을 확인하세요.',
    expected: (lotNo: string) => `지시 LOT ${lotNo}`,
    matched: (lotNo: string) => `스캔됨 ${lotNo}`,
    /** 다른 자재를 얹으면 그 뒤로 재고가 있다는 자리에 없다. */
    mismatch: '이 지시의 LOT 이 아닙니다',
  },
  verdict: {
    matched: '권장 위치와 같습니다',
    /** 다른 곳에 두면 다음 사람이 찾지 못한다. 임시로 두어야 하면 다른 화면이 받는다. */
    notRecommended: (code: string) => `권장 위치 ${code} 가 아닙니다`,
    temporary: '임시로 두어야 하면 임시 위치 적재로 갑니다',
    noRule: '관리 위치가 없는 품목입니다. 여기 적치합니까?',
    noRuleConfirm: '여기 적치합니다',
  },
  mix: {
    /** 한 품목만 받는 자리에 얹으면 그 재고는 다음 사람이 찾지 못한다. */
    item: '이 위치는 단일 품목만 보관합니다',
    lot: '이 위치는 단일 LOT 만 보관합니다',
    /** 포화·혼적으로 막히면 임시로 두는 길이 설계에 따로 있다. */
    temporary: '임시로 두어야 하면 임시 위치 적재로 갑니다',
  },
  /** 막지 않는다. 넘겨서 두는 판단은 자리를 보는 사람이 한다. */
  overCapacity: (capacity: string, held: string, adding: string) =>
    `수용량 ${capacity} · 현재 ${held} + ${adding}`,
  /** 막지 않는다. 냉장 자리가 없어 상온에 두어야 하는 날이 있다. */
  storageMismatch: (itemCondition: string, locationCondition: string) =>
    `품목은 ${itemCondition} 보관인데 이 자리는 ${locationCondition} 입니다`,
  /** 건별로 저장하고 마지막에 한 번 마친다. 연속 작업이라 매 건 화면을 끝내면 손이 더 간다. */
  record1: '이 지시 적치',
  done: {
    count: (count: string) => `적치됨 ${count}건`,
    row: (lotNo: string, code: string, qty: string) => `${lotNo} → ${code} ${qty}`,
    /** 담기지 않은 건이 없어야 마친다. */
    submit: '적치 완료',
  },
  sent: {
    title: '적치를 기록했습니다',
  },
  queued: {
    title: '적치를 전송 대기에 넣었습니다',
    description: '연결되면 보냅니다. 아직 보내지 않았습니다.',
  },
  rejected: {
    title: '적치를 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하세요. ',
    action: '전송 실패한 기록 보기',
  },
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '적치를 저장하지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  noWorker: '사번을 먼저 확인하세요',
} as const;
