/**
 * P-01-02 출고 QR 발행.
 *
 * 이 화면의 말은 「출고 QR」이다 — 보관 단위에 붙는 LOT 라벨(P-01-01)과 이름·용도가 다르다.
 * 두 말을 섞으면 현장에서 어느 종이를 붙일지 갈리므로 「라벨」이라 부르지 않는다.
 */
export const goodsIssueQr = {
  title: '출고 QR 발행',

  entry: {
    issueLabel: '출고 전표',
    workerLabel: '사번',
    /** 전표 없이 들어온 경우. 화면을 그리지 않고 이 안내만 세운다. */
    missingIssue: '출고 전표를 고른 뒤 이 화면으로 들어오세요.',
    missingWorker: '사번이 확인되지 않아 발행할 수 없습니다. 사번 인증을 먼저 하세요.',
  },

  printer: {
    label: '프린터',
    /** 계약이 상태 문구를 함께 내려 준다 — 화면이 상태값으로 문장을 조립하지 않는다. */
    empty: '등록된 프린터가 없습니다. 발행 기록은 남고 인쇄만 되지 않습니다.',
    loading: '프린터 상태를 확인하는 중입니다.',
    failed: '프린터 상태를 불러오지 못했습니다.',
    /** 셸(현장 단말) 밖에서 열었을 때. 프린터가 없는 것과 다른 사정이라 따로 말한다. */
    noShell: '이 화면을 띄운 곳에는 인쇄 통로가 없습니다. 발행 기록만 남고 인쇄는 하지 않습니다.',
  },

  lines: {
    sectionLabel: '출고 라인',
    caption: '이 전표의 출고 라인 목록',
    columnItem: '품목',
    columnLot: 'LOT',
    columnQty: '수량',
    columnStatus: '발행',
    selectAll: '전체 선택',
    clearSelection: '선택 해제',
    empty: '이 전표에 출고 라인이 없습니다.',
    loading: '출고 라인을 불러오는 중입니다.',
    failed: '출고 라인을 불러오지 못했습니다.',
    /** 행마다 붙는 발행 현황. 「모른다」와 「없다」를 다르게 말한다. */
    statusNotIssued: '미발행',
    statusIssued: (count: number) => `발행됨 ${String(count)}회`,
    statusUnknown: '발행 현황 확인 불가',
  },

  target: {
    sectionLabel: '발행 대상',
    unitLabel: '유형',
    unitLine: '라인 단위',
    unitPallet: '파렛트 단위',
    /** 파렛트 단위는 고를 대상을 찾을 길이 없어 아직 못 연다. 감추지 않고 사유를 적는다. */
    unitPalletPending:
      '유형: 파렛트 단위는 아직 고를 수 없습니다. 이 출고 전표에 실린 파렛트를 찾는 조회가 없습니다. 지금은 라인 단위로 발행합니다.',
    selectedCount: (count: number) => `${String(count)}개 라인`,
    none: '발행할 라인을 고르세요.',
    seqLabel: '회차',
    /** 회차는 서버가 매긴다 — 화면은 발행 뒤에야 값을 안다. */
    seqUnknown: '발행하면 서버가 매깁니다.',
    previewLabel: '미리보기',
    previewEmpty: '발행하면 인쇄될 모습을 여기에 보여 줍니다.',
    previewFailed: '미리보기를 불러오지 못했습니다. 인쇄는 그대로 진행할 수 있습니다.',
    previewAlt: '출고 QR 미리보기',
  },

  reissue: {
    label: '재발행 사유',
    placeholder: '사유를 고르세요',
    /** 고른 라인 중 이미 발행된 것이 있을 때만 뜬다. */
    required: '이미 발행된 라인이 있어 재발행 사유가 필요합니다.',
    notNeeded: '재발행 사유: 처음 발행하는 라인이라 사유가 필요 없습니다.',
    /** ⚠ 발행 현황을 못 읽은 라인이 섞였다. 재발행인지 화면이 단정하지 않고 자리만 연다. */
    unknownStatus:
      '발행 현황을 확인하지 못한 라인이 있습니다. 이미 발행된 라인이면 사유를 골라야 발행됩니다.',
    /** ⛔ 서버가 사유를 물어 칸이 섰다. 현황은 읽혔으므로 「확인하지 못했다」고 말하지 않는다. */
    serverAsked: '서버가 이 발행을 재발행으로 봅니다. 사유를 고르고 다시 발행하세요.',
    loading: '사유 목록을 불러오는 중입니다.',
    failed: '사유 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도하세요.',
    empty: '고를 수 있는 재발행 사유가 없습니다.',
  },

  action: {
    issue: '발행·인쇄',
    /** 비활성 사유는 그 컨트롤의 이름으로 시작한다. */
    disabledNoSelection: '발행·인쇄: 발행할 라인을 먼저 고르세요.',
    disabledNoReason: '발행·인쇄: 재발행 사유를 고르세요.',
    disabledNoWorker: '발행·인쇄: 사번이 확인되지 않았습니다.',
  },

  result: {
    /** 발행과 인쇄는 다른 걸음이다 — 한 문장으로 뭉치지 않는다. */
    issued: (count: number) => `${String(count)}건을 발행했습니다.`,
    printing: '프린터로 보내는 중입니다.',
    printed: '인쇄를 마쳤습니다.',
    printFailed: '인쇄에 실패했습니다. 발행 기록은 남아 있으니 재발행으로 다시 찍으세요.',
    reportFailed:
      '인쇄에 실패했고 그 결과를 서버에 남기지도 못했습니다. 발행 기록은 남아 있습니다.',
    /** 종이는 나왔는데 서버가 그 사실을 모른다 — 다음 회차가 「아직 안 찍었나」로 읽는다. */
    printedUnreported:
      '인쇄는 마쳤지만 그 결과를 서버에 남기지 못했습니다. 이미 찍힌 라벨을 확인하고 필요할 때만 다시 찍으세요.',
  },

  errors: {
    forbidden: '이 단말에서는 발행할 수 없습니다. 다른 단말에서 다시 시도하세요.',
  },

  /** 「전량 출고에도 예외 없이 항상 발행한다」는 확정 사항을 사용자가 물었을 때의 근거. */
  alwaysIssueNote: '전량 출고에도 출고 QR 을 발행합니다.',
} as const;
