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
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
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
    qty: (qty: string) => `수량 ${qty}`,
    from: (code: string) => `현재 ${code}`,
    recommended: (code: string) => `권장 위치 ${code}`,
    /** 목록에서는 위치 코드를 아직 받지 못했다. 있고 없고만 말한다. */
    hasRule: '권장 위치 있음',
    /** 권장이 없는 것과 확인하지 못한 것은 다르다. 앞엣것만 이렇게 적는다. */
    noRule: '권장 위치 없음',
    /** 값 목록이 확정되기 전이라 코드를 그대로 보인다. */
    level: (code: string) => `위치 관리 ${code}`,
    change: '다른 지시 고르기',
  },
  location: {
    legend: '적치 위치',
    scanLabel: '위치 코드 스캔',
    scanPlaceholder: '위치 라벨을 비추세요',
    pickLabel: '목록에서 고르기',
    pickPlaceholder: '위치를 고르세요',
    loading: '위치를 불러오는 중입니다',
    loadFailed: '위치를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '이 창고에 등록된 위치가 없습니다',
    notFound: (code: string) => `${code} 위치를 이 창고에서 찾지 못했습니다`,
    chosen: (code: string, name: string) => `${code} ${name}`,
  },
  verdict: {
    matched: '권장 위치와 같습니다',
    /** 다른 곳에 두면 다음 사람이 찾지 못한다. 임시로 두어야 하면 다른 화면이 받는다. */
    notRecommended: (code: string) => `권장 위치 ${code} 가 아닙니다`,
    temporary: '임시로 두어야 하면 임시 위치 적재로 갑니다',
    noRule: '관리 위치가 없는 품목입니다. 여기 적치합니까?',
    noRuleConfirm: '여기 적치합니다',
  },
  /** 지금 무엇이 들어 있는지는 이 화면이 알지 못한다. 위반이라고 말하지 않는다. */
  singleItemOnly: '이 위치는 단일 품목만 보관합니다. 다른 품목이 있으면 서버가 막습니다.',
  capacity: (qty: string) => `수용량 ${qty}`,
  submit: '적치 완료',
  sent: {
    title: '적치를 기록했습니다',
  },
  queued: {
    title: '적치를 담아 두었습니다',
    description: '연결되면 보냅니다. 아직 서버에 없습니다.',
  },
  rejected: {
    title: '적치가 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  noWorker: '사번을 확인한 뒤에 기록할 수 있습니다',
  another: '다음 적치',
} as const;
