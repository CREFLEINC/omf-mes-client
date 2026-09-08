/**
 * P-04-01 Packing(P&P) 실적 등록. **POP(현장 단말) 화면**이라 관리웹과 어휘가 갈린다.
 *
 * - 물류 출하담당이 장갑을 낀 채 읽는다. 문장을 짧게 쓰고 한 줄에 한 가지만 말한다.
 * - **매칭 판정을 화면이 하지 않는다.** 「맞다·다르다」는 서버가 내린 결과를 옮길 뿐이라
 *   문구도 판정의 종류만큼만 둔다.
 * - **합친 것은 합쳤다고 말한다.** 같은 LOT 을 다시 읽으면 수량을 더하는데, 조용히 더하면
 *   중복 스캔을 알아채지 못한다.
 */
export const packingResult = {
  title: '출하 실적 등록',
  panes: {
    scan: '스캔',
    packing: '포장 구성',
    progress: '진행',
  },
  header: {
    shipment: (shipmentId: number): string => `출하 #${String(shipmentId)}`,
    shipmentContext: (shipmentRequestNo: string, customerName: string): string =>
      `${shipmentRequestNo} · ${customerName}`,
    worker: (workerNo: string): string => `사번 ${workerNo}`,
    /** 사번을 아직 못 받았다 — 「없다」가 아니라 「모른다」다. */
    workerUnknown: '사번 미확인',
    terminalUnknown: '단말 미확인',
    /** 연결 상태는 사번과 «다른» 표식으로 낸다 — 하나로 묶으면 색이 무엇을 말하는지 흐려진다. */
    online: '연결됨',
    offline: '오프라인',
  },
  scan: {
    label: {
      shipment: '출하번호',
      deliveryLabel: '납품라벨',
      productionLot: '생산LOT',
    },
    submit: '읽기',
    scanning: '조회 중…',
    manualEntry: '직접 입력',
    shipmentSelection: '출하 대상',
    shipmentListLoading: '목록 조회 중…',
    todayPickedShipments: '당일 피킹 완료 출하',
    deliveryLabelReentry: '기존 납품 라벨 재진입',
    /** 둘째 스캔은 첫째가 끝나야 열린다 — 왜 잠겼는지 적는다. */
    lotLocked: '출하 대상을 먼저 선택하세요',
  },
  match: {
    ok: '매칭 — 이 출하에 배분된 LOT 입니다',
    itemMismatch: (itemCode: string): string => `선택한 출하의 대상 품목은 ${itemCode} 입니다`,
    notAllocated: '이 출하에 배분되지 않은 LOT 입니다',
    /** 서버가 사유를 주지 않았을 때. 판정 자체는 「다르다」이므로 막는 것은 같다. */
    unknownReason: '이 납품라벨과 맞지 않는 LOT 입니다',
    labelNotFound: '등록되지 않은 납품라벨입니다',
    shipmentNotFound: '피킹 완료된 출하번호를 찾지 못했습니다',
    openUnitBlocksShipmentChange: '열린 포장을 먼저 취소한 뒤 다른 출하를 읽으세요',
    lookupFailed: '조회하지 못했습니다. 다시 읽어 주세요',
  },
  contents: {
    columns: {
      itemCode: '품목',
      lotNo: 'LOT',
      qty: '수량',
    },
    total: (packed: number, allocated: number): string =>
      `합계 ${String(packed)} / ${String(allocated)}`,
    empty: '담긴 것이 없습니다',
    remove: '빼기',
  },
  qty: {
    label: '수량',
    /**
     * 키패드가 친 값을 그대로 보이는 자리.
     *
     * ⭐ **키패드는 키만 그린다**(DS `NumberPad`) — 친 값을 어디에도 보이지 않으면 작업자는
     * 자기가 무엇을 눌렀는지 모른 채 담게 된다(실측 지적).
     */
    entryLabel: '담을 수량',
    /** 아직 아무것도 치지 않았다. 0 으로 적으면 「0 을 담는다」로 읽힌다. */
    entryEmpty: '—',
    room: (room: number): string => `남은 ${String(room)}`,
    /** 잔여를 넘겼을 때. 넘긴 값이 아니라 **한도**를 말한다 — 작업자가 고칠 목표가 그것이다. */
    overRemaining: (remaining: number): string => `배분 ${String(remaining)} 을 넘을 수 없습니다`,
    notPositive: '수량은 0보다 커야 합니다',
    merged: (before: number, added: number, after: number): string =>
      `기존 ${String(before)} 에 ${String(added)} 을 더해 ${String(after)} 이 됩니다`,
  },
  fields: {
    handlingUnitType: '유형',
    /** 이름은 칸 옆에 있으므로 안내 글은 「무엇을 하라」만 남긴다. */
    typePlaceholder: '고르세요',
    parentHandlingUnit: '상위 포장',
    parentNone: '(없음)',
  },
  notes: {
    parentHint: '팔레트에 담으면 지정합니다',
    /** 후보가 없는 것은 고장이 아니다(스펙 §5-2-1). */
    parentEmpty: '이 창고에 담을 상위 포장이 없습니다. 없이 확정할 수 있습니다',
    qtyWaiting: '생산LOT 을 읽으면 수량을 칠 수 있습니다',
    typeUnavailable: '포장 유형을 받지 못했습니다. 다시 시도해 주세요',
  },
  progress: {
    packed: (count: number): string => `이 출하 포장 ${String(count)} 개`,
    unpacked: (qty: number): string => `미포장 ${String(qty)}`,
  },
  oqc: {
    label: 'OQC 상태',
    status: {
      NOT_REQUIRED: '비대상',
      PENDING: '대기',
      PASSED: '합격',
      REJECTED: '불합격',
      HELD: '보류',
    },
  },
  actions: {
    /** 읽은 것을 무르고 다시 읽는다 — 이 화면의 입력은 «읽기»다(사용자 지시 2026-09-07). */
    rescan: '다시 읽기',
    confirm: '포장 확정',
    confirming: '확정 중…',
    retry: '다시 시도',
    labels: '라벨 상태·재출력',
    packing: '포장 등록으로 돌아가기',
    cancelUnit: '포장 취소',
  },
  automaticLabels: {
    region: '라벨 자동 출력 상태',
    packingConfirmed: '포장 확정',
    oqcPassed: '합격/비대상',
    oqcWaiting: '검사 대기',
    lotUnavailable: 'LOT 미표시',
    failures: {
      summary: '기존 발행 이력을 확인하지 못해 자동 출력을 중단했습니다.',
      issue: '발행 기록을 만들지 못했습니다.',
      render: '발행은 완료됐지만 라벨 이미지를 받지 못했습니다.',
      print: '발행은 완료됐지만 프린터로 출력하지 못했습니다.',
      report: '인쇄 결과를 서버에 보고하지 못했습니다.',
    },
    packingFailure: (reason: string): string => `포장 라벨: ${reason}`,
    deliveryFailure: (reason: string): string => `납품 라벨: ${reason}`,
    complete: '포장 라벨과 발행 가능한 납품 라벨의 자동 출력을 마쳤습니다.',
    reissueRequired: (count: number): string =>
      `${String(count)}건은 발행 기록이 있지만 인쇄 완료가 아닙니다. 라벨 재출력에서 사유를 골라 처리하세요.`,
    waiting: (count: number): string =>
      `납품 라벨 ${String(count)}건은 OQC 합격 또는 검사 비대상으로 바뀐 뒤 출력할 수 있습니다.`,
    retryPackingIssue: '포장 라벨 발행 다시 시도',
    retryPackingRendition: '포장 라벨 이미지 다시 받기',
    retryDeliveryIssue: '납품 라벨 발행 다시 시도',
    retryDeliveryRendition: '납품 라벨 이미지 다시 받기',
    openReissue: '라벨 재출력 열기',
  },
  /**
   * 확정이 막힌 사유 — 「어떻게 풀 것인가」를 담는다(공유계약 G-3).
   *
   * ⛔ **조작 이름(「포장 확정 —」)을 앞에 붙이지 않는다.** 이 문구는 [ 포장 확정 ] 바로 옆에
   * 서므로 무엇에 대한 말인지는 «자리»가 말한다(사용자 지시 2026-09-07 · 전례 `P-01-02`).
   */
  locks: {
    noContents: '포장에 담긴 것이 없습니다',
    noType: '유형을 고르세요',
    offline: '연결이 끊겨 있습니다. 이 화면은 연결된 상태에서만 확정할 수 있습니다',
    /** 게이팅 판정별 사유. 「모른다」와 「막혔다」를 갈라 적는다(공유계약 F-6). */
    gateChecking: '단말 권한을 확인하는 중입니다',
    gateDenied: '이 단말·공정에는 실적 입력 권한이 없습니다',
    gateUnavailable: '단말 권한을 확인할 수 없습니다',
    gateUnidentified: '단말·공정이 확인되지 않았습니다',
    workerMissing: '사번이 확인되지 않았습니다',
  },
  confirmed: (handlingUnitNo: string): string => `포장 ${handlingUnitNo} 을 확정했습니다`,
} as const;
