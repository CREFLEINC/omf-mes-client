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
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '입하 등록',
  scan: {
    legend: '자재 LOT 스캔',
    label: '자재 LOT 스캔',
    placeholder: '자재 LOT 라벨을 비추세요',
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
    legend: 'P/O 선택',
    selectLabel: '발주 번호',
    loading: '미마감 발주를 불러오는 중입니다',
    loadFailed: '발주를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '미마감 발주가 없습니다',
    /** 번호만으로는 어느 발주 물품인지 확정되지 않는다. 담당자가 고른다. */
    pickNote: '스캔한 번호만으로는 발주가 정해지지 않습니다. 담당자가 고릅니다.',
    linesLoading: '발주 라인을 불러오는 중입니다',
    linesLoadFailed: '발주 라인을 확인할 수 없습니다',
    linesNone: '이 발주에 라인이 없습니다',
    lineLabel: (item: string, ordered: string, uom: string) => `${item} · 발주 ${ordered} ${uom}`,
    received: (qty: string) => `누적 입하 ${qty}`,
    tolerance: (over: string, under: string) => `허용 +${over} / -${under}`,
    clear: '발주 선택 지우기',
  },
  exception: {
    /** 발주 없이 도착한 건은 공급사의 출처가 정해지지 않아 아직 등록이 서지 않는다. */
    absent: '발주 없이 도착한 건은 아직 이 화면에서 등록할 수 없습니다',
    absentWhy: '공급사를 발주에서 승계하는 구조라, 발주가 없으면 공급사를 정할 자리가 없습니다.',
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
    ordered: (qty: string, uom: string) => `예정 ${qty} ${uom}`,
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
    normal: '예정 수량과 맞습니다',
    /** 판정 결과를 먼저 보인 뒤에 넘긴다. 넘어갈 화면은 아직 이 앱에 없다. */
    over: (ordered: string, received: string) =>
      `수량 초과 — 예정 ${ordered}, 실입하 ${received}`,
    overNext: '초과분은 초과 입하 분리에서 나눕니다. 그 화면은 아직 이 앱에 없습니다.',
    under: (ordered: string, received: string) =>
      `수량 부족 — 예정 ${ordered}, 실입하 ${received}`,
    underNext: '부족분은 입하 오류 등록으로 갑니다. 그 화면은 아직 이 앱에 없습니다.',
  },
  /** 검사 대상 여부는 서버가 라인마다 정한다. 화면이 보내지 않는다. */
  inspectionNote: '검사 대상 여부는 등록 뒤 서버가 라인마다 정합니다',
  submit: '입하 등록',
  sent: {
    title: '입하를 등록했습니다',
    description: '사전부착 라인의 자재 LOT이 보류 상태로 함께 생겼습니다',
  },
  queued: {
    title: '입하를 담아 두었습니다',
    description: '연결되면 보냅니다. 아직 서버에 없습니다.',
  },
  rejected: {
    title: '입하가 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  noWorker: '사번을 확인한 뒤에 기록할 수 있습니다',
  another: '다음 입하',
} as const;
