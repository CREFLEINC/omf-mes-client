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
    /** 라벨 발행 화면 공통 탭 이름(#295 시안 — 분할 LOT 라벨 · 재구성 신규 라벨과 같다). */
    pairs: '발행 대기',
    reprint: '재발행',
  },
  /** 찾기 칸 — 다시 인쇄에서는 스캐너 입력도 받는다(Enter = 그 LOT 고르기). */
  search: {
    label: '찾기',
    /** 발행 대기 찾기 칸 위 이름 — 칸을 누르면 뜨는 창 안 칸 안내도 같은 글. */
    pairsLabel: '공급사 또는 품목의 코드나 이름', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    /** 재발행 탭의 스캔 칸 — 번호가 맞으면 그 LOT 을 고르고, 적는 동안은 번호·품목코드로 거른다. */
    scanLabel: '자재 관리 LOT 번호 또는 품목의 코드나 이름',
  },
  /** 왼쪽 공급사·품목 목록. 칩은 대기 자재 관리 LOT 수다. */
  pairs: {
    label: '공급사·품목', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    /** 기본 정보 줄 뒤에 라벨 미출력 수(시안 「· 라벨 미출력 N」). */
    withUnprinted: (line: string, count: number) => `${line} · 라벨 미출력 ${count}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    /** 기본 정보 한 줄 — 패키징이 있으면 「기본 봉지 10 × 100 = 1,000 EA」. */
    defaultPackaged: (text: string) => `기본 ${text}`,
    defaultUnpackaged: (text: string) => `기본 ${text} · 포장 없음`,
    noDefault: '기본 정보 없음',
    empty: '공급사·품목이 없습니다. 관리웹 「공급사·품목 기본 정보」에 먼저 등록하세요.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    noMatch: '찾는 공급사·품목이 없습니다.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
  },
  /** 재발행 탭 왼쪽 안내. */
  /** 오른쪽 작업 칸. */
  work: {
    meta: (supplier: string, supplierCode: string, uomCode: string, defaults: string) =>
      `${supplier} ${supplierCode} · 기본 단위 ${uomCode} · ${defaults}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    create: '자재 관리 LOT 생성',
    /** 상시 할 일 한 줄 — 입하 대기 LOT 을 고르면 출고·투입 제한을 말한다(#295 시안). */
    help: '자재 관리 LOT 안내',
    /** 제목 줄 [도움말] 창(사용자 지정 문구 2026-11-19). */
    helpIntro: '자재 입고 전에 LOT를 미리 생성하고 라벨을 출력할 수 있습니다.',
    helpItems: [
      {
        term: '입고 처리:',
        text: 'PDA에서 라벨을 스캔하면 기존 입하 LOT에 연결되거나 새 LOT가 생성됩니다.',
      },
      { term: '사용 제한:', text: '입고 전 LOT는 출고 및 생산 투입이 불가능합니다.' },
      { term: '라벨 재출력:', text: '재출력 횟수와 사유가 기록됩니다.' },
    ],
    waitingTitle: '입하 대기 자재 관리 LOT',
    waitingEmpty: '입하 대기 중인 자재 관리 LOT가 없습니다.',
    waitingEmptyHint: '「자재 관리 LOT 생성」으로 생성하세요.',
    /** 제목 줄 칩 — 최근 입하된 LOT 은 표 맨 뒤에 흐리게, 라벨은 재발행 탭에서. */
    receivedChip: (count: number) => `입하 ${count} · 재발행 탭`,
    pickPair: '왼쪽에서 공급사·품목을 고르세요.', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    reprintTitle: '재발행',
    reprintEmpty: '최근 2주 안에 출력한 라벨이 없습니다.',
    /** 결과 표 머리 오른쪽 — 몇 장이 나왔고 몇 장이 안 나왔는가. */
    resultSummary: (printed: number, unfinished: number) =>
      unfinished === 0 ? `${printed}장 인쇄` : `${printed}장 인쇄, ${unfinished}장 남음`,
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
      qty: '재고량',
      package: '포장',
      status: 'LOT 상태',
      label: '출력 유무',
      printed: '출력 횟수',
      supplierLot: '공급사 LOT 번호',
      lastPrinted: '최근 출력일시',
      /** 발행 대기 표의 등록 일시 칸 — 목록 정렬 기준(사용자 지시 2026-11-19). */
      createdAt: '등록일시',
      result: '출력 결과',
    },
    none: '—',
    noPackage: '포장 없음',
    unprinted: '미출력',
    /** 라벨 칸 — 마지막 회차와 시각. */
    issuedAt: (seq: number, when: string) => `${seq}회 ${when}`,
    /** 재발행 표 「출력」 칸 — 마지막 회차. */
    issuedSeq: (seq: number) => `${seq}회`,
    /** 줄 전체가 체크 칸이다 — 읽어 주는 도구가 줄을 가를 수 있게 번호·수량을 이름에 싣는다. */
    rowName: (lotNo: string, qty: string) => `${lotNo} ${qty}`,
  },
  /** 상태 칩 — 생애 축(대기·폐기·입하됨)과 입하됨의 품질 상태. */
  lotState: {
    waiting: '입하 대기',
    voided: '폐기',
    received: (quality: string) => `입하 ${quality}`,
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
    failed: {
      printFailed: '인쇄 안 됨',
      reportFailedAfterPrint: '인쇄됨, 기록 안 됨',
      issueForbidden: '이 단말은 발행 불가',
      labelStateLocked: '발행할 수 없는 LOT',
      other: '발행 안 됨',
    },
  },
  /** 아래 작업 줄은 버튼만 — 진행 · 결과는 구획 안 안내 줄과 알림으로 말한다(#295). */
  bar: {
    label: '작업',
    /** 이미 출력한 LOT 을 골랐다 — 첫 발행은 미출력만 찍는다. */
    printedNote: (count: number) =>
      `이미 출력한 ${count}장은 「재발행」 탭에서 사유를 선택해 재인쇄하세요`,
    selectAllWaiting: (count: number) => `입하 대기 전체 선택 (${count}건)`,
    selectAllReprint: (count: number) => `전체 선택 (${count}건)`,
    voidIdle: '폐기',
    void: (count: number) => `입하 대기 ${count}개 폐기`,
    clear: '선택 해제',
    issue: (count: number) => `라벨 ${count}장 발행`,
    /** 발행 단위보다 많이 골랐다 — N장마다 멈춘다는 것을 단추가 함께 말한다(#295 · 사용자 지시 2026-11-19). */
    issueEach: (count: number, unit: number) => `라벨 ${count}장 발행 (${unit}장씩)`,
    unitNote: (unit: number) =>
      `${unit}장마다 멈춥니다. 라벨을 붙인 뒤 [다음 ${unit}장 발행]으로 이어 가세요`,
    issueIdle: '라벨 발행',
    running: (supplier: string) => `${supplier} 발행 중`,
    progress: (done: number, total: number) => `${total}장 중 ${done}장`,
    stop: '멈춤',
    stopping: '이번 장까지 찍고 멈춥니다',
    done: (count: number) => `라벨 ${count}장을 발행했습니다. 상자에 부착하세요.`,
    reprinted: (count: number) =>
      `라벨 ${count}장을 재인쇄했습니다. 기존 라벨을 제거하고 새 라벨을 부착하세요.`,
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
      needsReason: '「재발행」 탭에서 사유를 선택해 재인쇄하세요',
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
    /** 머리줄 칩의 읽기 이름(「프린터 선택: …」). 창 문구는 `popChrome.printerPicker`. */
    choose: '프린터 선택',
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
  /** 재발행 탭. 2회차부터는 사유가 필수다(서버 규칙). */
  reprint: {
    reasonLabel: '사유',
    /** 값 목록이 비면 보낼 수 없다 — 사유 없이 보내면 422 다. */
    reasonsEmpty: '고를 수 있는 재발행 사유가 없습니다. 사유 없이는 재인쇄할 수 없습니다.',
    reasonsFailed: '재발행 사유를 불러오지 못했습니다.',
    action: (count: number) => `${count}장 재인쇄`,
    actionIdle: '재인쇄',
    /** 스캔한 번호가 최근 2주 출력분에 없다 — 찾는 범위를 말한다. */
    notFound: (code: string) => `「${code}」 — 최근 2주 출력 LOT에 없습니다.`,
    /** 고른 LOT 이 라벨을 낼 수 없는 상태 — 누르기 «전»에 막고 까닭을 말한다. */
    lotBlocked: (status: string) => `「입하 ${status}」 LOT은 재인쇄할 수 없습니다`,
    lotStatus: { DEFECTIVE: '불량', SCRAPPED: '폐기' } as Record<string, string | undefined>,
  },
  /** 자재 관리 LOT 만들기 창(screens/P-01-01.md 「창」 · FR-002·003). */
  batch: {
    title: '자재 관리 LOT 생성',
    close: '닫기',
    supplier: '공급사',
    item: '품목',
    /** 기본값을 어디서 채웠나(US1-1 · US1-3). */
    source: {
      default: '기본 정보에서 가져옴',
      itemStorage: '공급사·품목 기본 정보 없음 — 품목 기본 보관 단위로 채움', // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
      none: '기본 정보 없음 — 직접 입력',
    },
    loading: '기본 정보를 불러오는 중입니다.',
    defaultsFailed: '기본 정보를 불러오지 못했습니다 — 값을 직접 넣으세요.',
    package: '포장',
    optional: '(선택)',
    packageOn: '포장 넣기',
    packageOff: '포장 없음',
    packageUom: '포장 단위',
    packageUomPlaceholder: '고르세요',
    packageCount: '포장 수',
    qtyPerPackage: '포장당 수',
    lotQtyAmount: 'LOT 1개 양',
    qtyPerPackageAmount: '포장당 양',
    lotQty: 'LOT 1개 수',
    unitLocked: '품목 기본 단위로 고정',
    supplierLot: '공급사 LOT 번호',
    lotCount: '개수',
    lotCountUnit: '개',
    errors: {
      lotQtyAmount: 'LOT 1개 양을 넣으세요(0보다 큰 수)',
      qtyPerPackageAmount: '포장당 양은 0보다 커야 합니다',
      mismatchAmount: (qty: string, product: string) =>
        `LOT 1개 양 ${qty} ≠ ${product} — 맞춰야 만들 수 있습니다`,
      packageCount: '포장 수는 1 이상 정수입니다',
      qtyPerPackage: '포장당 수는 0보다 커야 합니다',
      packageUom: '포장 단위를 고르세요',
      lotQty: 'LOT 1개 수를 넣으세요(0보다 큰 수)',
      integer: (uomCode: string) => `${uomCode}는 정수로 넣습니다`,
      lotCount: '개수는 1~200 사이 정수입니다',
      mismatch: (qty: string, product: string) =>
        `LOT 1개 수 ${qty} ≠ ${product} — 맞춰야 만들 수 있습니다`,
    },
    summary: (count: number, each: string, total: string) =>
      `자재 관리 LOT ${count}개 · 각 ${each} · 합계 ${total}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    summarySupplierLot: (no: string) => ` · 공급사 LOT ${no}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    cancel: '취소',
    submit: (count: number) => `${count}개 생성`,
    submitIdle: '생성',
    created: (count: number) =>
      `자재 관리 LOT ${count}개를 입하 대기 상태로 만들었습니다 — 고른 채로 두었으니 라벨을 발행하세요`,
    failed: '자재 관리 LOT를 만들지 못했습니다.',
  },
  /** 대기 LOT 폐기 확인(US1-7 · FR-005). */
  voidDialog: {
    title: '자재 관리 LOT를 폐기하시겠습니까?',
    target: (count: number) => `폐기 대상 · ${count}건`,
    body: '폐기 후에는 해당 LOT로 입하 처리할 수 없으며, 폐기한 LOT 번호는 재사용할 수 없습니다.',
    printed: (count: number) => `라벨을 이미 출력한 ${count}개는 라벨을 떼어 버리세요.`,
    cancel: '취소',
    confirm: '폐기',
    done: (count: number) => `자재 관리 LOT ${count}개를 폐기했습니다`,
    partial: (count: number, failed: number) => `자재 관리 LOT ${count}개 폐기 · 실패 ${failed}`, // ui-check-ignore: C-13 설계 확정 문구·용어 「공급사·품목」(screens/P-01-01.md · mockups/P0101-After)
    failed: '폐기하지 못했습니다.',
  },
  /** 라벨 미리 보기(발행 · 다시 인쇄). */
  preview: {
    title: '라벨 미리보기',
    reprintTitle: '재인쇄 미리 보기',
    kind: '자재 관리 LOT',
    item: '품목',
    qty: '수량',
    package: '포장',
    supplier: '공급사',
    reissue: (seq: number) => `재인쇄 ${seq}회`,
    prev: '◀ 이전',
    next: '다음 ▶',
    page: (index: number, total: number) => `${index} / ${total}장`,
    close: '닫기',
    print: (count: number) => `${count}장 인쇄`,
    reprint: (count: number) => `${count}장 재인쇄`,
  },
} as const;
