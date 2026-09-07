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
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    received: '생산창고 입고',
  },
  issue: {
    legend: '출고 전표 스캔',
    scanLabel: '출고 QR 스캔',
    scanPlaceholder: '출고 전표 QR을 비추세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: '출고 전표를 불러오는 중입니다',
    notFound: (code: string) => `${code} 출고 전표를 찾지 못했습니다`,
    /** 세 번을 물어 도착 위치와 작업지시를 얻는다. 하나라도 끊기면 전표를 열 수 없다. */
    loadFailed: '출고 전표를 열지 못했습니다. 연결을 확인하세요.',
    summary: (no: string, count: number) => `${no} · ${String(count)}라인`,
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
    description: '연결된 뒤에 다시 확인하세요. 이미 받은 전표면 입고가 되돌아옵니다.',
  },
  /** 큐에 담긴 것은 서버 응답에 없다. 세지 않으면 오프라인에서 두 번 받는다. */
  queued: {
    title: '이 출고 전표의 입고가 아직 보내지지 않았습니다',
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
    reasonRequired: '모자란 라인은 사유를 골라야 합니다',
  },
  submit: '입고 확정',
  noWorker: '사번을 확인한 뒤에 입고할 수 있습니다',
  noLine: '한 라인 이상 수령 수량을 적으세요',
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '입고를 담아 두지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  sent: {
    title: '입고를 기록했습니다',
  },
  held: {
    title: '입고를 담아 두었습니다',
    description: '연결되면 보냅니다.',
  },
  rejected: {
    title: '입고가 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  another: '다음 입고',
} as const;
