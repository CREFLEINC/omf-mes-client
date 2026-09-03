/**
 * M-04-01 제품LOT 피킹 스캔 — 오늘 나갈 제품 LOT 을 집어 기록한다.
 *
 * 보류 판정을 캐시하지 않는다. 그래서 연결이 있어야만 선다.
 *
 * 고객이 LOT 에 거는 조건은 자유 문장으로 들어온다. 화면이 해석하지 않고 크게 보인다 -
 * 못 알아들은 조건을 조용히 넘기면 그것이 남지 않는다.
 */
export const productPicking = {
  title: '제품 피킹',
  /** 보류 판정을 캐시할 수 없어 연결 없이는 집을 수 없다. */
  offline: {
    title: '연결이 없어 피킹할 수 없습니다',
    description: '보류 상태를 확인할 수 없습니다. 연결을 확인하세요.',
  },
  targets: {
    legend: '오늘 출하분',
    loading: '오늘 출하분을 불러오는 중입니다',
    loadFailed: '오늘 출하분을 확인할 수 없습니다',
    /* 고르던 라인이 목록에서 빠졌다. 말없이 나가면 무슨 일이 있었는지 알 수 없다. */
    dropped: '고르던 라인이 오늘 출하분에서 빠졌습니다',
    none: '오늘 출하할 작업지시가 없습니다',
    line: (no: number) => `${String(no)}번 줄`,
    progress: (allocated: string, picked: string) => `배정 ${allocated} · 피킹 ${picked}`,
    remaining: (qty: string, uom: string) => `남은 배정 ${qty} ${uom}`,
    complete: '배정만큼 다 집었습니다',
    inspection: '출하검사 대상',
  },
  target: {
    legend: '피킹 대상',
    /** 자유 텍스트라 해석하지 않는다. 사람이 읽고 고른다. */
    customerRequirement: '고객 LOT 요구',
    minimumShelfLife: (days: number) => `잔여 유효기간 요구 ${String(days)}일 이상`,
    change: '다른 대상 고르기',
    itemFailed: '품목을 확인할 수 없습니다',
  },
  candidates: {
    legend: (policy: string) => `권장 LOT — ${policy}`,
    fefo: '유효기간 이른 순',
    fifo: '먼저 만든 순',
    loading: '집을 수 있는 LOT을 불러오는 중입니다',
    loadFailed: 'LOT을 확인할 수 없습니다. 연결을 확인하세요.',
    none: '이 품목에 집을 수 있는 LOT이 없습니다',
    /** 정책 값을 모르면 순서를 세우지 않는다. 세운 척하면 엉뚱한 순서를 권장으로 낸다. */
    unknownPolicy: '선출 정책을 알 수 없어 순서를 정하지 않았습니다',
    /** 축의 값이 없는 줄은 섞지 않고 뒤에 따로 둔다. 선택 자체는 막지 않는다. */
    unorderedLegend: '순서를 정할 수 없습니다',
    recommended: '권장 1순위',
    choose: '이 LOT 고르기',
    available: (qty: string, uom: string) => `가용 ${qty} ${uom}`,
    expiry: (date: string) => `유효 ${date}`,
    remainingDays: (days: number) => `잔여 ${String(days)}일`,
    noExpiry: '유효기간 없음',
  },
  lot: {
    held: '보류 — 집을 수 없습니다',
    noAvailable: '다른 출하에 배정됐습니다',
    otherItem: '이 라인의 품목이 아닙니다',
    shelfLifeShort: (required: number, actual: number) =>
      `고객 요구 ${String(required)}일 미달(실제 ${String(actual)}일)`,
    /** 셀 수 없는 것을 넉넉한 것으로 두지 않는다. 판정의 정본은 서버다. */
    shelfLifeUnknown: '유효기간이 없어 잔여 일수를 판정할 수 없습니다',
    /** 권장은 순서 제안이지 위치가 아니다. 다른 것을 집어도 물건은 맞다. */
    notRecommended: '권장 1순위가 아닙니다 — 집을 수 있습니다',
  },
  scan: {
    legend: 'LOT 스캔',
    label: '제품 LOT 스캔',
    placeholder: '제품 LOT QR을 비추세요',
    manualLabel: '직접 입력',
    manualSubmit: '찾기',
    notFound: (code: string) => `${code} LOT을 이 품목에서 찾지 못했습니다`,
  },
  qty: {
    label: '피킹 수량',
    empty: '피킹 수량을 적으세요',
    notNumber: '피킹 수량은 숫자로 적으세요',
    notPositive: '피킹 수량은 0보다 커야 합니다',
    overAvailable: (limit: string) => `피킹 수량은 가용 ${limit}을(를) 넘을 수 없습니다`,
    overAllocated: (limit: string) => `피킹 수량은 남은 배정 ${limit}을(를) 넘을 수 없습니다`,
  },
  submit: '피킹 확정',
  done: {
    title: '피킹을 기록했습니다',
    /** 확정 후 되돌리기를 두지 않는다. 예약이 소진된다. */
    description: '되돌리기는 이 화면에서 하지 않습니다',
  },
  failed: '피킹을 기록하지 못했습니다. 다시 시도하세요.',
  conflict: '집을 수 없는 상태로 바뀌었습니다. 목록을 다시 확인하세요.',
  noWorker: '사번을 확인한 뒤에 기록할 수 있습니다',
  another: '다음 피킹',
} as const;
