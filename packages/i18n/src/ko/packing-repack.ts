/**
 * M-04-03 포장 재구성 스캔 — 물건은 그대로 두고 어느 포장에 들었는지만 바꾼다.
 *
 * LOT 이 갈리지 않는다. 그래서 계보가 생기지 않고, 되돌리기도 두지 않는다 - 되돌리려면
 * 반대 방향으로 한 번 더 재구성한다.
 *
 * 라벨은 여기서 뽑지 않는다. 프린터가 POP 스테이션에 있다.
 */
export const packingRepack = {
  title: '포장 재구성',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    created: '새 포장',
    replaced: '원 포장 구성',
  },
  source: {
    legend: '원 포장 스캔',
    scanLabel: '포장 스캔',
    scanPlaceholder: '포장 QR을 비추세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: '포장을 불러오는 중입니다',
    loadFailed: '포장을 확인할 수 없습니다. 연결을 확인하세요.',
    notFound: (code: string) => `${code} 포장을 찾지 못했습니다`,
    /** 같은 포장을 두 번 세면 물건이 두 배로 있는 것처럼 보인다. */
    already: '이미 고른 포장입니다',
    empty: '이 포장은 비어 있습니다',
    scanned: (count: number) => `원 포장 ${String(count)}건`,
    add: '포장 더 스캔',
    remove: '빼기',
  },
  type: {
    legend: '재구성 유형',
    merge: '합병 — 여러 포장을 하나로',
    split: '분할 — 하나를 여러 개로',
    reconfigure: '재구성 — 내용을 바꾼다',
  },
  contents: {
    legend: '새 구성',
    /** 원 포장에 있는 것보다 많이 담을 수 없다. 얼마까지인지를 함께 적는다. */
    pooled: (qty: string) => `원 포장 합 ${qty}`,
    qtyLabel: (lotNo: string) => `${lotNo} 수량`,
    /* 대리키를 보이면 실물 라벨과 대조할 수 없다. 라벨에는 품목 코드와 LOT 번호가 찍혀 있다. */
    lot: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    /** 같은 짝이 두 줄로 들어가지 못한다. 합쳤다는 사실을 말하지 않으면 어디서 왔는지 못 본다. */
    merged: (before: string, added: string, after: string) =>
      `${before} 에 ${added} 을(를) 더해 ${after} 이(가) 됩니다`,
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      negative: '수량은 0보다 작을 수 없습니다',
      overPooled: (limit: string) => `원 포장에 있는 ${limit} 을(를) 넘을 수 없습니다`,
    },
  },
  remainder: {
    legend: '남는 것',
    /** 안 적으면 작업자가 잔량 라벨도 새로 뽑으려 한다. */
    keepsNumber: (no: string) => `${no} — 분할 잔량은 원 포장 번호를 그대로 씁니다`,
    none: '원 포장이 비워집니다',
  },
  /** 발번과 인쇄는 POP 이 한다. 여기서 기다리게 두면 오지 않는 것을 기다린다. */
  labelNotice: '라벨 발행은 POP 에서 합니다. 이 화면은 구성만 바꿉니다.',
  submit: '재구성 확정',
  noWorker: '사번을 확인한 뒤에 재구성할 수 있습니다',
  noType: '재구성 유형을 고르세요',
  sent: {
    title: '재구성을 기록했습니다',
  },
  queued: {
    title: '재구성을 담아 두었습니다',
    /** 오프라인에서 확정하면 POP 대기 목록에 바로 안 올라간다. */
    description: '연결되면 보냅니다. 동기화 후에 POP 대기 목록에 올라갑니다.',
  },
  rejected: {
    title: '재구성이 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  another: '다음 재구성',
} as const;
