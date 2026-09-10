/**
 * M-01-10 재고이동·불량 반출 — 창고에서 창고로 물건을 옮긴다.
 *
 * 반출과 도착 사이에 시간이 있다. 그 사이에 그만두거나 앱이 꺼지면 반쪽만 저장된 이동이
 * 남는데, 데이터베이스가 그것을 막지 않는다 - 화면이 되살려 보여야 한다.
 *
 * 같은 창고 안의 위치 이동은 이 슬라이스에 없다. 계약에 그것을 적을 쓰기 경로가 없다.
 * 파렛트 단위도 없다 - 단위 정책 값 목록이 아직 확정 전이다.
 */
export const stockTransfer = {
  title: '재고 이동',
  /** 전송 실패한 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    shipped: '재고 이동 반출',
    arrived: '재고 이동 도착',
  },
  /** 반출과 도착 사이에 남은 것. 진입에서 먼저 보이지 않으면 같은 물건을 또 반출한다. */
  unfinished: {
    legend: '도착이 남은 이동',
    loading: '도착이 남은 이동을 찾는 중입니다',
    loadFailed: '도착이 남은 이동을 확인하지 못했습니다. 연결을 확인하세요.',
    none: '도착이 남은 이동이 없습니다',
    item: (no: string, count: number) => `${no} · ${String(count)}라인`,
    resume: '이어서 하기',
    /** 다른 단말이 반출한 것은 오프라인에서 오지 않는다. 없다고 단정하면 안 된다. */
    offline: '연결이 없어 다른 기기에서 반출한 이동은 보이지 않습니다.',
  },
  type: {
    legend: '이동 유형',
    normal: '일반 이동',
    defect: '불량 반출',
  },
  from: {
    /*
     * 번호를 붙이지 않는다. 화면은 도착을 먼저 세우고 그 아래에서 LOT 을 여러 번 스캔하는데,
     * 반출을 ①로 매기면 화면에 보이는 차례와 어긋나 어느 쪽을 먼저 하라는 말인지 갈린다.
     */
    legend: '반출 스캔',
    scanLabel: '반출 LOT 스캔',
    scanPlaceholder: 'LOT QR을 스캔하세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: 'LOT을 불러오는 중입니다',
    notFound: (code: string) => `${code} LOT을 찾지 못했습니다`,
    loadFailed: 'LOT을 확인할 수 없습니다. 연결을 확인하세요.',
    already: '이미 추가한 LOT입니다',
    /** 재고가 없는 LOT을 옮기면 반출 수량이 재고를 넘어 서버가 되돌린다. */
    noStock: '이 LOT은 옮길 재고가 없습니다',
    /*
     * 재고가 없는 것과 사업장을 못 정한 것을 가른다. 앞의 것은 셈이 틀린 것이고 뒤의 것은
     * 창고 마스터가 덜 선 것이라, 현장이 할 일이 서로 다르다.
     */
    unknownBusinessUnit: '이 자리의 사업장을 확인할 수 없습니다',
    unknownBusinessUnitWhy: '재고는 있습니다. 창고 정보가 서야 옮길 수 있으니 관리자에게 알리세요.',
    /** 이동 헤더는 출발 창고를 하나만 받는다. 섞으면 없는 자리에서 빼는 것이 된다. */
    mixedWarehouse: '서로 다른 창고의 LOT을 한 번에 옮길 수 없습니다. 창고별로 나누세요.',
    /* 대리키를 보이면 실물 라벨과 대조할 수 없다. 라벨에는 품목 코드와 LOT 번호가 찍혀 있다. */
    name: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    onHand: (qty: string) => `재고 ${qty}`,
    qtyLabel: (name: string) => `${name} 반출 수량`,
    remove: '빼기',
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      notPositive: '수량은 0보다 커야 합니다',
      overStock: (limit: string) => `재고 ${limit} 을(를) 넘을 수 없습니다`,
    },
  },
  /** 결정 14 — 보류는 막지 않고 알린다. 막으면 현장이 물건을 못 옮긴다. */
  hold: {
    title: (numbers: string) => `${numbers} 은(는) 보류 중인 LOT입니다`,
    description: '옮길 수는 있습니다. 보류 사유는 품질에서 풉니다.',
  },
  to: {
    legend: '도착 스캔',
    warehouseLabel: '도착 창고',
    warehousePlaceholder: '창고를 고르세요',
    scanLabel: '도착 위치 스캔',
    scanPlaceholder: '위치 QR을 스캔하세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: '위치를 불러오는 중입니다',
    notFound: (code: string) => `${code} 위치를 찾지 못했습니다`,
    picked: (code: string) => `도착 위치 ${code}`,
    /** 같은 창고 안 이동은 이 슬라이스에 없다. 계약에 적을 자리가 없다. */
    sameWarehouse: '같은 창고 안의 위치 이동은 아직 이 화면에서 할 수 없습니다.',
  },
  submitShip: '반출 기록',
  submitArrive: '이동 완료',
  noWorker: '사번을 먼저 확인하세요',
  noLine: '반출할 LOT을 스캔하고 수량을 적으세요',
  noDestination: '도착 위치를 스캔하세요',
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '이동을 저장하지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  shipped: {
    title: '반출을 기록했습니다',
    description: '도착 위치에 놓은 뒤 도착 스캔으로 이동을 끝냅니다.',
  },
  sent: {
    title: '이동을 마쳤습니다',
  },
  held: {
    title: '이동을 전송 대기에 넣었습니다',
    description: '연결되면 보냅니다. 반출과 도착은 순서대로 나갑니다.',
  },
  rejected: {
    title: '이동을 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하세요. ',
    action: '전송 실패한 기록 보기',
  },
  another: '다음 이동',
} as const;
