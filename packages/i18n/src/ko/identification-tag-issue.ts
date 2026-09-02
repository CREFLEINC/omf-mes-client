/**
 * P-02-05 인식표 발행·부착.
 *
 * 이 화면의 말은 「인식표」다 — 계약의 자원 이름은 개체 일련번호(`serial_number`)와 발행
 * 기록(`document_issue_log`)이지만, 현장에서 붙이는 것은 인식표 한 장이다.
 */
export const identificationTagIssue = {
  title: '인식표 발행',

  entry: {
    /** 헤더에 작업지시·사번을 세운다. 없으면 그 자리를 비운다 — 「알 수 없음」을 쓰지 않는다. */
    workOrderLabel: '작업지시',
    workerLabel: '사번',
    missingWorkOrder: '작업지시를 받지 못해 대상 LOT 을 불러올 수 없습니다.',
    missingWorker: '사번이 확인되지 않아 발행할 수 없습니다. 사번 인증을 먼저 하세요.',
  },

  /** 단말 기능 구성 판정. 「확인할 수 없다」와 「권한이 없다」를 다르게 말한다. */
  gate: {
    checking: '발행 권한을 확인하는 중입니다.',
    denied: '이 단말에서는 인식표를 발행할 수 없습니다. 담당자에게 문의하세요.',
    unavailable: '발행 권한을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    unidentified: '단말이 확인되지 않아 발행할 수 없습니다.',
  },

  /** 화면 머리에 상시 보이는 장비 상태. 인쇄가 안 될 때 가장 먼저 보는 자리다. */
  device: {
    printerLabel: '프린터',
    printerUnknown: '프린터를 확인할 수 없습니다',
    printerNone: '쓸 수 있는 프린터가 없습니다',
    terminalLabel: '단말',
    terminalUnknown: '확인되지 않음',
  },

  lotList: {
    sectionLabel: '대상 LOT',
    lotNoColumn: 'LOT',
    goodQtyColumn: '양품',
    /**
     * 양품 열을 채우지 못하는 사유. **비워 두고 말한다** — 값이 없는 칸을 말없이 두면
     * 「양품이 없다」로 읽힌다.
     */
    goodQtyPending: '목록에서는 양품 수를 표시할 수 없습니다. LOT 을 고르면 오른쪽에 나옵니다.',
    goodQtyPlaceholder: '—',
    select: '선택',
    selected: '선택됨',
    empty: '이 작업지시에 대상 LOT 이 없습니다.',
    loadFailed: '대상 LOT 을 불러오지 못했습니다.',
    /** 불량품에는 붙이지 않는다(R69·R70). 목록 옆에 상시 세운다. */
    goodOnlyNotice: '인식표는 양품 개체마다 1장입니다(불량 미부착).',
  },

  issue: {
    sectionLabel: '발행',
    lotLabel: 'LOT',
    goodQtyLabel: '양품',
    issuedLabel: '기발행',
    unissuedLabel: '미발행',
    unknownValue: '확인할 수 없음',
    quantityLabel: '발행 수량',
    quantityUnit: '개',
    countUnit: '개',
    notSelected: 'LOT 을 고르면 발행 수량을 입력할 수 있습니다.',
    loadFailed: '고른 LOT 의 양품 수를 불러오지 못했습니다.',
    submit: '발행·인쇄',
    reissue: '재인쇄',
    submitting: '발행하는 중입니다',
  },

  /** 발행 수량 입력이 막힌 사유. 고칠 방법이 분명해지도록 사유마다 다르게 말한다. */
  quantity: {
    empty: '발행 수량을 입력하세요.',
    notANumber: '발행 수량은 숫자로 입력하세요.',
    notPositive: '발행 수량은 1개 이상이어야 합니다.',
    exceedsUnissued: '미발행 양품보다 많이 발행할 수 없습니다.',
    exceedsLimit: '한 번에 1000개까지 발행할 수 있습니다.',
    unknownUnissued: '미발행 양품을 확인하지 못해 발행할 수 없습니다.',
    noGoodQty: '양품이 없어 발행할 수 없습니다.',
  },

  /**
   * 번호 미리보기. **발행 «전»에는 그리지 않는다** — 번호를 서버가 매기고 채번 규칙이 아직
   * 정해지지 않아, 화면이 지어낸 번호를 보이면 실제와 다른 것을 미리 본 것이 된다.
   */
  preview: {
    label: '번호 미리보기',
    beforeIssue: '일련번호는 발행할 때 서버가 매깁니다.',
    rangeSeparator: ' ~ ',
  },

  /** 두 호출 사이에서 끊길 수 있어 결과가 셋이다. */
  result: {
    issued: '인식표를 발행했습니다.',
    serialsOnlyTitle: '개체는 만들어졌습니다',
    serialsOnlyBody: '발행 기록을 만들지 못했습니다. 개체를 다시 만들지 않고 발행만 다시 합니다.',
    retryDocuments: '발행 다시 시도',
  },

  print: {
    sending: '프린터로 보내는 중입니다.',
    succeeded: '인쇄를 마쳤습니다.',
    failedTitle: '인쇄하지 못했습니다',
    failedBody: '발행 기록은 남아 있습니다. 재인쇄로 다시 출력하세요.',
    /** 셸 밖(브라우저)에서는 프린터로 보낼 수 없다. 감추지 않고 사유를 말한다. */
    shellUnavailable: '이 화면에서는 프린터로 보낼 수 없습니다. 현장 단말에서 인쇄하세요.',
    retry: '다시 인쇄',
  },

  reissueDialog: {
    title: '재인쇄',
    description: '재인쇄하면 개체마다 발행 회차가 올라갑니다.',
    reasonLabel: '재인쇄 사유',
    /** 값 목록이 도착할 때까지 사유 선택을 열지 않는다 — 사유 없이는 서버가 거부한다. */
    reasonPending: '재인쇄 사유 목록이 아직 준비되지 않아 재인쇄할 수 없습니다.',
    confirm: '재인쇄 진행',
    cancel: '닫기',
  },

  /** 서버가 거부했을 때. 다시 눌러 달라지는 갈래에만 재시도를 둔다. */
  error: {
    issueTitle: '발행하지 못했습니다',
    forbidden: '이 단말에는 출력 권한이 없습니다. 담당자에게 문의하세요.',
    /** 번호를 서버가 매기므로 사용자가 고칠 것이 없다 — 다시 부르면 풀린다. */
    duplicateSerial: '일련번호가 겹쳤습니다. 다시 시도하세요.',
    rejected: '요청이 반려됐습니다. 입력한 값을 확인하세요.',
  },
} as const;
