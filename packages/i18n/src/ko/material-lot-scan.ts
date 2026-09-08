/**
 * M-01-02 자재LOT 번호 스캔·등록 — 도착 때 못 스캔한 사전부착 라인을 채운다.
 *
 * 사전부착의 본 경로가 아니라 보완이다. 도착 때 스캔한 것은 입하 등록이 서버와 한
 * 트랜잭션으로 만들고, 미부착은 다른 화면이 채번한다.
 */
export const materialLotScan = {
  title: '자재LOT 스캔·등록',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    registered: '자재LOT 등록',
  },
  receipt: {
    legend: '입하 건 고르기',
    loading: '입하 건을 찾는 중입니다',
    loadFailed: '입하 건을 불러오지 못했습니다. 연결을 확인하세요.',
    none: 'LOT 이 비어 있는 사전부착 입하 건이 없습니다',
    pick: '입하 건',
    pickPlaceholder: '입하 건을 고르세요',
    item: (no: string, date: string) => `${no} · ${date}`,
  },
  line: {
    legend: '입하 라인 고르기',
    loading: '라인을 불러오는 중입니다',
    loadFailed: '라인을 불러오지 못했습니다. 연결을 확인하세요.',
    /** 다른 단말이 방금 채웠거나 도착 때 이미 스캔한 건이다. */
    none: '이 입하 건에는 LOT 이 비어 있는 사전부착 라인이 없습니다',
    pick: '입하 라인',
    pickPlaceholder: '라인을 고르세요',
    item: (lineNo: string, itemCode: string, qty: string) => `#${lineNo} · ${itemCode} · ${qty}`,
    picked: (lineNo: string) => `라인 #${lineNo}`,
  },
  scan: {
    legend: '스캔',
    scanLabel: '자재LOT 스캔',
    scanPlaceholder: '자재 LOT 라벨을 스캔하세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    /** 34자리를 붙여 쓰면 실물 라벨과 눈으로 대조할 수 없다. */
    counter: (length: string, total: string) => `${length}/${total}자리`,
    problem: {
      length: (length: string, total: string) =>
        `자재 LOT 번호는 ${total}자리입니다 (현재 ${length}자리)`,
      notDigits: '숫자만 입력할 수 있습니다',
      badDate: '라벨의 날짜 자리가 날짜가 아닙니다',
      duplicate: '이미 담아 둔 LOT 번호입니다',
    },
  },
  /* 라벨의 수량은 최초 납품 스냅샷이라 라인 수량과 다를 수 있다. 막지 않는다. */
  qtyDiffers: (labelQty: string, lineQty: string) =>
    `라벨 수량 ${labelQty} 이 라인 수량 ${lineQty} 과 다릅니다`,
  register: '이 라인 등록',
  registered: {
    legend: (count: string) => `등록됨 (${count}건)`,
    item: (lotNo: string, qty: string) => `${lotNo} · ${qty}`,
  },
  noWorker: '사번을 확인한 뒤에 등록할 수 있습니다',
  /** 단말 토큰이 싣고 온 값이다. 없으면 어느 공장의 LOT 인지 정할 수 없다. */
  noPlant: '단말 공장을 읽지 못했습니다. 단말을 다시 등록하세요.',
  /** 단말 보관소가 거절한 경우. 담긴 것이 없으므로 등록되지 않았다고 말한다. */
  saveFailed: {
    title: '등록을 담아 두지 못했습니다',
    description: '등록되지 않았습니다. 다시 시도하세요.',
  },
  done: '등록 완료',
  sent: {
    title: '등록했습니다',
  },
  held: {
    title: '등록을 담아 두었습니다',
    description: '연결되면 보냅니다.',
  },
  /* 같은 공장에 같은 번호가 있으면 400 이다. 다시 보내도 풀리지 않는다. */
  rejected: {
    title: '등록이 되돌아왔습니다',
    description: '같은 번호가 이미 있으면 다시 보내도 풀리지 않습니다. 다른 라벨을 스캔하세요. ',
    action: '되돌아온 건 보기',
  },
  another: '다음 입하 건',
} as const;
