/**
 * M-01-11 실물 카운트 — 창고에서 실제 물건을 센다.
 *
 * 세기만 한다. 장부와 다르다고 고치는 것은 관리웹이 한다.
 *
 * 아직 세지 않은 것과 세었더니 0개인 것은 다르다. 안 센 것을 0 으로 보내면 관리웹이 그것을
 * 전량 손실로 잡는다 - 센 라인만 보낸다.
 */
export const physicalCount = {
  title: '실물 카운트',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    counted: '실물 카운트',
  },
  plan: {
    legend: '실사 고르기',
    loading: '진행 중인 실사를 찾는 중입니다',
    loadFailed: '실사 목록을 불러오지 못했습니다. 연결을 확인하세요.',
    none: '진행 중인 실사가 없습니다',
    pick: '실사',
    pickPlaceholder: '실사를 고르세요',
    item: (no: string, date: string) => `${no} · ${date}`,
    /** 장부를 감추는 실사다. 작업자가 장부 수를 보고 그대로 적는 것을 막는다. */
    blind: '장부 수량을 감춘 실사입니다. 실물만 세어 적으세요.',
  },
  location: {
    legend: '위치 스캔',
    scanLabel: '위치 스캔',
    scanPlaceholder: '위치 QR을 비추세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: '이 위치의 라인을 불러오는 중입니다',
    loadFailed: '라인을 불러오지 못했습니다. 연결을 확인하세요.',
    notFound: (code: string) => `${code} 위치를 찾지 못했습니다`,
    picked: (code: string) => `위치 ${code}`,
    /** 장부에 없는 물건이 나올 수 있다. 그것을 적을 길은 이 슬라이스에 없다. */
    empty: '이 위치에는 실사 라인이 없습니다. 장부에 없는 물건은 관리웹에서 추가합니다.',
  },
  lines: {
    legend: '실물 수량',
    /* 대리키를 보이면 실물 라벨과 대조할 수 없다. 라벨에는 품목 코드와 LOT 번호가 찍혀 있다. */
    name: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    qtyLabel: (name: string) => `${name} 실물 수량`,
    /** 장부는 블라인드가 아닐 때만 온다. */
    systemQty: (qty: string) => `장부 ${qty}`,
    /** 덮어쓸 수 있게 두되 이전 값을 보인다 - 무엇을 바꾸는지 모르고 바꾸지 않게. */
    already: (qty: string) => `이전 값 ${qty}`,
    /** 안 센 것과 0 으로 센 것은 다르다. 안 센 라인은 보내지 않는다. */
    uncounted: '아직 세지 않음',
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      negative: '수량은 0보다 작을 수 없습니다',
    },
    /** 0 은 유효한 답이다. 세어 보니 없더라를 적는 자리다. */
    zeroHint: '실물이 없으면 0 을 적습니다. 비워 두면 아직 세지 않은 것으로 남습니다.',
  },
  submit: '이 위치 완료',
  noWorker: '사번을 확인한 뒤에 셀 수 있습니다',
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '센 것을 담아 두지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  sent: {
    title: '이 위치를 끝냈습니다',
  },
  held: {
    title: '센 것을 담아 두었습니다',
    description: '연결되면 보냅니다.',
  },
  rejected: {
    title: '센 것이 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  another: '다음 위치',
} as const;
