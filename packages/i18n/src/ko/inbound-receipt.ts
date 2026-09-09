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
    /** 자릿수와 숫자 전용은 저장소가 막지 않는다. 화면이 지킨다. */
    malformed: (length: number) => `자재 LOT 번호는 34자리 숫자입니다 (현재 ${String(length)}자)`,
    scanned: (lotNo: string) => `공급사 LOT ${lotNo}`,
    missing: 'LOT 번호 없음',
    missingChosen: 'LOT 번호가 붙어 있지 않습니다',
    reasonLabel: '대체 LOT 사유',
    reasonPlaceholder: '사유를 고르세요',
    reasonLoadFailed: '대체 LOT 사유를 불러오지 못했습니다',
    back: '스캔으로 되돌리기',
  },
  po: {
    legend: 'ERP W/O 선택',
    selectLabel: 'ERP W/O 번호',
    loading: '미마감 ERP W/O를 불러오는 중입니다',
    loadFailed: 'ERP W/O를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '미마감 ERP W/O가 없습니다',
    /** 번호만으로는 어느 발주 물품인지 확정되지 않는다. 담당자가 고른다. */
    pickNote: '스캔한 번호만으로는 ERP W/O가 정해지지 않습니다. 담당자가 고릅니다.',
    linesLoading: 'ERP W/O 라인을 불러오는 중입니다',
    linesLoadFailed: 'ERP W/O 라인을 확인할 수 없습니다',
    linesNone: '이 ERP W/O에 라인이 없습니다',
    lineLabel: (item: string, ordered: string, uom: string) => `${item} · 발주 ${ordered} ${uom}`,
    received: (qty: string) => `누적 입하 ${qty}`,
    tolerance: (over: string, under: string) => `허용 +${over} / -${under}`,
    clear: 'ERP W/O 선택 지우기',
  },
  exception: {
    /** 발주가 없으면 공급사도 품목도 단위도 승계할 곳이 없어 담당자가 고른다. */
    legend: 'ERP W/O 없이 도착',
    open: 'ERP W/O 없이 등록',
    openNote: 'ERP W/O가 없으면 공급사와 품목과 단위를 직접 고릅니다.',
    close: 'ERP W/O 고르기로 되돌리기',
    supplierLabel: '공급사',
    supplierPlaceholder: '공급사를 고르세요',
    supplierLoading: '공급사를 불러오는 중입니다',
    supplierLoadFailed: '공급사를 확인할 수 없습니다',
    supplierNone: '고를 공급사가 없습니다',
    itemLabel: '품목',
    itemPlaceholder: '품목을 고르세요',
    itemLoadFailed: '품목을 확인할 수 없습니다',
    /** 품목 마스터의 주인은 ERP 다. 이 화면이 품목을 만들 길은 계약에 없다. */
    itemUnregistered: '목록에 없는 품목은 여기서 만들 수 없습니다',
    itemUnregisteredWhy: 'ERP에 품목이 만들어진 뒤에 고를 수 있습니다.',
    uomLabel: '단위',
    uomPlaceholder: '단위를 고르세요',
    uomLoadFailed: '단위를 확인할 수 없습니다',
    /** 예정 수량이 없으므로 견줄 것이 없다. 판정하지 않는다는 사실을 말한다. */
    noVerdict: 'ERP W/O가 없어 예정 수량과 비교하지 않습니다',
    /** 공장은 단말 토큰이 싣고 온다. 없으면 지어내지 않고 막는다. */
    noPlant: '이 기기의 공장을 확인할 수 없어 등록할 수 없습니다',
  },
  note: {
    legend: '거래명세서',
    label: '명세서 번호',
    /** 촬영과 문자 인식은 이번 범위 밖이다. 없는 것을 있는 것처럼 두지 않는다. */
    photoAbsent: '명세서 촬영은 아직 없습니다. 번호만 적습니다.',
    /** 없어도 등록을 막지 않는다. 명세서는 별도 경로로 붙는다. */
    absent: '명세서 번호가 없습니다. 등록은 진행됩니다.',
  },
  qty: {
    legend: '품목·수량 확인',
    itemLoadFailed: '품목을 확인할 수 없습니다',
    /*
     * 발주 총량과 남은 예정을 같은 말로 부르지 않는다. 판정이 견주는 것은 남은 예정인데
     * 총량까지 예정이라 부르면 칸 옆의 수와 판정에 나오는 수가 다른 뜻의 같은 이름이 된다.
     */
    ordered: (qty: string, uom: string) => `발주 ${qty} ${uom}`,
    remaining: (qty: string, uom: string) => `남은 예정 ${qty} ${uom}`,
    received: '실입하 수량',
    packageCount: '포장 수',
    manufactured: '제조일',
    expiry: '유효기한',
    empty: '실입하 수량을 적으세요',
    notNumber: '실입하 수량은 숫자로 적으세요',
    notPositive: '실입하 수량은 0보다 커야 합니다',
    packageNotPositive: '포장 수는 0보다 커야 합니다',
    expiryBeforeManufactured: '유효기한이 제조일보다 앞설 수 없습니다',
  },
  verdict: {
    normal: '남은 예정과 맞습니다',
    /** 판정 결과를 먼저 보인 뒤에 넘긴다. 넘어갈 화면은 아직 이 앱에 없다. */
    over: (remaining: string, arrived: string) =>
      `수량 초과 — 남은 예정 ${remaining}, 이번 도착 ${arrived}`,
    overNext: '아래에서 정량분과 초과분을 나눠 등록합니다.',
    under: (remaining: string, arrived: string) =>
      `수량 부족 — 남은 예정 ${remaining}, 이번 도착 ${arrived}`,
    /*
     * 화면은 더 올 것인지 알지 못한다. 트럭과 거래명세서를 본 사람이 안다. 네 수를 보이고
     * 사람이 고르게 한다 - 수 없이 고르라 하면 무엇을 고르는지 모른다.
     */
    counts: {
      ordered: '발주',
      received: '누적',
      arrived: '이번 도착',
      remaining: '남은 예정',
    },
    underAsk: '더 들어올 물량이 있습니까?',
    /** 임시 입고가 아니다. 평범한 입하 등록이고 발주는 열린 채 남는다. */
    underContinue: '계속 등록',
    underContinueNote: '분할 납품이면 그대로 등록합니다. ERP W/O는 열린 채 남습니다.',
    underVariance: '입하 오류 등록',
    underVarianceNote: '이번이 마지막인데 모자라면 입하 오류로 넘어갑니다.',
  },
  /*
   * 초과가 판정되면 관리웹으로 넘기지 않고 이 화면에서 끝낸다. 정량분은 ERP W/O 에 귀속하고
   * 초과분은 귀속하지 않는다.
   */
  split: {
    legend: '초과 입하 분리',
    record: '초과 입하 분리',
    normalLabel: '정량분',
    excessLabel: '초과분',
    /** 초과분이 발주에 얹히지 않는다는 사실을 먼저 말한다. */
    excessNote: '초과분은 ERP W/O에 얹히지 않습니다.',
    typeLabel: '초과 예외 유형',
    typePlaceholder: '유형을 고르세요',
    typeLoadFailed: '초과 예외 유형을 불러오지 못했습니다',
    typeNone: '고를 수 있는 초과 예외 유형이 없습니다. 관리자에게 문의하세요.',
    reasonLabel: '초과 사유',
    reasonPlaceholder: '왜 초과로 왔는지 적으세요',
    /** 초과분을 싣는 모드는 계약이 유형과 사유를 함께 요구한다. */
    need: '초과분을 등록하려면 예외 유형을 고르고 사유를 적으세요',
    both: '정량분과 초과분 등록',
    normalOnly: '정량분만 등록',
    excessOnly: '초과분만 등록',
    atomicNote: '정량분과 초과분은 함께 등록되거나 함께 실패합니다.',
  },
  /** 검사 대상 여부는 서버가 라인마다 정한다. 화면이 보내지 않는다. */
  inspectionNote: '검사 대상 여부는 등록한 뒤에 라인마다 정해집니다',
  submit: '입하 등록',
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
} as const;
