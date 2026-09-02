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
   * 출고 유형과 원천 문서 유형의 값 목록이 아직 확정되지 않았다. 지어낸 값을 소리 없이
   * 실으면 값이 정해지는 날 전부 거부되므로, 무엇을 실었는지 화면이 적는다.
   */
  placeholderNote: (issueType: string) =>
    `출고 유형을 ${issueType} 로 보냅니다. 값 목록이 확정되면 바뀝니다.`,
  issueTypeLoadFailed: '출고 유형을 불러오지 못했습니다',
  noIssueType: '보낼 출고 유형이 없습니다. 공통코드를 확인하세요.',
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
