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
  title: 'Packing 실적 등록',
  panes: {
    scan: '스캔',
    packing: '포장 구성',
    progress: '진행',
  },
  header: {
    /** 스캔 전에는 어느 출하인지 모른다 — 빈 자리로 두지 않고 그 사실을 적는다. */
    shipmentUnknown: '납품라벨을 읽으면 어느 출하인지 표시됩니다',
    shipment: (shipmentId: number): string => `출하 #${String(shipmentId)}`,
    worker: (workerNo: string): string => `사번 ${workerNo}`,
    terminalUnknown: '단말 미확인',
  },
  scan: {
    label: {
      deliveryLabel: '납품라벨',
      productionLot: '생산LOT',
    },
    submit: '읽기',
    scanning: '조회 중…',
    manualEntry: '직접 입력',
    /** 둘째 스캔은 첫째가 끝나야 열린다 — 왜 잠겼는지 적는다. */
    lotLocked: '납품라벨을 먼저 읽으세요',
  },
  match: {
    ok: '매칭 — 이 납품라벨의 LOT 이 맞습니다',
    itemMismatch: (itemCode: string): string => `이 납품라벨은 ${itemCode} 용입니다`,
    notAllocated: '이 출하에 배분되지 않은 LOT 입니다',
    /** 서버가 사유를 주지 않았을 때. 판정 자체는 「다르다」이므로 막는 것은 같다. */
    unknownReason: '이 납품라벨과 맞지 않는 LOT 입니다',
    labelNotFound: '등록되지 않은 납품라벨입니다',
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
    /** 잔여를 넘겼을 때. 넘긴 값이 아니라 **한도**를 말한다 — 작업자가 고칠 목표가 그것이다. */
    overRemaining: (remaining: number): string => `배분 ${String(remaining)} 을 넘을 수 없습니다`,
    notPositive: '수량은 0보다 커야 합니다',
    merged: (before: number, added: number, after: number): string =>
      `기존 ${String(before)} 에 ${String(added)} 을 더해 ${String(after)} 이 됩니다`,
  },
  fields: {
    handlingUnitType: '유형',
    parentHandlingUnit: '상위 포장',
    parentNone: '(없음)',
    /** 번호는 서버가 매긴다 — 담기 시작 전에는 존재하지 않는 값이다. */
    handlingUnitPending: '포장 번호 — 담으면 매겨집니다',
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
  actions: {
    rescan: '다시 스캔',
    confirm: '포장 확정',
    confirming: '확정 중…',
    retry: '다시 시도',
  },
  locks: {
    noContents: '포장 확정 — 포장에 담긴 것이 없습니다',
    noType: '포장 확정 — 유형을 고르세요',
    offline: '포장 확정 — 연결이 끊겨 있습니다. 이 화면은 연결된 상태에서만 확정할 수 있습니다',
    /** 게이팅 판정별 사유. 「모른다」와 「막혔다」를 갈라 적는다(공유계약 F-6). */
    gateChecking: '포장 확정 — 단말 권한을 확인하는 중입니다',
    gateDenied: '포장 확정 — 이 단말·공정에는 실적 입력 권한이 없습니다',
    gateUnavailable: '포장 확정 — 단말 권한을 확인할 수 없습니다',
    gateUnidentified: '포장 확정 — 단말·공정이 확인되지 않았습니다',
    workerMissing: '포장 확정 — 사번이 확인되지 않았습니다',
  },
  confirmed: (handlingUnitNo: string): string => `포장 ${handlingUnitNo} 을 확정했습니다`,
} as const;
