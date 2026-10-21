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
  title: '입하 예정 조회',
  breadcrumbRoot: '구매 / 자재 관리',
  /** 사이드바의 탭 묶음 이름(`nav-tree.ts` 「입고 관리」). 이 화면은 그 묶음의 첫 탭이다. */
  breadcrumbHub: '입고 관리',
  /** 두 표 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: '끌어서 목록·상세 폭 조절',
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
    /** 행의 바로가기. 그 화면이 발주를 주소로 받는다(`po`) — 고른 채로 열린다. */
    /* 왼쪽 표의 발주번호 단추. 줄마다 글자가 달라도 「고른다」는 뜻을 접근 이름에 담는다. */
    selectOrder: (purchaseOrderNo: string): string => `${purchaseOrderNo} 라인 보기`,
    overReceiptSplit: '초과 입하 분리',
    /* 행마다 글자가 같다 — 접근 이름에 발주번호를 넣어 어느 발주인지 밝힌다. */
    overReceiptSplitRow: (purchaseOrderNo: string): string =>
      `${purchaseOrderNo} 초과 입하 분리로 이동`,
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
   * 초과분 잇기(서버 장부 P-100) — P/O 보다 많이 받아 P/O 에 넣지 않은 몫을 ERP 가 만든 추가 P/O 라인에 잇는다.
   * 서버가 후보를 제안하고 사람이 확정한다. 입하·입고 일을 이 화면으로 모으는 첫 걸음이다(사용자 지시 2026-10-21).
   * 「잇다 · 풀다」가 이 일의 두 낱말이다 — 「연결 · 해제」보다 짧고, 무엇이 무엇에 붙는지 읽힌다.
   */
  excess: {
    /** 조건 줄 오른쪽 끝의 진입 단추. 잇지 않은 초과분이 있으면 그 수가 붙는다. */
    entry: '초과분 잇기',
    entryCount: (count: number): string => `잇지 않은 초과분 ${String(count)}건`,
    title: '초과분 잇기',
    lead: 'P/O 보다 많이 받아 P/O 에 넣지 않은 몫(초과분)을 ERP 가 만든 추가 P/O 라인에 잇습니다. 이으면 그 라인의 받은 수량이 초과분만큼 늘어납니다. 잘못 이었으면 「이은 초과분」에서 풉니다.',
    steps: {
      label: '진행 단계',
      pick: '초과분 고르기',
      line: 'P/O 라인 고르기',
      link: '잇기',
    },
    hints: {
      pick: '이을 초과분을 목록에서 누르세요.',
      line: '아래 후보에서 이을 P/O 라인을 누르세요. 「수량 일치」 라인이 대개 맞는 추가 P/O 입니다.',
      link: '확인 문장을 읽고 「잇기」를 누르세요.',
      unlink: '풀 초과분을 누른 뒤 「풀기」를 누르세요.',
    },
    tabs: {
      label: '초과분 구분',
      unlinked: '잇지 않은 초과분',
      linked: '이은 초과분',
    },
    table: {
      receiptNo: '입하번호',
      receiptDate: '입하일',
      supplier: '공급사',
      item: '품목',
      lot: 'LOT',
      excessQty: '초과분',
      sourceOrder: '처음 P/O',
      linkedOrder: '이은 P/O',
      linkedAt: '이은 날',
    },
    candidates: {
      title: '이을 수 있는 P/O 라인',
      purchaseOrderNo: '발주번호',
      orderDate: '발주일',
      dueDate: '납기',
      ordered: '발주',
      received: '받음',
      /** 발주 + 초과 허용치 − 받은 수량 */
      room: '받을 수 있음',
      /** 남은 수량이 초과분과 같다 — 대개 그 초과분 때문에 만든 추가 P/O 다. */
      exact: '수량 일치',
      /** 상세에서 보던 발주의 라인. */
      current: '보던 발주',
      emptyTitle: '이을 수 있는 P/O 라인이 아직 없습니다',
      emptyDescription:
        'ERP 가 추가 P/O 를 만들어 MES 로 넘어오면 여기에 나타납니다. 같은 공급사·품목·단위이고 초과분을 다 받을 수 있는 라인만 보입니다.',
      loading: '후보를 불러오는 중',
      pickFirst: '위에서 초과분을 고르면 이을 수 있는 P/O 라인이 보입니다.',
    },
    /** 「PO-2026-0012 · 10번 줄」 */
    orderLine: (purchaseOrderNo: string, lineNo: number): string =>
      `${purchaseOrderNo} · ${String(lineNo)}번 줄`,
    /** 줄 고르기 단추의 접근 이름 — 보이는 글자(번호)를 담는다. */
    pickExcess: (receiptNo: string, lineNo: number): string =>
      `${receiptNo} ${String(lineNo)}번 줄 초과분 고르기`,
    pickLine: (purchaseOrderNo: string, lineNo: number): string =>
      `${purchaseOrderNo} ${String(lineNo)}번 줄 고르기`,
    /** 방금 「초과 입하 분리」에서 등록한 전표의 초과분. */
    justRegistered: '방금 등록',
    actions: {
      link: '잇기',
      unlink: '풀기',
    },
    /**
     * 누르기 전에 무엇이 바뀌는지 — 단추 옆에 늘 보인다. 수량 뒤에 조사를 붙이지 않는다(받침이 수마다 다르다) —
     * 화살표로 무엇이 어디로 가는지 적는다.
     */
    confirmLink: (qty: string, order: string): string =>
      `초과분 ${qty} → ${order}. 그 라인의 받은 수량이 ${qty} 늘어납니다.`,
    confirmUnlink: (qty: string, order: string): string =>
      `${order} 에서 초과분 ${qty} 풀기. 그 라인의 받은 수량이 ${qty} 줄고, 다시 잇지 않은 초과분이 됩니다.`,
    blocked: {
      noExcess: '먼저 이을 초과분을 고르세요.',
      noLine: '이을 P/O 라인을 고르세요.',
      noLinked: '풀 초과분을 고르세요.',
    },
    done: {
      linked: (qty: string, order: string): string => `이었습니다 — 초과분 ${qty} → ${order}`,
      unlinked: (qty: string, order: string): string => `풀었습니다 — ${order} 에서 초과분 ${qty}`,
    },
    empty: {
      unlinkedTitle: '잇지 않은 초과분이 없습니다',
      unlinkedDescription:
        '「초과 입하 분리」에서 발주보다 많이 온 수량을 등록하면 그 초과분이 여기에 나타납니다.',
      linkedTitle: '이은 초과분이 없습니다',
    },
    truncated: (shown: number, total: number): string =>
      `앞쪽 ${String(shown)}건만 보입니다(전체 ${String(total)}건).`,
    loading: '초과분을 불러오는 중',
    /** 상세 표의 열 — 이 발주에 맞는 초과분이 있을 때만 선다. */
    lineColumn: '초과분',
    lineLinkable: (qty: string): string => `${qty} 잇기`,
    lineLinkableLabel: (lineNo: number, qty: string): string =>
      `${String(lineNo)}번 줄에 초과분 ${qty} 잇기`,
    lineLinked: (qty: string): string => `${qty} 이음`,
    lineLinkedLabel: (lineNo: number, qty: string): string =>
      `${String(lineNo)}번 줄에 이은 초과분 ${qty} 보기`,
  },
} as const;
