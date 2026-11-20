/**
 * P-04-08 생산 LOT 분리(POP · 피처 013 · omf-all-around#303 · 시안 P0408).
 *
 * 제품 창고에 적치된 생산 LOT 을 수량으로 둘로 나누고 라벨 두 장(원래 LOT 새 수량 재발행, 새 LOT 첫 발행)을
 * 찍는다. 나눈 두 LOT 은 PDA 「LOT 분리 확인」에서 두 라벨을 스캔하기 전까지 출하 피킹이 되지 않는다.
 */
export const productLotSplit = {
  title: '생산 LOT 분리',

  work: {
    title: '분리하기',
    scanLabel: '생산 LOT 라벨',
    manualLabel: 'LOT 번호',
    looking: 'LOT 을 찾는 중입니다.',
    notFound: (lotNo: string) => `「${lotNo}」 LOT 이 이 공장에 없습니다. 라벨을 확인하세요.`,
    lookupFailed: 'LOT 을 읽지 못했습니다. 연결을 확인하고 다시 스캔하세요.',
    idleHint: '생산 LOT 라벨을 스캔하면 위치와 수량을 넣습니다.',
  },

  lot: {
    label: '스캔한 LOT',
    item: '품목',
    lotNo: 'LOT',
    status: '상태',
    workOrder: 'W/O',
    labelQty: 'LOT 수량',
    /** 정상은 칩을 두지 않는다(C-21) — 할 일이 생기는 상태만. */
    statuses: {
      INSPECTION_PENDING: '검사 대기',
      HOLD: '보류',
      DEFECTIVE: '불량',
      SCRAPPED: '폐기',
      VOIDED: '무효',
    } as Record<string, string | undefined>,
    queued: '확인 대기',
  },

  location: {
    label: '분리할 위치',
    tile: (warehouseCode: string, qty: string) => `${warehouseCode} 창고 ${qty}`,
    many: (count: number, total: string) =>
      `이 LOT 이 이송으로 ${String(count)}개 위치에 있습니다. 실물을 나눌 위치를 고르세요. 원래 LOT 라벨에는 LOT 수량(${total}에서 나눈 수량을 뺀 값)이 찍힙니다.`,
    blocked: {
      PUTAWAY_PENDING: '적치 대기',
      NOT_PRODUCT_WAREHOUSE: '제품 창고 아님',
      MIXED_STOCK_STATUS: '상태 섞임',
    } as Record<string, string | undefined>,
    none: '나눌 수 있는 위치가 없습니다. 이 LOT 이 제품 창고에 있는지 확인하세요.',
  },

  qty: {
    label: '분리할 수량(새 LOT)',
    badTitle: '수량을 확인하세요',
    bad: (max: string) => `1 이상, 이 위치 수량(${max})보다 작게 넣으세요.`,
    badInteger: '이 단위는 정수로 넣습니다.',
  },

  preview: {
    label: '나눈 뒤',
    parent: '원래 LOT 에 남음',
    child: '새 LOT',
    childNo: '번호는 분리할 때 붙습니다',
  },

  /** 분리를 막는 이유(조회의 막힘과 분리 409 둘 다) — 제목 한 줄 + 할 일 한 줄. */
  blocked: {
    NOT_PRODUCTION_LOT: {
      title: '생산 LOT 만 분리할 수 있습니다',
      body: '자재 LOT 은 이 화면에서 나누지 않습니다. 제품 창고의 생산 LOT 라벨을 스캔하세요.',
    },
    SPLIT_SERIAL_LOT: {
      title: '시리얼 관리 품목은 분리할 수 없습니다',
      body: '시리얼이 LOT 에 묶여 있어 나누면 시리얼 조회가 틀어집니다. 통째로 출하하세요.',
    },
    INVALID_STATE: {
      title: (state: string) => `분리할 수 없는 상태입니다(${state})`,
      titleNoState: '분리할 수 없는 상태입니다',
      body: '보류, 불량, 폐기, 무효 LOT 은 나눌 수 없습니다. 품질 처리가 끝난 뒤 다시 스캔하세요.',
    },
    LOT_SPLIT_UNCONFIRMED: {
      title: '분리 확인을 먼저 하세요',
      body: (at: string) =>
        `이 LOT 은 ${at}에 나눈 뒤 아직 PDA 「LOT 분리 확인」을 하지 않았습니다. 확인 대기 목록에서 라벨을 다시 출력할 수 있습니다.`,
      bodyNoTime:
        '이 LOT 은 나눈 뒤 아직 PDA 「LOT 분리 확인」을 하지 않았습니다. 확인 대기 목록에서 라벨을 다시 출력할 수 있습니다.',
    },
    LOT_ALREADY_RESERVED: {
      title: '분리할 수 없습니다. 다른 작업에 잡힌 LOT 입니다',
      body: (requestNo: string) =>
        `출하 지시서 ${requestNo}에 피킹된 몫이 있습니다. 피킹을 빼거나 출하가 끝난 뒤에 다시 스캔하세요.`,
      bodyNoRequest:
        '예약이나 피킹이 걸린 몫이 있습니다. 그 작업을 풀거나 끝낸 뒤에 다시 스캔하세요.',
    },
    PUTAWAY_PENDING: {
      title: '적치를 먼저 끝내세요',
      body: '적치 대기 자리에 있거나 이 자리에서 출발하는 적치 지시가 열려 있습니다. 적치를 끝낸 뒤 나누세요.',
    },
    NOT_PRODUCT_WAREHOUSE: {
      title: '제품 창고 위치가 아닙니다',
      body: '제품 창고(불량 창고 제외)에 있는 몫만 나눌 수 있습니다.',
    },
    MIXED_STOCK_STATUS: {
      title: '재고 상태가 섞인 위치입니다',
      body: '이 위치에 상태가 다른 재고가 섞여 있어 나눌 수 없습니다. 관리자에게 알리세요.',
    },
    unknown: {
      title: '분리하지 못했습니다',
      body: '다시 스캔해 상태를 확인하세요.',
    },
    states: {
      HOLD: '보류',
      DEFECTIVE: '불량',
      SCRAPPED: '폐기',
      VOIDED: '무효',
    } as Record<string, string | undefined>,
  },

  queue: {
    title: '확인 대기',
    hint: 'PDA 「LOT 분리 확인」에서 두 라벨을 스캔하면 목록에서 빠집니다.',
    label: '확인 대기 분리',
    cols: {
      lots: '원래 LOT, 새 LOT',
      qty: '수량(남음/새)',
      location: '위치',
      splitAt: '나눈 시각',
      label: '라벨',
    },
    choose: (lotNo: string) => `${lotNo} 분리 고르기`,
    newTag: '새로',
    parentChip: (outcome: string) => `원래 ${outcome}`,
    childChip: (outcome: string) => `새 ${outcome}`,
    printed: '출력함',
    failed: '인쇄 실패',
    notPrinted: '출력 전',
    emptyTitle: '확인 대기 분리가 없습니다',
    emptyBody: '나눈 LOT 은 PDA 확인 전까지 여기에 남습니다.',
    loadFailedTitle: '확인 대기 목록을 읽지 못했습니다',
    loadFailedBody: '연결을 확인한 뒤 다시 읽으세요.',
    retry: '다시 읽기',
  },

  bar: {
    label: '분리 작업',
    split: '분리하고 라벨 2장 출력',
    reprint: '고른 분리 라벨 2장 다시 출력',
    splitting: '나누는 중',
  },

  dialog: {
    splitTitle: '라벨 2장 — 원래 LOT 은 새 수량으로 다시 붙입니다',
    reprintTitle: '다시 출력하는 이유',
    parentCaption: (seq: number) => `원래 LOT 재발행 #${String(seq)}(사유 「LOT 분리」 자동)`,
    parentFirstCaption: (seq: number) => `원래 LOT 첫 발행 #${String(seq)}`,
    childCaption: (seq: number) => `새 LOT 첫 발행 #${String(seq)}`,
    parentReprint: '원래 LOT 다시 출력',
    childReprint: '새 LOT 다시 출력',
    oldLabel: (qty: string) => `원래 상자의 옛 라벨(수량 ${qty})은 떼어 버리세요.`,
    close: '닫기',
    print: '2장 인쇄',
    reasonLabel: '사유',
    reasonNeed: '사유를 고르세요',
    labelName: (lotNo: string) => `라벨 ${lotNo}`,
    workOrderLoading: 'W/O 를 읽는 중입니다.',
  },

  result: {
    split: (childLotNo: string) => `나눴습니다. 새 LOT ${childLotNo}`,
    printedTitle: '라벨 2장을 출력했습니다',
    printedBody:
      '실물을 나눠 라벨을 붙인 뒤 PDA 「LOT 분리 확인」에서 두 라벨을 스캔하세요. 확인 전에는 두 LOT 모두 출하 피킹이 되지 않습니다.',
    reprinted: '라벨 2장을 다시 출력했습니다',
    failedTitle: (count: number, which: string) =>
      `${String(count)}장을 인쇄하지 못했습니다(${which})`,
    failedBody: '분리는 끝났습니다. 확인 대기 목록에서 그 분리를 골라 다시 출력하세요.',
    whichParent: '원래 LOT 라벨',
    whichChild: '새 LOT 라벨',
    whichBoth: '두 라벨',
    shellUnavailable: '이 단말에서 인쇄할 수 없습니다. 확인 대기 목록에서 다시 출력하세요.',
    reportFailed: '라벨은 나왔지만 인쇄 결과를 보내지 못했습니다. 연결을 확인하세요.',
    notPrinted:
      '분리는 끝났고 라벨은 출력하지 않았습니다. 확인 대기 목록에서 그 분리를 골라 출력하세요.',
    splitFailed: '분리하지 못했습니다. 연결을 확인하고 다시 누르세요.',
    reprintFailed: '라벨을 다시 발행하지 못했습니다. 연결을 확인하고 다시 누르세요.',
    forbidden: '이 단말에는 라벨 출력 권한이 없습니다. 관리자에게 알리세요.',
  },
};
