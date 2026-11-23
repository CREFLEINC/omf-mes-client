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
    loading: '적치 지시를 불러오는 중입니다',
    loadFailed: '적치 지시를 확인할 수 없습니다. 연결을 확인하세요.',
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
    /** 004 — 지시가 어디서 생겼나. 창고 보충 수령에서 생긴 지시도 같은 목록에 선다(screens/M-putaway.md). */
    originLabel: '원천',
    /** 창고 보충 원천 — 요청번호를 괄호로(가운뎃점 나열 대신, C-13). */
    originWithNo: (origin: string, no: string) => `${origin}(${no})`,
    origin: {
      GOODS_RECEIPT: '구매 입고',
      REPLENISHMENT_RECEIPT: '창고 보충',
    },
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
  /**
   * 목록에서 자재 LOT 라벨을 스캔해 그 지시를 연다(omf-all-around#272). 연 지시는 LOT 이 확인된 채라
   * 위치만 스캔하면 바로 기록한다.
   */
  lotScan: {
    label: '자재 LOT 스캔',
    manual: '직접 입력',
    manualSubmit: '입력한 LOT 으로',
    /** 위치 라벨 같은 다른 라벨이거나, 등록되지 않은 LOT. 목록은 그대로 둔다. */
    notLot: 'LOT 라벨이 아니거나 등록되지 않은 LOT 입니다',
    none: '이 LOT 의 적치 지시가 없습니다',
    noneHint: '지시를 이미 끝냈거나 다른 기기에서 먼저 적치했습니다',
    /** 같은 LOT 을 나눠 입고하면 지시가 여럿이다 - 그 지시만 남기고 고르게 한다. */
    many: (count: string) => `이 LOT 의 적치 지시 ${count}건 — 하나를 고르세요`,
    showAll: '전체 지시 보기',
    /** LOT 으로 연 지시의 LOT 판정 - 목록에서 이미 읽었다. */
    fromList: '목록에서 스캔한 LOT 입니다',
    legend: '자재 LOT',
    /** 단추 없이 기록한다는 것을 단추 자리에서 말한다. */
    auto: '맞는 위치를 스캔하면 바로 기록합니다',
    /** 보관 위치를 정하지 않은 품목은 어느 위치든 받는다 - 알고 정한 위험(2026-11-14). */
    autoAnywhere: '스캔한 위치에 바로 기록합니다. 둘 곳을 확인하고 스캔하세요',
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
    /** 보관 위치 밖을 확인하고 [미지정 위치 적치]를 눌렀다(T054) — 다음은 LOT · 기록. */
    outsideConfirmed: '보관 위치가 아닌 곳에 적치합니다',
    /** 보관 위치를 정하지 않은 품목 — 막지 않는다. */
    anywhere: '보관 위치를 정하지 않은 품목입니다. 이 창고 어디든 둘 수 있습니다',
    /** LOT 으로 연 지시는 위치 스캔이 곧 기록이라, 막힌 것이 기록되지 않았음을 말한다. */
    notRecorded: '기록하지 않았습니다',
  },
  /**
   * 카드로 고른 지시를 기록하는 단추. 기록하는 단추가 「적치 완료」다 - 화면만 닫던 단추는 지웠다
   * (omf-all-around#272).
   */
  record1: '적치 완료',
  /**
   * 「이 지시 적치」가 잠긴 이유(공유계약 G-1). 위에서부터 처음 비어 있는 것 하나만 말한다 -
   * 위치가 통과해야 LOT 을 묻는 순서와 같다.
   */
  locked: {
    location: '위치 라벨을 스캔하면 진행합니다',
    lot: '자재 LOT 라벨을 스캔하면 진행합니다',
  },
  done: {
    row: (lotNo: string, code: string, qty: string) => `${lotNo} → ${code} ${qty}`,
    /** 창고 보충 지시는 적치 대기에 남은 양만큼만 옮긴다(004). */
    movedPartial: (qty: string) => `적치 대기에 남은 ${qty} 만 옮겼습니다(나머지는 먼저 출고됨)`,
    movedNone: '옮길 재고가 없어 지시를 닫았습니다',
  },
  sent: {
    title: '적치를 기록했습니다',
  },
  queued: {
    title: '적치를 전송 대기에 넣었습니다',
    description: '연결되면 보냅니다. 아직 보내지 않았습니다.',
  },
  rejected: {
    count: (count: string) => `전송하지 못한 적치 ${count}건`,
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
  /** 목록 머리 줄 오른쪽 — 지난 적치는 「적치 기록」(M-01-14)에서 본다(피처 011). */
  historyLink: '적치 기록',
  /**
   * 피처 009 — 적치 지시 없는 구매 입고 적치(omf-all-around#294). IQC 판정·입하 마감이 끝난 자재 관리 LOT 을
   * 지시 없이 위치를 스캔해 적치하면 그때 입고된다. 지시(004 보충·배포 전 구매 입고)는 위 문구 그대로다.
   */
  direct: {
    /**
     * 목록 제목과 같은 줄 오른쪽의 적치 대기 LOT 수 — 따로 서던 요약 줄(「적치 대기 LOT N건」)을 걷었다(사용자 지시
     * 2026-11-23). 적치 지시 수는 적지 않는다.
     */
    count: (lots: string) => `${lots}건`,
    lotsLegend: '적치 대기 자재 목록',
    lotsLoading: '적치 대기 LOT 을 불러오는 중입니다',
    lotsLoadFailed: '적치 대기 LOT 을 확인할 수 없습니다. 연결을 확인하세요.',
    tasksLegend: '적치 지시',
    /** 두 목록이 모두 비었을 때. */
    none: '적치할 LOT 과 적치 지시가 없습니다',
    /** 공급사가 없는 이전 흐름 LOT 의 공급사 머리 줄. */
    noInboundLot: '입하 LOT 없음(이전 흐름)',
    /**
     * 적치 대기 표(사용자 지시 2026-11-23) — No · 품목(코드 위 · 이름 아래) · 수량 · 진척. 입하 LOT · 자재 관리 LOT 번호는
     * 적지 않는다. 칸 이름은 낭독기에만(표 머리 줄은 숨긴다).
     */
    columns: { no: 'No', item: '품목', qty: '수량', progress: '적치 진척' },
    /** 진척 — 적치 완료 / 자재 관리 LOT. */
    progress: (done: number, total: number) => `${String(done)}/${String(total)}`,
    progressLabel: (done: number, total: number) =>
      `자재 관리 LOT ${String(total)}개 중 ${String(done)}개 적치 완료`,
    /** 줄의 품목 칸을 누르면 적치(위치 스캔)로 — LOT 이 여럿이면 고르는 시트를 먼저 띄운다. */
    open: (itemCode: string, itemName: string) => `${itemCode} ${itemName} 적치`,
    /**
     * 한 줄(입하 LOT · 품목)에 적치 대기 LOT 이 여럿일 때 — 손에 든 라벨과 같은 LOT 을 고른다. 아무 LOT 이나 열면 손에 든
     * 것과 다른 LOT 이 그 위치에 기록된다.
     */
    pick: {
      title: '적치할 LOT 고르기',
      itemCode: '품목코드',
      itemName: '품목명',
      open: (lotNo: string) => `${lotNo} 적치`,
    },
    defective: '불량',
    normal: '정상',
    lotScanPrompt: '자재 LOT 라벨을 스캔하면 그 LOT 을 엽니다',
    finding: 'LOT 을 확인하는 중입니다',
    findFailed: 'LOT 을 확인할 수 없습니다. 연결을 확인하세요.',
    /** 적치 대기가 아닌 LOT 을 스캔했을 때 — 서버 이유 코드마다(FR-011). */
    reason: {
      RECEIVING: '입하 마감 전',
      INSPECTION: 'IQC 판정 전(보류)',
      ALREADY_PUT_AWAY: '이미 적치됨',
      HAS_TASK: '적치 지시가 있는 LOT 입니다',
      DISPOSED: '처분됨',
      OTHER_PLANT: '다른 공장 LOT',
      NOT_INBOUND: '구매 입하 LOT 이 아닙니다',
    },
    /** 이미 적치된 자리 — 위치 코드 · 창고. */
    putAwayAt: (code: string, warehouse: string) => `${code}, ${warehouse}`,
    /** 적치 방식(공통코드 GOODS_RECEIPT_PUTAWAY_MODE). */
    mode: {
      DESIGNATED: '지정 위치',
      UNDESIGNATED: '미지정 위치',
      TEMPORARY: '임시 적치',
    },
    /** LOT 화면 머리. */
    qtyLabel: '수량',
    inboundLotLabel: '입하 LOT',
    lotLabel: '자재 LOT',
    statusLabel: '판정',
    change: '다른 LOT 고르기',
    /** 지정 위치 목록 — 창고별. */
    /**
     * 지정 위치 나무(사용자 지시 2026-11-23) — 창고 › 구역 › 랙 › 위치. 「지정 위치 — 공장 안 모든 창고」 머리 글은
     * 걷었다. 품목의 지정 위치가 없으면 이 PDA 에 지정된 창고 아래 「지정 위치 없음」.
     */
    /**
     * 품목 유형에 맞지 않는 창고의 위치(사용자 지시 2026-11-23) — 자재는 자재창고, 완제품은 제품창고, 불량은 불량창고.
     * 서버가 받는 위치여도 화면이 기록하지 않는다.
     */
    wrongWarehouse: {
      MATERIAL: '자재는 자재창고에만 둘 수 있습니다',
      PRODUCT: '완제품은 제품창고에만 둘 수 있습니다',
      other: '이 LOT 을 둘 수 없는 창고입니다',
    },
    /** 적치 위치 나무 위 제목 — 나무의 이름표(aria-label)도 같은 말(사용자 지시 2026-11-23). */
    designatedLabel: '적치 위치 후보 목록',
    designatedAnywhere: '지정 위치 없음',
    /** 지정 위치도 없고 이 PDA 창고 줄도 보이지 않을 때(창고 없는 단말 · 불량 LOT) — 표 줄과 같은 말. */
    designatedNone: '지정 위치 없음',
    wholeWarehouse: '창고 전체 — 위치를 나누지 않은 창고',
    checking: '위치를 확인하는 중입니다',
    checkFailed: '위치를 확인할 수 없습니다. 연결을 확인하세요.',
    /** 판정 문구 — 판정 코드로 꺼낸다(베트남어 때문에 서버 메시지를 그대로 쓰지 않는다). */
    verdict: {
      DESIGNATED: '지정 위치입니다',
      UNDESIGNATED: '지정된 위치가 아닙니다. 정말 적치합니까?',
      NOT_FOUND: '찾을 수 없는 위치',
      INACTIVE: '찾을 수 없는 위치',
      OTHER_PLANT: '다른 공장 위치',
      STAGING: '적치 대기 위치에는 둘 수 없습니다',
      NOT_LEAF: '구역이나 랙이 아니라 맨 아래 위치를 스캔하세요',
      DEFECT_LOT_NEEDS_DEFECT_WAREHOUSE: '불량 LOT 은 불량창고에만 둘 수 있습니다',
      NORMAL_LOT_IN_DEFECT_WAREHOUSE: '정상 LOT 은 불량창고에 둘 수 없습니다',
      RESTRICTED_LOCATION: '이 위치는 지정 품목만 받습니다',
    },
    /** 미지정 위치 확인 — 적치하면 보관 품목에 더해진다(FR-017a). */
    addsDesignation: (itemCode: string) =>
      `적치하면 이 위치의 보관 품목에 ${itemCode} 가 더해집니다`,
    notYetRecorded: '아직 기록하지 않았습니다.',
    notRecorded: '기록하지 않았습니다',
    rescan: '다시 스캔',
    confirmUndesignated: '미지정 위치 적치',
    /** 단추 없이 기록한다는 것을 단추 자리에서 말한다. */
    auto: '지정 위치를 스캔하면 바로 기록합니다',
    /** 방금 기록한 것 — LOT → 위치 수량. */
    row: (lotNo: string, code: string, qty: string) => `${lotNo} → ${code} ${qty}`,
    receipt: (receiptNo: string, warehouse: string) => `입고 ${receiptNo}, ${warehouse}`,
    /** 전송 실패한 기록 — 서버가 거절한 적치(US2-9 · FR-030). */
    rejectedHint: 'LOT 은 적치 대기 목록에 그대로 있습니다. 다른 위치에 다시 적치하세요.',
  },
} as const;
