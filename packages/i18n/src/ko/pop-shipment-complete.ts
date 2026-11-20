/**
 * P-04-07 출하 완료(POP · 피처 010 · omf-all-around#305).
 *
 * 출하 지시서 코드(PDA 화면 QR · 인쇄 QR)를 스캔하거나 [지시서 검색]으로 고르면 확인 화면이 열리고, [출하 완료] 한 번으로
 * 출하가 끝난다. ⛔ ERP 송신 여부는 이 화면 어디에도 말하지 않는다(사용자 결정 2026-11-18).
 * 문구는 현장 단말용으로 짧게, 할 일을 먼저 쓴다. 가운뎃점으로 항목을 잇지 않는다(C-13).
 */
export const popShipmentComplete = {
  /** 메뉴 이름(`pop-screen-catalog.ts`)과 같은 말이다. */
  title: '출하 완료',

  scan: {
    /* 칸 위 이름 — 칸 안 흐린 안내는 두지 않는다(POP 공통 · 사용자 지시 2026-11-19). */
    label: '출하 지시서 조회',
    /** [직접 입력] 창에 넣을 값의 이름 — 창 칸 안내가 「출하 지시서 번호를 입력하세요」다. */
    manualLabel: '출하 지시서 번호',
    search: '지시서 검색',
    looking: '지시서를 여는 중입니다.',
    notCode: (value: string): string =>
      `출하 지시서 코드가 아닙니다. 읽은 값: ${value}. LOT 라벨이 아니라 지시서 QR 을 스캔하세요.`,
    notFound: (value: string): string => `찾을 수 없는 출하 지시서입니다. 읽은 값: ${value}`,
    failed: '지시서를 열지 못했습니다. 연결을 확인한 뒤 다시 스캔하세요.',
    /* [직접 입력] — 손으로 친 지시서 번호(SR-…)만으로도 연다. 못 찾으면 친 값을 그대로 보인다(둘러보기 W-2). */
    directNotFound: (value: string): string =>
      `찾을 수 없는 출하 지시서입니다. 입력한 값: ${value}. 지시서 번호(SR-…)를 확인하세요.`,
    /* 새 코드가 열리지 않았을 때 — 아래 확인 화면은 앞서 연 지시서다(둘러보기 W-3). */
    previousStill: (requestNo: string): string => `아래 화면은 앞서 연 지시서 ${requestNo} 입니다.`,
  },

  head: {
    request: '출하 지시서',
    customer: '고객',
    shipTo: '납품처',
    salesOrder: '수주',
    noSalesOrder: '없음(수주 없이 작성)',
    ready: '출하 가능',
    blocked: '출하 불가',
    /** 「이름 (코드)」(C-10). */
    named: (name: string, code: string): string => `${name} (${code})`,
  },

  blockers: {
    heading: '출하할 수 없습니다',
    PICKING_SHORT: {
      title: '피킹 수량이 부족합니다',
      hint: 'PDA 제품 피킹에서 출하 LOT을 확인해 주세요.',
    },
    /*
     * 라인을 짚지 않은 피킹 부족 — 서버가 «낼 피킹 LOT 이 하나도 없을 때» 내는 이유다(라인 수량은 다 찼어도 난다).
     * 「수량이 부족합니다」로 쓰면 지시 20 / 피킹 20 화면과 어긋나 보여 실제 까닭대로 쓴다.
     */
    noPickedLot: {
      title: '피킹된 출하 LOT이 없습니다',
      hint: 'PDA 제품 피킹에서 출하 LOT을 확인해 주세요.',
    },
    NOT_INSPECTED: {
      title: '검사하지 않은 LOT 이 있습니다',
      hint: 'OQC 출하검사(P-04-06, W-04-03)에서 결과를 기록하세요.',
    },
    REJECTED: {
      title: '불합격 LOT 이 있습니다',
      hint: 'PDA 에서 [교체]하거나 재검 결과를 넣으세요.',
    },
    HELD: {
      title: '보류 LOT 이 있습니다',
      hint: 'OQC 출하검사에서 판정을 마치세요.',
    },
    SALES_ORDER_LINE_CANCELLED: {
      title: 'ERP 에서 취소된 수주 라인이 있습니다',
      hint: '담당자에게 문의하세요.',
    },
    /** 라인 막힘의 대상 한 줄 — 「라인 2 FG-B200, 피킹 수량 0 / 지시 수량 50」. */
    line: (lineNo: number, itemCode: string, picked: string, target: string): string =>
      `라인 ${String(lineNo)} ${itemCode}, 피킹 수량 ${picked} / 지시 수량 ${target}`,
    lineOnly: (lineNo: number): string => `라인 ${String(lineNo)}`,
  },

  lines: {
    heading: '출하 품목',
    caption: '출하 품목별 지시 수량과 피킹 수량',
    columns: {
      lineNo: '라인',
      itemCode: '품목 코드',
      itemName: '품목명',
      target: '지시 수량',
      picked: '피킹 수량',
      over: '초과 수량',
      lotCount: 'LOT 수',
    },
  },

  warehouses: {
    heading: '재고가 빠질 창고',
    entry: (lotCount: number, qty: string): string => `LOT ${String(lotCount)}개, 수량 ${qty}`,
    /** 두 창고 이상에 몫이 있는 LOT — 창고마다 LOT 수를 세면 그 LOT 이 양쪽에 들어간다(시안 ③). */
    splitLot: (lotNo: string): string => `${lotNo} 는 두 창고에 나뉘어 있어 양쪽에 모두 셉니다.`,
  },

  lots: {
    heading: (count: number): string => `피킹 LOT (${String(count)}건)`,
    caption: '피킹 LOT 과 OQC 판정',
    empty: '피킹된 LOT이 없습니다.',
    columns: {
      lotNo: 'LOT',
      itemCode: '품목 코드',
      qty: '수량',
      oqc: 'OQC',
      managementCode: '출하 관리 코드',
    },
    /* 여러 창고·적치 대기 자리에 나뉜 LOT 의 몫 — 「창고 A 20, 창고 B 20」. */
    portion: (warehouse: string, qty: string): string => `${warehouse} ${qty}`,
    stagingIncluded: (qty: string): string => `적치 대기 ${qty} 포함`,
    /* 교체로 빠진 LOT — 확인 화면에서 출하에 들지 않는다는 것을 한 줄로 알린다. */
    replaced: (count: number, lots: string): string =>
      `교체로 빠진 LOT ${String(count)}: ${lots}. 출하에 들지 않습니다.`,
    replacedLot: (lotNo: string, judgment: string | null): string =>
      judgment === null ? lotNo : `${lotNo}(${judgment})`,
    oqc: {
      NOT_REQUIRED: '검사 불필요',
      SKIPPED: '검사 생략',
      NOT_INSPECTED: '미검사',
      ACCEPTED: '합격',
      REJECTED: '불합격',
      HELD: '보류',
    },
  },

  result: {
    title: '출하를 완료했습니다',
    shipmentNo: '출하 번호',
    request: '출하 지시서',
    completedAt: '완료 시각',
    worker: '작업자',
    /** 완료한 POP 단말과 작업자(시안 ⑥⑦ 「단말 · 작업자」 — C-13 으로 쉼표). */
    completedBy: '단말과 작업자',
    who: (terminalCode: string, workerName: string, workerNo: string): string =>
      `${terminalCode}, ${workerName} (${workerNo})`,
    qty: '출하 수량',
    qtyValue: (qty: string, lineCount: number, lotCount: number, over: string | null): string =>
      `${qty}, 라인 ${String(lineCount)}, LOT ${String(lotCount)}${over === null ? '' : ` (초과 ${over} 포함)`}`,
    warehouses: '재고 차감',
    warehouseValue: (name: string, qty: string): string => `${name} ${qty}`,
  },

  already: {
    title: '이미 출하 완료된 지시서입니다',
    heading: '완료된 출하',
    shipmentNo: '출하 번호',
    request: '출하 지시서',
    completedAt: '완료',
  },

  search: {
    title: '출하 지시서 검색',
    close: '닫기',
    queryLabel: '검색어',
    /** 찾기 칸 위 이름 — 넣을 값(칸 안 흐린 안내는 없고, 글자판 창 칸 안내가 「… 을/를 입력하세요」다). */
    queryHeading: '지시서 번호, 고객명, 품목명 또는 코드',
    /** 켜면 막는 이유가 없는 지시서만(서버 `completionReadyOnly`), 끄면 출하가 남은 지시서 전부. */
    readyOnly: '출하 가능만 표시',
    count: (total: number): string => `${String(total)}건`,
    caption: '출하 지시서 목록',
    select: (requestNo: string): string => `지시서 ${requestNo} 조회`,
    ready: '출하 가능',
    blocked: '출하 불가',
    shipDate: '출하일',
    customer: '고객',
    items: '품목',
    itemsValue: (code: string, name: string, more: number): string =>
      more > 0 ? `${code} ${name} 외 ${String(more)}` : `${code} ${name}`,
    summary: '내용',
    summaryValue: (lineCount: number, lotCount: number, picked: string, target: string): string =>
      `라인 ${String(lineCount)}, LOT ${String(lotCount)}, 피킹 수량 ${picked} / 지시 수량 ${target}`,
    blockedWhy: '출하 불가 사유',
    /** 라인을 짚지 않은 피킹 부족(낼 피킹 LOT 없음) — 확인 화면 `blockers.noPickedLot` 과 같은 뜻. */
    noPickedLot: '피킹된 출하 LOT 없음',
    blockerCount: {
      PICKING_SHORT: (count: number): string => `피킹 수량 부족 ${String(count)}라인`,
      NOT_INSPECTED: (count: number): string => `미검사 LOT ${String(count)}`,
      REJECTED: (count: number): string => `불합격 LOT ${String(count)}`,
      HELD: (count: number): string => `보류 LOT ${String(count)}`,
      SALES_ORDER_LINE_CANCELLED: (count: number): string => `수주 라인 취소 ${String(count)}`,
    },
    loading: '지시서 목록을 불러오는 중입니다.',
    empty: '조건에 맞는 출하 지시서가 없습니다.',
    emptyHintFiltered: '검색어를 변경하거나 필터를 해제해 주세요.',
    emptyHint: '검색어를 변경해 주세요.',
    failed: '지시서 목록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    retry: '다시 시도',
    pageNav: '지시서 목록 쪽 이동',
  },

  bar: {
    label: '출하 완료 작업',
    recheck: '상태 새로고침',
    close: '닫기',
    complete: '출하 완료',
    completing: '완료하는 중…',
  },

  failure: {
    /* 409 ALREADY_COMPLETED 인데 다시 읽어도 완료되지 않은 지시서(검증 1회차 F-3) — 아무 말 없이 두지 않는다. */
    alreadyNotDone:
      '서버가 「이미 출하 완료」로 거절했지만 이 지시서는 아직 완료되지 않았습니다. [상태 새로고침]을 누르고, 그래도 안 되면 담당자에게 알리세요.',
    /* 서버 문구를 함께 보인다 — 작업자가 담당자에게 그대로 전할 수 있게. */
    withMessage: (base: string, message: string): string => `${base} (서버: ${message})`,
    blocked: '출하 불가 사유가 새로 생겼습니다. 사유를 확인하세요.',
    changed: '그사이 지시서가 바뀌었습니다. 상태를 새로고침한 뒤 완료하세요.',
    network: '연결이 끊겨 완료하지 못했습니다. 연결을 확인한 뒤 다시 누르세요.',
    other: '출하를 완료하지 못했습니다. [상태 새로고침]을 누른 뒤 다시 시도하세요.',
  },
};
