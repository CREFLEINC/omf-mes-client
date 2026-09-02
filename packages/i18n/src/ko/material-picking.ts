/**
 * M-01-08 자재 출고·피킹 — 지시대로 자재를 집어 라인으로 내보낸다.
 *
 * 보류 판정은 서버가 한다. 화면이 따로 재면 오프라인에서 두 판단이 갈린다.
 *
 * 모자라면 부분 출고로 두고 부족분을 남긴다. 대체 자재는 이 화면 밖이다.
 */
export const materialPicking = {
  title: '자재 출고·피킹',
  record: {
    picked: '자재 피킹',
    issued: '자재 출고',
  },
  worker: {
    loading: '사번을 확인하는 중입니다',
    loadFailed: '사번을 확인할 수 없습니다. 연결을 확인하세요.',
    notFound: (workerNo: string) => `${workerNo} 사번의 작업자를 찾지 못했습니다`,
  },
  orders: {
    legend: '내 피킹 지시',
    loading: '피킹 지시를 불러오는 중입니다',
    loadFailed: '피킹 지시를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '받은 피킹 지시가 없습니다',
    change: '다른 지시 고르기',
    /** 값 목록이 확정되기 전이라 코드를 그대로 보인다. */
    type: (code: string) => `유형 ${code}`,
  },
  lines: {
    legend: '피킹 라인',
    /** 몇 건 중 몇 건을 집었는지. 남은 일이 얼마인지가 이 줄로 보인다. */
    progress: (done: number, total: number) => `${String(done)} / ${String(total)}`,
    loading: '라인을 불러오는 중입니다',
    loadFailed: '라인을 확인할 수 없습니다. 연결을 확인하세요.',
    none: '이 지시에 라인이 없습니다',
    planned: (planned: string, picked: string) => `요청 ${planned} / 피킹 ${picked}`,
    /* 담긴 것은 아직 서버에 없다. 끝난 것으로 보이면 같은 라인을 다시 집는다. */
    queued: (qty: string) => `${qty} 미확정 — 아직 서버에 없습니다`,
    at: (locationCode: string) => `위치 ${locationCode}`,
    expiry: (date: string) => `유효 ${date}`,
    manufactured: (date: string) => `제조 ${date}`,
    /** 서버가 매긴 순위다. 화면이 다시 계산하지 않는다. */
    rank: (rank: number) => `선출 ${String(rank)}순위`,
    /** 보류는 서버가 표시해 내려준다. 사유 코드는 값 목록이 확정되기 전이라 그대로 보인다. */
    held: '보류 중',
    heldReason: (code: string) => `보류 사유 ${code}`,
    done: '다 집었습니다',
  },
  scan: {
    legend: 'LOT 스캔',
    label: 'LOT 번호',
    placeholder: 'LOT 라벨을 비추세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    /** 계획과 다른 LOT 을 집으면 서버도 막는다. 눌러 보고 알게 두지 않는다. */
    mismatch: (expected: string) => `이 라인의 LOT 이 아닙니다. ${expected} 을(를) 집으세요.`,
    matched: '라인의 LOT 과 같습니다',
  },
  qty: {
    label: '출고 수량',
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      notPositive: '수량은 0보다 커야 합니다',
      overPlanned: (limit: string) => `남은 요청 ${limit} 을(를) 넘을 수 없습니다`,
    },
  },
  /** 선출은 권고다. 강제 옵션은 서버가 갖고 있어 화면이 막지 않는다. */
  outOfSequence: '선출 순서가 앞선 LOT 이 남아 있습니다. 집을 수는 있습니다.',
  pick: '이 라인 피킹',
  picked: (qty: string) => `${qty} 집었습니다`,
  submit: '출고 확정',
  /** 모자란 만큼은 부족분으로 남는다. 대체 자재는 이 화면 밖이다. */
  partialNote: '요청보다 적게 집었으면 부족분은 남습니다. 대체 자재는 이 화면에서 다루지 않습니다.',
  /*
   * 어느 값이 이 화면의 출고인지 계약이 아직 말하지 않는다. 목록의 첫 값을 조용히 쓰면 틀린
   * 값을 소리 없이 보내는 것과 같아, 사람이 고르게 하고 왜 고르는지를 적는다.
   */
  issueTypeLabel: '출고 유형',
  issueTypePlaceholder: '출고 유형을 고르세요',
  issueTypeNote: '어느 값이 이 출고인지 아직 정해지지 않아 담당자가 고릅니다.',
  issueTypeLoadFailed: '출고 유형을 불러오지 못했습니다',
  noIssueType: '보낼 출고 유형이 없습니다. 공통코드를 확인하세요.',
  /* 담긴 것을 끝난 것으로 말하지 않는다. 거부를 조용히 넘기면 왜 안 집혔는지 알 수 없다. */
  pickOutcome: {
    sent: { title: '집었습니다', description: '' },
    queued: {
      title: '피킹을 담아 두었습니다',
      description: '연결되면 보냅니다. 아직 서버에 없습니다.',
    },
    rejected: {
      title: '피킹이 되돌아왔습니다',
      description: '서버가 받지 않았습니다.',
    },
  },
  /* 단말 보관소가 차면 담기 자체가 실패한다. 조용히 넘기면 적은 것이 어디에도 없다. */
  saveFailed: '단말에 담지 못했습니다. 저장 공간을 확인하고 다시 시도하세요.',
  /* 서버는 출고 뒤에도 집은 양을 그대로 내려준다. 남은 것이 없다는 말을 화면이 대신 한다. */
  allIssued: '이 지시에서 내보낼 것이 남아 있지 않습니다.',
  /* 담긴 출고는 서버가 아직 몰라 조회로 드러나지 않는다. 또 확정하면 재고가 두 번 깎인다. */
  issueQueued: '이 지시의 출고가 이미 담겨 있습니다. 연결되면 나갑니다.',
  /* 셸이 배경으로 보내다 거부당한 건은 화면이 스스로 본 적이 없다. 그래도 사유는 보여야 한다. */
  returned: {
    title: (count: string) => `이 지시에서 되돌아온 건 ${count}`,
    description: '서버가 받지 않았습니다. 사유를 확인하세요. ',
  },
  noWorker: '사번을 확인한 뒤에 피킹할 수 있습니다',
  sent: {
    title: '출고를 확정했습니다',
  },
  queued: {
    title: '출고를 담아 두었습니다',
    /*
     * 되돌릴 수 없는 실물 이동이라 담긴 것을 끝난 것으로 말하지 않는다. 서버가 거부하면
     * 물건은 이미 라인에 가 있고, 되돌리는 것은 화면이 아니라 사람이다.
     */
    description: '연결되면 보냅니다. 아직 확정이 아니며 서버가 되돌릴 수 있습니다.',
  },
  rejected: {
    title: '출고가 되돌아왔습니다',
    /** 실물이 이미 나갔을 수 있다. 그 사실을 감추지 않는다. */
    description: '물건이 이미 나갔다면 회수해야 합니다. 되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  another: '다음 지시',
} as const;
