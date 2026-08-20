/**
 * W-01-07 재고 현황·상태 조회. 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **「묶는 축」을 사용자 문구에 쓰지 않는다** — 계약의 낱말(`groupBy`)이고, 화면에서는
 * 「보기」와 그 이름(품목별·LOT별·위치별)으로 말한다.
 *
 * **참조 값(창고·위치·품목·LOT·단위·소유처)의 표기가 네 갈래다** — 아직 오지 않음 ·
 * 목록에 없음 · 불러오기 실패 · **`null`이 뜻을 갖는 자리**. 넷을 뭉개면 정상 값이
 * 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 *
 * **「(LOT 무관)」·「(자사 소유)」는 빈 값이 아니라 확정된 뜻이다.** 대시나 「알 수 없음」으로
 * 두면 자료가 빠졌거나 값이 잘못됐다는 뜻이 되어 정반대로 읽힌다.
 *
 * **정렬 안내가 W-01-09와 반대다** — 그 화면은 「현재 쪽 안에서만」이고 이 화면은
 * 「전체 결과 기준」이다. 서버가 정렬해 쪽을 나눠 주기 때문이다.
 */
export const stockStatus = {
  title: '재고 현황·상태 조회',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '재고 잔액 목록',
    /*
     * **드로어도 창도 아닌 「아래 구획」이다**(계획 결정 2). 디자인 시스템에 드로어가 없고,
     * 창으로 대체하면 목록이 가려져 이 화면의 「고르고 돌아오는」 반복 조회가 매번 열고 닫는
     * 일이 된다.
     */
    detail: 'LOT 상세',
    /** 상세와 나란한 셋째 구획이다. 같은 LOT을 다른 질문(언제 얼마나 움직였나)으로 본다. */
    history: '수불 이력',
  },
  /** 보기 탭. 값은 주소 키 `view`와 같다. */
  views: {
    label: '보기',
    item: '품목별',
    lot: 'LOT별',
    location: '위치별',
  },
  fields: {
    warehouse: '창고',
    item: '품목',
    lot: 'LOT',
    location: '위치',
    qualityStatus: '품질 상태',
    inventoryStatus: '재고 상태',
    ownership: '소유 구분',
    includeZero: '잔액 0 포함',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 같은 조회를 다시 한다. 조건·보기·정렬·쪽·선택을 하나도 바꾸지 않는다. */
    refresh: '새로고침',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 접근 이름에 **LOT 이름**을 넣는다 — 「선택」이 행마다 되풀이되면 어느 줄인지 알 수 없다.
     * 내부 번호를 넣지 않는다(#44) — 이름을 못 풀면 표 칸과 같은 대체 표기가 들어간다.
     */
    selectRow: (lotName: string): string => `${lotName} 선택`,
    deselectRow: (lotName: string): string => `${lotName} 선택 해제`,
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    /*
     * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.** 문구도 그렇게 읽히게 쓴다 —
     * 「창고는 필수입니다」가 아니라 「창고를 고른 뒤 조회합니다」다.
     */
    warehouseRequired: '창고를 고른 뒤 조회합니다. 이 화면은 한 창고의 재고를 봅니다.',
    /*
     * LOT 이름을 풀 범위를 품목이 정한다 — 품목 없이 열면 LOT 칸이 거의 전부
     * 「알 수 없음」이 되어 정상 값이 잘못된 값으로 보인다.
     */
    lotViewNeedsItem: 'LOT별 보기는 품목을 고른 뒤에 열립니다. LOT 이름을 품목 범위에서 풉니다.',
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     */
    filterReferencesFailed:
      '창고·위치·품목·LOT 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    listReferencesFailed: '단위·소유처 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /*
     * **성능이 아니라 가능·불가능의 문제다.** 계약이 영업일 범위를 필수로 두어 기간 없이
     * 부르면 거부된다 — 「기간을 줄이면 빨라집니다」가 아니라 「기간 없이는 조회할 수
     * 없습니다」로 적는다. 그렇게 적지 않으면 사용자가 기간을 비운 채 기다린다.
     */
    historyNeedsPeriod:
      '영업일 시작과 종료를 모두 채운 뒤 조회합니다. 수불 이력은 기간 없이는 조회할 수 없습니다.',
    historyPeriodReversed: '영업일 종료가 시작보다 앞섭니다. 두 날짜의 순서를 바꾸세요.',
  },
  loading: {
    balances: '재고 잔액을 불러오는 중',
    lotDetail: 'LOT 상세를 불러오는 중',
    history: '수불 이력을 불러오는 중',
    transactionLines: '거래 라인을 불러오는 중',
  },
  /** 잔액 표의 머리글. 열 구성과 폭의 근거는 screens/stock-status/balance-table.tsx에 있다. */
  table: {
    item: '품목',
    lot: 'LOT',
    location: '위치',
    onHandQty: '보유',
    availableQty: '가용',
    blockedQty: '보류',
    uom: '단위',
    qualityStatus: '품질 상태',
    inventoryStatus: '재고 상태',
    ownership: '소유',
    lastTransactionAt: '최근 거래',
    /** LOT별 보기에만 있는 열. 다른 보기의 줄은 LOT을 가리키지 않아 고를 대상이 없다. */
    select: '상세',
  },
  /** 1단 그룹 헤더. 무엇으로 묶였는지 이름 앞에 밝힌다 — 이름만 있으면 축을 알 수 없다. */
  groupHeader: {
    item: (name: string): string => `품목: ${name}`,
    location: (name: string): string => `위치: ${name}`,
  },
  /**
   * 조건 줄. 상태·소유 구분 선택지는 조회 결과에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * ① 아직 확정되지 않은 **임시 목록**이라는 것 ② 이번 결과에 없는 값은 빠진다는 것.
   */
  filters: {
    all: '전체',
    codeNote:
      '아직 확정되지 않은 임시 목록입니다. 이번 조회 결과에 나온 값으로 만들어, 결과에 없는 값은 목록에 없습니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /* 위치·LOT 선택칸은 매달린 조건이 없으면 선택지가 비어 있다 — 그 사실을 밝힌다. */
    locationNeedsWarehouse: '창고를 고르면 위치 선택지가 채워집니다.',
    lotNeedsItem: '품목을 고르고 LOT별 보기로 바꾸면 LOT 선택지가 채워집니다.',
    chipWarehouse: (value: string): string => `창고: ${value}`,
    chipItem: (value: string): string => `품목: ${value}`,
    chipLot: (value: string): string => `LOT: ${value}`,
    chipLocation: (value: string): string => `위치: ${value}`,
    chipQualityStatus: (value: string): string => `품질 상태: ${value}`,
    chipInventoryStatus: (value: string): string => `재고 상태: ${value}`,
    chipOwnership: (value: string): string => `소유 구분: ${value}`,
    chipIncludeZero: '잔액 0 포함',
    chipRemoveWarehouse: '창고 조건 제거',
    chipRemoveItem: '품목 조건 제거',
    chipRemoveLot: 'LOT 조건 제거',
    chipRemoveLocation: '위치 조건 제거',
    chipRemoveQualityStatus: '품질 상태 조건 제거',
    chipRemoveInventoryStatus: '재고 상태 조건 제거',
    chipRemoveOwnership: '소유 구분 조건 제거',
    chipRemoveIncludeZero: '잔액 0 포함 해제',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/stock-status/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    /*
     * **조회하지 않은 것을 「없습니다」로 말하지 않는다.** 창고를 고르기 전에는 요청 자체가
     * 나가지 않는데, 그때 결과 없음을 내면 사용자가 자료가 없는 줄 알고 조건을 더 넓힌다 —
     * 무엇을 해도 결과가 같다. 사유는 조건 줄의 잠긴 버튼이 이미 밝힌다.
     */
    notQueriedTitle: '아직 조회하지 않았습니다',
    notQueriedDescription: '조건 줄에서 창고를 고른 뒤 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noResultTitle: '조건에 맞는 재고가 없습니다',
    noResultDescription: '조건을 줄이거나 「잔액 0 포함」을 켠 뒤 다시 조회하세요.',
    /* 목록이 계속 보이는 자리라 「무엇을 하면 채워지는가」만 말한다. */
    noSelectionTitle: '고른 LOT이 없습니다',
    noSelectionDescription: '위 표에서 LOT을 고르면 그 상태와 보류가 여기에 보입니다.',
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
    /*
     * **`null`이 뜻을 갖는 자리 둘.** 「알 수 없음」과 가른다 —
     * 품목별·위치별 보기에서 LOT이 비는 것은 정상이고, 소유처가 비는 것은 자사 소유라는 뜻이다.
     */
    noLot: '(LOT 무관)',
    ownedBySelf: '(자사 소유)',
    /*
     * 음수 보유를 **오류로 부르지 않는다** — 음수를 허용하는 품목인지 알 수 있는 필드가
     * 계약에 없다. 「음수」라는 사실만 말한다.
     */
    negativeOnHand: '음수 보유',
    /** 계약이 세어 준 값을 그대로 쓴다 — 화면이 보류 LOT을 따로 세지 않는다. */
    heldLotCount: (count: number): string => `보류 LOT ${String(count)}건`,
    /*
     * 미사용 참조에 붙이는 표식. **선택지에서 빼지 않는다** — 과거 재고가 미사용 창고·위치·
     * 품목을 참조할 수 있어, 빼면 그 재고를 조건으로 찾을 방법이 사라진다.
     * 표 칸에는 붙이지 않는다(`ReferenceState`가 사용 여부를 나르지 않는다 — 저장소 관례).
     */
    inactiveSuffix: ' (미사용)',
  },
  notes: {
    /*
     * **W-01-09와 반대다.** 그 화면은 쪽 안 정렬이라 「현재 쪽 안에서만」이고,
     * 이 화면은 서버 정렬이라 「전체 결과 기준」이다. 베껴 쓰면 사실과 어긋난다.
     *
     * 방향을 함께 밝힌다 — 계약의 `sort`가 열만 받고 방향을 받지 않아 한 방향뿐인데,
     * `aria-sort`는 「모름」을 표기할 수단이 없어 오름차순으로 적는다.
     */
    sortScope:
      '정렬은 서버가 전체 결과를 기준으로 합니다. 정렬 방향은 고를 수 없어 오름차순 한 방향입니다.',
    /* 밝히지 않으면 사용자가 「이 품목의 LOT은 이게 전부」로 읽는다 — 서버가 쪽을 나눠 준다. */
    groupScope: '그룹은 지금 보고 있는 쪽 안에서만 묶입니다. 다른 쪽의 행은 함께 묶이지 않습니다.',
  },
  /**
   * LOT 상세 구획 — 아래 구획이다(계획 결정 2). **조회만 한다** — 등록·수정·보류 해제 수단이
   * 하나도 없다. 그것은 품질 도메인 화면의 소관이다.
   */
  detail: {
    /*
     * **제목이 아니라 속성 묶음의 접근 이름이다.** 이 구획에는 이름·값 묶음이 둘 있고
     * (속성 · 수량) 보조기술이 둘을 가르는 근거가 이 이름이다 — 짝인 `quantities`와
     * 같은 자리에 있는 값이라 이름도 같은 결로 둔다.
     */
    attributes: (lotNo: string): string => `LOT ${lotNo}`,
    /*
     * **수량은 상세 조회가 아니라 고른 잔액 줄에서 온다.** 계약의 `Lot`은 만들어질 때의
     * 초기 수량만 갖는다. 그래서 「이 조건으로 조회한 줄의 수량」임을 밝힌다 —
     * 밝히지 않으면 사용자가 그 LOT의 전체 재고로 읽는다.
     */
    quantities: '지금 수량',
    quantitiesNote:
      '지금 걸린 조회 조건에 해당하는 줄의 수량입니다. 가용은 서버가 계산해 내려준 값입니다.',
    onHandQty: '보유',
    reservedQty: '예약',
    pickedQty: '피킹',
    blockedQty: '보류',
    availableQty: '가용',
    /** 수량 다섯이 모두 이 단위로 세어진다 — 줄마다 다르므로 수량 곁에 붙인다. */
    uom: '단위',
    lotType: 'LOT 유형',
    status: '상태',
    manufacturedAt: '제조 시각',
    expiryDate: '유효기한',
    initialQty: '초기 수량',
    remarks: '비고',
    /*
     * **표식일 뿐이다.** 기한이 지난 재고를 어떻게 할지가 아직 정해지지 않아
     * 자동으로 보류를 걸지 않는다(이슈 §4 미결 5). 임박 기준 일수도 미확정이라(미결 2)
     * 상수에서 받아 문구에 넣는다 — 문구에 숫자를 박으면 고칠 자리가 둘이 된다.
     */
    expiryPassed: '유효기한 경과',
    expirySoon: '유효기한 임박',
    expiryNote: (days: number): string =>
      `임박 기준은 ${String(days)}일이며 아직 확정되지 않았습니다. 기한이 지나도 보류가 자동으로 걸리지 않습니다.`,
    externalIdentifiers: '외부 식별자',
    identifierType: '식별자 유형',
    externalIdentifier: '식별자',
    issuedBy: '발급처',
    externalSystem: '외부 시스템',
    /* 발급처가 비어 있는 것이 정상이다 — 우리 쪽에서 붙인 번호다. */
    issuedBySelf: '(자체 부여)',
    noExternalIdentifiers: '등록된 외부 식별자가 없습니다.',
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.**
     * 이 구획이 이름을 내는 참조는 단위와 발급처(거래처) 둘이다.
     */
    referencesFailed: '단위·발급처 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    holds: {
      title: '해제되지 않은 보류',
      reason: '사유',
      status: '상태',
      holdQty: '보류 수량',
      uom: '단위',
      heldAt: '보류 시각',
      releaseCondition: '해제 조건',
      remarks: '비고',
      /* 계약이 「비어 있으면 전량 보류」로 정했다. 빈칸이나 0으로 두면 정반대로 읽힌다. */
      wholeLot: '전량 보류',
      emptyTitle: '해제되지 않은 보류가 없습니다',
      emptyDescription: '이 LOT에 걸린 보류가 없거나 모두 해제되었습니다.',
      /*
       * **경로 안내이지 링크가 아니다.** 의심자재 등록은 품질 도메인 화면의 소관이고
       * 그 화면이 아직 없어 링크를 만들면 죽은 링크가 된다(이슈 §6).
       */
      suspectMaterialPath:
        '의심자재 등록은 품질관리 > 의심자재 등록(W-03-03)에서 합니다. 이 화면은 조회만 합니다.',
    },
  },
  /**
   * 수불 이력 구획 — LOT 상세와 나란한 셋째 구획이다. 같은 LOT에 대한 다른 질문
   * (「언제 얼마나 움직였나」)을 답한다.
   *
   * **기간을 성능 문제로 말하지 않는다.** 계약이 영업일 범위를 필수로 두어 기간 없이는
   * 조회 자체가 불가능하다 — 「기간을 줄이면 빨라집니다」로 적으면 사용자가 비운 채 기다린다.
   *
   * **이 구획에는 선택칸이 없다**(계획 결정 14). 거래 유형·원천 전표 유형은 값 목록이
   * 확정되지 않아 자리표시가 비고, 「조회해야 선택지가 생긴다」는 순환이 된다.
   */
  history: {
    periodFrom: '영업일 시작',
    periodTo: '영업일 종료',
    /** 왜 기간이 필요한지와 기본값을 함께 밝힌다 — 둘 다 없으면 사용자가 빈 칸을 의심한다. */
    periodNote:
      '수불 원장은 영업일로 나뉘어 있어 기간이 있어야 조회할 수 있습니다. LOT을 고르면 최근 1개월이 채워집니다.',
    table: {
      businessDate: '영업일',
      transactionNo: '거래 번호',
      transactionType: '거래 유형',
      sourceDocumentType: '원천 전표',
      status: '상태',
      /** 단말에서 행위가 일어난 시각이다. 서버가 받은 시각과 벌어질 수 있다. */
      occurredAt: '발생 시각',
      /** 고르면 그 거래의 라인이 아래에 열린다. 「상세」가 아니라 무엇이 열리는지 적는다. */
      select: '라인',
    },
    /*
     * 취소가 행을 지우지 않고 **역처리 행을 더한다**(계약). 그 사실만 표식으로 밝히고
     * 대상 거래의 번호는 내지 않는다 — 이름을 풀 참조가 이 화면에 없다.
     */
    reversal: '역처리',
    showLines: '보기',
    hideLines: '닫기',
    /* 접근 이름에 **거래 번호**를 넣는다 — 「보기」가 줄마다 되풀이되면 어느 거래인지 모른다. */
    showLinesRow: (transactionNo: string): string => `${transactionNo} 라인 보기`,
    hideLinesRow: (transactionNo: string): string => `${transactionNo} 라인 닫기`,
    empty: {
      /* 기간을 채우기 전에는 요청이 나가지 않는다 — 그것을 「없습니다」로 말하지 않는다. */
      notQueriedTitle: '아직 조회하지 않았습니다',
      notQueriedDescription: '영업일 범위를 채운 뒤 조회하세요.',
      beyondLastTitle: '이 쪽에는 이력이 없습니다',
      beyondLastDescription: '첫 쪽으로 이동하세요.',
      noResultTitle: '이 기간에 움직인 기록이 없습니다',
      noResultDescription: '영업일 범위를 넓힌 뒤 다시 조회하세요.',
      noSelectionTitle: '고른 거래가 없습니다',
      noSelectionDescription: '위 표에서 거래를 고르면 그 거래의 라인이 여기에 보입니다.',
    },
    lines: {
      title: '거래 라인',
      item: '품목',
      lot: 'LOT',
      qty: '수량',
      uom: '단위',
      fromWarehouse: '출발 창고',
      fromLocation: '출발 위치',
      toWarehouse: '도착 창고',
      toLocation: '도착 위치',
      /*
       * **위치 이름은 조건 줄에서 고른 창고의 것만 풀 수 있다** — 계약이 위치 목록을
       * 창고별로만 내려 준다. 다른 창고의 위치를 「알 수 없음」으로 적으면 *값이 잘못됐다*는
       * 뜻이 되어 정반대로 읽히므로(#47), 풀 수 없는 이유를 그대로 적는다.
       */
      otherWarehouseLocation: '(다른 창고의 위치)',
      scopeNote:
        '위치 이름은 조건 줄에서 고른 창고의 것만 풀립니다. 다른 창고로 오간 라인은 위치 이름 대신 그 사실을 적습니다.',
      emptyTitle: '이 거래에 라인이 없습니다',
      /** 문구가 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다. */
      referencesFailed:
        '품목·LOT·창고·위치·단위 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    },
  },
  /** 조회 시점 스냅샷임을 밝힌다 — 집계는 언제나 이미 과거다. */
  asOf: (at: string): string => `기준 ${at}`,
} as const;
