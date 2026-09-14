/**
 * M-02-02 수리 왕복 투입·반출 스캔 — 불량을 수리에 넣고, 마치고 꺼낸 사실을 남긴다.
 *
 * 왕복의 앞뒤가 한 화면에 있다. 앞쪽이 서버에 없으면 뒤쪽이 붙을 곳이 없어, 이 화면은
 * 연결이 있어야만 선다.
 *
 * 수리한 물건은 원래 LOT 으로 돌아가지 않는다. 그래서 이 화면은 반출까지만 말하고 그다음을
 * 약속하지 않는다.
 */
export const repairRoundtrip = {
  title: '수리 왕복 스캔',
  tabs: {
    dispatch: '수리 투입',
    return: '수리 반출',
  },
  /** 연결이 끊긴 채로 열면 앞쪽 기록을 만들 수 없다. */
  offline: {
    title: '연결이 있어야 할 수 있습니다',
    description: '수리 투입과 반출은 연결이 있는 동안에만 기록됩니다. 연결을 확인하세요.',
    /** 하다가 끊긴 것은 다르다. 스캔한 것을 지우지 않고 저장만 미룬다. */
    duringWork: '연결이 끊겼습니다. 스캔한 것은 그대로 두었으니 연결되면 이어서 하세요.',
  },
  scan: {
    label: '불량 LOT 스캔',
    placeholder: '불량 LOT 라벨을 스캔하세요',
    loading: 'LOT을 찾는 중입니다',
    loadFailed: 'LOT을 확인할 수 없습니다. 연결을 확인한 뒤 다시 스캔하세요.',
    notFound: (code: string) => `${code} LOT을 찾지 못했습니다`,
    /** 스캐너가 못 읽는 라벨이 있다. 스캔 칸 자체를 열어 손으로 넣는다. */
    manualLabel: '직접 입력',
    manualSubmit: '입력한 값으로 찾기',
  },
  defect: {
    legend: '불량 정보',
    loading: '불량 기록을 불러오는 중입니다',
    /** 확인하지 못한 것을 불량이 아닌 것으로 말하지 않는다. */
    loadFailed: '불량 기록을 확인할 수 없습니다. 연결을 확인한 뒤 다시 스캔하세요.',
    none: (lotNo: string) => `불량 판정된 LOT이 아닙니다 — 읽은 값 ${lotNo}`,
    /** 조회한 창의 길이를 함께 적는다. 창 밖의 불량을 없는 것으로 읽지 않게 한다. */
    window: (days: number) => `최근 ${String(days)}일 안에서 찾았습니다`,
    pick: '수리할 불량을 고르세요',
    qty: (qty: string, uom: string) => `불량 ${qty} ${uom}`,
    /* 카드로 세우면 고른 것을 색으로 말할 수 없다. 표를 달아 무엇을 골랐는지 남긴다. */
    picked: '선택됨',
    /** 수량만으로는 고를 수 없다. 무엇이 잘못됐는지가 고르는 기준이다. */
    code: (code: string, name: string) => `${code} ${name}`,
    unknownCode: '불량 코드를 확인할 수 없습니다',
    detectedAt: (at: string) => `검출 ${at}`,
  },
  qty: {
    label: '수리 수량',
    empty: '수리 수량을 적으세요',
    notNumber: '수리 수량은 숫자로 적으세요',
    notPositive: '수리 수량은 0보다 커야 합니다',
    overDefect: (limit: string) => `수리 수량은 불량 수량 ${limit}을(를) 넘을 수 없습니다`,
  },
  dispatch: {
    submit: '투입 등록',
    /** 같은 불량을 두 번 투입하면 왕복이 갈라져 어느 쪽이 닫혔는지 알 수 없다. */
    already: '이미 수리 투입되었습니다',
    alreadyAt: (at: string) => `투입 ${at}`,
    done: '수리 투입을 기록했습니다',
    failed: '수리 투입을 기록하지 못했습니다. 다시 시도하세요.',
  },
  return: {
    legend: '수리 결과',
    submit: '반출 등록',
    succeeded: '수리 성공',
    failed: '수리 실패',
    /** 앞쪽이 없으면 왕복이 성립하지 않는다. */
    noOpen: '수리 투입 기록이 없습니다',
    /* 어느 LOT 의 건인지 모르면 남의 것을 반출하게 된다. 무엇을 해야 하는지 먼저 말한다. */
    needScan: '불량 LOT 을 먼저 스캔하세요',
    done: '수리 반출을 기록했습니다',
    /** 반출까지가 이 화면의 몫이다. 재투입은 다른 화면이 한다. */
    afterNote: '수리한 물건을 다시 투입하는 것은 이 화면에서 하지 않습니다',
    error: '수리 반출을 기록하지 못했습니다. 다시 시도하세요.',
  },
  open: {
    legend: (count: number) => `수리 중 ${String(count)}건`,
    caption: '아직 반출되지 않은 수리 건',
    none: '수리 중인 건이 없습니다',
    loadFailed: '수리 중인 건을 확인할 수 없습니다',
    /* 카드로 세우면 고른 것을 색으로 말할 수 없다. 표를 달아 무엇을 골랐는지 남긴다. */
    picked: '선택됨',
    /* 계약에 수리 건의 업무 번호가 없다. 대리키를 번호인 척 세우지 않는다. */
    columns: {
      qty: '수량',
      startedAt: '투입',
    },
  },
  noWorker: '사번을 확인한 뒤에 기록할 수 있습니다',
} as const;
