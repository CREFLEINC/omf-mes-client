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
  /** 전송 실패한 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
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
    blind: '전산 잔량을 감춘 실사입니다. 실물만 세어 적으세요.',
    /*
     * 창고를 순회하는 일이라 한 번에 끝나지 않는다. 남은 양을 말하지 않으면 언제 끝나는지
     * 모른 채 돌게 된다. 센 라인 수는 서버가 세어 준다.
     */
    progress: (counted: string, planned: string) => `진행 ${counted} / ${planned}`,
    progressLabel: '실사 진행',
  },
  location: {
    legend: '위치 스캔',
    scanLabel: '위치 스캔',
    scanPlaceholder: '위치 QR을 스캔하세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: '이 위치의 라인을 불러오는 중입니다',
    loadFailed: '라인을 불러오지 못했습니다. 연결을 확인하세요.',
    notFound: (code: string) => `${code} 위치를 찾지 못했습니다`,
    picked: (code: string) => `위치 ${code}`,
    /** 장부에 없는 물건이 나올 수 있다. 그것을 적을 길은 이 슬라이스에 없다. */
    empty: '이 위치에는 실사 라인이 없습니다. 전산에 없는 물건은 관리웹에서 추가합니다.',
  },
  lines: {
    legend: '실물 수량',
    /*
     * 대리키를 보이면 실물 라벨과 대조할 수 없다. 라벨에는 품목 코드와 LOT 번호가 찍혀 있다.
     *
     * 둘 중 하나를 아직 못 받았으면 구분점만 남겨 두지 않는다 - 뒤가 빈 채로 서면 값이
     * 잘린 것처럼 읽힌다.
     */
    name: (item: string, lotNo: string) => [item, lotNo].filter((part) => part !== '').join(' · '),
    /*
     * 눈에 보이는 라벨은 짧게 둔다. 줄 이름은 바로 위에 제목으로 서 있어, 라벨에 또 적으면
     * 한 줄에 같은 이름이 두 번 선다.
     */
    qty: '실물 수량 입력',
    /** 어느 줄의 칸인지는 눈으로 보고, 화면을 읽어 주는 도구는 이 이름으로 가른다. */
    qtyLabel: (name: string) => `${name} 실물 수량 입력`,
    /*
     * 전산 잔량은 블라인드가 아닐 때만 온다. 감춘 실사에서도 자리는 남긴다 - 지우면 장부가
     * 없는 실사와 구별되지 않아, 가려진 것인지 원래 없는 것인지 줄을 보고 알 수 없다.
     */
    systemQty: (qty: string, unit: string) => `전산 잔량 ${[qty, unit].join(' ').trim()}`,
    /** 감춘 자리. 값이 아니라 가렸다는 사실을 적는다. */
    masked: '▪▪▪',
    /*
     * 세어 적은 값과 전산 잔량의 차이. 되돌릴 수 없는 재고 조정이 이 수만큼 나간다 - 사유를
     * 요구하면서 얼마인지 말하지 않으면 사람이 암산해 고르게 된다.
     */
    diffOver: (qty: string, unit: string) => `차이 ${[qty, unit].join(' ').trim()} 많음`,
    diffShort: (qty: string, unit: string) => `차이 ${[qty, unit].join(' ').trim()} 부족`,
    /*
     * 덮어쓸 수 있게 두되 앞서 적은 값을 보인다 - 무엇을 바꾸는지 모르고 바꾸지 않게.
     *
     * 무엇의 값인지 적는다. 전산 잔량과 나란히 서면 둘 다 숫자라, 전산 재고인지 내가 앞서
     * 센 값인지 문구로 갈리지 않으면 알 수 없다.
     */
    already: (qty: string, unit: string) => `앞서 센 값 ${[qty, unit].join(' ').trim()}`,
    /*
     * 안 센 것과 0 으로 센 것은 다르다. 안 센 라인은 보내지 않는다.
     *
     * 무엇을 안 셌는지 적는다. 라인마다 서는 말이라 그 라인의 실물을 가리킨다는 것이
     * 드러나야 한다.
     */
    uncounted: '이 라인은 아직 세지 않았습니다',
    reason: '차이 사유',
    reasonLabel: (name: string) => `${name} 차이 사유`,
    reasonPlaceholder: '차이 사유를 고르세요',
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      negative: '수량은 0보다 작을 수 없습니다',
    },
    /** 0 은 유효한 답이다. 세어 보니 없더라를 적는 자리다. */
    zeroHint: '실물이 없으면 0 을 적습니다. 비워 두면 아직 세지 않은 것으로 남습니다.',
  },
  submit: '이 위치 완료',
  noWorker: '사번을 먼저 확인하세요',
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '실물 수량을 저장하지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  sent: {
    title: '이 위치를 끝냈습니다',
  },
  held: {
    title: '실물 수량을 전송 대기에 넣었습니다',
    description: '연결되면 보냅니다.',
  },
  rejected: {
    title: '실물 수량을 전송하지 못했습니다',
    description: '전송 실패한 기록에서 사유를 확인하세요. ',
    action: '전송 실패한 기록 보기',
  },
  another: '다음 위치',
} as const;
