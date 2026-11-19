/**
 * P-04-01 출하 포장. **POP(현장 단말) 화면**이라 관리웹과 어휘가 갈린다.
 *
 * - 물류 출하담당이 장갑을 낀 채 읽는다. 문장을 짧게 쓰고 한 줄에 한 가지만 말한다.
 * - **매칭 판정을 화면이 하지 않는다.** 「맞다·다르다」는 서버가 내린 결과를 옮길 뿐이라
 *   문구도 판정의 종류만큼만 둔다.
 * - 본문은 POP 통일 시안(#295)의 3단계: ① 출하 대상 → ② 포장 유형 · LOT 스캔 → ③ 포장 내용 확인.
 */
export const packingResult = {
  steps: {
    label: '포장 단계',
    shipment: '출하 대상 선택',
    scan: '포장 유형·LOT 스캔',
    review: '포장 내용 확인',
  },
  shipments: {
    region: '출하 대상',
    loading: '목록 조회 중…',
    empty: '오늘 피킹을 마친 출하가 없습니다.',
    failed: '출하 목록을 받지 못했습니다. 다시 시도해 주세요',
    inProgress: '포장 진행 중',
    allocations: (count: number): string => `배분 LOT ${String(count)}건`,
    item: '품목',
    scan: '출하 스캔',
    scanPlaceholder: '출하 번호를 스캔하세요',
    notFound: (code: string): string => `${code} — 오늘 피킹을 마친 출하 목록에 없습니다.`,
    unassigned: '미구성 상자',
  },
  band: {
    label: '포장 정보',
    shipment: '출하 대상',
    type: '포장 유형',
    unitNo: '포장 번호',
    unassigned: '미구성 상자',
    boxes: (count: number): string => `${String(count)}개`,
    unknown: '확인 못 함',
  },
  scan: {
    productionLot: '생산 LOT 라벨 스캔',
    placeholder: '생산 LOT 라벨을 스캔하세요',
  },
  match: {
    itemMismatch: (itemCode: string): string => `선택한 출하의 대상 품목은 ${itemCode} 입니다`,
    notAllocated: '생산LOT 번호는 선택한 출하에 포함되지 않은 LOT입니다.',
    unknownReason: '이 출하와 맞지 않는 LOT 입니다',
    openUnitBlocksShipmentChange: '진행 중인 포장을 먼저 취소한 뒤 다른 출하를 선택하세요',
    lookupFailed: '조회하지 못했습니다. 다시 읽어 주세요',
  },
  rows: {
    region: '포장할 생산 LOT',
    empty: '스캔한 생산 LOT이 없습니다.',
    emptyHint: '포장할 생산 LOT 라벨을 스캔하세요. 여러 개를 이어서 스캔할 수 있습니다.',
    available: (qty: string): string => `가능 ${qty}`,
    qtyLabel: (lotNo: string): string => `${lotNo} 수량`,
    remove: '포장에서 제외',
    sum: (qty: string): string => `포장 합계 ${qty}`,
    room: (qty: string): string => `포장 가능 ${qty}`,
    reviewRoom: (qty: string): string => `담은 LOT의 포장 가능 수량 ${qty}`,
  },
  qty: {
    title: '수량',
    entryLabel: '담을 수량',
    room: (qty: string): string => `남은 ${qty}`,
    submit: '담기',
    unit: (uom: string): string => `단위 ${uom}`,
    overRemaining: (remaining: number): string => `배분 ${String(remaining)} 을 넘을 수 없습니다`,
    notPositive: '수량은 0보다 커야 합니다',
  },
  fields: {
    handlingUnitType: '포장 유형',
  },
  notes: {
    typeUnavailable: '포장 유형을 받지 못했습니다. 다시 시도해 주세요',
  },
  actions: {
    confirm: '포장 확정',
    confirming: '확정 중…',
    retry: '다시 시도',
    labels: '라벨 상태·재인쇄',
    prev: '이전',
    next: '다음',
    cancelUnit: '포장 취소',
  },
  automaticLabels: {
    region: '라벨 자동 출력 상태',
    packingConfirmed: '포장 확정',
    failures: {
      summary: '기존 발행 이력을 확인하지 못해 자동 출력을 중단했습니다.',
      issue: '발행 기록을 만들지 못했습니다.',
      render: '발행은 완료됐지만 라벨 이미지를 받지 못했습니다.',
      print: '발행은 완료됐지만 프린터로 출력하지 못했습니다.',
      report: '인쇄 결과를 서버에 보고하지 못했습니다.',
    },
    packingFailure: (reason: string): string => `포장 라벨: ${reason}`,
    complete: (handlingUnitNo: string): string =>
      `포장 ${handlingUnitNo}을 확정하고 포장 라벨 인쇄를 보냈습니다.`,
    reissueRequired: (count: number): string =>
      `${String(count)}건은 발행 기록이 있지만 인쇄 완료가 아닙니다. 라벨 상태·재인쇄에서 사유를 골라 처리하세요.`,
    retryPackingIssue: '발행 다시 시도',
    retryPackingRendition: '이미지 다시 받기',
    openReissue: '라벨 상태·재인쇄',
  },
  locks: {
    noContents: '포장에 담긴 것이 없습니다',
    noType: '유형을 고르세요',
    offline: '연결이 끊겨 있습니다. 이 화면은 연결된 상태에서만 확정할 수 있습니다',
    gateChecking: '단말 권한을 확인하는 중입니다',
    gateDenied: '이 단말·공정에는 실적 입력 권한이 없습니다',
    gateUnavailable: '단말 권한을 확인할 수 없습니다',
    gateUnidentified: '단말·공정이 확인되지 않았습니다',
    workerMissing: '사번이 확인되지 않았습니다. 사번 인증을 먼저 진행해주세요.',
    shipmentMissing: '출하대상을 먼저 선택하세요',
    warehouseMissing: '출하 전표에 창고가 없어 확정할 수 없습니다',
    unitOpening: '포장을 만드는 중입니다',
  },
  confirmed: (handlingUnitNo: string): string => `포장 ${handlingUnitNo}을 확정했습니다`,
  confirmDialog: {
    title: '포장을 확정할까요?',
    shipment: '출하번호',
    type: '포장 유형',
    contents: '내용물',
    lotCount: (count: number): string => `LOT ${count}건`,
    lotCountWithQty: (count: number, qty: string): string => `LOT ${count}건 · 수량 ${qty}`,
    labelNotice: '확정 시 포장 라벨이 바로 인쇄됩니다.',
    confirm: '확정',
  },
} as const;
