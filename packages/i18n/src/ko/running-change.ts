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
    /* ⚠ 머리줄의 작업지시 표기는 화면마다 「W/O」로 통일한다(사용자 지시 2026-09-10). */
    workOrder: (workOrderId: number) => `W/O ${workOrderId}`,
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
    currentLot: '현재 생산LOT',
    replace: '부품 교체',
  },

  current: {
    loading: '현재 투입을 불러오는 중입니다.',
    empty: '이 작업지시에 등록된 투입이 없습니다. 교체할 대상이 없습니다.',
    noWorkOrder: '작업지시가 정해지면 현재 투입이 표시됩니다.',
    /*
     * ⭐ **칸마다 이름을 붙인다**(사용자 제안 시안 2026-09-11). 값만 늘어놓으면 「ABC-123」이
     *    품목인지 LOT 인지, 「100 EA」가 계획인지 투입인지 화면만 보고는 알 수 없다.
     */
    itemCodeLabel: '제품 코드',
    inputQtyLabel: '투입 수량',
    moldSectionLabel: '금형 정보',
    moldNoLabel: '금형 번호',
    moldNameLabel: '금형명',
    shotCountLabel: '타발수',
    shotRemainingLabel: '잔여 타발수',
    moldUnknown: '금형을 확인할 수 없습니다',
    moldNone: '이 세션에 물린 금형이 없습니다',
    /** 세션이 없으면 금형을 «알 수 없다» — 「없다」와 다르다. 비워 두면 둘이 한 모양이 된다. */
    moldNoSession: '세션이 없어 물린 금형을 알 수 없습니다',
    /*
     * ⭐ 자릿수를 끊어 적는다(`128,400`) — 여섯 자리를 한 덩이로 두면 눈이 자릿수를 세야 한다.
     *   자매 화면 `P-05-01` 이 같은 값을 같은 방법으로 적는다. ⛔ 값 자체는 그대로다.
     */
    moldShotCount: (current: number) => current.toLocaleString('ko-KR'),
    moldShotRemaining: (remaining: number) => remaining.toLocaleString('ko-KR'),
    moldShotRemainingUnknown: '잔여 산출 불가',
    /** 적정 타수를 넘었어도 등록을 막지 않는다 — 경고만 낸다(스펙 §6). */
    moldShotExceeded: '적정 타수를 넘었습니다. 담당자에게 확인하세요.',
  },

  /**
   * 《현재 생산LOT》 — 지금 돌고 있는 생산LOT 과 그 진척.
   *
   * ⛔ 「LOT 없음」과 「불러오지 못함」을 같은 말로 적지 않는다. 앞은 앞 화면을 거쳐 다시
   * 들어와야 풀리고, 뒤는 다시 읽으면 풀린다.
   */
  currentLot: {
    loading: '현재 생산LOT 을 불러오는 중입니다.',
    missing: '현재 생산LOT 을 받지 못했습니다. 작업 화면에서 다시 들어오세요.',
    failed: '현재 생산LOT 을 불러오지 못했습니다. 교체 등록은 그대로 할 수 있습니다.',
    progress: (goodQty: number, targetQty: number) => `진행 ${goodQty}/${targetQty}`,
    /** 진척은 선택 필드다 — 못 받았으면 0 으로 적지 않고 모른다고 적는다. */
    progressUnknown: (targetQty: number) => `목표 ${targetQty} · 진행 확인 불가`,
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
    manualEntry: '직접 입력',
    outcomes: {
      /**
       * 읽은 코드와 찾은 LOT 이 «다를 때»만 둘을 잇는다 — 검색이 번호의 일부·외부 식별자로도
       * 걸리므로 작업자가 잘못 걸린 것인지 판단할 근거가 된다(`scan.ts`).
       */
      partResolved: (code: string, lotNo: string) => `${code} → ${lotNo} 을(를) 담았습니다.`,
      /**
       * 읽은 코드가 곧 LOT 번호인 경우. ⛔ **화살표 양쪽에 같은 값을 적지 않는다** — 무엇이
       * 무엇으로 바뀌는지 읽히지 않고, 실제로는 바뀐 것이 없다.
       */
      part: (lotNo: string) => `${lotNo} 을(를) 담았습니다.`,
      ambiguous: (count: number) =>
        `여러 건이 걸렸습니다(${count}건). LOT 번호를 그대로 읽어 주세요.`,
      notFound: (code: string) => `${code} 에 해당하는 LOT 을 찾지 못했습니다.`,
      failed: '조회에 실패했습니다. 다시 읽어 주세요.',
      offline: '연결이 끊겨 조회할 수 없습니다. 연결되면 다시 읽어 주세요.',
    },
  },

  replace: {
    partLabel: '신규 부품',
    partNone: '신규 부품 LOT 을 먼저 스캔 해주세요.',
    /*
     * 보류 칩의 품질 상태 — 공통코드로 표시명을 푼다. ⛔ **코드를 그대로 세우지 않는다**:
     * 현장은 `INSPECTION_PENDING` 이 무엇인지도, 무엇을 하면 풀리는지도 모른다.
     */
    statusLoading: '상태를 확인하는 중',
    statusFailed: '상태를 확인하지 못했습니다',
    /* 표시명을 못 받았을 때만 코드를 보인다. 이름을 지어내지 않는다(전례 #1022). */
    statusUnknown: (code: string) => `${code} (표시명 없음)`,
    clearPart: '지우기',
    targetLabel: '교체 대상',
    targetPlaceholder: '교체 대상을 고르세요',
    targetOption: (itemCode: string, lotNo: string) => `${itemCode} (${lotNo})`,
    qtyLabel: '투입 수량',
    qtyProblems: {
      empty: '투입 수량을 입력하세요.',
      format: '숫자만 입력하세요.',
      notPositive: '투입 수량은 0보다 커야 합니다.',
    },
    reasonLabel: '교체 사유',
    reasonPlaceholder: '사유를 고르세요',
    /**
     * ⚠ 사유를 고르지 않아도 등록은 막히지 않는다(스펙 §6 — 권고).
     *
     * ⛔ **「값이 정해지지 않았다」로 말하지 않는다.** 값은 고객이 마스터에서 채우는 것이고
     * (스펙 §8 미결 1 · 2026-09-03 판정), 비어 있는 것은 «아직 안 채운» 상태다. 못 받은
     * 것과도 갈라 말한다 — 앞은 기다릴 일이고 뒤는 다시 읽으면 풀린다.
     */
    /**
     * 고를 사유가 없을 때 **칸 «안»에서 말한다**(사용자 지시 2026-09-11).
     *
     * ⚠ 「사유를 고르세요」를 그대로 두고 아래에 따로 안내를 붙였더니, 잠긴 칸이 고르라고
     *   말하고 그 밑에서 못 고른다고 말하는 두 문장이 겹쳤다.
     */
    /* ⚠ 마침표를 찍지 않는다 — 칸 «안»의 자리 표시 글이지 문장이 아니다(사용자 지시). */
    reasonEmpty: '선택 가능한 교체 사유가 없어 사유 없이 등록됩니다',
    reasonFailed: '교체 사유를 불러오지 못했습니다. 사유 없이 등록됩니다.',
    reasonLoading: '교체 사유를 불러오는 중입니다.',
    submit: '교체 등록',
    recorded: '교체를 담았습니다. 서버에 전송되면 미전송 건수가 줄어듭니다.',
    rejected: '서버가 이 교체를 받지 않았습니다.',
  },

  /**
   * 투입 수량 키패드 — 공유계약 D-4(POP 숫자 입력은 화면 내장 키패드).
   *
   * 단말에는 자판이 없다. 칸만 두면 값을 넣을 방법이 없다.
   */
  pad: {
    title: '투입 수량',
    keypadLabel: '수량 키패드',
    backspace: '한 자 지움',
    clear: '지움',
    decimal: '소수점',
    confirm: '확인',
    cancel: '취소',
    /** 아직 아무것도 안 눌렀다 — 빈 칸을 말없이 두면 「0 이 들어갔나」로 읽힌다. */
    empty: '—',
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
