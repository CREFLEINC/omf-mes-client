/**
 * W-01-09 입하 예정 조회. **자재창고 도메인의 첫 화면**이고 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **입하 예정 = 아직 다 들어오지 않은 구매발주(P/O) 라인이다**(omf-mes-server#741) — 고객사가 ASN 을
 * 쓰지 않는다. 「ASN」·「입하예정번호」를 사용자 문구에 쓰지 않는다.
 *
 * 입하 상태(미착수·부분 입하·입하 완료)와 지연은 **서버가 준 수량으로 판정한다** — 남은 수량이 있고
 * 납기가 공장 현지 오늘보다 앞서면 「지연」이다.
 *
 * **참조 값(공급사·공장·품목·단위)의 표기가 세 갈래다** — 아직 오지 않음 · 목록에 없음 · 불러오기 실패.
 * 셋을 한 문구로 뭉개면 정상 값이 잠깐 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 */
export const inboundSchedule = {
  /** 화면 막대의 이름 — 사이드바 줄 이름(`nav-tree.ts` 「입고 관리」)과 같다. 탭을 합치며(2026-10-23) 화면 이름이 됐다. */
  title: '입고 관리',
  breadcrumbRoot: '구매 / 자재 관리',
  /** 사이드바 줄 이름(`nav-tree.ts` 「입고 관리」). */
  breadcrumbHub: '입고 관리',
  /** 두 표 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: '끌어서 목록·상세 폭 조절',
  /** 막대 위쪽 끝의 단추 — 발주 목록을 왼쪽으로 완전히 접고 편다(사용자 지시 2026-10-24). */
  listCollapse: '발주 목록 접기',
  listExpand: '발주 목록 펼치기',
  panes: {
    filter: '조회 조건',
    list: '입하 예정 목록',
    orders: '구매발주 목록',
    lines: '발주 라인',
  },
  fields: {
    periodFrom: '납기 시작',
    periodTo: '납기 종료',
    supplier: '공급사',
    plant: '공장',
    item: '품목',
    q: '발주번호 검색',
    openOnly: '미완료만',
    overdueOnly: '납기 지난 것만',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /* 왼쪽 표의 발주번호 단추. 줄마다 글자가 달라도 「고른다」는 뜻을 접근 이름에 담는다. */
    selectOrder: (purchaseOrderNo: string): string => `${purchaseOrderNo} 라인 보기`,
    /** 고른 발주의 「입하 등록」 — 오른쪽에서 등록 창이 열린다. */
    register: '입하 등록',
    /* 발주마다 글자가 같다 — 접근 이름에 발주번호를 넣어 어느 발주인지 밝힌다. */
    registerRow: (purchaseOrderNo: string): string => `${purchaseOrderNo} 입하 등록`,
    /** 라인 아래 LOT 줄 접기·펼치기 — 머리칸의 손잡이는 전부, 줄의 손잡이는 그 줄만. */
    expandAll: 'LOT 모두 펼치기',
    collapseAll: 'LOT 모두 접기',
    expandLine: (lineNo: number): string => `${String(lineNo)}번 줄 LOT 펼치기`,
    collapseLine: (lineNo: number): string => `${String(lineNo)}번 줄 LOT 접기`,
    /** LOT 줄의 다음 할 일 — 서버가 정한 것만 선다(C-17). */
    postReceipt: '입고 처리',
    postReceiptRow: (lotNo: string): string => `${lotNo} 입고 처리`,
    requestIqc: 'IQC 의뢰 요청',
    requestIqcRow: (lotNo: string): string => `${lotNo} IQC 의뢰 요청`,
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    periodInvalid: '납기는 있는 날짜여야 합니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '납기 종료는 시작보다 앞설 수 없습니다.',
  },
  loading: {
    list: '입하 예정 목록을 불러오는 중',
    lines: '발주 라인을 불러오는 중',
  },
  /** 표의 머리글. 열 구성과 폭의 근거는 screens/inbound-schedule/order-table.tsx · line-table.tsx 에 있다. */
  table: {
    receiptStatus: '상태',
    expectedReceiptDate: '납기',
    purchaseOrderNo: '발주번호',
    lineNo: 'No.',
    supplierCode: '공급사 코드',
    supplierName: '공급사명',
    openLines: '미입고 품목',
    itemCode: '품목코드',
    itemName: '품목명',
    orderedQty: '발주 수량',
    receivedQty: '입하 수량',
    remainingQty: '남은 수량',
    uom: '단위',
    orderDate: '발주일',
    storageLocation: '창고',
    /** 왼쪽 표 — 그 발주 LOT 들의 가장 뒤처진 단계. 서버가 묶음 수를 실을 때만 선다. */
    progress: '진행',
  },
  /** 발주 상세(오른쪽) 머리의 이름표. */
  detail: {
    purchaseOrderNo: '발주번호',
    supplierCode: '공급사 코드',
    supplierName: '공급사명',
    expectedReceiptDate: '납기',
    orderDate: '발주일',
  },
  /** 입하 진행(`receiptStatusCode`). 서버가 정한다 — 취소는 라인 ERP 취소 · 헤더 취소 둘 다다. */
  receiptStatus: {
    NOT_STARTED: '미착수',
    PARTIAL: '부분 입하',
    COMPLETED: '입하 완료',
    CANCELLED: '취소',
  },
  /** 빠른 조회 줄 — 공급업체 · 품목/바코드 · 오늘 도착 · 지연(사용자 결정 2026-10-20). 누르거나 고르는 즉시 조회한다. */
  quick: {
    supplier: '공급업체',
    supplierPlaceholder: '공급업체명 또는 ID 입력',
    item: '품목코드',
    itemPlaceholder: '품목코드 입력',
    scanNotFound: (value: string): string => `「${value}」에 맞는 품목이 없습니다.`,
    scanFailed: '품목을 찾지 못했습니다. 잠시 뒤 다시 스캔하세요.',
    today: '오늘 도착',
    overdue: '지연',
    detailOpen: '상세 조건 펼치기',
    detailClose: '상세 조건 접기',
  },
  filters: {
    all: '전체',
    itemPlaceholder: '품목을 고르세요',
    itemClear: '품목 조건 지우기',
    itemPick: '이 품목으로 조회',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    chipSupplier: (value: string): string => `공급사: ${value}`,
    chipPlant: (value: string): string => `공장: ${value}`,
    chipItem: (value: string): string => `품목: ${value}`,
    chipQ: (value: string): string => `발주번호: ${value}`,
    chipRemoveSupplier: '공급사 조건 제거',
    chipRemovePlant: '공장 조건 제거',
    chipRemoveItem: '품목 조건 제거',
    chipRemoveQ: '발주번호 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/inbound-schedule/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 입하 예정이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    /*
     * **조회하지 않은 것을 「없습니다」로 말하지 않는다.** 보낼 수 없는 기간(없는 날짜·뒤집힘)이면
     * 요청 자체가 나가지 않는다. 사유는 조건 줄이 밝히므로 여기서는 어디를 고쳐야 하는지만 가리킨다.
     */
    notQueriedTitle: '아직 조회하지 않았습니다',
    notQueriedDescription: '조건 줄의 안내에 따라 납기를 고친 뒤 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noOrderTitle: '발주를 고르세요',
    noOrderDescription: '왼쪽 목록에서 발주번호를 누르면 라인이 보입니다.',
    noLinesTitle: '이 발주에는 라인이 없습니다',
  },
  values: {
    /** 열린 발주가 납기 안에 있다. */
    onTrack: '정상',
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    /** 남은 수량이 있는데 납기(공장 현지 날짜)가 지났다. 당일은 지연이 아니다. */
    overdue: '지연',
    /** 납기가 없는 발주. 목록 맨 뒤로 간다. */
    noDueDate: '납기 없음',
    /** 남은 라인 / 전체 라인 */
    lineRatio: (open: number, total: number): string => `${String(open)} / ${String(total)}`,
    /** 오른쪽 표 제목 — 고른 발주와 공급사. */
    linesOf: (purchaseOrderNo: string, supplierName: string): string =>
      `${purchaseOrderNo} · ${supplierName}`,
    /** 품목코드로 찾은 라인의 표식(보조기술용). 줄 배경이 함께 바뀐다. */
    matchedLine: '찾은 품목',
    /*
     * 미사용 참조에 붙이는 표식. **선택지에서 빼지 않는다** — 지금은 쓰지 않는 거래처·공장을
     * 참조하는 과거 발주가 있다. 빼면 그 발주들을 조건으로 찾을 방법이 사라진다.
     */
    inactiveSuffix: ' (미사용)',
  },
  /**
   * 초과분 발주 연결(서버 장부 P-115 · 옛 P-100) — 발주보다 많이 받아 P/O 에 넣지 않은 몫을 ERP 가 만든 추가 발주 라인에
   * 연결한다. 서버가 후보를 제안하고 사람이 확정한다. 입하·입고 일을 이 화면으로 모으는 첫 걸음이다(사용자 지시 2026-10-21).
   *
   * **화면 낱말은 업무 낱말이고 서버 낱말과 다르다**(사용자 결정 2026-10-24). 서버 팀과 이야기할 때는 아래 짝으로 옮긴다.
   *
   * | 화면 | 서버(장부 P-115 입하 ↔ P/O 배정) |
   * | --- | --- |
   * | 초과분 · 초과 수량 | 미배정 · `unallocatedQty` |
   * | 연결 · 연결한 발주 | 배정 · `allocations[]` (`POST …/allocations`) |
   * | 미연결 · 연결됨 | 미배정이 남은 줄 · 배정된 몫 |
   * | 연결 해제 | 배정 해제 (`DELETE …/allocations/{id}`) |
   *
   * 「배정」을 화면에 쓰지 않는 까닭: 이 제품에서 「배정」은 이미 **출하할 재고를 잡아 두는 것**이다(PDA 피킹 「배정 · 피킹」 ·
   * 출하 요청 「배정 수량」 · 출하 일정 「요청 / 배정 / 출하」). 입고 쪽에 같은 낱말을 쓰면 뜻이 둘이 된다. 「미배정」은 시스템이
   * 아직 안 한 일을 말할 뿐 현장에서 벌어진 일(발주보다 더 왔다)을 말하지 않는다 — 발주 없는 입하가 없어 미배정은 늘 초과분이다.
   */
  excess: {
    /** 탭 줄 오른쪽의 진입 단추. 미연결 초과분이 있으면 그 수가 붙는다. */
    entry: '초과분 연결',
    entryCount: (count: number): string => `미연결 초과분 ${String(count)}건`,
    title: '초과분 발주 연결',
    steps: {
      label: '진행 단계',
      pick: '초과분 선택',
      line: '발주 라인 선택',
      link: '연결',
    },
    tabs: {
      label: '초과분 구분',
      unlinked: '미연결',
      linked: '연결됨',
    },
    table: {
      receiptNo: '입하번호',
      receiptDate: '입하일',
      supplier: '공급사',
      item: '품목',
      lot: 'LOT',
      excessQty: '초과 수량',
      sourceOrder: '원 발주',
      linkedOrder: '연결 발주',
      linkedAt: '연결일',
    },
    candidates: {
      title: '연결할 발주 라인',
      purchaseOrderNo: '발주번호',
      orderDate: '발주일',
      dueDate: '납기',
      ordered: '발주 수량',
      received: '입하 수량',
      /** 발주 + 초과 허용치 − 입하 수량 */
      room: '연결 가능',
      /** 남은 수량이 초과분과 같다 — 대개 그 초과분 때문에 만든 추가 발주다. */
      exact: '수량 일치',
      /** 상세에서 보던 발주의 라인. */
      current: '선택한 발주',
      emptyTitle: '연결할 발주 라인이 없습니다',
      emptyDescription: 'ERP 에서 추가 발주가 들어오면 여기에 표시됩니다.',
      loading: '발주 라인을 불러오는 중',
    },
    /** 「PO-2026-0012 · 10번 줄」 */
    orderLine: (purchaseOrderNo: string, lineNo: number): string =>
      `${purchaseOrderNo} · ${String(lineNo)}번 줄`,
    /** 줄 선택 단추의 접근 이름 — 보이는 글자(번호)를 담는다. */
    pickExcess: (receiptNo: string, lineNo: number): string =>
      `${receiptNo} ${String(lineNo)}번 줄 초과분 선택`,
    pickLine: (purchaseOrderNo: string, lineNo: number): string =>
      `${purchaseOrderNo} ${String(lineNo)}번 줄 선택`,
    /** 방금 「입하 등록」에서 등록한 전표의 초과분. */
    justRegistered: '방금 등록',
    actions: {
      link: '연결',
      unlink: '연결 해제',
    },
    /** 단추 옆에 늘 보이는 요약. 수량 뒤에 조사를 붙이지 않는다(받침이 단위마다 다르다). */
    confirmLink: (qty: string, order: string): string => `초과분 ${qty} → ${order}`,
    confirmUnlink: (qty: string, order: string): string => `${order}의 초과분 ${qty} 연결 해제`,
    blocked: {
      noExcess: '연결할 초과분을 선택하세요.',
      noLine: '연결할 발주 라인을 선택하세요.',
      noLinked: '연결을 해제할 초과분을 선택하세요.',
    },
    done: {
      linked: (qty: string, order: string): string => `연결했습니다: 초과분 ${qty} → ${order}`,
      unlinked: (qty: string, order: string): string =>
        `연결을 해제했습니다: ${order}의 초과분 ${qty}`,
    },
    empty: {
      unlinkedTitle: '미연결 초과분이 없습니다',
      linkedTitle: '연결된 초과분이 없습니다',
    },
    truncated: (shown: number, total: number): string =>
      `${String(shown)}건까지만 표시합니다 (전체 ${String(total)}건).`,
    loading: '초과분을 불러오는 중',
    /** 상세 표의 열 — 이 발주에 맞는 초과분이 있을 때만 선다. */
    lineColumn: '초과분',
    lineLinkable: (qty: string): string => `${qty} 연결`,
    lineLinkableLabel: (lineNo: number, qty: string): string =>
      `${String(lineNo)}번 줄에 초과분 ${qty} 연결`,
    lineLinked: (qty: string): string => `${qty} 연결됨`,
    lineLinkedLabel: (lineNo: number, qty: string): string =>
      `${String(lineNo)}번 줄에 연결된 초과분 ${qty} 보기`,
  },
  /**
   * 입고 단계 — **서버가 LOT 마다 판정한다**(규범 C-17 · 계약 대기). 이름은 「다음에 할 일」이다: 검사 대기는 품질팀이,
   * 입고 대기는 이 화면이, 적치 대기는 PDA 가 할 차례다. 탭 줄 칩·왼쪽 「진행」 열·LOT 줄 칩이 같은 이름을 쓴다.
   */
  stage: {
    /** 탭 줄 칩 묶음의 접근 이름. */
    label: '입고 단계',
    group: {
      /** 라벨 미부착 입하 — LOT 이 아직 없다. POP 에서 라벨을 발행해야 검사·입고로 간다. */
      LABEL: '라벨 발행 대기',
      INSPECTION: '검사 대기',
      HELD: '보류',
      RECEIPT: '입고 대기',
      PUTAWAY: '적치 대기',
    },
    /** 「검사 대기 4」 — 칩의 글자. */
    groupCount: (label: string, count: number): string => `${label} ${String(count)}`,
    /** 칩을 누르면 그 묶음의 LOT 이 있는 발주만 남는다. 다시 누르면 풀린다. */
    filterOn: (label: string): string => `${label} 발주만 보기`,
    filterOff: (label: string): string => `${label} 조건 해제`,
    /** LOT 줄의 칩. 모르는 코드는 번역하지 않고 그대로 낸다. */
    code: {
      LABEL_PENDING: '라벨 발행 대기',
      INSPECTION_REQUIRED: '검사 의뢰 전',
      INSPECTION_REQUESTED: '검사 대기',
      INSPECTION_IN_PROGRESS: '검사 중',
      INSPECTION_HELD: '보류',
      RECEIPT_READY: '입고 대기',
      PUTAWAY_PENDING: '적치 대기',
      PUTAWAY_TEMPORARY: '임시 적치',
      COMPLETED: '완료',
      CANCELLED: '취소',
    },
    /** 왼쪽 「진행」 칸 — 아직 LOT 이 하나도 없는 발주. */
    beforeReceipt: '입하 전',
    /** 발주 머리의 「진행」 — 묶음마다 「검사 대기 1」을 「·」로 잇는다. */
    summarySeparator: ' · ',
  },
  /**
   * 라인 표에서 바로 입하 등록(사용자 지시 2026-10-24 · PDA 「라벨 미부착 일괄 입하」와 같은 길). 체크한 품목은 남은 수량
   * 그대로 한꺼번에, 행을 누르면 그 품목만 수량을 정해 받는다. 라벨 미부착으로만 받고, 입하번호는 품목마다 하나다.
   */
  receive: {
    selectAll: '모두 선택',
    selectRow: (lineNo: number): string => `${String(lineNo)}번 줄 선택`,
    /** 「모두 선택」이 뺀 부분 입하 품목. 하나씩 체크하면 넣을 수 있다. */
    partialSkipped: (count: number): string => `부분 입하 ${String(count)}건은 빼고 선택했습니다.`,
    /** 고른 발주 머리의 단추 — 체크한 수는 옆 글자가 말한다. */
    submit: '체크한 품목 입하 등록',
    checkedCount: (count: number): string => `선택 ${String(count)}건`,
    /** 품목코드 칸의 단추 — 그 품목만 수량을 정해 받는다. 행 어디를 눌러도 같다. */
    editRow: (itemCode: string): string => `${itemCode} 입하 수량 입력`,
    qtyLabel: (lineNo: number): string => `${String(lineNo)}번 줄 이번 입하 수량`,
    /** 남은 수량 칸 — 이번 수량이 정량 한도를 넘으면 넘는 몫. */
    excessTag: (qty: string): string => `초과 ${qty}`,
    submitRow: '입하 등록',
    cancelRow: '취소',
    errors: {
      qtyEmpty: '이번 입하 수량을 넣으세요.',
      qtyNotNumber: '이번 입하 수량은 숫자로 넣으세요.',
      qtyNotPositive: '이번 입하 수량은 0보다 커야 합니다.',
    },
    /** 사유 코드를 못 받으면 라벨 미부착으로 보낼 수 없다 — 서버가 사유 없는 미부착 줄을 받지 않는다. */
    noReason: '라벨 미부착 사유 코드를 불러오지 못해 입하를 등록할 수 없습니다.',
    confirm: {
      title: '입하를 등록합니다',
      lead: (count: number): string =>
        count === 1
          ? '1건을 등록합니다.'
          : `${String(count)}건을 등록합니다. 품목마다 입하번호가 따로 만들어집니다.`,
      labelNote:
        '라벨 미부착으로 등록합니다. 라벨은 POP 「자재LOT 등록·라벨 발행」에서 발행합니다.',
      irreversible: '등록한 입하는 이 화면에서 되돌릴 수 없습니다. 취소는 승인을 거칩니다.',
      itemCode: '품목코드',
      itemName: '품목명',
      qty: '입하 수량',
      excess: (qty: string): string => `초과분 ${qty}`,
      back: '돌아가기',
      register: '등록',
    },
    /** 표 위 한 줄 — 만든 입하번호. 여럿이면 첫 번호와 나머지 수. */
    done: (count: number, firstNo: string): string =>
      count === 1
        ? `입하를 등록했습니다: ${firstNo}`
        : `입하 ${String(count)}건을 등록했습니다: ${firstNo} 외 ${String(count - 1)}건`,
    /** 초과분이 있으면 그 자리에서 연결 창으로. */
    goExcess: '초과분 연결',
  },
  /** 라인 아래 LOT 줄 — 번호 · 입하일 · 수량과, 그 단계의 근거(서버가 준 값만 적는다). */
  lot: {
    receivedOn: (date: string): string => `입하 ${date}`,
    /** 적치는 PDA 의 일이다 — 이 화면은 보기만 한다. */
    putawayOnPda: 'PDA에서 적치',
    /** 라벨 발행(LOT 등록)은 POP 「자재LOT 등록·라벨 발행」의 일이다 — 이 화면은 보기만 한다. */
    issueLabelOnPop: 'POP에서 라벨 발행',
    /** LOT 번호 자리 — 라벨 미부착 입하라 LOT 이 아직 없다(PDA 입하 등록과 같은 말). */
    labelMissing: '라벨 미부착',
    evidence: {
      /** 라벨 미부착 줄 — POP 의 입하 라인 목록에서 찾는 번호. */
      receiptNo: (inboundReceiptNo: string): string => `입하번호 ${inboundReceiptNo}`,
      requested: (requestNo: string, date: string): string => `의뢰 ${requestNo} · ${date}`,
      accepted: (date: string): string => `검사 합격 ${date}`,
      rejected: '검사 불합격 · 불량창고만',
      skipped: '검사 생략',
      noInspection: '무검사',
      posted: (goodsReceiptNo: string, date: string): string => `입고 ${goodsReceiptNo} · ${date}`,
      putawayDone: (date: string): string => `적치 ${date}`,
      separator: ' · ',
    },
    /** 「IQC 의뢰 요청」을 보낸 뒤 LOT 줄 위의 한 줄. */
    requested: (lotNo: string, requestNo: string): string =>
      `IQC 의뢰를 보냈습니다: ${lotNo} → ${requestNo}`,
    loading: '입고 진행을 불러오는 중',
    loadFailed: '입고 진행을 불러오지 못했습니다. 라인은 그대로 보입니다.',
  },
} as const;
