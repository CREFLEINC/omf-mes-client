/**
 * P-01-02 분할 LOT 라벨(008 · omf-all-around#289 · #295 시안).
 *
 * 부분 출고로 떼어 낸 수량은 분할 LOT(새 자재 관리 LOT)이 되고, 이 화면은 그 봉지에 붙일 **자재 관리 LOT 라벨**을
 * 찍는다. 출고 QR(라인·파렛트)은 더 발행하지 않는다 — 이미 붙은 출고 QR 은 PDA 생산창고 입고가 계속 읽는다.
 */
export const goodsIssueQr = {
  title: '분할 LOT 라벨',

  /** 라벨 발행 화면 공통 탭 이름 — 발행 대기(라벨 안 찍음 · 인쇄 실패) / 재발행(찍음). */
  /** 발행 대기 요약 한 줄 — 인쇄 실패 · 가장 오래된 것(기간과 상관없이). */
  band: {
    failed: (count: number) => `인쇄 실패 ${String(count)}건`,
    oldest: (at: string, age: string) => `가장 오래된 것 ${at} · ${age}`,
    showUnprinted: '발행 대기 보기',
  },

  tabs: {
    label: '보기',
    unprinted: '발행 대기',
    printed: '재발행',
  },
  /** 맨 위 스캔 칸 — 분할·원래 LOT 번호 스캔, [직접 입력]으로 출고번호·품목코드. */
  search: {
    label: 'LOT 번호 · 출고번호 · 품목코드',
    placeholder: '라벨을 스캔하세요',
    manualTitle: '분할 LOT 찾기',
    /** 찾는 말로 거른 표 — 칸 아래 안내 줄. */
    filtered: (query: string) => `「${query}」(으)로 찾은 결과입니다.`,
    clearFilter: '전체 삭제',
    notFound: (code: string) => `「${code}」에 해당하는 분할 LOT이 없습니다 — 번호를 확인하세요.`,
    /** 재발행 탭 할 일 한 줄. */
  },
  /** 재발행 보기의 기간 — 서버가 출고일로 거른다(contracts §4). */
  periods: {
    label: '출고일',
    today: '오늘',
    week: '최근 7일',
    month: '최근 30일',
  },
  /** 표 구획 왼쪽 아래 정렬(분할 시각). */
  order: {
    label: '정렬',
    newest: '최신순',
    oldest: '오래된순',
  },
  help: {
    button: '도움말',
    body: [
      '부분 출고로 떼어 낸 수량은 분할 LOT(새 자재 관리 LOT)이 됩니다. 전량 출고는 이미 붙은 자재 관리 LOT 라벨을 그대로 씁니다.',
      '라벨은 자재 관리 LOT 라벨과 같은 양식이고(포장 줄 없음), QR에는 분할 LOT 번호만 실립니다. 라벨에는 품목·수량(분할 수량)·공급사가 보입니다.',
      '봉지에 라벨이 없으면 생산창고 입고(PDA)·자재 투입(POP)에서 스캔할 수 없습니다. 이미 붙은 출고 QR은 PDA 생산창고 입고에서 계속 읽힙니다.',
      '재인쇄하면 인쇄 회차가 하나 오르고 사유가 남습니다.',
    ],
  },

  table: {
    label: '분할 LOT',
    select: '선택',
    lotNo: '분할 LOT 번호 · 기존 LOT',
    item: '품목',
    qty: '수량',
    issue: '출고번호 · 도착',
    splitAt: '분할 시각',
    labelColumn: '라벨',
    parentLabel: '원래',
    /** 출고번호 아래 줄 — 「라인 1 · WH-P1 / S220-WIP」. */
    lineDestination: (lineNo: number, destination: string) =>
      destination === '' ? `라인 ${String(lineNo)}` : `라인 ${String(lineNo)} · ${destination}`,
    today: '오늘',
    daysAgo: (days: number) => `${String(days)}일 지남`,
    choose: (lotNo: string) => `${lotNo} 고르기`,
  },
  status: {
    unissued: '인쇄 대기',
    failed: (count: number) => `인쇄 실패 ${String(count)}회`,
    pending: (seq: number) => `인쇄 ${String(seq)}회 · 결과 미확인`,
    printed: (seq: number) => `인쇄 완료 ${String(seq)}회`,
  },
  empty: {
    unprintedTitle: '라벨을 발행할 분할 LOT이 없습니다.',
    unprintedBody: '부분 출고하면 여기에 나옵니다.',
    printedTitle: (period: string) => `${period} 안에 라벨을 인쇄한 분할 LOT이 없습니다.`,
    printedBody: '출고일 기간을 넓혀 보세요.',
    searchTitle: (tab: string) => `찾는 LOT이 「${tab}」에 없습니다.`,
    searchNone: '번호를 확인하세요.',
    searchInPrinted: (lotNo: string) => `이미 라벨을 인쇄한 LOT입니다(${lotNo}).`,
    searchInUnprinted: (lotNo: string) => `아직 라벨을 인쇄하지 않은 LOT입니다(${lotNo}).`,
    showInPrinted: '「재발행」에서 보기',
    showInUnprinted: '「발행 대기」에서 보기',
    loadFailedTitle: '분할 LOT 목록을 불러오지 못했습니다.',
    loadFailedBody: '연결을 확인한 뒤 다시 불러오세요. 이 상태에서는 라벨을 발행할 수 없습니다.',
    retry: '다시 불러오기',
  },
  reasons: {
    label: '재인쇄 사유',
    needFailed: (count: number) =>
      `인쇄가 실패한 LOT ${String(count)}건의 재인쇄 사유를 선택하세요`,
    need: '사유를 선택하세요',
  },
  bar: {
    label: '작업',
    selectAll: (count: number) => `전체 선택 (${String(count)}건)`,
    clearAll: (count: number) => `전체 해제 (${String(count)}건)`,
    clearSelection: '선택 해제',
    print: (count: number) => `라벨 ${String(count)}장 발행`,
    printNone: '라벨 발행',
    reprint: (count: number) => `${String(count)}장 재인쇄`,
    reprintNone: '재인쇄',
    running: (done: number, total: number) => `라벨 인쇄 중 ${String(done)} / ${String(total)}`,
  },
  preview: {
    title: '라벨 발행 미리 보기',
    reprintTitle: '재인쇄 미리 보기',
    note: '자재 관리 LOT 라벨과 같은 양식입니다. QR에는 분할 LOT 번호만 실리고, 라벨에는 품목·수량(분할 수량)·공급사가 보입니다. 포장 줄은 없습니다.',
    reissueNote: (reason: string) =>
      ` 사유 「${reason}」로 재인쇄합니다. 인쇄 회차가 하나 오릅니다.`,
    guide: '80 × 30 mm · QR = 분할 LOT 번호',
    bag: '붙일 봉지',
    bagValue: (qty: string, issueNo: string, lineNo: number, destination: string) =>
      `${qty} · 출고 ${issueNo} 라인 ${String(lineNo)}${destination === '' ? '' : ` · 도착 ${destination}`}`,
    parent: '기존 LOT',
    prev: '◀ 이전',
    next: '다음 ▶',
    page: (index: number, total: number) => `${String(index)} / ${String(total)}장`,
    cancel: '취소',
    print: (count: number) => `${String(count)}장 인쇄`,
    reprint: (count: number) => `${String(count)}장 재인쇄`,
    printer: (name: string) => `프린터 ${name}`,
    printerDefault: '프린터 서버 기본값',
  },
  result: {
    printed: (count: number) => `라벨 ${String(count)}장을 발행했습니다. 봉지에 부착하세요.`,
    reprinted: (count: number) =>
      `라벨 ${String(count)}장을 재인쇄했습니다. 기존 라벨을 제거하고 새 라벨을 부착하세요.`,
    partial: (total: number, printed: number, failed: number) =>
      `${String(total)}장 중 ${String(printed)}장 인쇄 · ${String(failed)}장 인쇄 실패 — 프린터 연결과 용지를 확인하세요. 실패한 것은 「발행 대기」에 남아 있으니 사유를 선택해 재인쇄하세요.`,
    notSent: (count: number) => ` 보내지 않은 ${String(count)}장은 그대로 남아 있습니다.`,
    forbidden: '이 단말에는 라벨 발행 권한이 없습니다. 관리자에게 알리세요.',
    issueFailed: (count: number, reason: string) =>
      `${String(count)}장은 발행하지 못했습니다${reason === '' ? '' : ` — ${reason}`}.`,
    showPrinted: '재발행 보기',
  },
} as const;
