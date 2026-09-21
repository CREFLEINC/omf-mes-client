/**
 * W-01-10(정상품 입하 처리).
 *
 * **낱말을 가려 쓴다.** 「입하」는 자재가 도착한 사실이고 「입고」는 창고 재고로 받아들이는 것이다.
 * 이 화면이 고르는 대상은 **입하 전표**이고 만드는 것은 **입고 전표**다 — 둘을 뭉개면
 * 무엇을 고르고 무엇을 만드는지 화면에서 읽을 수 없다.
 *
 * **「전송 완료」라는 낱말을 쓰지 않는다.** 계약이 내려주는 `erpMessageQueued`는 「송신 대기열에
 * 적재됐다」이지 「상대 시스템으로 보냈다」가 아니다 — 뭉개면 승인자가 반영된 줄로 오해한다.
 */
export const goodsReceipt = {
  title: '정상품 입하 처리',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '대상 입하 전표 목록',
    lines: '고른 전표의 라인',
    post: '입고 처리 입력',
  },
  fields: {
    supplier: '공급사',
    /** W-03-01 품목 칸과 같은 검색 묶음 — 누르면 「공급사 선택」 창이 열린다. */
    supplierPlaceholder: '코드·이름으로 검색',
    supplierClear: '공급사 지우기',
    /** 계약의 `receiptDateFrom`·`receiptDateTo`. **기본 기간을 심지 않는다**(W-01-09가 세운 규칙). */
    receiptDateFrom: '입하 시작일',
    receiptDateTo: '입하 종료일',
    /** 값 목록이 확정되지 않아 선택지가 비어 있다 — 안내는 `pendingCode`가 맡는다. */
    status: '상태',
    q: '입하번호·거래명세서번호 검색',
    qPlaceholder: '입하번호 또는 거래명세서번호',
    /* 아래는 확정 입력. **사용자가 고르는 것은 이 여덟뿐이다** — 수량·품목·단위·자재 LOT은
     * 고른 입하 라인의 값을 그대로 싣는다(전량 입고라 수량 입력칸이 없다). */
    warehouse: '입고 창고',
    location: '적치 위치',
    receiptType: '입고 유형',
    sourceDocumentType: '원천 문서 유형',
    qualityStatus: '품질 상태',
    inventoryStatus: '재고 상태',
    reason: '사유',
    receiptDatetime: '입고 일시',
    remarks: '비고',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 입하번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **내부 번호를 접근 이름에 넣지 않는다** — 그것이 화면 밖으로 새는 또 하나의 경로다.
     */
    selectRow: (inboundReceiptNo: string): string => `${inboundReceiptNo} 선택`,
    deselectRow: (inboundReceiptNo: string): string => `${inboundReceiptNo} 선택 해제`,
    /** 라인에는 사용자 대면 번호가 줄번호뿐이다 — 입하 라인 번호는 내부 번호라 쓰지 않는다. */
    selectLine: (lineNo: number): string => `${String(lineNo)}번 줄 선택`,
    deselectLine: (lineNo: number): string => `${String(lineNo)}번 줄 선택 해제`,
    /** 이 화면의 유일한 쓰기. 누르면 곧바로 나가지 않고 확인 창이 먼저 뜬다. */
    post: '입고 처리',
    confirmPost: '입고 처리 완료',
    keepEditing: '취소',
    /** 입고 처리 확인 창의 닫기(사용자 지시) — 창만 닫고 입력 화면으로 돌아간다. */
    cancelPost: '취소',
    discardDraft: '재선택',
    viewSourceDocument: '원천 문서 보기',
  },
  /**
   * 비활성 사유. **버튼 이름으로 시작한다**(배치 규범 4) — 사유가 시각적으로 끊겼을 때
   * 무엇에 대한 안내인지 복원할 단서가 그것뿐이다.
   */
  actionReasons: {
    /*
     * 코드 목록이 확정되지 않아 **입고 처리 자체가 열리지 않는** 상태.
     *
     * 원천 문서 유형과 재고 상태는 고정 OpenAPI가 값을 닫았다. 입고 유형·품질 상태는
     * 운영 공통코드 목록을 받기 전까지 값을 지어내지 않고 처리를 잠그며 사유를 밝힌다.
     */
    postCodeListPending:
      '입고 처리: 입고 유형·품질 상태의 운영 코드 목록이 준비되지 않아 지금은 입고 처리를 할 수 없습니다.',
    postNeedsWarehouse: '입고 처리: 입고 창고를 고르세요.',
    postNeedsLocation: '입고 처리: 적치 위치를 고르세요.',
    postNeedsCodes: '입고 처리: 필수 코드를 모두 고르세요.',
    postNeedsReceiptDatetime: '입고 처리: 입고 일시를 넣으세요.',
    /*
     * 원천 문서로 넘어갈 수 없는 이유. 유형 코드와 대상의 대응 규약이 아직 없어 무엇을 가리키는지
     * 화면이 알 수 없다 — 짐작해서 열면 다른 문서를 연다.
     */
    sourceDocumentUnavailable:
      '원천 문서 보기: 원천 문서 유형과 대상의 대응 규약이 아직 정해지지 않아 문서를 열 수 없습니다. 유형 코드와 입하번호만 보입니다.',
  },
  /** 입력칸 옆에 붙는 오류. 서버가 준 필드 오류도 같은 자리에 낸다. */
  errors: {
    /** 계약의 코드 길이 상한. 고른 값이 상한을 넘으면 보내지 않는다. */
    codeTooLong: (max: number): string => `코드는 ${String(max)}자를 넘을 수 없습니다.`,
  },
  /** 실패·비활성 사유는 그 대상으로 시작한다(배치 규범 4). */
  reasons: {
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     */
    referencesFailed: '공급사 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·자재 LOT·공장 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /*
     * **잘림은 실패와 다르다.** 이름 목록이 앞쪽만 오면 그 뒤의 정상 값이 「알 수 없음」으로 찍히는데,
     * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다. 특히 **자재 LOT은 다섯 참조 중
     * 유일한 거래 기록**이라 시간이 갈수록 쌓여 가장 잘리기 쉽다.
     * 다시 시도로 풀리지 않으므로 복구 버튼을 붙이지 않고 사실만 밝힌다.
     */
    lineReferencesTruncated:
      '확인되지 않은 정보는 「알 수 없음」으로 표시될 수 있으며, 실제 값의 오류는 아닙니다.',
    /*
     * 고를 수 없는 줄의 사유. **값 자체를 설명한다** — 상태 코드로 판정하지 않는다(공유계약 G-2).
     * 여러 줄이 함께 쓰는 문구라 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다(규범 4의 이탈 조건).
     */
    /** 입고 창고·적치 위치 선택지를 못 받았다. 이 둘이 없으면 어디에 넣을지 정할 수 없다. */
    postOptionsFailed: '입고 창고·적치 위치 선택지를 불러오지 못했습니다.',
    lineNoLot: '자재 LOT이 생성되지 않았습니다.',
    lineQtyNotPositive: '입하 수량이 0보다 커야 선택할 수 있습니다.',
  },
  loading: {
    inboundReceipts: '대상 입하 전표 목록을 불러오는 중',
    lines: '입하 라인을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/goods-receipt/ir-table.tsx에 있다. */
  table: {
    inboundReceiptNo: '입하번호',
    supplier: '공급사',
    receiptDatetime: '입하일시',
    deliveryNoteNo: '거래명세서번호',
    status: '상태',
    select: '선택',
  },
  /** 라인 표의 머리글과 칸 문구. 폭의 근거는 screens/goods-receipt/ir-line-table.tsx에 있다. */
  /** 입고 처리 입력 구획의 제목. */
  postTitle: '입고 정보',
  lineTable: {
    /** 제목줄(입하 기본정보)과 라인 표를 가르는 구획 제목. */
    title: '입하 라인',
    lineNo: '줄번호',
    item: '품목',
    receivedQty: '입하 수량',
    lot: '자재 LOT',
    expiryDate: '유효기한',
    select: '선택',
    /** 「100 SAMPLE-EA」 — 단위 열을 따로 두지 않고 수량 표기에 붙인다(W-01-03이 세운 처리). */
    receivedQtyPair: (receivedQty: number, uom: string): string => `${String(receivedQty)} ${uom}`,
  },
  /** 고른 입하 전표의 제목줄. **목록 표에 두지 않은 값(공장)이 여기서 보인다.** */
  summary: {
    label: '고른 입하 전표',
    inboundReceiptNo: '입하번호',
    supplier: '공급사',
    plant: '공장',
    receiptDatetime: '입하일시',
    deliveryNoteNo: '거래명세서번호',
    status: '상태',
  },
  /**
   * 고른 입하 라인의 제목줄.
   *
   * **검사 대상·상태를 열로 두지 않고 여기서 보인다** — 열을 늘리는 것보다 줄이는 것이 먼저다.
   * 고른 한 줄에서만 필요한 값이라 표 전체에 열을 낼 이유가 없다(계획 §5.5).
   */
  lineSummary: {
    label: '선택한 입하 라인',
    lineNo: '줄번호',
    item: '품목',
    receivedQty: '입하 수량',
    lot: '자재 LOT',
    expiryDate: '유효기한',
    inspectionRequired: '수입검사 대상',
    status: '상태',
    inspectionYes: '대상',
    inspectionNo: '대상 아님',
  },
  filters: {
    all: '전체',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /**
     * **「없다」와 구분한다.** 목록이 오는 동안 선택칸은 선택지 0건으로 그려지는데, 그 모습은
     * 「이 창고에는 위치가 없다」와 글자가 같다 — 이 화면이 참조 표기에서 지키는 구분
     * (미도착을 「알 수 없음」으로 내지 않는다)을 선택지 목록에서도 지킨다.
     */
    lookupLoading: '선택지를 불러오는 중입니다.',
    /** 상태 선택지가 왜 비어 있는지 — 라벨 옆 같은 줄. 공용 `pendingCode.note` 와 뜻이 같은 짧은 문구다. */
    statusPending: '코드 확정 전엔 선택이 불가합니다.',
    /** 입고 처리의 코드 선택칸이 비어 있는 이유 — 라벨 옆 같은 줄. 공용 `pendingCode.note` 의 짧은 판. */
    codePending: '코드 확정 전엔 선택이 불가합니다.',
    chipSupplier: (value: string): string => `공급사: ${value}`,
    /** 한쪽만 넣은 기간도 조건이다 — 그 사실이 칩에서 읽혀야 한다. */
    chipPeriodBoth: (from: string, to: string): string => `입하일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `입하일: ${from}부터`,
    chipPeriodTo: (to: string): string => `입하일: ${to}까지`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipQ: (value: string): string => `검색어: ${value}`,
    chipRemoveSupplier: '공급사 조건 제거',
    chipRemovePeriod: '입하일 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveQ: '검색어 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/goods-receipt/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /** 빈 상태는 **네 갈래**다. 사용자가 할 조치가 서로 다르다(완료 조건 C07). */
  empty: {
    noResultTitle: '조건에 맞는 입하 전표가 없습니다',
    noResultDescription: '조건을 줄이거나 입하일 범위를 넓힌 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '입하 전표를 선택해 주세요',
    noSelectionDescription: '목록에서 입하할 전표의 「선택」을 눌러 주세요.',
    noLinesTitle: '입고할 라인이 없습니다',
    noLinesDescription: '이 전표에는 입고할 수 있는 품목 라인이 없습니다.',
    /*
     * 주소에 고른 전표가 있는데 **목록 조회가 실패한** 자리. 골격(「불러오는 중」)을 내면
     * 기다리라고 말하는데 기다려서 풀리지 않는다. 라인 값을 받아도 구획을 열 수 없다 —
     * **제목줄이 쓰는 전표의 값이 목록 응답에만 있다**(W-01-03이 세운 형태).
     */
    listFailedTitle: '대상 입하 전표를 불러오지 못해 이 전표를 열 수 없습니다',
    listFailedDescription: '위의 「다시 시도」로 목록을 불러온 뒤 다시 고르세요.',
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
    inactiveSuffix: ' (미사용)',
    /** 아직 고르지 않은 선택칸의 트리거 문구. 값 목록이 준비되지 않은 칸은 `pendingCode`가 맡는다. */
    selectPlaceholder: '고르세요',
    /** 입고 정보 선택칸마다의 자리표시(사용자 지시) — 무엇을 고르는 칸인지 칸 안에서 읽힌다. */
    fieldPlaceholders: {
      warehouse: '입고 창고를 선택하세요',
      location: '적재 위치를 선택하세요',
      receiptType: '입고 유형을 선택하세요',
      sourceDocumentType: '원천 문서 유형을 선택하세요',
      qualityStatus: '품질 상태를 선택하세요',
      inventoryStatus: '재고 상태를 선택하세요',
      reason: '사유를 선택하세요',
    },
  },
  notes: {
    /*
     * 한 줄만 고를 수 있다는 사실. 밝히지 않으면 둘째 줄을 골랐을 때 앞 선택이 풀리는 것이
     * 고장으로 읽힌다(계약이 라인마다 위치를 받으므로 나중에 여러 줄로 늘 수 있다 — 이슈 §4).
     */
    singleLineSelect: '한 번에 하나의 입하 라인만 선택할 수 있습니다.',
    /** 입력칸이 없는 값이 무엇에서 정해지는지 밝힌다 — 밝히지 않으면 화면 어디에서도 읽을 수 없다. */
    businessDateDerived: '영업일은 선택한 입고 일시를 기준으로 자동 설정됩니다.',
    qtyFromInboundLine:
      '선택한 라인의 품목·수량·단위·자재 LOT이 그대로 입고되며, 수량을 나누어 입고할 수 없습니다.',
    plantFromInboundReceipt: '공장은 선택한 입하 전표의 공장으로 자동 적용됩니다.',
    /** 고른 창고의 공장을 함께 보인다 — 전표의 공장과 다르면 눈으로 보인다. 막지는 않는다. */
    warehousePlant: (plant: string): string => `고른 창고의 공장: ${plant}`,
    /** 고른 창고의 공장이 입하 전표와 다를 때 — 입하 전표의 공장을 함께 보인다(사용자 지시). */
    warehousePlantDiffers: (plant: string): string =>
      `선택한 창고의 공장이 입하 전표의 공장(${plant})과 다릅니다.`,
    /*
     * **응답을 받지 못한 실패에만 붙인다.** 공통 문구는 「다시 시도하세요」로 끝나는데,
     * 확인 없이 다시 보내면 같은 입하가 입고 전표 두 벌이 될 수 있다.
     */
    postRecheck:
      '입고 전표가 이미 만들어졌는지 확인한 뒤 다시 시도하세요. 확인 없이 다시 보내면 같은 입하가 두 번 입고될 수 있습니다.',
  },
  /**
   * 확인 창.
   *
   * **되돌릴 수 없는 쓰기 앞에 한 겹을 더 둔다.** 확정 한 번에 다섯 가지가 함께 움직이는데
   * 이 화면에는 되돌리는 수단이 없다 — 무엇을 보내는지 한 번 더 보이는 값이 그만큼 크다.
   */
  dialog: {
    submitTitle: '이 내용으로 입고 처리할까요?',
    submitLead: '입고할 내용을 확인한 후 실행해 주세요.',
    /** 확인 창의 묶음 제목 — 무엇을 · 어디로 · 어떤 상태로. */
    submitGroupWhat: '입고 대상',
    submitGroupWhere: '입고 위치',
    submitGroupHow: '입고 조건',
    /** 되돌릴 수 없다는 경고 — 짧은 한 줄로 앞세운다. */
    submitIrreversible: '입고 처리 후에는 이 화면에서 되돌릴 수 없습니다.',
    /** 이슈 §6 — 한 번의 확정으로 함께 움직이는 것. 경고 아래 보조 설명으로 낮춘다. */
    submitEffects:
      '입고 전표 생성·전기, 자재 LOT 상태 변경, 수불 원장 기록, 재고 잔액 반영, ERP 송신 대기열 적재가 함께 처리됩니다.',
    discardTitle: '변경사항을 취소할까요?',
    /** 이 화면의 버리기 확인 본문(사용자 지시) — 공용 `discardChangesConfirm` 은 다른 화면이 쓴다. */
    discardLead: '저장하지 않은 내용이 있습니다. 취소하면 변경한 내용이 사라집니다.',
  },
  /**
   * 입고 처리 결과.
   *
   * **확인한 것과 확인하지 않은 것을 가려 밝힌다.** 한 트랜잭션으로 다섯 가지가 움직이는데
   * 화면이 증거를 갖는 것은 그중 일부뿐이다 — 나머지를 말하지 않으면 사용자가 「다 됐다」로 읽는다.
   */
  result: {
    label: '입고 처리 결과',
    receiptNo: '입고번호',
    status: '상태',
    sourceDocument: '원천 문서',
    /** 유형 코드와 **입하번호**를 낸다 — 원천 식별자는 내부 번호라 내지 않는다. */
    sourceDocumentPair: (typeCode: string, inboundReceiptNo: string): string =>
      `${typeCode} · ${inboundReceiptNo}`,
    lotStatus: '자재 LOT 상태',
    lotStatusLoading: '자재 LOT 상태를 다시 불러오는 중',
    lotStatusFailed: '자재 LOT 상태를 다시 불러오지 못했습니다.',
    /* 응답에 LOT 상태가 없어 다시 조회한 값이다. 값 자체로 분기하지 않고 그대로 보인다. */
    lotStatusNote:
      '입고 처리 뒤 자재 LOT을 다시 조회해 받은 값입니다. 화면은 이 값을 해석하지 않고 그대로 보입니다.',
    /* 원장·ERP는 라벨 없이 문장으로 낸다 — 라벨 키를 미리 세우지 않는다(쓰이지 않는 문구가
     * 먼저 서 있으면 어느 것이 화면에 실제로 나오는지 읽을 수 없다). 라벨이 붙는 형태로
     * 바꾸게 되면 그때 함께 세운다. */
    ledgerAll: '입고 라인마다 수불 원장 라인이 함께 만들어졌습니다.',
    ledgerSome: '일부 입고 라인에만 수불 원장 라인이 있습니다.',
    ledgerNone: '응답에 수불 원장 라인이 담기지 않았습니다.',
    /** 확인하지 않은 것을 밝힌다 — 이 화면은 재고 잔액을 조회하지 않는다. */
    balanceNote: '재고 잔액은 이 화면이 확인하지 않습니다. 잔액은 재고 현황 화면에서 확인하세요.',
    /*
     * **세 갈래다.** 참·거짓뿐 아니라 **응답에 값이 오지 않은 경우**를 따로 가른다 —
     * 없음을 참으로 읽으면 이 화면에서 가장 나쁜 오해가 생긴다.
     * 어느 갈래에도 「전송 완료」를 쓰지 않는다(이슈 §6).
     */
    erpQueued:
      'ERP 송신 대기열에 적재됐습니다. 아직 상대 시스템에 반영된 것은 아니라 지금 조회하면 없을 수 있습니다.',
    erpNotQueued:
      'ERP 송신 대기열에 적재되지 않았습니다. 상대 시스템 반영 여부는 연계 동기화 현황 화면에서 확인하세요.',
    erpUnknown: 'ERP 송신 대기열 적재 여부를 알 수 없습니다. 응답에 그 값이 오지 않았습니다.',
  },
  /** 조건 줄 공급사 칸이 여는 창 — 공용 「품목 선택」 창과 같은 모양·조작이다. */
  supplierPicker: {
    title: '공급사 선택',
    keywordLabel: '검색어',
    keywordPlaceholder: '공급사 코드 또는 이름',
    search: '찾기',
    columns: { select: '선택', code: '코드', name: '이름' },
    inactive: '미사용',
    noResult: '검색 결과가 없습니다. 코드나 이름의 일부로 다시 찾아보세요.',
    searchFailed: '공급사를 찾지 못했습니다.',
    searching: '찾는 중입니다…',
    page: {
      range: (from: number, to: number, total: number): string =>
        `${String(from)}–${String(to)} / 전체 ${String(total)}건`,
      previous: '이전',
      next: '다음',
    },
    cancel: '취소',
    pick: '선택',
  },
} as const;
