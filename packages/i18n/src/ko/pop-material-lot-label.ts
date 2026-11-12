export const popMaterialLotLabel = {
  /**
   * 화면 이름 — 005 부터 「자재 관리 LOT 라벨」(omf-all-around#254 · screens/P-01-01.md).
   * ⚠ 화면 목록(`patterns/pop-screen-catalog.ts`)의 이름과 같아야 한다 — 고치면 함께 고친다.
   */
  title: '자재 관리 LOT 라벨',
  /**
   * 왼쪽 위 두 보기. 공급사·품목은 대기 자재 관리 LOT 을 만들고 라벨을 처음 찍는 곳, 다시 인쇄는 이미 찍은 라벨.
   * ⛔ 「입하 LOT」 탭 · 「라벨 대기 입하 줄」은 없다(FR-036 · D-19·D-25).
   */
  tabs: {
    label: '보기',
    pairs: '공급사·품목', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    reprint: '다시 인쇄',
  },
  /** 찾기 칸 — 다시 인쇄에서는 스캐너 입력도 받는다(Enter = 그 LOT 고르기). */
  search: {
    label: '찾기',
    pairsPlaceholder: '공급사 또는 품목(코드·이름)', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    reprintPlaceholder: '자재 관리 LOT 번호 스캔 또는 품목코드',
    clear: '지우기',
  },
  /** 왼쪽 공급사·품목 목록. 칩은 대기 자재 관리 LOT 수다. */
  pairs: {
    label: '공급사·품목', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    waiting: (count: number) => `대기 ${count}`,
    unprinted: (count: number) => `라벨 미출력 ${count}`,
    /** 기본 정보 줄 뒤에 라벨 미출력 수(시안 「· 라벨 미출력 N」). */
    withUnprinted: (line: string, count: number) => `${line} · 라벨 미출력 ${count}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    /** 기본 정보 한 줄 — 패키징이 있으면 「기본 봉지 10 × 100 = 1,000 EA」. */
    defaultPackaged: (text: string) => `기본 ${text}`,
    defaultUnpackaged: (text: string) => `기본 ${text} · 패키징 없음`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    noDefault: '기본 정보 없음',
    hint: '기본 정보는 관리웹 「공급사·품목 기본 정보」에서 정합니다. 입하 LOT는 여기서 만들지 않습니다 — PDA 입하 스캔 때 저절로 생깁니다.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    empty: '공급사·품목이 없습니다. 관리웹 「공급사·품목 기본 정보」에 먼저 등록하세요.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    noMatch: '찾는 공급사·품목이 없습니다.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
  },
  /** 다시 인쇄 보기의 왼쪽 안내. */
  reprintInfo:
    '최근 2주 안에 라벨을 출력한 자재 관리 LOT입니다. 다시 인쇄하면 출력 차수가 오르고 사유가 남습니다. 폐기된 LOT는 라벨을 찍지 않습니다.',
  /** 오른쪽 작업 칸. */
  work: {
    meta: (supplier: string, supplierCode: string, uomCode: string, defaults: string) =>
      `${supplier} ${supplierCode} · 기본 단위 ${uomCode} · ${defaults}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    create: '자재 관리 LOT 만들기',
    info: '자재 관리 LOT는 공급사·품목으로 미리 만들고 라벨을 붙여 둡니다. 물건이 오면 PDA 입하(M-01-01)에서 스캔만 하면 같은 공급사·품목의 「입하 중」 입하 LOT에 들어가거나 새 입하 LOT가 저절로 생깁니다. 대기 LOT는 재고가 없어 출고·투입 스캔에서 거부됩니다.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    waitingTitle: '대기 자재 관리 LOT',
    waitingSub: (itemCode: string, supplier: string) =>
      `${itemCode} · ${supplier} — 아직 입하되지 않음`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    waitingEmpty:
      '대기 중인 자재 관리 LOT가 없습니다. 「자재 관리 LOT 만들기」로 만드세요. 패키징·수량은 기본 정보로 채워집니다.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    receivedTitle: (count: number) => `최근 입하된 자재 관리 LOT ${count}개`,
    receivedSub: '라벨만 다시 찍을 수 있습니다(「다시 인쇄」 탭)',
    pickPair: '왼쪽에서 공급사·품목을 고르세요.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    reprintTitle: '다시 인쇄',
    reprintCount: (count: number) => `출력한 자재 관리 LOT ${count}개`,
    reprintEmpty: '최근 2주 안에 출력한 라벨이 없습니다.',
    /** 결과 표 머리 오른쪽 — 몇 장이 나왔고 몇 장이 안 나왔는가. */
    resultSummary: (printed: number, unfinished: number) =>
      unfinished === 0 ? `${printed}장 인쇄` : `${printed}장 인쇄, ${unfinished}장 남음`,
    /**
     * 20초마다 스스로 다시 받지만, 기다리지 않고 바로 볼 수단으로 남긴다(omf-all-around#29).
     * 관리웹(W-01-14)에서 만든 LOT · PDA 가 입하한 LOT 이 바로 서야 한다.
     */
    refresh: '새로 고침',
    refreshedAt: (time: string) => `${time} 받음`,
    loadFailed: '자재 관리 LOT 목록을 불러오지 못했습니다.',
    retry: '다시 불러오기',
    /** 단말의 공장을 아직 모른다(등록 전) — 목록을 부르지 않는다. */
    noPlant: '단말의 공장을 확인하는 중입니다.',
  },
  table: {
    columns: {
      check: '선택',
      lotNo: '자재 관리 LOT 번호',
      item: '품목',
      qty: '재고 수량',
      package: '패키징',
      supplierLot: '공급사 LOT',
      status: '상태',
      label: '라벨',
      printed: '출력',
      result: '결과',
    },
    /** 최근 입하된 LOT 번호 아래 줄. */
    inboundLot: (no: string) => `입하 LOT ${no}`,
    none: '—',
    unprinted: '미출력',
    /** 라벨 칸 — 마지막 회차와 시각. */
    issuedAt: (seq: number, when: string) => `${seq}회 ${when}`,
    /** 줄 전체가 체크 칸이다 — 읽어 주는 도구가 줄을 가를 수 있게 번호·수량을 이름에 싣는다. */
    rowName: (lotNo: string, qty: string) => `${lotNo} ${qty}`,
  },
  /** 상태 칩 — 생애 축(대기·폐기·입하됨)과 입하됨의 품질 상태. */
  lotState: {
    waiting: '대기',
    voided: '폐기',
    received: (quality: string) => `입하됨 · ${quality}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    quality: {
      NORMAL: '정상',
      INSPECTION_PENDING: '검사 대기',
      DEFECTIVE: '불량',
      SCRAPPED: '폐기',
    } as Record<string, string | undefined>,
  },
  /** 줄마다 제자리에 붙는 결과. 길게 쓰지 않는다 — 다음 할 일은 아래 동작 바가 말한다. */
  status: {
    printed: '인쇄됨',
    running: '보내는 중',
    waiting: '대기',
    notSelected: '선택 안 함',
    stopped: '멈춤',
    /** 보내기 직전에 다시 보니 다른 단말이 먼저 찍었다 — 실패가 아니다. */
    alreadyIssued: '이미 발행됨',
    /** 종이는 나왔고 IQC 라벨만 안 나왔다 — 「실패」로 읽히면 자재 라벨을 한 장 더 찍는다. */
    iqcMissing: '인쇄됨, IQC 라벨 안 나옴',
    failed: {
      printFailed: '인쇄 안 됨',
      reportFailedAfterPrint: '인쇄됨, 기록 안 됨',
      issueForbidden: '이 단말은 발행 불가',
      labelStateLocked: '발행할 수 없는 LOT',
      other: '발행 안 됨',
    },
  },
  /** 하단 동작 바 — 왼쪽은 지금 상태 한 줄, 오른쪽은 주 동작. */
  bar: {
    empty: '라벨을 찍거나 폐기할 대기 자재 관리 LOT를 고르세요',
    selected: (count: number, unprinted: number) => `${count}개 선택 · 라벨 미출력 ${unprinted}개`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    /** 이미 출력한 LOT 을 골랐다 — 첫 발행은 미출력만 찍는다. */
    printedNote: (count: number) =>
      `이미 출력한 ${count}장은 「다시 인쇄」에서 사유를 골라 찍으세요`,
    selectAllWaiting: '대기 전체 선택',
    voidIdle: '폐기',
    void: (count: number) => `대기 ${count}개 폐기`,
    clear: '선택 해제',
    issue: (count: number) => `라벨 ${count}장 발행`,
    issueIdle: '라벨 발행',
    running: (supplier: string) => `${supplier} 발행 중`,
    progress: (done: number, total: number) => `${total}장 중 ${done}장`,
    stop: '멈춤',
    stopping: '이번 장까지 찍고 멈춥니다',
    done: (count: number) => `${count}장 인쇄했습니다 — 상자에 붙여 두세요`,
    reprinted: (count: number) => `${count}장 다시 인쇄했습니다 — 출력 차수가 올랐습니다`,
    confirm: '확인',
    failed: (count: number) => `${count}장이 나오지 않았습니다`,
    stopped: (count: number) => `${count}장이 남았습니다`,
    retry: (count: number) => `${count}장 다시 발행`,
    /**
     * 발행 단위 — N장마다 멈추고 이어서(사용자 지시 2026-10-27). 「전체」는 멈추지 않는다.
     * 작업자가 N장을 붙이고 다음 N장을 찍는다 — 라벨이 프린터 앞에 쌓여 섞이지 않게.
     */
    unit: {
      label: '발행 단위',
      all: '전체',
      each: (count: number) => `${count}장`,
      /** 고른 장수가 단위보다 많을 때 왼쪽 상태 줄에 덧붙인다. */
      note: (count: number) => `${count}장마다 멈춤`,
    },
    /** 한 단위를 다 찍고 쉬는 중. */
    paused: (done: number, total: number) => `${total}장 중 ${done}장 발행`,
    pausedNote: (remaining: number) => `라벨을 붙인 뒤 이어서 발행하세요 · 남은 ${remaining}장`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    resume: (count: number) => `다음 ${count}장 발행`,
    /** 실패한 까닭마다 할 일. 다시 눌러도 같은 답이 오는 것은 다시 하라고 하지 않는다. */
    next: {
      printFailed: '프린터 연결과 용지를 확인하세요',
      reportFailedAfterPrint: '라벨은 나왔습니다. 다시 찍지 마세요',
      issueForbidden: '라벨 프린터가 있는 단말에서 발행하세요',
      labelStateLocked: '불량이나 폐기 LOT 은 라벨을 발행하지 않습니다',
      other: '잠시 뒤 다시 발행하세요',
      stopped: '남은 장을 이어서 발행할 수 있습니다',
      /** 받은 사유 목록에 「인쇄 실패」가 없어 화면이 스스로 다시 찍지 못한다(`PRINT_FAILURE_REASON_CODE`). */
      needsReason: '「다시 인쇄」에서 사유를 골라 찍으세요',
    },
  },
  /** 머리줄 오른쪽의 상태 묶음. 다른 POP 화면과 같은 말을 쓴다. */
  device: {
    /** ⭐ 번호가 뒤에 붙는다 — 「단말# 5」(사용자 지시 2026-09-14). */
    terminalLabel: '단말#',
    terminalUnknown: '확인되지 않음',
  },
  printer: {
    label: '프린터',
    /** 머리줄 칩을 누르면 뜨는 창의 제목. */
    choose: '프린터 선택',
    close: '닫기',
    /**
     * 브라우저 실행·옛 설치본 — 셸이 고른 프린터를 받지 못한다(2단계 검증 2026-10-16). 고르는 창을 열지 않는다.
     * ⛔ 고른 것처럼 보이는데 기본 프린터로 나가면 그쪽이 더 나쁘다.
     */
    shellOnly: '설치본에서만 프린터를 고를 수 있습니다.',
    /** 이 단말에 기억해 둔 프린터가 목록에서 사라졌다 — 기본으로 돌아간 것을 말한다. */
    storedMissing: (name: string) =>
      `기억해 둔 프린터 「${name}」를 찾을 수 없어 기본 프린터로 인쇄합니다.`,
    none: '사용할 수 있는 프린터가 없습니다.',
    /** ⛔ 「없다」와 「모른다」를 같은 모양으로 그리지 않는다(공유계약 G-9). */
    unknown: '프린터 상태를 확인할 수 없습니다.',
    retry: '다시 확인',
  },
  /** 다시 인쇄 보기. 2회차부터는 사유가 필수다(서버 규칙). */
  reprint: {
    reasonLabel: '사유',
    reasonPrompt: '사유를 고르세요',
    /** 값 목록이 비면 보낼 수 없다 — 사유 없이 보내면 422 다. */
    reasonsEmpty: '고를 수 있는 재발행 사유가 없습니다. 사유 없이는 다시 인쇄할 수 없습니다.',
    reasonsFailed: '재발행 사유를 불러오지 못했습니다.',
    action: (count: number) => `${count}장 다시 인쇄`,
    actionIdle: '다시 인쇄',
    empty: '다시 찍을 라벨을 고르거나 스캔하세요',
    selected: (count: number) => `${count}장 선택`,
    summary: (reason: string) => `사유 ${reason}`,
    /** 사유 없이 골랐다 — 막대에 말하고 단추를 잠근다. */
    needsReason: '사유를 골라야 다시 인쇄할 수 있습니다',
    /** 스캔한 번호가 최근 2주 출력분에 없다 — 찾는 범위를 말한다. */
    notFound: '최근 2주 안에 출력한 자재 관리 LOT에서 찾지 못했습니다.',
    /** 고른 LOT 이 라벨을 낼 수 없는 상태 — 누르기 «전»에 막고 까닭을 말한다. */
    lotBlocked: (status: string) => `「${status}」 LOT 은 라벨을 다시 찍을 수 없습니다`,
    lotStatus: { DEFECTIVE: '불량', SCRAPPED: '폐기' } as Record<string, string | undefined>,
  },
  /** 자재 관리 LOT 만들기 창(screens/P-01-01.md 「창」 · FR-002·003). */
  batch: {
    title: '자재 관리 LOT 만들기',
    close: '닫기',
    pair: '공급사 · 품목', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    /** 기본값을 어디서 채웠나(US1-1 · US1-3). */
    source: {
      default: '기본 정보에서 가져옴',
      itemStorage: '공급사·품목 기본 정보 없음 — 품목 기본 보관 단위로 채움', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
      none: '기본 정보 없음 — 직접 입력',
    },
    sourceNote: {
      defaultWithoutPackage: '기본 정보가 「패키징 없음」입니다. 필요하면 넣을 수 있습니다.',
      itemStorage: '패키징 없이 만들면 기본 단위 수량만 남습니다(낱개가 섞인 상자 등).',
      none: '이 공급사·품목은 기본 정보도, 품목 기본 보관 단위도 없어 패키징 없이 시작합니다. 필요하면 넣을 수 있습니다.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    },
    loading: '기본 정보를 불러오는 중입니다.',
    defaultsFailed: '기본 정보를 불러오지 못했습니다 — 값을 직접 넣으세요.',
    package: '패키징',
    optional: '(선택)',
    packageOn: '패키징 넣기',
    packageOff: '패키징 없음',
    packageUom: '패키징 단위',
    packageUomPlaceholder: '고르세요',
    packageCount: '패키징 수',
    qtyPerPackage: (uomCode: string) => `패키징당 수량 (${uomCode})`,
    lotQty: '자재 관리 LOT당 재고 수량',
    lotQtyPlaceholder: '자재 관리 LOT 1개의 수량',
    lotQtyHelpPackaged: (uomCode: string) =>
      `「패키징 수 × 패키징당 수량」으로 채워집니다. 직접 고치면 곱과 같아야 합니다. 단위는 ${uomCode} 고정.`,
    lotQtyHelp: (uomCode: string) =>
      `단위는 품목 기본 단위(${uomCode})로 정해져 있고 고르지 않습니다.`,
    unitLocked: '품목 기본 단위로 고정',
    supplierLot: '공급사 LOT 번호',
    supplierLotPlaceholder: '예: SL-77',
    supplierLotHelp: '만드는 자재 관리 LOT 모두에 같은 값이 들어갑니다.',
    lotCount: '개수',
    lotCountUnit: '개',
    lotCountHelp: '한 번에 1~200개까지 만듭니다.',
    errors: {
      packageCount: '패키징 수는 1 이상 정수입니다',
      qtyPerPackage: '패키징당 수량은 0보다 커야 합니다',
      packageUom: '패키징 단위를 고르세요',
      lotQty: '재고 수량을 넣으세요(0보다 큰 수)',
      integer: (uomCode: string) => `${uomCode}는 정수로 넣습니다`,
      lotCount: '개수는 1~200 사이 정수입니다',
      mismatch: (qty: string, product: string) =>
        `재고 수량 ${qty} ≠ ${product} — 맞춰야 만들 수 있습니다`,
    },
    summary: (count: number, each: string, total: string) =>
      `자재 관리 LOT ${count}개 · 각 ${each} · 합계 ${total}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    summarySupplierLot: (no: string) => ` · 공급사 LOT ${no}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    summaryNote: (pattern: string) =>
      `번호 예: ${pattern} … · 대기 상태로 만들어지며 재고는 늘지 않습니다. 입하 LOT는 PDA 스캔 때 정해집니다.`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    summaryEmpty: '개수를 넣으면 만들어질 자재 관리 LOT가 여기 보입니다.',
    cancel: '취소',
    submit: (count: number) => `${count}개 만들기`,
    submitIdle: '만들기',
    created: (count: number) =>
      `자재 관리 LOT ${count}개를 대기 상태로 만들었습니다 — 고른 채로 두었으니 라벨을 발행하세요`,
    failed: '자재 관리 LOT를 만들지 못했습니다.',
  },
  /** 대기 LOT 폐기 확인(US1-7 · FR-005). */
  voidDialog: {
    title: (count: number) => `대기 자재 관리 LOT ${count}개를 폐기할까요?`,
    body: '폐기하면 PDA 입하 스캔에서 거부되고, 번호는 다시 매기지 않습니다.',
    printed: (count: number) => `라벨을 이미 출력한 ${count}개는 라벨을 떼어 버리세요.`,
    cancel: '취소',
    confirm: (count: number) => `${count}개 폐기`,
    done: (count: number) => `자재 관리 LOT ${count}개를 폐기했습니다`,
    partial: (count: number, failed: number) => `자재 관리 LOT ${count}개 폐기 · 실패 ${failed}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    failed: '폐기하지 못했습니다.',
  },
  /** 라벨 미리 보기(발행 · 다시 인쇄). */
  preview: {
    title: '라벨 발행 미리 보기',
    reprintTitle: '다시 인쇄 미리 보기',
    note: 'QR에는 자재 관리 LOT 번호만 실립니다. 라벨에는 품목·재고 수량·단위·패키징(있으면)·공급사가 보입니다.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    reprintNote: (reason: string) => ` 사유 「${reason}」, 출력 차수가 하나 오릅니다.`,
    kind: '자재 관리 LOT',
    item: '품목',
    qty: '수량',
    package: '패키징',
    supplier: '공급사',
    reissue: (seq: number) => `재발행 ${seq}회`,
    prev: '◀ 이전',
    next: '다음 ▶',
    page: (index: number, total: number) => `${index} / ${total}장`,
    printer: (name: string) => `프린터 ${name}`,
    printerDefault: '프린터 기본값',
    cancel: '취소',
    close: '닫기',
    print: (count: number) => `${count}장 인쇄`,
    reprint: (count: number) => `${count}장 다시 인쇄`,
  },
} as const;
