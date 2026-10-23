/**
 * M-01-01 입하 등록 — 공급사 도착을 기록한다. 자재 입하 흐름의 첫 화면이다.
 *
 * 한 번의 등록이 입하와 라인과 자재 LOT 을 함께 만든다. 화면이 셋으로 나눠 보내지 않는다.
 *
 * 예정과 실입하가 어긋나면 화면이 판정하고 그 결과를 먼저 보인다 - 조용히 넘기면 왜 다른
 * 화면에 왔는지 알 수 없다.
 */
export const inboundReceipt = {
  title: '입하 등록',
  /** 전송 실패한 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '입하 등록',
  scan: {
    legend: '자재 LOT 스캔',
    /* 구획 제목과 같은 말을 쓰지 않는다. 좁은 화면에 같은 줄이 둘로 붙는다. */
    label: 'LOT 번호',
    placeholder: '자재 LOT 라벨을 스캔하세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    /** 읽은 값을 함께 보인다. 스캐너 설정에 따라 구분자 `|` 가 다른 글자로 들어온다. */
    malformed: (read: string) =>
      `자재 LOT 번호 형식이 아닙니다(제품코드|수량|날짜|공급사|번호). 읽은 값: ${read}`,
    /** 이 공장에 이미 있는 LOT 의 라벨. 받으면 전송 뒤 서버가 거부한다(omf-all-around#28). */
    registered: (read: string) => `이미 등록된 LOT입니다. 읽은 값: ${read}`,
    scanned: (lotNo: string) => `공급사 LOT ${lotNo}`,
    externalEntry: '납품서의 공급사 LOT 번호 입력',
    externalLabel: '공급사 LOT 번호',
    externalPlaceholder: '납품서 원문을 그대로 입력하세요',
    externalSubmit: '공급사 LOT 번호 넣기',
    externalRequired: '공급사 LOT 번호를 입력하세요',
    externalTooLong: (max: number, actual: number) =>
      `공급사 LOT 번호는 ${String(max)}자 이하여야 합니다 (현재 ${String(actual)}자)`,
    externalTaken: (lotNo: string) => `라벨 미부착 · 공급사 LOT ${lotNo}`,
    missing: 'LOT 번호 없음',
    missingChosen: '공급사 LOT 번호가 없습니다.',
    reasonLabel: '대체 LOT 사유',
    reasonPlaceholder: '사유를 고르세요',
    reasonLoadFailed: '대체 LOT 사유를 불러오지 못했습니다',
    /** 스캔 구역의 지시. 단계 제목이 「라벨을 스캔하세요」라 여기서는 손이 할 일을 말한다. */
    prompt: '스캐너 단추를 누르세요',
    /** 라벨을 받은 뒤의 대기 줄. */
    standby: '다른 라벨이면 다시 스캔',
    /** 라벨이 없을 때의 두 길 위에 서는 이름. */
    noLabel: '라벨이 없나요?',
  },
  /** 스캔한 라벨의 제품코드와 이 건의 품목을 견준 결과. 다르면 서버가 거부할 라벨이다. */
  label: {
    otherItem: '스캔한 라벨의 제품코드가 이 건의 품목과 다릅니다',
    rescan: '다른 자재의 라벨입니다. 라벨을 다시 스캔하거나 자재 P/O 를 다시 고르세요.',
    checking: '라벨의 제품코드를 확인하는 중입니다',
    /* 연결이 없으면 확인하지 못한다. 막지는 않는다 - 서버가 등록할 때 같은 대조를 한다. */
    unverified: '라벨의 제품코드를 확인하지 못했습니다. 다르면 전송할 때 되돌아옵니다.',
  },
  /**
   * 라벨이 없을 때(LOT 번호 없음) 받을 것을 고르는 길. 라벨 제품코드로 좁힐 수 없어 자재 P/O 번호를
   * 늘어놓으면 무엇이 무엇인지 모른다 - 입고 예정을 공급사 · 자재 P/O · 발주일 · 입고예정일 표로
   * 보이고 공급사명 · 기간으로 거른다. 행을 누르면 그 자재 P/O 의 품목 표로 간다(사용자 지시 2026-10-21).
   */
  lotless: {
    orders: '입고 예정',
    /** 공급사 이름을 받지 못했을 때. 번호라도 보여야 고를 수 있다. */
    supplierUnknown: (id: number) => `공급사 #${String(id)}`,
    /** 표의 컬럼 머리. */
    columns: {
      supplier: '공급사',
      /** 입고 예정 표의 첫 칸(사용자 지시 2026-10-22). */
      order: 'P/O No.',
      /** 입고예정일을 「납기예정일」로 부른다(사용자 지시 2026-10-22). 발주일 칸은 뺐다. */
      expectedDate: '납기예정일',
      expectedDateFull: '납기예정일',
      /** 품목 표의 품목 칸 - 품목명 아래 품목코드를 함께 적는다(사용자 지시 2026-10-22). */
      item: '품목',
      /** 품목 표의 행 번호 칸. */
      no: 'No.',
      qty: '수량',
      /** 품목 표의 수량 칸 - 이미 받은 수량/발주 수량. */
      receivedOfOrdered: '입고/발주 수량',
      /** 칸 경계 손잡이의 접근명 - 끌어서 그 칸 폭을 바꾼다. */
      resize: (column: string) => `${column} 칸 폭`,
    },
    orderCount: (count: number) => `입하 예정 ${String(count)}건`,
    /** 입고 예정 행의 접근명. 화면은 칸으로 나눠 보이지만 낭독기는 한 번에 읽는다. */
    orderRow: (orderNo: string, supplier: string, expected: string) =>
      `${orderNo} · ${supplier} · 납기예정일 ${expected}`,
    filter: {
      open: '필터',
      /** 접혀 있어도 걸러진 줄 안다. */
      openActive: (count: number) => `필터 ${String(count)}`,
      supplierName: '공급사명',
      supplierNamePlaceholder: '공급사명 입력',
      /** 입하가 끝난 자재 P/O 만 보는 켜고 끄기. */
      doneOnly: '입하 완료 건만',
      period: '기간',
      basis: '기간 기준',
      basisExpected: '납기예정일',
      basisOrdered: '발주일',
      periodAll: '전체 기간',
      clear: '필터 지우기',
      none: '조건에 맞는 입고 예정이 없습니다',
    },
    /** 품목 표 위에 보고 있는 구매 발주를 적는 이름표. */
    info: { supplier: '공급사', order: '발주번호', itemName: '품목명', itemCode: '품목코드' },
    /** 품목 표의 거르기 - 품목 찾기를 「필터」 단추로 접고 편다. */
    itemFilter: {
      open: '필터',
      openActive: (count: number) => `필터 ${String(count)}`,
    },
    items: '받을 품목',
    itemRow: (name: string, code: string, qty: string) => `${name} · ${code} · ${qty}`,
    count: (count: number) => `품목 ${String(count)}건`,
    /** 다 받은 라인을 거르는 단추. */
    openOnly: '받을 것만',
    /**
     * 일부만 받고 남은 라인(사용자 지시 2026-10-22) - 「필터」 안에서 이것만 보고, 「모두 선택」은
     * 이것을 빼고 고른다. 남은 수량을 그대로 넣으면 부분 입하가 무색해진다.
     */
    partialOnly: '부분 입하만',
    partialTag: '부분 입하',
    noPartial: '부분 입하된 품목이 없습니다',
    /** 다 받은 행. 초록 바탕이라 눈으로는 보이고, 낭독기에는 이 말로 알린다. */
    closed: '입하 완료',
    /**
     * 체크해 한꺼번에 등록하기. 거의 다 문제없이 들어오므로 이상 없는 품목은 남은 수량 그대로
     * 한 번에 등록하고, 문제가 있는 품목만 따로 처리한다(사용자 지시 2026-10-21).
     */
    bulk: {
      selectAll: '모두 선택',
      selectRow: (name: string) => `${name} 선택`,
      /** 고정 글자 - 체크한 수는 표 위 checkedCount 가 말한다(사용자 지시 2026-10-22). */
      submit: '체크한 품목 입하 등록',
      checkedCount: (count: number) => `(선택 ${String(count)}건)`,
      /** 「모두 선택」이 뺀 부분 입하 품목. 하나씩 체크하면 넣을 수 있다. */
      partialSkipped: (count: number) => `부분 입하 ${String(count)}건은 빼고 선택했습니다`,
      prompt: '체크한 품목은 남은 수량 그대로 등록합니다',
      noneChecked: '등록할 품목을 체크하세요',
      done: {
        sent: (count: number) => `${String(count)}건을 입하 등록했습니다`,
        queued: (count: number) => `${String(count)}건을 담았습니다. 연결되면 보냅니다`,
        rejected: (count: number) =>
          `${String(count)}건 등록이 되돌아왔습니다. 전송 실패 목록을 확인하세요`,
        failed: (count: number) => `${String(count)}건을 담지 못했습니다. 다시 누르세요`,
      },
    },
    searchLabel: '품목 찾기',
    searchPlaceholder: '품목명 또는 품목코드',
    noMatch: (query: string) => `「${query}」에 맞는 품목이 없습니다`,
    /** 품목이 다 받은 것뿐일 때(「받을 것만」으로 거르면 표가 빈다). */
    none: '입하 처리가 모두 완료된 건입니다',
    /** 자재 P/O 에 품목 라인이 아예 없을 때. */
    empty: '이 자재 P/O에 품목이 없습니다',
  },
  po: {
    legend: '자재 P/O 선택',
    selectLabel: '자재 P/O 번호',
    /** 발주 카드의 둘째 줄. 같은 공급사의 발주가 여럿이면 날짜로 가른다. */
    orderDate: (date: string) => `발주일 ${date}`,
    loading: '미마감 자재 P/O를 불러오는 중입니다',
    loadFailed: '자재 P/O를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '미마감 자재 P/O가 없습니다',
    /** 번호만으로는 어느 발주 물품인지 확정되지 않는다. 담당자가 고른다. */
    pickNote: '스캔한 번호만으로는 자재 P/O가 정해지지 않습니다. 담당자가 고릅니다.',
    /** 번호에서 품목을 찾아 좁혔다. 좁힌 것이 틀릴 수 있어 넓힐 길을 함께 둔다. */
    narrowedNote: '스캔한 자재의 품목이 있는 자재 P/O만 보입니다.',
    showAll: '전체 자재 P/O 보기',
    /** 라벨 제품코드로 품목을 찾는 동안에는 목록을 내지 않는다 — 그 사이 전체 목록이 보이면 무관한 발주를 고른다. */
    itemChecking: '스캔한 자재의 품목을 확인하는 중입니다',
    itemCheckFailed:
      '스캔한 자재의 품목을 확인하지 못해 전체 자재 P/O를 보입니다. 라벨과 같은 품목의 발주를 고르세요.',
    /** 품목 목록에 없는 제품코드면 어느 발주에도 맞지 않는다. 전체 목록으로 넘기지 않는다. */
    itemNotFound: (code: string) => `등록된 품목 중에 ${code}가 없습니다. 라벨을 다시 확인하세요.`,
    /** 그 품목의 미마감 발주가 없다. 다른 품목의 발주는 라벨과 맞지 않아 내지 않는다. */
    noneForItem: (code: string) =>
      `${code} 품목의 미마감 자재 P/O가 없습니다. 발주 없이 들어온 물건이면 「자재 P/O 없이 등록」으로 진행하세요.`,
    linesLoading: '자재 P/O 라인을 불러오는 중입니다',
    linesLoadFailed: '자재 P/O 라인을 확인할 수 없습니다',
    linesNone: '이 자재 P/O에 라인이 없습니다',
    /* ⭐ 코드와 이름을 «각자의 줄»에 적는다(사용자 지시 2026-09-19) — 붙여 두면 어디까지가
       코드인지 매번 가려 읽어야 하고, 실물 라벨과 대조하는 것은 코드 쪽이다. */
    lineItemCode: (code: string) => `품목코드 ${code}`,
    lineItemName: (name: string) => `품목명 ${name}`,
    lineOrdered: (qty: string, uom: string) => `발주량 ${qty} ${uom}`,
    /*
     * 품목과 단위는 다른 조회에서 온다. 못 찾았을 때 빈 글자를 끼우면 이름도 단위도 없이
     * 수량만 남아, 작업자가 무엇을 세는지 모르는 채 적는다. 없는 것은 없다고 적는다.
     */
    itemUnknown: '품목 정보 없음',
    uomUnknown: '단위 없음',
    received: (qty: string) => `누적 입하 ${qty}`,
    /**
     * 판정이 견주는 수다. 발주량만 보이면 그 수에 맞춰 적고 초과 판정을 받는다.
     *
     * ⚠ **발주량과 같으면 화면이 이 줄을 세우지 않는다**(사용자 지시 2026-09-19) — 같은 수를
     *   두 번 말할 뿐이고, 그때는 발주량대로 적는 것이 맞다.
     */
    lineRemaining: (qty: string) => `잔여 수량 ${qty}`,
    lineClosed: '다 받았습니다',
    tolerance: (over: string, under: string) => `허용 +${over} / -${under}`,
    linePicked: '선택됨',
    clear: '자재 P/O 선택 지우기',
  },
  exception: {
    /** 발주가 없으면 공급사도 품목도 단위도 승계할 곳이 없어 담당자가 고른다. */
    legend: '자재 P/O 없이 도착',
    open: '자재 P/O 없이 등록',
    openNote: '자재 P/O가 없으면 공급사와 품목과 단위를 직접 고릅니다.',
    close: '자재 P/O 고르기로 되돌리기',
    supplierLabel: '공급사',
    supplierPlaceholder: '공급사를 고르세요',
    supplierLoading: '공급사를 불러오는 중입니다',
    supplierLoadFailed: '공급사를 확인할 수 없습니다',
    supplierNone: '고를 공급사가 없습니다',
    itemLabel: '품목',
    itemNone: '고른 품목이 없습니다',
    itemPick: '품목 찾기',
    itemChange: '품목 변경하기',
    /** 품목 마스터의 주인은 ERP 다. 이 화면이 품목을 만들 길은 계약에 없다. */
    itemUnregistered: '목록에 없는 품목은 여기서 만들 수 없습니다',
    itemUnregisteredWhy: 'ERP에 품목이 만들어진 뒤에 고를 수 있습니다.',
    uomLabel: '단위',
    uomPlaceholder: '단위를 고르세요',
    uomLoadFailed: '단위를 확인할 수 없습니다',
    typeLabel: '예외입하 유형',
    typePlaceholder: '예외 유형을 고르세요',
    typeLoadFailed: '예외입하 유형을 불러오지 못했습니다',
    reasonLabel: '예외 사유',
    /** 예정 수량이 없으므로 견줄 것이 없다. 판정하지 않는다는 사실을 말한다. */
    noVerdict: '자재 P/O가 없어 예정 수량과 비교하지 않습니다',
    /** 공장은 단말 토큰이 싣고 온다. 없으면 지어내지 않고 막는다. */
    noPlant: '이 기기의 공장을 확인할 수 없어 등록할 수 없습니다',
  },
  /** 품목 마스터가 커서 한 화면에 늘어놓을 수 없다. 찾아서 고르는 자리를 따로 둔다. */
  itemPicker: {
    title: '품목 고르기',
    searchLabel: '품목 검색',
    searchPlaceholder: '품목코드나 품목명을 적으세요',
    more: (rest: string) => `더보기 (+${rest})`,
    loading: '품목을 찾는 중입니다',
    empty: '찾은 품목이 없습니다',
    failed: '품목을 찾지 못했습니다. 연결을 확인하세요.',
    cancel: '고르지 않고 돌아가기',
    toTop: '맨 위로',
  },
  note: {
    legend: '거래명세서',
    label: '명세서 번호',
    vehicle: '차량번호',
    /** 촬영과 문자 인식은 이번 범위 밖이다. 없는 것을 있는 것처럼 두지 않는다. */
    photoAbsent: '명세서 촬영은 아직 없습니다. 번호만 적습니다.',
    /** 없어도 등록을 막지 않는다. 명세서는 별도 경로로 붙는다. */
    absent: '명세서 번호가 없습니다. 등록은 진행됩니다.',
  },
  qty: {
    legend: '품목·수량 확인',
    itemLoadFailed: '품목을 확인할 수 없습니다',
    /*
     * 발주량과 잔여 수량을 같은 말로 부르지 않는다. 판정이 견주는 것은 잔여 수량인데 총량까지
     * 같은 이름으로 부르면 칸 옆의 수와 판정에 나오는 수가 다른 뜻의 같은 이름이 된다.
     */
    itemCode: (code: string) => `품목코드 ${code}`,
    itemName: (name: string) => `품목명 ${name}`,
    ordered: (qty: string, uom: string) => `발주량 ${qty} ${uom}`,
    remaining: (qty: string, uom: string) => `잔여 수량 ${qty} ${uom}`,
    received: '실입하 수량',
    packageCount: '포장 수',
    /** 수량 판의 숫자판 단추. */
    pad: '숫자판 열기',
    /**
     * 접어 둔 선택 입력. 대부분의 입하는 비워 둔 채 등록하므로 펼쳐 두면 수량 단계가 한 화면을
     * 넘는다. 값이 있거나 숫자판이 그리로 옮겨 가면 저절로 펼친다.
     */
    extras: '포장 수 · 제조일 · 유효기한',
    /** 수량 판 안의 펼침 단추. 판 안이라 짧게 쓰고, 무엇이 들었는지는 펼친 칸이 말한다. */
    extrasShort: '추가 정보',
    /** 판 머리 뱃지 - 이번 것까지 받고 남는 수. 넘치면 넘친 수. */
    leftChip: (qty: string, uom: string) => `잔량 ${qty} ${uom}`,
    overChip: (qty: string, uom: string) => `초과 ${qty} ${uom}`,
    manufactured: '제조일',
    expiry: '유효기한',
    empty: '실입하 수량을 적으세요',
    notNumber: '실입하 수량은 숫자로 적으세요',
    notPositive: '실입하 수량은 0보다 커야 합니다',
    packageNotPositive: '포장 수는 0보다 커야 합니다',
    expiryBeforeManufactured: '유효기한이 제조일보다 앞설 수 없습니다',
  },
  verdict: {
    normal: '잔여 수량과 맞습니다',
    /** 판정 결과를 먼저 보인 뒤 같은 화면의 분리 단계로 이어 간다. */
    over: (remaining: string, arrived: string) =>
      `수량 초과 — 잔여 수량 ${remaining}, 이번 도착 ${arrived}`,
    overNext: '정량분과 초과분을 확인하고 이번 화면에서 등록 방식을 고르세요.',
    split: {
      legend: '초과 입하 분리',
      remaining: '잔여 수량',
      normal: '정량분',
      excess: '초과분',
      /**
       * 초과분 나눠 등록(장부 P-100 · 사용자 결정 2026-10-22). 입하 한 건 · LOT 한 개로 받고,
       * 초과분만 자재 P/O 에 넣지 않고 초과분 목록에 남긴다 - ERP 가 추가 P/O 를 만들면 그 라인에
       * 잇는다. 예외 유형 · 사유는 받지 않는다.
       */
      keepExcess: '초과분 나눠 등록',
      normalOnly: '정량분만 등록',
      /** 정량분이 0 이면(받을 것이 남지 않은 라인) 나눌 것이 없다. */
      noRoom: '이 라인은 받을 수량이 남지 않았습니다. 자재 P/O 없이 등록하세요.',
      kept: '초과분은 자재 P/O에 넣지 않고 초과분 목록에 남깁니다.',
    },
    under: (remaining: string, arrived: string) =>
      `수량 부족 — 잔여 수량 ${remaining}, 이번 도착 ${arrived}`,
    /*
     * 화면은 더 올 것인지 알지 못한다. 트럭과 거래명세서를 본 사람이 안다. 네 수를 보이고
     * 사람이 고르게 한다 - 수 없이 고르라 하면 무엇을 고르는지 모른다.
     */
    counts: {
      ordered: '발주',
      received: '누적',
      arrived: '이번 도착',
      /* 판정이 견주는 잔여 수량이 아니라 이번 것까지 받고도 남는 몫이다. */
      remaining: '남은',
    },
    /**
     * 부족일 때 바닥 바 위의 두 수(이번 도착 · 남은)를 묶는 이름. 수량 부족(더 오지 않음)은 입하
     * 오류 등록 메뉴에서 따로 처리한다(사용자 지시 2026-10-22) - 이 화면은 부분 입하 한 길이다.
     */
    underCounts: '부분 입하 수량',
    /**
     * 임시 입고가 아니다. 평범한 입하 등록이고 발주는 열린 채 남는다. 누르면 곧바로 등록한다 —
     * 「계속」만으로는 누른 뒤 무엇이 되는지 알 수 없었다.
     */
    underContinue: '부분 입하 등록',
    underContinueNote: '부분 입하로 그대로 등록합니다. 자재 P/O는 열린 채 남습니다.',
    /**
     * 부족을 부분 입하로 받을 때 고르는 사유(사용자 지시 2026-10-22). 자주 나는 셋과 기타 - 기타만
     * 직접 적는다. 고른 이름(기타면 적은 글)이 헤더 비고(remarks)로 간다.
     */
    partialReasonLabel: '부분 입하 사유',
    partialReasonPlaceholder: '사유를 고르세요',
    partialReasons: {
      SPLIT_SHIPMENT: '공급사 분할 납품',
      SUPPLIER_SHORTAGE: '공급사 재고 부족',
      IN_TRANSIT: '운송 중 일부 미도착',
      OTHER: '기타 (직접 입력)',
    },
    partialReasonOther: '기타 사유',
    /**
     * 라벨 없이 한 품목을 부분 입하한 뒤 - 결과 화면으로 가지 않고 부분 입하 화면에 남아 알린다
     * (사용자 지시 2026-10-22). 남은 것을 이어 받거나 앱바로 발주 상세 목록에 돌아간다.
     */
    partialDone: {
      sent: (qty: string) => `부분 입하 ${qty}를 등록했습니다`,
      queued: (qty: string) => `부분 입하 ${qty}를 담았습니다. 연결되면 보냅니다`,
    },
    /** 부분 입하 화면에서 이미 받은 수 - 따로 눈에 띄게(사용자 지시 2026-10-22). */
    receivedSoFar: '기입하 수량',
    partialReasonOtherPlaceholder: '기타 사유 입력',
  },
  /** 검사 대상 여부는 서버가 라인마다 정한다. 화면이 보내지 않는다. */
  inspectionNote: '검사 대상 여부는 등록한 뒤에 라인마다 정해집니다',
  submit: '입하 등록',
  /**
   * 잠긴 등록 단추가 «왜» 잠겼는지 — 단추 바로 아래 한 줄로 선다(공유계약 G-1).
   *
   * ⭐ 위에서부터 처음 비어 있는 것 하나만 말한다. 다 늘어놓으면 무엇부터 할지가 흐려진다.
   * ⛔ 작업자가 확인할 길이 없는 것을 확인하라 하지 않는다 — 그때는 관리자에게 문의하게 한다.
   */
  locked: {
    loading: '담아 둔 기록을 읽는 중입니다. 잠시 뒤에 눌러 주세요.',
    noWorker: '사번을 확인해야 등록할 수 있습니다',
    noOrder: '자재 P/O를 먼저 고르세요',
    noOrderLine: '자재 P/O 라인을 먼저 고르세요',
    noSupplier: '공급사를 먼저 고르세요',
    noItem: '품목을 먼저 고르세요',
    noUom: '단위를 먼저 고르세요',
    noExceptionType: '예외입하 유형을 먼저 고르세요',
    noExceptionReason: '예외 사유를 먼저 적으세요',
    /* 공장은 발주에서 승계하거나 기기가 싣고 온다. 작업자가 이 화면에서 고칠 수 없다. */
    noPlant: '이 입하의 공장을 확인할 수 없습니다. 관리자에게 문의하세요.',
    qtyEmpty: '실입하 수량을 먼저 적으세요',
    qtyNotNumber: '실입하 수량을 숫자로 고치세요',
    qtyNotPositive: '실입하 수량을 0보다 크게 고치세요',
    packageCount: '포장 수를 0보다 크게 고치세요',
    expiryBeforeManufactured: '유효기한을 제조일 뒤로 고치세요',
    labelChecking: '라벨 확인이 끝나면 등록할 수 있습니다',
    labelMismatch: '라벨의 품목과 맞는 자재 P/O를 고르세요',
    underUnanswered: '더 들어올 물량이 있는지 먼저 고르세요',
    noSubstituteReason: '대체 LOT 사유를 먼저 고르세요',
    noPartialReason: '부분 입하 사유를 먼저 고르세요',
    noPartialReasonText: '기타 사유를 먼저 적으세요',
  },
  /**
   * 방금 등록한 한 건을 되짚는 자리 — 「등록했습니다」 아래에 선다(현장 요청 2026-09-21).
   *
   * ⭐ 같은 자재 P/O 의 자재를 여러 번 넣을 때, 앞 자재를 무엇으로 얼마나 넣었는지 확인할
   *    곳이 화면에 없었다. 적은 값을 그대로 다시 보인다.
   */
  recorded: {
    legend: '등록한 내용',
    purchaseOrder: '자재 P/O',
    line: (lineNo: string) => `${lineNo}번 라인`,
    item: '품목',
    qty: '실입하 수량',
    /* 초과 분리는 두 몫으로 나뉘어 나간다. 합만 보이면 어느 쪽이 얼마인지 알 수 없다. */
    normalQty: '정량분',
    excessQty: '초과분',
    packageCount: '포장 수',
    lotNo: '공급사 LOT',
    lotMissing: '라벨 미부착',
    manufactured: '제조일',
    expiry: '유효기한',
    none: '없음',
  },
  sent: {
    title: '입하를 등록했습니다',
    description: '사전부착 라인의 자재 LOT도 함께 만들어졌습니다. 모두 보류 상태입니다.',
  },
  queued: {
    title: '입하를 전송 대기에 넣었습니다',
    description: '연결되면 보냅니다. 아직 보내지 않았습니다.',
  },
  rejected: {
    title: '입하를 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하세요. ',
    action: '전송 실패한 기록 보기',
  },
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 등록되지 않았다고 말한다. */
  saveFailed: {
    title: '입하를 저장하지 못했습니다',
    description: '등록되지 않았습니다. 다시 시도하세요.',
  },
  noWorker: '사번을 먼저 확인하세요',
  another: '다음 입하',
  /** 단계마다 지시 하나. 동사로 끝난다 — 무엇을 할지가 제목이다. */
  steps: {
    scan: '자재 LOT 라벨을 스캔하세요',
    line: '자재 P/O 라인을 고르세요',
    /** 라벨이 없을 때(LOT 번호 없음) 같은 단계의 두 화면 - 입고 예정 목록과 그 자재 P/O 의 품목 목록. */
    lotlessOrder: '구매 발주 목록',
    lotlessItem: '발주 상세 목록',
    /** 라벨 없이 고르는 두 화면의 번호 - 단계 2 안의 첫째 · 둘째. */
    lotlessOrderBadge: '2-1',
    lotlessItemBadge: '2-2',
    unordered: '발주 없이 받을 품목과 수량을 적으세요',
    /* 칸 이름(「실입하 수량」)과 겹치지 않게 짧게 쓴다 — 겹치면 낭독기가 두 자리를 같은 이름으로 읽는다. */
    qty: '수량 확인',
    /** 라벨 없이 2-2 에서 품목을 눌러 오는 셋째 화면 - 남은 수량을 다 받는 것은 2-2 의 체크가 한다. */
    lotlessQty: '부분 입하 등록',
  },
  /** 작업 헤더 — 처리 중인 값. 이름은 낭독기에만 준다. */
  header: {
    item: '품목 코드',
    itemName: '품목명',
    purchaseOrder: '자재 P/O',
    lot: '공급사 LOT',
    tolerance: '허용',
    lineOf: (purchaseOrderNo: string, lineNo: string) => `${purchaseOrderNo} · ${lineNo}번 라인`,
  },
  /** 고를 것이 하나뿐이라 알아서 골랐다는 것. 조용히 건너뛰면 무엇을 골랐는지 모른다. */
  auto: {
    picked: (purchaseOrderNo: string, lineNo: string) =>
      `${purchaseOrderNo} · ${lineNo}번 라인을 골랐습니다`,
  },
  /** 결과 화면에서 다음 라벨을 읽으면 그 자리에서 다음 입하가 시작된다. */
  nextScanPrompt: '다음 라벨을 스캔하세요',
} as const;
