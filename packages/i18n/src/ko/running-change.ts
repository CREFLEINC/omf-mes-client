/**
 * P-02-11 러닝체인지 부품 교체 등록.
 *
 * 이 화면의 말은 「교체」다 — 계약의 자원 이름은 자재 투입(`material_consumption`)이지만,
 * 현장에서 하는 일은 설비를 멈추지 않고 부품을 바꿔 다는 것이다.
 *
 * ⛔ 「정정」이라고 쓰지 않는다. 정정은 잘못 적은 것을 없던 일로 만드는 것이고, 교체는
 * 이전 부품도 실제로 쓰였다는 뜻이다 — 두 말을 섞으면 이력이 왜곡된다.
 */
export const runningChange = {
  title: '러닝체인지 부품 교체',

  header: {
    workOrder: (workOrderId: number) => `작업지시 ${workOrderId}`,
    workOrderMissing: '작업지시를 받지 못해 현재 투입을 불러올 수 없습니다.',
    session: (workSessionId: number) => `세션 ${workSessionId}`,
    sessionNone: '세션 없음',
    terminal: (terminalId: number) => `단말 ${terminalId}`,
    terminalUnknown: '단말 확인되지 않음',
    unsynced: (count: number) => `미전송 ${count}건`,
    synced: '전송 완료',
    offline: '오프라인',
  },

  panes: {
    current: '현재 투입',
    replace: '부품 교체',
  },

  current: {
    loading: '현재 투입을 불러오는 중입니다.',
    empty: '이 작업지시에 등록된 투입이 없습니다. 교체할 대상이 없습니다.',
    noWorkOrder: '작업지시가 정해지면 현재 투입이 표시됩니다.',
    replacedBadge: '교체됨',
    moldLabel: '금형',
    moldUnknown: '금형을 확인할 수 없습니다',
    moldNone: '이 세션에 물린 금형이 없습니다',
    /** 세션이 없으면 금형을 «알 수 없다» — 「없다」와 다르다. 비워 두면 둘이 한 모양이 된다. */
    moldNoSession: '세션이 없어 물린 금형을 알 수 없습니다',
    moldShotCount: (current: number) => `타발수 ${current}`,
    moldShotRemaining: (remaining: number) => `잔여 ${remaining}`,
    moldShotRemainingUnknown: '잔여 산출 불가',
    /** 적정 타수를 넘었어도 등록을 막지 않는다 — 경고만 낸다(스펙 §6). */
    moldShotExceeded: '적정 타수를 넘었습니다. 담당자에게 확인하세요.',
  },

  /**
   * 설비를 멈추지 않는다는 것과 W/O 가 나뉘지 않는다는 것 — 둘 다 스펙 §3 도면이
   * 화면에 상시 세워 둔 안내다.
   */
  notices: {
    equipmentKeepsRunning: '설비를 멈추지 않습니다.',
    noWorkOrderSplit: 'W/O 는 나뉘지 않습니다. 생산LOT 만 BOM 스냅샷별로 갈립니다.',
  },

  scan: {
    label: '신규 부품 LOT 스캔',
    submit: '읽기',
    scanning: '조회 중',
    manualEntry: '직접 입력',
    outcomes: {
      part: (code: string, lotNo: string) => `${code} → ${lotNo} 을(를) 담았습니다.`,
      ambiguous: (count: number) =>
        `여러 건이 걸렸습니다(${count}건). LOT 번호를 그대로 읽어 주세요.`,
      notFound: (code: string) => `${code} 에 해당하는 LOT 을 찾지 못했습니다.`,
      failed: '조회에 실패했습니다. 다시 읽어 주세요.',
      offline: '연결이 끊겨 조회할 수 없습니다. 연결되면 다시 읽어 주세요.',
    },
  },

  replace: {
    partLabel: '신규 부품',
    partNone: '신규 부품 LOT 을 먼저 읽어 주세요.',
    clearPart: '지우기',
    targetLabel: '교체 대상',
    targetPlaceholder: '교체할 투입을 고르세요',
    targetOption: (itemCode: string, lotNo: string) => `${itemCode} (${lotNo})`,
    qtyLabel: '투입 수량',
    qtyProblems: {
      empty: '투입 수량을 입력하세요.',
      format: '숫자만 입력하세요.',
      notPositive: '투입 수량은 0보다 커야 합니다.',
    },
    reasonLabel: '교체 사유',
    /**
     * 값 목록이 정해지지 않아 고를 것이 없다. **감추지 않고 사유를 말한다** — 칸만 비워 두면
     * 고를 것이 없는 것인지 아직 안 고른 것인지 구분되지 않는다.
     *
     * ⚠ 사유를 고르지 않아도 등록은 막히지 않는다(스펙 §6 — 권고).
     */
    reasonPlaceholder: '선택할 수 없음',
    reasonUnavailable: '교체 사유는 아직 고를 수 있는 값이 정해지지 않았습니다. 없이 등록됩니다.',
    submit: '교체 등록',
    /** 이전 투입을 지우지 않는다는 사실을 등록 자리에서 말한다(§5-2 · 이력 불변). */
    keepsHistory: '이전 투입은 지워지지 않고 그대로 남습니다.',
    recorded: '교체를 담았습니다. 서버에 전송되면 미전송 건수가 줄어듭니다.',
    rejected: '서버가 이 교체를 받지 않았습니다.',
  },

  /** 등록이 막힌 사유. 「확인할 수 없다」와 「권한이 없다」를 다르게 말한다. */
  disabled: {
    checking: '교체 권한을 확인하는 중입니다.',
    denied: '이 단말에서는 자재를 투입할 수 없습니다. 담당자에게 문의하세요.',
    unavailable: '교체 권한을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    unidentified: '단말이 확인되지 않아 교체를 등록할 수 없습니다.',
    workerMissing: '사번이 확인되지 않아 교체를 등록할 수 없습니다. 사번 인증을 먼저 하세요.',
    workOrderMissing: '작업지시가 없어 교체를 등록할 수 없습니다.',
    partMissing: '신규 부품 LOT 을 읽어야 등록할 수 있습니다.',
    targetMissing: '교체 대상을 골라야 등록할 수 있습니다.',
  },

  retry: '다시 시도',
} as const;
