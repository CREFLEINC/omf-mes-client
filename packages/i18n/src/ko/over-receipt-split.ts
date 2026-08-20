/**
 * W-01-03 초과 입하 분리. **자재창고 도메인의 첫 쓰기 화면**이다.
 *
 * PR ① 몫만 담는다 — 대상 발주를 고르고, 라인마다 이번 도착 수량을 넣고,
 * 정량분과 초과분이 갈리는 것까지다. 세 모드 등록·결과·실패 문구는 PR ②에서 더한다.
 *
 * **「정량분」과 「초과분」이 이 화면의 두 낱말이다.** 계약의 `normal`·`excess`를 그대로
 * 옮기지 않고 업무 낱말로 말한다 — 사용자가 만드는 것은 두 건의 입하 전표이지
 * 요청 본문의 두 갈래가 아니다.
 *
 * **정량·초과는 화면이 만든 값이다.** 서버가 내려준 값이 아니라는 사실을 안내가 밝힌다 —
 * 지금까지의 조회 화면은 서버 값을 그대로 그렸고, 이 화면이 처음으로 파생값을 그린다.
 *
 * **참조 값(공급사·공장·품목·단위)의 표기가 네 갈래다** — 아직 오지 않음 · 목록에 없음 ·
 * 불러오기 실패 · 정상. 넷을 뭉개면 정상 값이 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 */
