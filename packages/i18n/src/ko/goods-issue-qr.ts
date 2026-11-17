/**
 * P-01-02 분할 LOT 라벨(008 · omf-all-around#289).
 *
 * 부분 출고로 떼어 낸 수량은 분할 LOT(새 자재 관리 LOT)이 되고, 이 화면은 그 봉지에 붙일 **자재 관리 LOT 라벨**을
 * 찍는다. 출고 QR(라인·파렛트)은 더 발행하지 않는다 — 이미 붙은 출고 QR 은 PDA 생산창고 입고가 계속 읽는다.
 */
export const goodsIssueQr = {
  title: '분할 LOT 라벨',
  terminalLabel: '단말#',
  terminalUnknown: '확인되지 않음',

  /** 라벨 안 찍은 분할 LOT — 기간과 상관없이 모두 센다(FR-008). */
  band: {
    unknownTitle: '라벨 안 찍은 분할 LOT 건수를 받지 못했습니다',
    unknownBody: '목록을 다시 불러오세요. 받기 전까지는 「없음」이 아닙니다.',
    noneTitle: '라벨 안 찍은 분할 LOT 없음',
    noneBody: '부분 출고로 생긴 분할 LOT 은 모두 라벨을 찍었습니다.',
    title: (count: number) => `라벨 안 찍은 분할 LOT ${String(count)}건`,
    body: '봉지에 라벨이 없으면 생산창고 입고(PDA)·자재 투입(POP)에서 스캔할 수 없습니다. 기간과 상관없이 모두 보입니다.',
    failed: (count: number) => `인쇄 실패 ${String(count)}건`,
    oldest: (at: string, age: string) => `가장 오래된 것 ${at} · ${age}`,
    showUnprinted: '라벨 안 찍음 보기',
  },

  tabs: {
    label: '보기',
    unprinted: '라벨 안 찍음',
    printed: '찍음',
  },
  search: {
    label: '분할 LOT 찾기',
    /* 좁은 칸에서도 잘리지 않게 짧게 — 분할·원래 LOT 번호 스캔, 출고번호·품목코드 입력(시안 P0102-After 의 뜻). */
    placeholder: 'LOT 번호 스캔 · 출고번호 · 품목코드',
    clear: '지우기',
  },
  /** 찍음 보기의 기간 — 서버가 출고일로 거른다(contracts §4). */
  periods: {
    label: '출고일',
    today: '오늘',
    week: '최근 7일',
    month: '최근 30일',
  },
  refresh: '새로 고침',
  refreshedAt: (at: string) => `${at} 받음`,
  info: '부분 출고로 떼어 낸 수량은 분할 LOT(새 자재 관리 LOT)이 됩니다. 라벨은 자재 관리 LOT 라벨과 같은 양식이고 QR 에는 분할 LOT 번호가 실립니다. 출고 QR 은 더 발행하지 않습니다 — 이미 붙은 출고 QR 은 PDA 생산창고 입고에서 계속 읽힙니다.',

  table: {
    label: '분할 LOT',
    select: '선택',
    lotNo: '분할 LOT 번호 · 원래 LOT',
    item: '품목',
    qty: '수량',
    issue: '출고번호 · 라인',
    destination: '도착 창고 · 위치',
    splitAt: '분할 시각',
    splitAtOldestFirst: '분할 시각 ↑',
    labelColumn: '라벨',
    parentLabel: '원래',
    line: (lineNo: number) => `라인 ${String(lineNo)}`,
    today: '오늘',
    daysAgo: (days: number) => `${String(days)}일 지남`,
    choose: (lotNo: string) => `${lotNo} 고르기`,
  },
  status: {
    unissued: '미발행',
    failed: (count: number) => `인쇄 실패 · ${String(count)}회`,
    failedHint: '사유 골라 다시 찍기',
    pending: (seq: number) => `찍음 ${String(seq)}회 · 결과 미확인`,
    printed: (seq: number) => `찍음 ${String(seq)}회`,
  },
  empty: {
    unprintedTitle: '라벨을 찍을 분할 LOT 이 없습니다',
    unprintedBody:
      '부분 출고하면 떼어 낸 수량이 분할 LOT 이 되어 여기에 나옵니다. 전량 출고는 이미 붙은 자재 관리 LOT 라벨을 그대로 씁니다.',
    printedTitle: (period: string) => `${period} 안에 찍은 분할 LOT 라벨이 없습니다.`,
    printedBody: '기간을 넓혀 보세요.',
    searchTitle: '찾는 분할 LOT 이 이 목록에 없습니다.',
    searchNone:
      '번호를 확인하세요. 전량 출고한 LOT 은 분할 LOT 이 생기지 않아 여기 나오지 않습니다.',
    searchInPrinted: (lotNo: string) => `이미 라벨을 찍은 분할 LOT 입니다(${lotNo}).`,
    searchInUnprinted: (lotNo: string) => `아직 라벨을 안 찍은 분할 LOT 입니다(${lotNo}).`,
    showInPrinted: '「찍음」에서 보기',
    showInUnprinted: '「라벨 안 찍음」에서 보기',
    loadFailedTitle: '분할 LOT 목록을 불러오지 못했습니다.',
    loadFailedBody: '연결을 확인한 뒤 다시 불러오세요. 이 상태에서는 라벨을 찍을 수 없습니다.',
    retry: '다시 불러오기',
  },
  reasons: {
    needFailed: (count: number) =>
      `인쇄 실패한 ${String(count)}장은 회차가 이미 올라 있어 사유를 골라야 찍습니다`,
    need: '사유를 고르세요',
  },
  bar: {
    pickHint: '라벨을 찍을 분할 LOT 을 고르세요 — 오래된 것이 위에 있습니다',
    selected: (count: number) => `${String(count)}개 선택`,
    withFailed: (count: number) => ` · 인쇄 실패 ${String(count)}개 포함`,
    failedNeedsReason: '인쇄 실패한 것은 재발행 사유를 골라야 찍습니다',
    selectAll: (count: number) => `전체 선택 (${String(count)})`,
    clearAll: '전체 해제',
    clearSelection: '선택 해제',
    print: (count: number) => `라벨 ${String(count)}장 찍기`,
    printNone: '라벨 찍기',
    reprintHint: '다시 찍을 라벨을 고르거나 스캔하세요',
    reprintSelected: (count: number) => `${String(count)}장 선택`,
    withReason: (reason: string) => ` · 사유 ${reason}`,
    reprintNeedsReason: '사유를 골라야 다시 찍을 수 있습니다',
    reprint: (count: number) => `${String(count)}장 다시 찍기`,
    reprintNone: '다시 찍기',
    listFirst: '목록을 받은 뒤 라벨을 찍을 수 있습니다',
    running: (done: number, total: number) => `라벨 찍는 중 ${String(done)} / ${String(total)}`,
  },
  preview: {
    title: '분할 LOT 라벨 미리 보기',
    reprintTitle: '다시 찍기 미리 보기',
    note: '자재 관리 LOT 라벨과 같은 양식입니다. QR 에는 분할 LOT 번호만 실리고, 라벨에는 품목·수량(분할 수량)·공급사가 보입니다. 패키징 줄은 없습니다.',
    reissueNote: (reason: string) => ` 사유 「${reason}」, 출력 차수가 하나 오릅니다.`,
    guide: '80 × 30 mm · QR = 분할 LOT 번호',
    bag: '붙일 봉지',
    bagValue: (qty: string, issueNo: string, lineNo: number, destination: string) =>
      `${qty} · 출고 ${issueNo} 라인 ${String(lineNo)}${destination === '' ? '' : ` · 도착 ${destination}`}`,
    parent: '원래 LOT',
    prev: '◀ 이전',
    next: '다음 ▶',
    page: (index: number, total: number) => `${String(index)} / ${String(total)}장`,
    cancel: '취소',
    print: (count: number) => `${String(count)}장 인쇄`,
    reprint: (count: number) => `${String(count)}장 다시 찍기`,
    printer: (name: string) => `프린터 ${name}`,
    printerDefault: '프린터 서버 기본값',
  },
  result: {
    printed: (count: number) =>
      `${String(count)}장 인쇄했습니다 — 봉지에 붙여 두세요. 찍은 분할 LOT 은 「찍음」으로 옮겼습니다.`,
    reprinted: (count: number) =>
      `${String(count)}장 다시 찍었습니다 — 출력 차수가 올랐습니다. 헌 라벨은 떼어 버리세요.`,
    partial: (total: number, printed: number, failed: number) =>
      `${String(total)}장 중 ${String(printed)}장 인쇄 · ${String(failed)}장 인쇄 실패 — 프린터 연결과 용지를 확인하세요. 실패한 것은 「라벨 안 찍음」에 남아 있으니 사유를 골라 다시 찍으세요.`,
    notSent: (count: number) => ` 보내지 않은 ${String(count)}장은 그대로 남아 있습니다.`,
    forbidden: '이 단말에는 라벨 발행 권한이 없습니다. 관리자에게 알리세요.',
    issueFailed: (count: number, reason: string) =>
      `${String(count)}장은 발행하지 못했습니다${reason === '' ? '' : ` — ${reason}`}.`,
    showPrinted: '찍음 보기',
    close: '닫기',
  },
} as const;
