/**
 * P-02-03 자재 투입. **POP(현장 단말) 화면**이라 관리웹과 어휘가 갈린다.
 *
 * - 화면 구성 규범 C-5, C-13을 따른다. 하단 바 「남은 일」 문장은 머리말 없이 그대로 보인다.
 *   라벨과 구획 제목은 명사형, 안내와 오류는 상황과 할 일을 한두 문장으로 쓴다. 가운뎃점으로
 *   항목을 잇지 않는다.
 * - 현장 화면 규칙 C-21: 대상은 품목 이름으로 가리키고 LOT 번호는 목록 줄에서만 보인다. 정상 값은
 *   두지 않고 예외만 칩으로 말한다.
 * - 말은 화면 용어집(C-13)을 따른다: 불출량, 투입량, 잔량, 과투입, 미투입, 투입 중, 투입 완료, 미전송,
 *   전송 완료, [투입 등록], [취소], [추가 투입].
 * - 품목 이름 뒤 조사는 화면이 `patterns/josa`로 붙여 넘긴다(인자 이름의 `WithObject`, `WithTopic`).
 * - **「통과」가 「정상」이 아니다.** 출고 미귀속은 막지 않고 기록만 하는데, 나중에 계보를 추적할
 *   때 그 구분이 필요하다. 그래서 표시할 말이 따로 있다.
 * - 판정 문구를 화면이 지어내지 않는다. 자재 상태와 오투입 판정은 서버가 하고 화면은 옮긴다.
 * - 머리줄 문구는 POP 공용(`popChrome.header`)이다.
 */
