/**
 * P-02-08 포장 작업(LOT 스캔·제품 포장) — POP.
 *
 * ⚠ **「잔여」를 말하는 문구가 없다.** 스펙 §3 은 포장 대상 행마다 LOT 잔여를 보이고 §6 은
 * 초과 스캔을 인라인 오류로 규정하지만, 계약의 `Lot` 에 이미 포장된 수량을 뺀 잔여 축이
 * 없다(설계 회신 대기). 없는 값을 말하는 문구를 미리 두면 값이 오지 않은 채 문구만 남는다.
 */
export const packingWork = {
  title: '포장 작업',

  device: {
    workOrderLabel: '작업지시',
    workOrderUnknown: '작업지시 없음',
    terminalLabel: '단말',
    terminalUnknown: '확인되지 않음',
  },

  entry: {
    missingWorkOrder:
      '작업지시를 알 수 없어 포장 대상을 불러오지 못했습니다. 작업 시작 화면에서 작업지시를 고른 뒤 들어오십시오.',
    missingWorker: '사번이 확인되지 않아 포장을 시작할 수 없습니다. 작업자 지정을 먼저 마치십시오.',
  },

  lotList: {
    sectionLabel: '포장 대상',
    lotNoColumn: 'LOT 번호',
    initialQtyColumn: '최초 수량',
    select: '선택',
    selected: '선택됨',
    empty: '포장할 수 있는 완료 LOT 이 없습니다.',
    loadFailed: '포장 대상 목록을 불러오지 못했습니다.',
    completedOnlyNotice:
      '완료된 생산LOT 만 보입니다. 미달로 마감된 LOT 도 실물이 있으므로 함께 포장할 수 있습니다.',
    remainingPending:
      '「잔여」 열은 아직 세우지 않았습니다 — 이미 포장된 수량을 뺀 값을 서버가 내려 주지 않습니다.',
  },

  scan: {
    sectionLabel: '스캔',
    label: 'LOT / 인식표 스캔',
    submit: '담기',
    manualEntry: '직접 입력',
    manualEntryNote: '스캔이 되지 않으면 이 버튼을 눌러 칸으로 옮긴 뒤 손으로 칩니다.',
    quantityLabel: '수량',
    unknownLot: '포장 대상 목록에 없는 LOT 입니다. 이 작업지시의 완료 LOT 만 담을 수 있습니다.',
    quantityRequired: '수량을 넣으십시오.',
    quantityPositive: '수량은 0보다 커야 합니다.',
    quantityNumber: '수량은 숫자로 넣으십시오.',
    blockedNoType:
      '담기 — 포장 유형을 먼저 고르십시오. 유형이 정해져야 포장 단위를 만들 수 있습니다.',
    creating: '포장 단위를 만드는 중입니다.',
    /*
     * ⛔ **오프라인에서 새 포장을 시작할 수 없다.** 포장 번호는 서버가 매겨 돌려주는 값이라
     * (스펙 §4-A 「자동」) 끊긴 채로는 얻을 길이 없고, 계약도 등록을 오프라인 대상으로 두지
     * 않았다. 담긴 뒤의 확정만 큐에 들어간다 — 그 차이를 작업자가 알아야 헛손질을 안 한다.
     */
    blockedOfflineNoUnit:
      '담기 — 연결이 끊겨 새 포장을 시작할 수 없습니다. 포장 번호는 서버가 매깁니다. 연결된 뒤에 다시 담으십시오.',
  },

  unit: {
    sectionLabel: '포장 단위',
    numberPending: '번호는 첫 내용물을 담을 때 부여됩니다',
    typeLabel: '유형',
    typePlaceholder: '고르십시오',
    typeLoadFailed: '포장 유형 목록을 불러오지 못했습니다.',
    parentLabel: '상위 포장',
    parentNone: '(없음)',
    parentLoadFailed: '상위 포장 후보를 불러오지 못했습니다.',
    createFailed: '포장 단위를 만들지 못했습니다.',
    lockedNotice: '내용물을 담기 시작하면 유형과 상위 포장은 바꿀 수 없습니다.',
  },

  contents: {
    sectionLabel: '내용물',
    lotColumn: 'LOT',
    itemColumn: '품목',
    qtyColumn: '수량',
    unknownCode: '—',
    empty: '아직 담은 것이 없습니다.',
    totalLabel: '합계',
    mixedTitle: '한 포장에 여러 LOT 이 섞였습니다',
    mixedBody: '막지 않습니다 — 어느 LOT 이 들어갔는지는 내용물 행으로 남습니다.',
  },

  confirm: {
    submit: '포장 확정',
    submitting: '확정하는 중',
    blockedNoType: '포장 확정 — 포장 유형을 고르십시오.',
    blockedNoContents: '포장 확정 — 담은 것이 없습니다. 빈 포장은 만들지 않습니다.',
    blockedNoUnit: '포장 확정 — 포장 단위가 아직 만들어지지 않았습니다.',
    blockedPacked: '이 포장은 확정을 마쳤습니다. 「다음 포장 시작」을 누르십시오.',
    done: '포장을 확정했습니다.',
    doneBody: '라벨·인식표 재출력은 이 화면 밖에서 합니다.',
    startNext: '다음 포장 시작',
  },

  /**
   * 오프라인 큐 — 공유계약 C-1 · 스펙 §6.
   *
   * ⭐ **담긴 순간이 곧 확정으로 보인다.** 그래서 아직 닿지 않은 건수를 함께 말하지 않으면
   * 작업자는 서버가 받았다고 믿는다.
   */
  outbox: {
    pending: (count: number) => `미전송 ${String(count)}건`,
    queued: '아직 서버에 닿지 않았습니다. 연결되면 자동으로 보냅니다.',
    offline: '오프라인입니다. 연결되면 자동으로 보냅니다.',
    rejected: '서버가 이 포장 확정을 받지 않았습니다.',
    stalled: '서버가 계속 받지 않습니다. 확정한 내용은 그대로 남아 있습니다.',
    retryNow: '다시 보내기',
  },

  error: {
    confirmTitle: '포장을 확정하지 못했습니다.',
    emptyContents: '담은 것이 없어 서버가 되돌렸습니다. 내용물을 담은 뒤 다시 확정하십시오.',
    alreadyPacked: '이미 확정된 포장입니다. 다음 포장을 새로 시작하십시오.',
    forbidden: '이 단말에는 포장 권한이 없습니다. 담당자에게 문의하십시오.',
  },
} as const;
