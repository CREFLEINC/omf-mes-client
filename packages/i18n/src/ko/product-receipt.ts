/**
 * M-04-04 제품입고·적치 — 생산·외주에서 넘어온 제품 LOT 이 완제품 재고로 선다.
 *
 * 제품 LOT 을 만드는 것은 생산이고 여기는 인수와 위치 확정이다. 이 화면이 인수를 거부하면
 * 그 LOT 은 출하 흐름에 들어오지 않는다.
 */
export const productReceipt = {
  title: '제품 입고·적치',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
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
    hint: '물건이 들어갈 창고입니다. 인식표가 지금 있는 자리와 다를 수 있습니다.',
  },
  unit: {
    legend: '인식표 스캔',
    scanLabel: '인식표 스캔',
    scanPlaceholder: '인식표 QR을 스캔하세요',
    manualLabel: '인식표 직접 입력',
    manualSubmit: '인식표 넣기',
    loading: '인식표를 찾는 중입니다',
    loadFailed: '인식표를 불러오지 못했습니다. 연결을 확인하세요.',
    notFound: (no: string) => `${no} 인식표를 찾지 못했습니다`,
    picked: (no: string) => `인식표 ${no}`,
    empty: '이 인식표에는 담긴 것이 없습니다',
  },
  contents: {
    legend: '인수 대상',
    loading: '담긴 것을 불러오는 중입니다',
    loadFailed: '담긴 것을 불러오지 못했습니다. 연결을 확인하세요.',
    name: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    qtyLabel: (name: string) => `${name} 실물 수량`,
    expected: (qty: string) => `인식표 수량 ${qty}`,
    manufactured: (at: string) => `제조 ${at}`,
    expiry: (date: string) => `유효기간 ${date}`,
    /* 실물대로 받는다. 사유를 담을 자리가 계약에 없어 지어내지 않는다. */
    differs: '인식표 수량과 다릅니다. 실물대로 받습니다.',
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
    /** 창고가 위치를 관리하지 않으면 흡수용 위치 하나로 들어간다. */
    unmanaged: '이 창고는 위치를 관리하지 않습니다. 대표 위치로 들어갑니다.',
    /** 대표 위치가 없으면 목적지를 지어낼 수 없다. */
    noDefault: '이 창고에 대표 위치가 없습니다. 기준정보를 확인하세요.',
  },
  submit: '입고·적치 완료',
  noWorker: '사번을 확인한 뒤에 입고할 수 있습니다',
  /** 단말 토큰이 싣고 온 값이다. 없으면 어느 공장의 입고인지 정할 수 없다. */
  noPlant: '단말 공장을 읽지 못했습니다. 단말을 다시 등록하세요.',
  /** 단말 보관소가 거절한 경우. 담긴 것이 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '입고를 담아 두지 못했습니다',
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
    title: '입고를 담아 두었습니다',
    description: '연결되면 보냅니다. 적치 완료는 그 뒤 적치 화면에서 잇습니다.',
  },
  rejected: {
    title: '입고를 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하세요. ',
    action: '전송 실패한 기록 보기',
  },
  another: '다음 인식표',
} as const;
