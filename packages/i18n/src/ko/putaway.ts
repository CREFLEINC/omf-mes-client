/**
 * M-01-05 적치·입고 완료 — 받아 둔 자재를 제자리에 두고 그 사실을 남긴다.
 *
 * 지시가 둬도 되는 위치(품목을 보관 품목으로 걸어 둔 위치)를 싣는다. 있으면 그 중 아무 데나 받고,
 * 다른 곳에 두면 다음 사람이 찾지 못한다. 비면 이 창고 어디든 두되 어디에 두었는지는 반드시 남긴다.
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
    /*
     * 라벨과 눈으로 대조할 값이다. 지시 번호만으로는 무엇을 집는지 알 수 없다. 계약이 목록
     * 줄에 LOT 번호를 싣지 않아 지시 번호를 함께 둔다.
     *
     * 세 값에 각각 이름을 붙인다. 값만 늘어놓으면 어느 것이 품목이고 어느 것이 지시 번호인지
     * 형식을 아는 사람만 읽는다.
     */
    itemLabel: '품목',
    /** 작업 카드에서 코드 옆에 서는 품목 이름의 이름(낭독기용). */
    itemNameLabel: '품목명',
    taskNoLabel: '지시 번호',
    qtyLabel: '수량',
    /** 둬도 되는 위치. 서버는 품목의 보관 위치(위치 「보관 품목」)로 계산한다. */
    allowedLabel: '보관 위치',
    /** 작업 카드의 가야 할 곳. */
    allowed: (codes: string) => `보관 위치 ${codes}`,
    /** 둘 곳이 여럿이면 카드에는 첫 코드와 나머지 수만. */
    allowedMore: (first: string, rest: string) => `${first} 외 ${rest}곳`,
    /** 「자세히」 — 둘 곳 전부. 이 중 아무 데나 둔다. */
    allowedAll: (codes: string) => `보관 위치(아무 데나) ${codes}`,
    /** 보관 위치를 정하지 않은 품목. */
    anywhere: '창고 내 아무 위치',
    change: '다른 지시 고르기',
  },
  location: {
    legend: '적치 위치',
    scanLabel: '위치 코드 스캔',
    scanPlaceholder: '위치 라벨을 스캔하세요',
    /** 「창고 전체」에는 스캔할 라벨이 없어 목록에서 고른다. */
    pickLabel: '적치 위치',
    pickPlaceholder: '위치를 고르세요',
    loading: '위치를 불러오는 중입니다',
    loadFailed: '위치를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '이 창고에 등록된 위치가 없습니다',
    notFound: (code: string) => `${code} 위치를 이 창고에서 찾지 못했습니다`,
    manual: '직접 입력',
    manualSubmit: '입력한 위치로',
    /** 스캔으로 정한 위치를 되돌리고 스캔 칸을 다시 연다. */
    rescan: '위치 재스캔',
    /** 판정 배너 제목 — 읽은 위치(주 정보). 판정은 본문이 보조로 말한다. */
    scanned: (code: string, name: string) => `${code} · ${name}`,
  },
  lot: {
    legend: '자재 LOT 스캔',
    scanLabel: 'LOT 라벨 스캔',
    scanPlaceholder: '자재 라벨을 스캔하세요',
    manual: '직접 입력',
    manualSubmit: '입력한 LOT 으로',
    loading: 'LOT 번호를 불러오는 중입니다',
    loadFailed: 'LOT 번호를 확인할 수 없습니다. 연결을 확인하세요.',
    expected: (lotNo: string) => `지시 LOT ${lotNo}`,
    /** 판정(보조 정보) — 배너 제목의 읽은 LOT 아래에 선다. */
    matched: '지시 LOT 과 일치합니다',
    /** 다른 자재를 얹으면 그 뒤로 재고가 있다는 자리에 없다. 읽은 값은 배너 제목이 말한다. */
    mismatch: '이 지시의 LOT 이 아닙니다',
    /** 맞춘 LOT 을 되돌리고 스캔 칸을 다시 연다. */
    rescan: 'LOT 재스캔',
  },
  verdict: {
    /** 판정(보조 정보) — 제목의 위치 아래에 선다. */
    matched: '이 품목의 보관 위치입니다',
    temporary: '임시로 두어야 하면 임시 위치 적재로 갑니다',
    /** 임시로 두는 화면으로 가는 버튼 — 안내 문구와 갈라 둔다. */
    temporaryMove: '임시 위치 적재로 이동',
    /** 둘 곳 밖. 보관 위치는 위치 관리의 「보관 품목」에서 정한다. */
    notAllowed: (allowed: string) => `이 품목의 보관 위치(${allowed})가 아닙니다`,
    /** 보관 위치를 정하지 않은 품목 — 막지 않는다. */
    anywhere: '보관 위치를 정하지 않은 품목입니다. 이 창고 어디든 둘 수 있습니다',
  },
  /** 건별로 저장하고 마지막에 한 번 마친다. 연속 작업이라 매 건 화면을 끝내면 손이 더 간다. */
  record1: '이 지시 적치',
  /**
   * 「이 지시 적치」가 잠긴 이유(공유계약 G-1). 위에서부터 처음 비어 있는 것 하나만 말한다 -
   * 위치가 통과해야 LOT 을 묻는 순서와 같다.
   */
  locked: {
    location: '위치 라벨을 스캔하면 진행합니다',
    lot: '자재 LOT 라벨을 스캔하면 진행합니다',
  },
  done: {
    count: (count: string) => `적치됨 ${count}건`,
    row: (lotNo: string, code: string, qty: string) => `${lotNo} → ${code} ${qty}`,
    /** 담기지 않은 건이 없어야 마친다. */
    submit: '적치 완료',
    /** 마칠 것이 없을 때. 한 건이라도 적치해야 마친다. */
    locked: '지시를 하나 이상 적치하면 마칠 수 있습니다',
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
