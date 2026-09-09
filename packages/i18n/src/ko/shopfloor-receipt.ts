/**
 * M-01-09 생산창고 입고 — 출고된 것을 현장에서 받아 적는다.
 *
 * 수령 전표는 출고 전표 하나에 하나다. 같은 출고를 두 번 받으면 뒤엣것이 되돌아온다.
 *
 * 호퍼 잔량 실측은 이 슬라이스에 없다. 장부 잔량과의 차이로 적어야 하는 별개의 쓰기라
 * 따로 세운다.
 */
export const shopfloorReceipt = {
  title: '생산창고 입고',
  /*
   * 통신이 끊기면 출고와 입고가 한 단말로 합쳐진다(결정 17 시나리오 2). 말하지 않으면
   * 작업자는 평소처럼 다른 단말을 기다린다.
   */
  degraded: {
    title: '오프라인입니다',
    description: '출고분도 이 기기에서 처리합니다. 연결되면 한꺼번에 보냅니다.',
  },
  /** 전송 실패한 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    received: '생산창고 입고',
    hopper: '호퍼 잔량 실측',
  },
  issue: {
    legend: '출고 전표 스캔',
    scanLabel: '출고 QR 스캔',
    scanPlaceholder: '출고 전표 QR을 스캔하세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: '출고 전표를 불러오는 중입니다',
    notFound: (code: string) => `${code} 출고 전표를 찾지 못했습니다`,
    /** 세 번을 물어 도착 위치와 작업지시를 얻는다. 하나라도 끊기면 전표를 열 수 없다. */
    loadFailed: '출고 전표를 열지 못했습니다. 연결을 확인하세요.',
    summary: (no: string, count: number) => `${no} · ${String(count)}라인`,
    /** 어디로 들어온 것인가. 없으면 받은 자리가 전표에만 남는다. */
    destination: (code: string) => `도착 ${code}`,
    destinationUnknown: '도착 위치를 확인할 수 없습니다. 연결을 확인하세요.',
    empty: '이 출고 전표에는 라인이 없습니다',
  },
  /** 수령 전표는 출고 전표와 1:1 이다. 막지 않으면 같은 물건을 두 번 받은 것이 된다. */
  already: {
    title: '이미 입고된 출고 전표입니다',
    description: '한 출고 전표는 한 번만 받습니다. 다시 받을 수 없습니다.',
  },
  /** 안 밝히면 확인된 줄 알고 이미 받은 전표를 또 받는다. 되돌아와도 이미 늦다. */
  unverified: {
    title: '이미 받은 전표인지 확인하지 못했습니다',
    description: '연결된 뒤에 다시 확인하세요. 이미 받은 전표면 입고 전송이 실패합니다.',
  },
  /** 큐에 담긴 것은 서버 응답에 없다. 세지 않으면 오프라인에서 두 번 받는다. */
  queued: {
    title: '이 출고 전표의 입고가 전송 대기 중입니다',
    description: '연결되면 보냅니다. 그때까지 다시 받지 않습니다.',
  },
  lines: {
    legend: '라인 수령',
    issued: (qty: string) => `출고 ${qty}`,
    receivedLabel: (item: string) => `${item} 수령 수량`,
    /* 대리키를 보이면 실물 라벨과 대조할 수 없다. 라벨에는 품목 코드와 LOT 번호가 찍혀 있다. */
    name: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    /** 부호를 사람에게 묻지 않는다. 모자란 것만 차이로 부른다. */
    short: (qty: string) => `차이 ${qty} 모자람`,
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      negative: '수량은 0보다 작을 수 없습니다',
      /** 초과는 데이터베이스가 막는다. 화면이 통과시키면 확정이 서버에서 되돌아온다. */
      overIssued: (limit: string) => `출고한 ${limit} 보다 많이 받을 수 없습니다`,
    },
    reasonLabel: (item: string) => `${item} 차이 사유`,
    reasonPlaceholder: '사유를 고르세요',
    /** 왜 모자란지를 아는 사람은 물건을 받은 그 자리에 있다. */
    reasonRequired: '모자란 품목은 사유를 고르세요',
  },
  /*
   * 실사에서 나오는 값이 아니라 자재가 라인에 들어오는 이 시점에 사람이 눈으로 잰다. 여기서
   * 적지 않으면 호퍼에 무엇이 얼마나 남았는지가 어디에도 남지 않는다.
   */
  hopper: {
    legend: '호퍼 잔량',
    equipmentLabel: '설비',
    equipmentPlaceholder: '설비를 고르세요',
    loading: '설비를 불러오는 중입니다',
    loadFailed: '설비를 확인할 수 없습니다. 연결을 확인하세요.',
    /** 매핑이 없으면 잴 자리가 없다. 지어낸 자리에 적으면 어느 호퍼인지가 사라진다. */
    noHopper: '이 설비에는 호퍼 위치가 지정돼 있지 않습니다',
    /** 설비가 위치를 직접 가리킨다. 고르면 그 자리가 정해진다. */
    at: (code: string) => `호퍼 ${code}`,
    stockLoading: '호퍼에 있는 것을 불러오는 중입니다',
    stockFailed: '호퍼 잔량을 확인할 수 없습니다. 연결을 확인하세요.',
    empty: '이 호퍼에 장부상 남은 것이 없습니다',
    onHand: (qty: string) => `장부 ${qty}`,
    measuredLabel: (name: string) => `${name} 실측 잔량`,
    /** 부호를 사람이 적게 하면 뒤집어 적는 순간 재고가 반대로 움직인다. 화면이 뺀다. */
    difference: (qty: string) => `차이 ${qty}`,
    problem: {
      notNumber: '숫자만 입력할 수 있습니다',
      negative: '0보다 작을 수 없습니다',
    },
    submit: '호퍼 잔량 기록',
    sent: '호퍼 잔량을 기록했습니다',
    queued: '호퍼 잔량을 전송 대기에 넣었습니다',
    rejected: '호퍼 잔량을 전송하지 못했습니다',
    saveFailed: '호퍼 잔량을 저장하지 못했습니다. 기록되지 않았습니다.',
  },
  submit: '입고 확정',
  noWorker: '사번을 먼저 확인하세요',
  noLine: '받은 품목의 수량을 적으세요',
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '입고를 저장하지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  sent: {
    title: '입고를 기록했습니다',
  },
  held: {
    title: '입고를 전송 대기에 넣었습니다',
    description: '연결되면 보냅니다.',
  },
  rejected: {
    title: '입고를 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하세요. ',
    action: '전송 실패한 기록 보기',
  },
  another: '다음 입고',
} as const;
