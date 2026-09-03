/**
 * M-01-06 입하 오류 등록 — 받은 것이 예정과 다르다는 사실을 남긴다.
 *
 * 한 번 등록하면 고칠 수 없다. 계약에 수정·삭제 경로가 없어, 누르기 전에 그 사실을 묻는다.
 *
 * 반품이냐 폐기냐는 이 화면이 정하지 않는다. 현장은 적고, 판단은 담당자가 한다.
 */
export const inboundVariance = {
  title: '입하 오류 등록',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '입하 오류',
  receipt: {
    legend: '대상 입하',
    searchLabel: '입하번호 검색',
    searchPlaceholder: '입하번호 일부를 적으세요',
    loading: '입하를 불러오는 중입니다',
    loadFailed: '입하를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '입하를 찾지 못했습니다',
    pickLabel: '입하 고르기',
    pickPlaceholder: '입하를 고르세요',
    linesLoading: '입하 라인을 불러오는 중입니다',
    linesLoadFailed: '입하 라인을 확인할 수 없습니다',
    linesNone: '이 입하에 라인이 없습니다',
    lineLabel: (no: number, qty: string) => `${String(no)}번 줄 · 실입하 ${qty}`,
    chosen: (no: number, qty: string) => `고른 줄 ${String(no)}번 · 실입하 ${qty}`,
    change: '다른 대상 고르기',
    itemLoadFailed: '품목을 확인할 수 없습니다',
  },
  known: {
    legend: '이미 적힌 오류',
    loading: '적힌 오류를 불러오는 중입니다',
    loadFailed: '적힌 오류를 확인할 수 없습니다',
    none: '이 줄에 적힌 오류가 없습니다',
    item: (type: string, qty: string) => `${type} ${qty}`,
    /** 담아 둔 것은 서버에 없다. 목록에 나오지 않는다는 사실을 함께 적는다. */
    pending: (count: number) => `담아 둔 오류 ${String(count)}건 — 아직 서버에 없습니다`,
  },
  form: {
    legend: '오류 내용',
    typeLabel: '오류 유형',
    typePlaceholder: '유형을 고르세요',
    typeLoadFailed: '오류 유형을 불러오지 못했습니다',
    qtyLabel: '대상 수량',
    /** 방향은 유형이 말한다. 사람에게는 얼마인지만 묻는다. */
    qtyNote: '모자란 양이든 넘친 양이든 양수로 적습니다',
    empty: '대상 수량을 적으세요',
    notNumber: '대상 수량은 숫자로 적으세요',
    notPositive: '대상 수량은 0보다 커야 합니다',
    reasonLabel: '사유',
    reasonPlaceholder: '사유를 고르세요',
    /** 사유를 모를 때 기록 자체가 막히면 안 된다. */
    reasonOptional: '사유는 비워도 됩니다',
    reasonLoadFailed: '사유를 불러오지 못했습니다',
    /** 예정 수량이 이 화면에 닿지 않아 차이와 견주지 못한다. 못 하는 것을 감추지 않는다. */
    noExpectedQty: '예정 수량이 이 화면에 오지 않아 차이와 견주지 못합니다',
  },
  confirm: {
    title: '등록하면 고칠 수 없습니다',
    body: '입하 오류는 등록 뒤에 수정하거나 지울 수 없습니다. 진행할까요?',
    cancel: '돌아가기',
    proceed: '등록합니다',
  },
  submit: '오류 등록',
  sent: {
    title: '입하 오류를 등록했습니다',
    /** 반품이냐 폐기냐는 이 화면이 정하지 않는다. */
    description: '담당자 확인을 기다립니다. 반품과 폐기는 이 화면에서 정하지 않습니다.',
  },
  queued: {
    title: '입하 오류를 담아 두었습니다',
    description: '연결되면 보냅니다. 아직 서버에 없습니다.',
  },
  rejected: {
    title: '입하 오류가 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 등록되지 않았다고 말한다. */
  saveFailed: {
    title: '오류를 담아 두지 못했습니다',
    description: '등록되지 않았습니다. 다시 시도하세요.',
  },
  noWorker: '사번을 확인한 뒤에 기록할 수 있습니다',
  another: '다음 오류',
} as const;
