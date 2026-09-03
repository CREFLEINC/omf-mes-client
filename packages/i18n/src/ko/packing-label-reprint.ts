/**
 * P-02-09 포장 라벨·인식표 재출력·부착.
 *
 * ⭐ **재출력이 이 화면의 정상 경로다**(스펙 §5-1). 다른 라벨 화면은 최초 발행이 정상이고
 * 재발행이 예외인데 여기는 반대라, 문구도 「다시 찍는 것」을 예외처럼 말하지 않는다.
 */
export const packingLabelReprint = {
  title: '포장 라벨 재출력',

  entry: {
    /** 헤더에 포장 단위·사번을 세운다. 없으면 그 자리를 비운다 — 「알 수 없음」을 쓰지 않는다. */
    handlingUnitLabel: '포장',
    workerLabel: '사번',
    missingHandlingUnit: '포장 단위를 받지 못해 재출력 대상을 불러올 수 없습니다.',
    missingWorker: '사번이 확인되지 않아 재출력할 수 없습니다. 사번 인증을 먼저 하세요.',
  },

  /** 단말 기능 구성 판정. 「확인할 수 없다」와 「권한이 없다」를 다르게 말한다. */
  gate: {
    checking: '출력 권한을 확인하는 중입니다.',
    denied: '이 단말에서는 라벨을 출력할 수 없습니다. 담당자에게 문의하세요.',
    unavailable: '출력 권한을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    unidentified: '단말이 확인되지 않아 재출력할 수 없습니다.',
  },

  /** 화면 머리에 상시 보이는 장비 상태. 인쇄가 안 될 때 가장 먼저 보는 자리다. */
  device: {
    printerLabel: '프린터',
    printerUnknown: '프린터를 확인할 수 없습니다',
    printerNone: '쓸 수 있는 프린터가 없습니다',
    terminalLabel: '단말',
    terminalUnknown: '확인되지 않음',
  },

  handlingUnit: {
    sectionLabel: '포장 단위',
    typeLabel: '유형',
    contentsLabel: '내용물',
    lotColumn: 'LOT',
    itemColumn: '품목',
    qtyColumn: '수량',
    /** 이름을 못 받은 칸. **번호를 대신 찍지 않는다** — 현장에 없는 번호로 읽힌다. */
    unknownValue: '—',
    empty: '이 포장에 담긴 내용물이 없습니다.',
    loadFailed: '포장 단위를 불러오지 못했습니다.',
    namesFailed: 'LOT·품목 이름을 불러오지 못해 일부 칸이 비어 있습니다.',
    /** 혼적 — 한 포장에 LOT 이 둘 이상. 붙일 라벨이 갈리므로 눈에 띄게 세운다. */
    mixedLot: (lotCount: number): string => `혼적(LOT ${String(lotCount)}건)`,
    mixedLotBody: 'LOT 마다 붙일 라벨이 갈립니다. 재출력 대상을 하나씩 확인하세요.',
  },

  /** 우단 《재출력 대상》 — 줄 하나가 라벨 한 장이다. */
  targets: {
    sectionLabel: '재출력 대상',
    packingLabel: '포장 라벨',
    identificationTag: '인식표',
    unknownLot: 'LOT 확인 불가',
    /** 개체를 데이터로 좁힐 수 없다. 감추지 않고 사유를 보인다 */
    serialUnavailable: '이 포장에 든 개체를 특정할 수 없어 인식표는 재출력할 수 없습니다.',
    /** 범위 표기 — 개체 줄은 LOT + 수량으로만 말할 수 있다 */
    range: (qty: number): string => `수량 ${String(qty)}`,
    issueCount: (count: number): string => `발행 이력 ${String(count)}회`,
    neverIssued: '발행 이력 없음',
    issueCountUnknown: '발행 이력 확인 불가',
    summaryFailed: '발행 이력을 불러오지 못해 회차를 표시할 수 없습니다.',
    select: '선택',
    selected: '선택됨',
    empty: '재출력할 대상이 없습니다.',
  },

  /** 재발행 사유 — ⭐ 이 화면에서는 예외가 아니라 기본 입력이다(스펙 §5-1). */
  reason: {
    label: '재출력 사유',
    placeholder: '사유를 고르세요',
    required: '재출력에는 사유가 필요합니다.',
    /** 이력이 없는 대상만 골랐다 — 최초 발행이라 사유를 받지 않는다(스펙 §6) */
    notNeeded: '발행 이력이 없어 최초 발행으로 처리됩니다. 사유가 필요 없습니다.',
    empty: '사유 목록이 아직 등록되지 않았습니다. 담당자에게 문의하세요.',
    loadFailed: '사유 목록을 불러오지 못했습니다.',
  },

  action: {
    submit: '재출력',
    submitting: '재출력 중…',
    noSelection: '재출력할 대상을 고르세요.',
  },

  error: {
    issueTitle: '재출력하지 못했습니다.',
    forbidden: '이 단말에는 출력 권한이 없습니다. 담당자에게 문의하세요.',
    rejected: '요청이 거부됐습니다. 값을 확인한 뒤 다시 시도하세요.',
  },

  /** 인쇄는 발행과 별개다 — 기록이 남고 인쇄만 실패하는 상태가 정상적으로 생긴다(K-4). */
  print: {
    shellUnavailable: '발행 기록은 남았습니다. 이 환경에서는 프린터로 보낼 수 없습니다.',
    succeeded: '재출력했습니다.',
    failedTitle: '기록은 남았고 인쇄만 실패했습니다.',
    failedBody: '발행 기록은 그대로 있습니다. 프린터를 확인한 뒤 다시 인쇄하세요.',
    retry: '다시 인쇄',
    issued: '발행 완료',
  },
} as const;
