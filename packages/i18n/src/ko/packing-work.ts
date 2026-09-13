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
    /* ⚠ 머리줄 표기는 「W/O」로 통일한다(사용자 지시 2026-09-10). */
    workOrderLabel: 'W/O',
    workOrderUnknown: 'W/O 없음',
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
    empty: '포장할 수 있는 완료 LOT 이 없습니다.',
    loadFailed: '포장 대상 목록을 불러오지 못했습니다.',
  },

  scan: {
    sectionLabel: '스캔',
    label: 'LOT / 인식표 스캔',
    submit: '담기',
    manualEntry: '직접 입력',
    quantityLabel: '수량',
    /*
     * 화면 내장 숫자 키패드(D-4). ⛔ **운영체제 키보드에 기대지 않는다** — 현장 POP 은
     * 키오스크로 잠겨 있어 키보드가 뜨지 않고, 그러면 이 칸에 입력 수단이 아예 없다.
     */
    keypadLabel: '수량 키패드',
    keypadBackspace: '한 자 지움',
    keypadClear: '지움',
    keypadDecimal: '소수점',
    unknownLot: '포장 대상 목록에 없는 LOT 입니다. 이 작업지시의 완료 LOT 만 담을 수 있습니다.',
    quantityRequired: '수량을 넣으십시오.',
    quantityPositive: '수량은 0보다 커야 합니다.',
    quantityNumber: '수량은 숫자로 넣으십시오.',
  },

  unit: {
    sectionLabel: '포장 단위',
    typeLabel: '유형',
    /** 「담기」를 눌렀는데 유형이 비어 있을 때 이 칸에 붙는다 — 고칠 곳에서 말한다. */
    typeRequired: '포장 유형을 고르세요.',
    typePlaceholder: '고르세요',
    typeLoadFailed: '포장 유형 목록을 불러오지 못했습니다.',
    parentLabel: '상위 포장',
    parentNone: '(없음)',
    parentLoadFailed: '상위 포장 후보를 불러오지 못했습니다.',
    /*
     * ⚠ **화면에 «줄»로 세우지 않는다**(사용자 지시 2026-09-10 — 그 문장을 걷었다). 다만 칸이
     * 잠기는 이유가 어디에도 없으면 왜 못 바꾸는지 알 길이 없다(리뷰 지적) — 잠긴 칸에만
     * 붙여 설명으로 읽히게 한다.
     */
    lockedReason: '내용물을 담기 시작하면 바꿀 수 없습니다.',
    /*
     * ⛔ **끊긴 동안에는 새 포장을 시작할 수 없다**(스펙 §6). 번호를 서버가 매기고 확정이 그
     * 번호로 나가므로 단말이 만들 수 없는 값이다 — 왜 다른 것은 되는데 이것만 안 되는지를 말한다.
     */
    offlineStartBlocked: '연결이 끊겨 새 포장을 시작할 수 없습니다. 포장 번호는 서버가 매깁니다.',
    /*
     * 담다가 그만둘 때 — 확정 전에만 열린다(스펙 §5-7).
     *
     * ⛔ **잠긴 사유를 따로 적지 않는다.** 잠기는 경우가 셋인데 셋 다 화면이 이미 말하고 있다 —
     * 확정 뒤에는 「확정을 마쳤습니다」가, 끊겼을 때는 오프라인 배너가, 담기 전에는 번호 자리의
     * 「담기 시작하면 번호가 매겨집니다」가. 액션 옆에서 되풀이하면 늘 떠 있는 문장이 된다.
     */
    discardAction: '포장 취소',
  },

  contents: {
    sectionLabel: '내용물',
    unknownCode: '—',
    /** 담긴 줄 하나를 읽어 주는 이름 — 값마다 무엇인지 붙인다. */
    lineLabel: (lotNo: string, itemCode: string, qty: string) =>
      `LOT ${lotNo} · 품목 ${itemCode} · 수량 ${qty}`,
    empty: '내용물이 비어 있습니다.',
    totalLabel: '합계',
    mixedTitle: '한 포장에 여러 LOT 이 섞였습니다',
  },

  confirm: {
    submit: '포장 확정',
    submitting: '확정하는 중',
    blockedPacked: '이 포장은 확정을 마쳤습니다. 「다음 포장 시작」을 누르십시오.',
    done: '포장을 확정했습니다.',
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
    /** 담기 시작(포장 단위 만들기)이 실패했을 때. 확정과 다른 단계다 — 같은 말로 덮지 않는다. */
    startTitle: '포장을 시작하지 못했습니다.',
    confirmTitle: '포장을 확정하지 못했습니다.',
    emptyContents: '담은 것이 없어 서버가 되돌렸습니다. 내용물을 담은 뒤 다시 확정하십시오.',
    forbidden: '이 단말에는 포장 권한이 없습니다. 담당자에게 문의하십시오.',
  },
} as const;
