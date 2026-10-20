/**
 * W-01-09 입하 예정 조회. **자재창고 도메인의 첫 화면**이고 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **입하 예정 = 아직 다 들어오지 않은 구매발주(P/O) 라인이다**(omf-mes-server#741) — 고객사가 ASN 을
 * 쓰지 않는다. 「ASN」·「입하예정번호」를 사용자 문구에 쓰지 않는다.
 *
 * 입하 진행(미착수·부분 입하·입하 완료)과 지연은 **서버가 준 수량으로 판정한다** — 남은 수량이 있고
 * 납기가 공장 현지 오늘보다 앞서면 「지연」이다.
 *
 * **참조 값(공급사·공장·품목·단위)의 표기가 세 갈래다** — 아직 오지 않음 · 목록에 없음 · 불러오기 실패.
 * 셋을 한 문구로 뭉개면 정상 값이 잠깐 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 */
export const inboundSchedule = {
  title: '입하 예정 조회',
  description: '구매발주 중 아직 다 들어오지 않은 라인을 납기 순으로 봅니다.',
  breadcrumbRoot: '구매 / 자재 관리',
  panes: {
    list: '입하 예정 목록',
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
    overReceiptSplit: '초과 입하 분리',
    /* 행마다 글자가 같다 — 접근 이름에 발주번호를 넣어 어느 발주인지 밝힌다. */
    overReceiptSplitRow: (purchaseOrderNo: string): string =>
      `${purchaseOrderNo} 초과 입하 분리로 이동`,
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    periodInvalid: '납기는 있는 날짜여야 합니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '납기 종료는 시작보다 앞설 수 없습니다.',
    /*
     * 이름을 못 불러온 것이지 자료가 없는 것이 아니다 — 둘을 섞으면 목록이 비어 보인다.
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.**
     */
    referencesFailed: '공급사·품목·단위 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  loading: {
    list: '입하 예정 목록을 불러오는 중',
  },
  /** 표의 머리글. 열 구성과 폭의 근거는 screens/inbound-schedule/schedule-table.tsx에 있다. */
  table: {
    expectedReceiptDate: '납기',
    purchaseOrderNo: '발주번호',
    lineNo: '라인',
    supplier: '공급사',
    item: '품목',
    orderedQty: '발주 수량',
    receivedQty: '입하 수량',
    remainingQty: '남은 수량',
    uom: '단위',
    receiptStatus: '진행',
    storageLocation: '창고',
    actions: '바로가기',
  },
  /** 입하 진행(`receiptStatusCode`). 서버가 정한다 — 취소는 라인 ERP 취소 · 헤더 취소 둘 다다. */
  receiptStatus: {
    NOT_STARTED: '미착수',
    PARTIAL: '부분 입하',
    COMPLETED: '입하 완료',
    CANCELLED: '취소',
  },
  filters: {
    all: '전체',
    /* 기간이 필수가 아니라는 사실은 화면에서 읽혀야 한다 — 비워 두면 「빠뜨렸다」로 읽힌다. */
    periodNote:
      '납기 기간은 비워 두어도 조회됩니다. 「미완료만」을 끄면 다 들어온 라인과 취소된 라인도 보입니다.',
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
  },
  values: {
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
    /** 발주번호 아래에 붙는 ERP 발주번호. */
    erpPurchaseOrderNo: (value: string): string => `ERP ${value}`,
    /*
     * 미사용 참조에 붙이는 표식. **선택지에서 빼지 않는다** — 지금은 쓰지 않는 거래처·공장을
     * 참조하는 과거 발주가 있다. 빼면 그 발주들을 조건으로 찾을 방법이 사라진다.
     */
    inactiveSuffix: ' (미사용)',
  },
} as const;