export const overReceiptSplit = {
  title: '초과 입하 분리',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '대상 발주 목록',
    lines: '고른 발주의 라인',
    /** 두 전표에 함께 실리는 머리 입력과 초과분에만 실리는 값이 한 구획에 있다. */
    register: '등록 정보',
    result: '등록 결과',
  },
  fields: {
    supplier: '공급사',
    q: '발주번호 검색',
    /** 계약의 `openOnly`를 업무 낱말로 옮긴다 — 「아직 입하가 끝나지 않은 발주만」이다. */
    openOnly: '미완료 발주만',
    /** 계약 필수. 두 전표에 같은 값이 실리고, 영업일도 이 값의 날짜에서 나온다. */
    receiptDatetime: '입하 일시',
    deliveryNoteNo: '거래명세서번호',
    remarks: '비고',
    /** 예외 유형·초과 사유는 **초과분 전표에만** 실린다(계약 설명). */
    exceptionType: '예외 유형',
    exceptionReason: '초과 사유',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 세 버튼이 계약의 세 갈래와 1:1이다. **기본값이 없어** 버튼을 고르는 것이 곧 갈래를 고르는 것이다 —
     * 「저장」 하나로 합치면 무엇이 저장되는지 누르기 전에 알 수 없다.
     */
    registerBoth: '분리 등록',
    registerNormalOnly: '정량분만 저장',
    registerExcessOnly: '초과분만 저장',
    createPurchaseOrder: '신규 P/O 등록',
    /** 초안 파기 확인 창의 확인 버튼. 「확인」으로 두면 무엇이 확인되는지 창을 다시 읽어야 한다. */
    discardDraft: '입력을 버린다',
    keepEditing: '계속 입력',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 발주번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **발주번호를 쓴다.** 내부 번호를 접근 이름에 넣으면 화면 밖으로 새어 나간다.
     */
    selectRow: (purchaseOrderNo: string): string => `${purchaseOrderNo} 선택`,
    deselectRow: (purchaseOrderNo: string): string => `${purchaseOrderNo} 선택 해제`,
  },
  /** 실패 사유는 그 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     * 공장은 고른 발주의 제목줄에서만 보이므로 아래 구획 안내가 맡는다.
     */
    referencesFailed: '공급사 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·공장 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  /**
   * 등록 버튼이 잠긴 사유(배치 규범 4).
   *
   * **버튼 이름으로 시작한다** — 사유가 시각적으로 끊겼을 때 어느 버튼의 것인지 복원할 단서가 된다.
   * 다만 아직 아무 수량도 넣지 않은 상태는 **세 버튼이 함께 잠기므로** 무엇에 대한 안내인지로
   * 시작한다(규범 4의 이탈 조건) — 같은 사정을 세 번 되풀이하면 무엇을 해야 하는지 오히려 흐려진다.
   */
  actionReasons: {
    noQty: '아직 넣은 도착 수량이 없습니다. 라인에 이번 도착 수량을 넣으면 등록할 수 있습니다.',
    bothNeedsExcess:
      '분리 등록은 초과분이 없어 나눌 것이 없습니다. 「정량분만 저장」으로 등록하세요.',
    bothNeedsNormal:
      '분리 등록은 정량분이 없어 나눌 것이 없습니다. 「초과분만 저장」으로 등록하세요.',
    normalOnlyNeedsNormal:
      '정량분만 저장은 받을 정량분이 없습니다. 잔량과 허용치 안쪽으로 도착한 수량이 있으면 이 버튼을 쓸 수 있습니다.',
    excessOnlyNeedsExcess:
      '초과분만 저장은 초과분이 없습니다. 정량 한도를 넘게 도착한 수량이 있으면 이 버튼을 쓸 수 있습니다.',
    /*
     * **여기가 시작하는 자리가 아니다.** 화면은 이제 있지만 이 버튼에서 열지 않는다 —
     * 정산할 초과분 전표가 정해지기 전에 열면 「무엇을 정산하는지 모르는 발주 등록」이 되고,
     * 그것이 곧 일반 구매 발주 등록이다(착수 이슈 §6 ①).
     *
     * 그래서 잠금은 유지하고 **사유만 새 사실로 바꾼다** — 풀리는 조건이 「화면이 준비되면」이
     * 아니라 「초과분 입하를 먼저 등록하면」이고, 그 뒤에 이어지는 자리는 등록 결과 구획이다.
     */
    createPurchaseOrderUnavailable:
      '신규 P/O 등록은 여기서 시작하지 않습니다. 초과분 입하를 먼저 등록하면 등록 결과에서 이어집니다.',
  },
  loading: {
    purchaseOrders: '대상 발주 목록을 불러오는 중',
    lines: '발주 라인을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/over-receipt-split/po-table.tsx에 있다. */
  table: {
    purchaseOrderNo: '발주번호',
    supplier: '공급사',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
    status: '상태',
    select: '선택',
  },
  /**
   * 라인 표의 머리글과 칸 문구.
   *
   * **수량 넷을 여섯 열이 아니라 네 열에 담는다** — 짝지어 한 칸에 넣으면 열이 줄고,
   * 줄지 않으면 표 하한(`58rem`)을 넘겨 표가 짓눌린다(계획 §5.5).
   */
  lineTable: {
    lineNo: '줄번호',
    item: '품목',
    ordered: '발주 · 기입하',
    remaining: '잔량 · 허용',
    arrivedQty: '이번 도착 수량',
    split: '정량 · 초과',
    /** 「발주 100 · 기입하 40」 */
    orderedPair: (orderedQty: number, receivedQty: number): string =>
      `발주 ${String(orderedQty)} · 기입하 ${String(receivedQty)}`,
    /** 「잔량 60 (+5)」 — 괄호 안이 초과 허용치다. 뜻은 표 아래 안내가 밝힌다. */
    remainingPair: (remainingQty: number, toleranceOverQty: number): string =>
      `잔량 ${String(remainingQty)} (+${String(toleranceOverQty)})`,
    /** 「정량 60 · 초과 5」 — 화면이 만든 값이다. */
    splitPair: (normalQty: number, excessQty: number): string =>
      `정량 ${String(normalQty)} · 초과 ${String(excessQty)}`,
    /*
     * 표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다(배치 규범 3의 이탈 조건).
     * **줄번호를 접근 이름에 넣는다** — 「이번 도착 수량」이 줄마다 되풀이되면 어느 줄인지 알 수 없다.
     * 내부 번호를 쓰지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
     */
    arrivedQtyLabel: (lineNo: number): string => `${String(lineNo)}번 줄 이번 도착 수량`,
    /** 입력칸 아래의 단위 표기. 단위 열을 따로 두지 않고 수량을 치는 자리에 붙인다. */
    uomNote: (uom: string): string => `단위 ${uom}`,
  },
  /** 고른 발주의 제목줄. **목록 표에 두지 않은 값(공장)이 여기서 보인다.** */
  summary: {
    label: '고른 발주',
    purchaseOrderNo: '발주번호',
    supplier: '공급사',
    plant: '공장',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
    status: '상태',
  },
  filters: {
    all: '전체',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /* 기본이 켬이라는 사실을 밝힌다 — 끄면 이미 입하가 끝난 발주도 함께 나온다. */
    openOnlyNote: '기본은 아직 입하가 끝나지 않은 발주만 봅니다. 끄면 끝난 발주도 함께 나옵니다.',
    chipSupplier: (value: string): string => `공급사: ${value}`,
    chipQ: (value: string): string => `발주번호: ${value}`,
    chipRemoveSupplier: '공급사 조건 제거',
    chipRemoveQ: '발주번호 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/over-receipt-split/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 발주가 없습니다',
    noResultDescription: '조건을 줄이거나 「미완료 발주만」을 끈 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '발주를 고르면 라인이 보입니다',
    noSelectionDescription: '위 목록에서 초과 도착이 생긴 발주를 골라 「선택」을 누르세요.',
    /*
     * 주소에 고른 발주가 있는데 **목록 조회가 실패한** 자리. 골격(「불러오는 중」)을 내면
     * 기다리라고 말하는데 기다려서 풀리지 않는다 — 빈 상태로 내는 것보다 나쁘다.
     * 라인 값은 받을 수 있어도 **제목줄에 낼 발주의 값이 목록 응답에만 있어** 구획을 열 수 없다.
     */
    listFailedTitle: '대상 발주를 불러오지 못해 이 발주를 열 수 없습니다',
    listFailedDescription: '위의 「다시 시도」로 목록을 불러온 뒤 다시 고르세요.',
    noLinesTitle: '이 발주에는 라인이 없습니다',
    noLinesDescription: '발주에 담긴 품목 줄이 하나도 없어 받을 것을 정할 수 없습니다.',
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
    /** 수량을 넣지 않았거나 넣은 값이 수량이 아니어서 아직 가를 것이 없다. */
    notSplit: '—',
    inactiveSuffix: ' (미사용)',
  },
  /** 라인 입력의 형식 오류. 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. */
  errors: {
    qtyNotNumber: '수량은 숫자로 넣으세요.',
    qtyNotPositive: '수량은 0보다 커야 합니다.',
    /*
     * 머리 입력의 오류는 **등록을 누른 뒤에** 세운다 — 치는 도중에 붉은 글씨를 띄우면
     * 아직 다 넣지도 않은 칸이 잘못된 것처럼 보인다(저장소 전례).
     */
    receiptDatetimeRequired: '입하 일시를 넣으세요.',
    deliveryNoteNoTooLong: (max: number): string =>
      `거래명세서번호는 ${String(max)}자를 넘을 수 없습니다.`,
    exceptionReasonRequired: '예외 유형을 골랐으면 초과 사유를 함께 넣으세요.',
    /*
     * 사유가 붙은 줄을 그대로 두고 등록하면 **그 줄만 빠진 전표**가 만들어진다.
     * 되돌릴 수 없는 쓰기라 빠뜨린 줄을 나중에 알아채면 고칠 방법이 없다.
     */
    qtyInvalidBlocked:
      '고치지 않은 도착 수량이 있어 등록하지 않았습니다. 사유가 붙은 줄을 고친 뒤 다시 등록하세요.',
  },
  notes: {
    /*
     * **화면이 만든 값이라는 사실을 밝힌다.** 서버가 내려준 값으로 읽히면 사용자가
     * 「시스템이 이미 그렇게 정했다」고 받아들여 수량을 다시 보지 않는다.
     */
    splitDerived:
      '정량 · 초과는 이 화면이 계산한 값입니다. 잔량에 초과 허용치(+)를 더한 값까지가 정량분이고, 그보다 많이 도착한 몫이 초과분입니다.',
    /* 빈 칸이 오류가 아니라는 사실은 화면에서 읽혀야 한다 — 비워 두면 「빠뜨렸다」로 읽힌다. */
    arrivedQtyOptional: '이번에 받지 않는 줄은 수량을 비워 두세요.',
    /*
     * **영업일은 입하 일시에서 파생한 값이다.** 입력칸을 두지 않으므로 그 사실을 밝히지 않으면
     * 사용자는 영업일이 무엇으로 정해졌는지 화면 어디에서도 읽을 수 없다.
     */
    businessDateDerived:
      '영업일은 입하 일시의 날짜로 함께 보냅니다. 야간에 받은 자재의 영업일이 다르게 잡혀야 한다면 담당자에게 알려 주세요.',
    /* 머리 입력 한 벌이 두 전표에 같이 실린다는 사실. 밝히지 않으면 초과분만 따로 적는 줄 안다. */
    headerSharedByBoth: '입하 일시·거래명세서번호·비고는 만들어지는 전표 모두에 같이 실립니다.',
    /* 반대쪽 — 이 둘은 초과분 전표에만 붙는다. 밝히지 않으면 정량분에도 붙는 줄 안다. */
    excessOnlyFields: '예외 유형과 초과 사유는 초과분 전표에만 실립니다.',
    /*
     * 초과분의 수입검사 대상 여부는 **보낼 자리가 요청에 없다.** 지어내지 않고 사실만 밝힌다.
     */
    excessInspection:
      '초과분의 수입검사 대상 여부는 이 화면에서 함께 보내지 않습니다. 확인이 필요하면 담당자에게 알려 주세요.',
    /*
     * 응답을 받지 못한 실패에만 붙인다. 맹목적으로 다시 누르면 같은 도착이 전표 두 벌로 남는다 —
     * 되돌리려면 승인을 거쳐야 해서 화면이 되돌릴 수 없다.
     */
    registerRecheck:
      '등록됐는지 확인한 뒤 다시 시도하세요. 확인하지 않고 다시 보내면 같은 입하가 두 번 등록될 수 있습니다.',
  },
  /**
   * 등록 결과.
   *
   * **전표 번호는 사용자 대면 업무 번호라 낸다.** 내부 번호는 어느 갈래에도 내지 않는다.
   * 사라지는 알림(토스트)으로 내지 않는 이유도 그것이다 — 나중에 조회할 때 쓸 번호를
   * 몇 초 뒤에 없애면 적어 둘 틈이 없다.
   */
  result: {
    count: (count: number): string => `전표 ${String(count)}건을 만들었습니다.`,
    receiptNo: '전표번호',
    status: '상태',
    /* 응답이 어느 건이 정량분인지 알려 주지 않는다. 순서로 추측해 라벨을 붙이지 않는다. */
    unlabeled: '정량분과 초과분 중 어느 전표인지는 표시하지 않습니다.',
    /*
     * 다음 화면(W-01-11)으로 가는 길. **만들어진 전표마다 선다** — 두 건일 때 하나로 합치면
     * 어느 전표를 정산하는지 화면이 지어내야 하는데, 응답은 그것을 알려 주지 않는다.
     *
     * **전표번호를 보이는 글자에 담는다.** 링크가 둘 나란히 서므로 글자가 같으면 어느 전표의
     * 것인지 가릴 수 없고, 숨은 이름(`aria-label`)으로만 가르면 눈으로 보는 사람이 구분하지
     * 못한다 — 보이는 글자와 접근 이름을 같게 두는 편이 둘 다 만족한다.
     * **내부 번호를 쓰지 않는다** — 그것이 번호가 화면 밖으로 새는 또 하나의 경로다.
     */
    registerPo: (inboundReceiptNo: string): string => `${inboundReceiptNo} 입하로 P/O 등록`,
  },
  dialog: {
    /* 초안 파기 확인. 본문은 공통 문구(`common.discardChangesConfirm`)를 쓴다. */
    discardTitle: '입력한 도착 수량을 버립니다',
  },
} as const;
