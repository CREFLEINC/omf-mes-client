/**
 * M-04-04 제품입고·적치 — 생산·외주에서 넘어온 제품 LOT 이 완제품 재고로 선다.
 *
 * 제품 LOT 을 만드는 것은 생산이고 여기는 인수와 위치 확정이다. 이 화면이 인수를 거부하면
 * 그 LOT 은 출하 흐름에 들어오지 않는다.
 */
export const productReceipt = {
  title: '제품 입고·적치',
  /** 전송 실패한 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    received: '제품 입고',
    putaway: '제품 적치',
  },
  warehouse: {
    legend: '완제품 창고 고르기',
    loading: '창고를 찾는 중입니다',
    loadFailed: '창고를 불러오지 못했습니다. 연결을 확인하세요.',
    pick: '입고 창고',
    pickPlaceholder: '창고를 고르세요',
    /** 인식표가 든 창고는 지금 있는 자리다. 들어갈 창고는 사람이 정한다. */
    hint: '물건이 들어갈 창고입니다. 인식표가 지금 있는 위치와 다를 수 있습니다.',
  },
  /** 생산 포장을 없애 제품은 생산 LOT 라벨로 들어온다. 이미 만든 인식표(상자)도 받는다(omf-all-around#293). */
  unit: {
    legend: 'LOT 라벨 스캔',
    scanLabel: '생산 LOT 라벨 또는 인식표 스캔',
    scanPlaceholder: '생산 LOT 라벨이나 인식표 QR을 스캔하세요',
    manualLabel: 'LOT·인식표 직접 입력',
    manualSubmit: 'LOT·인식표 넣기',
    loading: 'LOT·인식표를 찾는 중입니다',
    loadFailed: '인식표를 불러오지 못했습니다. 연결을 확인하세요.',
    lotLoadFailed: 'LOT을 불러오지 못했습니다. 연결을 확인하세요.',
    notFound: (no: string) => `${no} 에 맞는 LOT·인식표를 찾지 못했습니다`,
    /** 받지 않는 생산 LOT 라벨 — 까닭을 사람의 말로. */
    lotRefused: {
      /** 피처 016 공정 반제품(시안 2판 ⑤). 둘째 줄은 `semiFinishedHint`. */
      semiFinished: (_lotNo: string) => '반제품 LOT 은 제품 입고할 수 없습니다',
      notProduct: (lotNo: string) => `${lotNo} 은(는) 제품 LOT이 아닙니다`,
      voided: (lotNo: string) => `${lotNo} 은(는) 폐번된 LOT입니다`,
      noGood: (lotNo: string) => `${lotNo} 은(는) 양품 실적이 없습니다`,
      stocked: (lotNo: string) => `${lotNo} 은(는) 이미 입고한 LOT입니다`,
    },
    /** 반제품 거절 카드의 둘째 줄 — 할 일을 말한다(시안 2판 ⑤). 공정을 모르면 순번 없이. */
    semiFinishedHint: (lotNo: string, operationSeq: number | null) =>
      `${lotNo}${operationSeq === null ? '' : ` · 공정 ${String(operationSeq)}`} 반제품 — 다음 공정에서 POP 자재 투입으로 투입하세요.`, // ui-check-ignore: C-13 승인 시안 2판 표기(016 screens/M-04-04)
    picked: (no: string) => `인식표 ${no}`,
    empty: '이 인식표에는 담긴 물건이 없습니다',
  },
  contents: {
    legend: '인수 대상',
    loading: '담긴 물건을 불러오는 중입니다',
    loadFailed: '담긴 물건을 불러오지 못했습니다. 연결을 확인하세요.',
    name: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    qtyLabel: (name: string) => `${name} 실물 수량`,
    /* 구성 줄을 차례로 적는다. 숫자판을 닫았다 다시 열지 않고 옆으로 옮긴다. */
    previousLine: '앞 라인',
    nextLine: '다음 라인',
    expected: (qty: string) => `인식표 수량 ${qty}`,
    expectedGood: (qty: string) => `양품 실적 ${qty}`,
    manufactured: (at: string) => `제조 ${at}`,
    expiry: (date: string) => `유효기간 ${date}`,
    /* 실물대로 받는다. 사유를 담을 자리가 계약에 없어 지어내지 않는다. */
    differs: '인식표 수량과 다릅니다. 실물대로 받습니다.',
    differsGood: '양품 실적과 다릅니다. 실물대로 받습니다.',
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      negative: '수량은 0보다 작을 수 없습니다',
      zero: '입고 수량은 0보다 커야 합니다',
    },
  },
  /** 입고는 막지 않는다. 막히는 것은 하류의 피킹·출하다. */
  notReleased: '이 LOT 은 아직 검사 대기입니다. 입고는 되지만 피킹·출하는 막힙니다.',
  /** 판정에 쓰는 값이라 캐시하지 않는다. 오프라인에서는 물어볼 수 없다. */
  releaseUnknown: '오프라인입니다. 검사 상태를 확인할 수 없습니다.',
  location: {
    legend: '적치 위치',
    scanLabel: '위치 스캔',
    scanPlaceholder: '위치 QR을 스캔하세요',
    manualLabel: '위치 직접 입력',
    manualSubmit: '위치 넣기',
    loading: '위치를 찾는 중입니다',
    notFound: (code: string) => `${code} 위치를 찾지 못했습니다`,
    picked: (code: string) => `위치 ${code}`,
    /** 위치를 나누지 않은 창고는 「창고 전체」 하나로 들어간다. */
    unmanaged: '이 창고는 위치를 나누지 않았습니다. 창고 전체로 들어갑니다.',
    /** 「창고 전체」가 없으면 목적지를 지어낼 수 없다. */
    noDefault: '이 창고에 창고 전체 위치가 없습니다. 관리자에게 문의하세요.',
    /** 위치가 보관 품목으로 이 품목을 정해 두었다. */
    matched: '이 품목의 보관 위치입니다',
    /**
     * 「지정 품목만 받기」를 켠 위치에 지정 밖 품목(피처 009 T058). 두면 서버도 막는다(LOCATION_ITEM_RESTRICTED). 옵션이 꺼진
     * 위치는 막지 않고 확인을 묻는다 — 품목 지정은 안내다(FR-017b).
     */
    notAllowed: '이 위치는 지정 품목만 받습니다',
    undesignated: '지정된 위치가 아닙니다. 정말 적치합니까?',
    confirmUndesignated: '미지정 위치 적치',
    rescan: '다시 스캔',
    undesignatedConfirmed: '지정된 위치가 아닌 곳에 입고합니다',
    /** 보관 품목을 정하지 않은 위치 — 막지 않는다. */
    anywhere: '품목을 가리지 않는 위치입니다',
    itemsLoadFailed: '이 위치의 보관 품목을 확인할 수 없습니다',
  },
  /** 이 화면이 재고를 세우는 지점이라 두 번 서면 같은 제품이 두 벌이 된다. */
  stocked: {
    title: '이미 입고 처리된 제품 LOT 입니다',
    description: '다른 기기에서 먼저 입고했습니다. 재고를 확인하세요.',
  },
  unverified: {
    title: '이미 입고됐는지 확인할 수 없습니다',
    description: '연결이 없어 물어볼 수 없습니다. 재고를 확인한 뒤 진행하세요.',
    /** 연결이 아닌 이유로 확인하지 못했을 때 그 이유 뒤에 붙인다. */
    caution: '재고를 확인한 뒤 진행하세요.',
  },
  submit: '입고·적치 완료',
  noWorker: '사번을 먼저 확인하세요',
  /** 단말 토큰이 싣고 온 값이다. 없으면 어느 공장의 입고인지 정할 수 없다. */
  noPlant: '이 기기의 공장을 읽지 못했습니다. 기기를 다시 등록하세요.',
  /** 단말 보관소가 거절한 경우. 담긴 것이 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '입고를 저장하지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  sent: {
    title: '입고하고 적치했습니다',
  },
  /** 적치 지시 식별자는 입고 응답에만 있다. 담긴 채로는 아직 없다. */
  receivedOnly: {
    title: '입고했습니다. 적치가 남았습니다',
    description: '적치 완료는 적치·입고 완료 화면에서 잇습니다.',
    action: '적치 화면으로',
  },
  /* 입고는 섰고 적치만 되돌아왔다. 둘을 한 문구로 뭉치면 무엇이 섰는지 알 수 없다. */
  putawayRejected: {
    title: '입고했습니다. 적치를 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하고 적치 화면에서 다시 하세요. ',
    action: '전송 실패한 기록 보기',
  },
  held: {
    title: '입고를 전송 대기에 넣었습니다',
    description: '연결되면 보냅니다. 적치 완료는 그 뒤 적치 화면에서 잇습니다.',
  },
  rejected: {
    title: '입고를 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하세요. ',
    action: '전송 실패한 기록 보기',
  },
  another: '다음 인식표',
  /**
   * 방금 찍은 결과 칸(사용자 지시 2026-11-20, 입하 등록 시안 A 를 제품 입고에도) — 담음 초록 · 이미 담음 회색(몇 번
   * 줄인지) · 담지 않음 빨강. 「담음」은 아직 서버에 보내지 않은 것이라 「등록됨」으로 쓰지 않는다(사용자 결정 2026-11-20).
   */
  result: {
    added: '담음',
    unitLines: (count: number) => `인식표 1개 → ${String(count)}라인`,
    duplicate: '이미 담은 LOT입니다',
    duplicateRow: (no: number) => `인수 대상 No ${String(no)}에 있습니다`,
    rejected: '담지 않음',
  },
  /** 인수 대상 표 — 줄마다 실물 수량 칸. 줄을 누르면 시트(제조일 · 유효기간 · 양품 실적). */
  tally: {
    total: (count: number) => `${String(count)}개`,
    open: (itemCode: string, lotNo: string) => `${itemCode} ${lotNo} 열기`,
  },
  sheet: {
    title: '인수 대상',
    fields: {
      itemCode: '품목코드',
      itemName: '품목명',
      lot: 'LOT',
      expectedUnit: '인식표 수량',
      expectedGood: '양품 실적',
      manufactured: '제조',
      expiry: '유효기간',
    },
  },
  /** 창고는 고르면 맨 위 한 줄로 접는다. */
  warehouseChange: '바꾸기',
  summary: {
    count: (count: number) => `${String(count)}개`,
  },
} as const;