export const materialInputScan = {
  title: '자재 투입',
  panes: {
    input: '투입 자재',
    /** 편집 영역 제목. 고른 자재가 있으면 그 품목 이름이 제목이다(C-21 영역 제목). */
    noSelection: '선택한 자재',
  },
  /**
   * 수량(C-21 「진행 / 기준」): 라벨 「투입량」과 값 「30 / 100 KG」(투입량 / 불출량), 진행 막대. 잔량은
   * 이번 투입 곁에만, 음수는 보이지 않는다(과투입은 칩과 한 줄).
   */
  pairs: {
    /** 정보 영역의 「라벨 값」 쌍(C-21). 투입량의 값은 「투입량 / 불출량」이다(PI-33). */
    lotLabel: 'LOT',
    progressLabel: '투입량',
    progress: (recorded: string, issued: string | null, uom: string): string =>
      `${recorded}${issued === null ? '' : ` / ${issued}`}${uom === '' ? '' : ` ${uom}`}`,
    /** 잔량 = 불출량 − 투입량. 편집 영역의 이번 투입 곁에만 둔다. */
    remaining: (qty: string): string => `잔량 ${qty}`,
    over: (qty: string): string => `불출량보다 ${qty} 더 투입했습니다.`,
    /** 지금 넣는 양. 입력 칸 묶음의 소제목이다. */
    thisInput: '이번 투입',
  },
  /**
   * 수령 상태의 예외 칩(C-21 정상은 숨김). 서버가 계산한 차이 수량을 옮긴 것이다. 막지 않는다.
   * `matched`는 화면에 두지 않는다.
   */
  receiptStatus: {
    matched: '받음',
    short: '덜 받음',
    none: '못 받음',
  },
  loading: {
    receipt: '불출 자재를 불러오는 중',
  },
  empty: {
    /* 불출된 자재도 담은 자재도 없을 때. */
    receiptTitle: '불출된 자재가 없습니다. 자재 LOT을 스캔하면 목록에 담깁니다.',
    /* 조회 자체가 나가지 않은 상태. 「불출된 자재가 없다」와 다른 말을 한다. */
    notQueriedTitle: '작업지시가 지정되지 않았습니다.',
  },
  notes: {
    /** 덜 받거나 못 받은 자재가 있을 때만 구획 맨 위 안내 상자로 보인다(C-7, C-19). 투입을 막지 않는다. */
    shortAllowed: '덜 받거나 못 받은 자재가 있어도 불출량만큼 투입할 수 있습니다.',
  },

  /** 스캔 칸 — 자재 LOT과 금형을 **같은 칸**에서 받는다(스펙 §3). 대상은 안내 문구에 적는다(C-13). */
  scan: {
    label: '스캔',
    placeholder: '자재 LOT 또는 금형 코드',
    /**
     * 스캔 한 번의 결과 한 줄(C-21). 대상은 품목 이름으로 말하고 LOT 번호를 다시 쓰지 않는다.
     * 오타 확인이 필요한 경우(못 찾음)만 읽은 코드를 담는다.
     */
    outcomes: {
      material: (itemWithObject: string): string => `${itemWithObject} 담았습니다.`,
      /* 「물렸습니다」를 쓰지 않는다. 화면이 한 일은 이 투입에 딸린 금형으로 정한 것뿐이다. */
      mold: (moldWithObject: string): string => `금형 ${moldWithObject} 지정했습니다.`,
      again: (item: string): string => `${item} 추가 투입을 담았습니다.`,
      duplicate: (itemWithTopic: string): string => `${itemWithTopic} 이미 담겨 있습니다.`,
      /* 상태 «이름»은 코드값 조회로 받은 것을 그대로 넣는다(스펙 §5-2). */
      blockedStatus: (itemWithTopic: string, statusName: string): string =>
        `${itemWithTopic} 「${statusName}」 상태라 담을 수 없습니다.`,
      /** 상태 자체를 받지 못한 경우. 모르는 것을 「정상」으로 그리지 않는다(스펙 §5-2). */
      blockedStatusUnknown: (item: string): string =>
        `${item}의 상태를 확인하지 못했습니다. 다시 스캔하세요.`,
      ambiguous: (count: number): string =>
        `${String(count)}건이 함께 검색되었습니다. 라벨의 코드 전체를 스캔하세요.`,
      notFound: (code: string): string =>
        `${code}에 해당하는 자재 LOT이나 금형이 없습니다. 코드를 확인하세요.`,
      failed: '조회하지 못했습니다. 다시 스캔하세요.',
      /** 끊긴 상태에서 「다시 스캔하세요」만 쓰면 될 것처럼 읽힌다. 연결이 먼저다. */
      offline: '연결이 끊겨 자재를 조회할 수 없습니다. 연결된 뒤 다시 스캔하세요.',
      /** 투입을 보낸 뒤 결과 한 줄(다음 동작에서 보냈든 [투입 등록]이든). */
      recorded: (item: string, qty: string): string => `${item} ${qty} 투입`,
      /** 미전송 투입의 [취소] 뒤. 아무것도 보내지 않았다. */
      undone: (item: string): string => `${item} 미전송 투입을 취소했습니다.`,
      /** 다 투입한 LOT을 스캔했을 때. 정보만이다(PI-28). */
      allInput: (item: string): string => `${item} 불출량을 모두 투입했습니다.`,
      /** 화면을 다시 열 때 앞서 남은 미전송 투입을 보냈다(PI-31). 한 번만 보인다. */
      leftoversSent: (count: number): string =>
        `앞서 스캔한 미전송 투입 ${String(count)}건을 전송했습니다.`,
    },
  },

  /** 자재 목록(불출된 LOT과 담은 LOT)과 편집 영역. */
  scanned: {
    materialsLabel: '자재 목록',
    /** 스캔했지만 기록하지 않은 LOT을 목록에서 되돌린다(사용자 화면 확인 결정 2026-10-23, PI-08). */
    remove: '스캔 취소',
    removeMaterial: (lotNo: string): string => `${lotNo} 스캔 취소`,
    removed: (item: string): string => `${item} 스캔을 취소했습니다.`,
    /**
     * 미전송(PI-26). 스캔하면 잔량으로 투입을 잡고 다음 동작에서 보낸다. 그 사이 수량을 고치거나
     * [취소]로 버린다.
     */
    pendingHint: '다음 스캔이나 생산 작업으로 넘어갈 때 전송합니다.',
    /** 편집 영역의 투입 기록 목록(PI-30). */
    recordsTitle: '투입 내역',
    pendingState: '미전송',
    sentState: '전송 완료',
    /** 취소 기록 API(omf-mes-server#828)가 생기면 쓴다. 그 전에는 그리지 않는다. */
    cancelRecord: '투입 취소',
    /** 다 투입한 LOT(PI-28). */
    allInput: '불출량을 모두 투입했습니다.',
    extraInput: '추가 투입',
    undo: '취소',
    undoMaterial: (lotNo: string): string => `${lotNo} 미전송 투입 취소`,
    /** 자동으로 보내지 않고 직접 입력으로 돌리는 까닭 한 줄(PI-28). */
    manualReasons: {
      unknown: '불출량을 몰라 투입량을 직접 입력합니다.',
      none: '불출량을 모두 투입했습니다. 더 넣으려면 투입량을 직접 입력하세요.',
      unit: '단위가 달라 투입량을 직접 입력합니다.',
    },
    /** 보낸 투입을 고르면. 고치거나 거두는 기능은 아직 없다(omf-mes-server#828). */
    sentReadOnly: '전송한 투입은 지금 고칠 수 없습니다. 더 넣으려면 LOT 라벨을 다시 스캔하세요.',
    /** 이번 투입 칸. 보이는 이름은 소제목 「이번 투입」이고 접근 이름에 LOT 번호를 붙인다. */
    qtyLabel: (lotNo: string): string => `${lotNo} 이번 투입`,
    qtyProblems: {
      empty: '이번 투입 수량을 입력하세요.',
      format: '이번 투입 수량은 숫자로 입력하세요.',
      notPositive: '이번 투입 수량은 0보다 커야 합니다.',
    },
    /** 서버가 통과시키되 기록만 한 것 — 스펙 §5-3. 「통과」가 「정상」이 아니다. */
    unlinkedIssue: '출고 미귀속',
    keypadLabel: (lotNo: string): string => `${lotNo} 수량 키패드`,
    /** 고른 LOT 한 건을 기록한다(건별 저장, 스펙 §5-8). */
    keypadSubmit: '투입 등록',
    keypadClear: '전체 지움',
    keypadBackspace: '한 자 지움',
    /** 목록 위 한 줄(C-21). 투입 완료는 과투입을 포함한다(PI-32). */
    summary: (todo: number, done: number): string =>
      `투입할 자재 ${String(todo)}건, 투입 완료 ${String(done)}건`,
    /** 목록 줄 진행 칩(C-21 상태 하나). 불출량에 닿으면 투입 완료, 넘으면 과투입(경고). */
    completeMark: '투입 완료',
    overMark: (qty: string): string => `과투입 ${qty}`,
    pendingMark: '투입 중',
    /** 편집 영역에 고른 자재가 없을 때. */
    noSelection: '목록에서 자재를 고르거나 LOT 라벨을 스캔하세요.',
    /** 받은 LOT을 골랐지만 이번 화면에서 아직 스캔하지 않았을 때. 담기는 스캔으로만 한다. */
    scanToInput: 'LOT 라벨을 스캔하면 이번 투입을 입력할 수 있습니다.',
    /** 예외 칩. 이름은 그 상태에서 할 일이 보이게 짓는다(C-17, C-21). */
    heldMark: '보류 확인 필요',
    /* IQC 에서 적은 4M 변경품(omf-all-around#63) — 투입을 막지 않고 알린다. */
    fourMChangeMark: '4M 변경품',
    fourMChangeLine: (detail: string): string => `4M 변경: ${detail}`,
    /** 불출 줄의 단위와 LOT의 단위가 다르면 잔량을 셀 수 없다. */
    unitMismatch: '단위 다름',
    /* 넘어도 막지 않는다(미결 #6 — 경고만). 그 사실을 문구가 함께 말한다. */
    shotCountExceeded: (mold: string): string =>
      `금형 ${mold} 적정 타수를 넘었습니다. 투입할 수 있지만 교체를 검토하세요.`,
  },

  /** 하단 바 「남은 일」(C-5). 문장 끝에 마침표를 두지 않는다. */
  remaining: {
    workOrderMissing: '작업지시가 지정되지 않았습니다. 작업 지시 목록에서 작업지시를 고르세요',
    scan: '자재 LOT을 스캔하세요',
    /** 기록하지 않은 LOT이 하나면 품목 이름으로 가리킨다. LOT 번호 전체를 쓰지 않는다(C-5 한 줄). */
    record: (item: string): string => `${item}의 투입을 등록하세요`,
    recordMany: (count: number): string => `스캔한 자재 ${String(count)}건의 투입을 등록하세요`,
    /** 막힘 없음(C-5). 주 동작 [생산 작업으로]가 하는 일을 말한다. */
    done: '투입을 마쳤으면 생산 작업으로 이동하세요',
    /** 미전송 투입이 있을 때. 막힘이 아니라 곧 일어날 일이다. */
    sending: (item: string, qty: string): string => `${item} ${qty} 투입을 다음 스캔 때 전송합니다`,
  },

  /**
   * 투입 등록과 다음 작업. 저장은 LOT마다 [투입 등록] 하나다. 따로 닫는 확정 동작은 없다
   * (사용자 화면 확인 결정 2026-10-23, 두 번 확정하지 않는다).
   */
  confirm: {
    /**
     * 잠긴 사유. 하단 바 「남은 일」 자리에 그대로 선다.
     *
     * ⛔ 아래 셋을 한 문장으로 합치지 않는다(공유계약 F-6). 「권한이 없다」와 「확인할 수 없다」는
     * 작업자가 할 일이 다르다.
     */
    reasons: {
      unavailable: '투입 권한을 확인하지 못했습니다. 투입 권한 다시 조회를 누르세요',
      unidentified:
        '단말이나 작업지시의 공정을 확인하지 못했습니다. 작업 지시 목록에서 작업지시를 다시 고른 뒤 들어오세요.',
      checking: '투입 권한을 확인하는 중입니다',
      /* 건별 저장이라 「아직 기록되지 않은 줄」이 남아 있다는 뜻이다 — 닫으면 그 줄이 버려진다. */
      qtyMissing: '등록하지 않은 자재가 있습니다. 투입량을 입력해 등록하거나 스캔 취소하세요',
      /* 이 화면에서 사번 입력 창을 연다(PI-17). 다른 화면으로 돌려보내지 않는다(C-13). */
      workerMissing: '사번을 입력하세요',
    },
    /** 이 버튼이 하는 일은 **권한 조회 한 번**이다. */
    retry: '투입 권한 다시 조회',
    /** 다음 작업. 화면 이름 그대로 적는다(`pop-screen-catalog` 의 `P-02-04`). */
    goToProductionResult: '생산 작업으로',
    failed: '투입을 등록하지 못했습니다.',
  },
} as const;
