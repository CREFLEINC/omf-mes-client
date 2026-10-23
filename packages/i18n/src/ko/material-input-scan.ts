/**
 * P-02-03 자재 투입. **POP(현장 단말) 화면**이라 관리웹과 어휘가 갈린다.
 *
 * - 화면 구성 규범 C-5, C-13을 따른다. 하단 바 「남은 일」 문장은 머리말 없이 그대로 보인다.
 *   라벨과 구획 제목은 명사형, 안내와 오류는 상황과 할 일을 한두 문장으로 쓴다. 가운뎃점으로
 *   항목을 잇지 않는다.
 * - 조사가 LOT 번호 바로 뒤에 붙지 않게 쓴다. 번호의 끝 글자로는 받침을 알 수 없어 「LOT은」처럼
 *   업무 용어 뒤에 붙인다(C-5, `LOT` 은 「랏」으로 읽는다).
 * - **「통과」가 「정상」이 아니다.** 출고 미귀속은 막지 않고 기록만 하는데, 나중에 계보를 추적할
 *   때 그 구분이 필요하다. 그래서 표시할 말이 따로 있다.
 * - 판정 문구를 화면이 지어내지 않는다. 자재 상태와 오투입 판정은 서버가 하고 화면은 옮긴다.
 * - 머리줄 문구는 POP 공용(`popChrome.header`)이다.
 */
export const materialInputScan = {
  title: '자재 투입',
  panes: {
    input: '투입 자재',
    qty: '투입 수량',
  },
  /** 편집 영역의 라벨 값 쌍. 출고, 수령, 차이는 계획 대비 수령(생산창고 입고) 값이다. */
  pairs: {
    item: '품목',
    issuedQty: '출고',
    receivedQty: '수령',
    varianceQty: '차이',
    receiptStatus: '수령 상태',
    lotStatus: 'LOT 상태',
  },
  /** 수령 상태 — 서버가 계산한 차이 수량을 세 갈래로 옮긴 것이다. 값을 만들지 않는다. */
  receiptStatus: {
    matched: '수령 완료',
    short: '수령 부족',
    none: '미수령',
  },
  loading: {
    receipt: '라인 수령 내역을 불러오는 중',
  },
  empty: {
    /* 수령 내역도 담은 자재도 없을 때. */
    receiptTitle: '수령 내역이 없습니다. 자재 LOT을 스캔하면 목록에 담깁니다.',
    /* 조회 자체가 나가지 않은 상태 — 「받은 자재가 없다」와 다른 말을 한다. */
    notQueriedTitle: '작업지시가 지정되지 않았습니다.',
  },
  notes: {
    /**
     * 부족이나 미수령은 투입을 막지 않는다(스펙 §6). 그런 LOT이 있을 때만 구획 맨 위 안내 상자로
     * 보인다(C-7, C-19).
     */
    shortAllowed: '수령이 부족하거나 없는 자재가 있어도 받은 양만큼 투입할 수 있습니다.',
  },

  /** 스캔 칸 — 자재 LOT과 금형을 **같은 칸**에서 받는다(스펙 §3). 대상은 안내 문구에 적는다(C-13). */
  scan: {
    label: '스캔',
    placeholder: '자재 LOT 또는 금형 코드',
    /**
     * 스캔 한 번의 결과를 말하는 자리. 실패도 그 자리에서 말한다 — 화면을 옮기지 않는다.
     *
     * 결과 문장은 «해석된 것»만 말한다. 오타 확인이 필요한 경우(못 찾음)만 읽은 코드를 담는다.
     */
    outcomes: {
      material: (lotNo: string): string => `${lotNo} 담았습니다.`,
      /* 「물렸습니다」를 쓰지 않는다. 화면이 한 일은 이 투입에 딸린 금형으로 정한 것뿐이다. */
      mold: (moldCode: string): string => `금형 ${moldCode} 지정했습니다.`,
      duplicate: (lotNo: string): string => `${lotNo} LOT은 이미 담겨 있습니다.`,
      /* 상태 «이름»은 코드값 조회로 받은 것을 그대로 넣는다(스펙 §5-2). */
      blockedStatus: (lotNo: string, statusName: string): string =>
        `${lotNo} LOT은 「${statusName}」 상태라 담을 수 없습니다. 정상 상태의 자재만 투입할 수 있습니다.`,
      /** 상태 자체를 받지 못한 경우. 모르는 것을 「정상」으로 그리지 않는다(스펙 §5-2). */
      blockedStatusUnknown: (lotNo: string): string =>
        `${lotNo} LOT의 상태를 확인하지 못해 담을 수 없습니다. 다시 스캔하세요.`,
      ambiguous: (count: number): string =>
        `${String(count)}건이 함께 검색되었습니다. 라벨의 코드 전체를 스캔하세요.`,
      notFound: (code: string): string =>
        `${code}에 해당하는 자재 LOT이나 금형이 없습니다. 코드를 확인하세요.`,
      failed: '조회하지 못했습니다. 다시 스캔하세요.',
      /** 끊긴 상태에서 「다시 스캔하세요」만 쓰면 될 것처럼 읽힌다. 연결이 먼저다. */
      offline: '연결이 끊겨 자재를 조회할 수 없습니다. 연결된 뒤 다시 스캔하세요.',
    },
  },

  /**
   * 자재 목록(수령한 LOT과 담은 LOT)과 금형. 수령한 LOT은 스캔하면 담기고, 담은 LOT마다 투입
   * 수량을 넣고 기록한다.
   */
  scanned: {
    materialsLabel: '자재 목록',
    moldLabel: '금형',
    remove: '빼기',
    removeMaterial: (lotNo: string): string => `${lotNo} 빼기`,
    /** 투입 수량 칸. 보이는 라벨은 `qtyField`이고 접근 이름에 LOT 번호를 붙인다. */
    qtyField: '투입 수량',
    qtyLabel: (lotNo: string): string => `${lotNo} 투입 수량`,
    qtyProblems: {
      empty: '투입 수량을 입력하세요.',
      format: '투입 수량은 숫자로 입력하세요.',
      notPositive: '투입 수량은 0보다 커야 합니다.',
    },
    /** 서버가 통과시키되 기록만 한 것 — 스펙 §5-3. 「통과」가 「정상」이 아니다. */
    unlinkedIssue: '출고 미귀속',
    keypadLabel: (lotNo: string): string => `${lotNo} 수량 키패드`,
    /** 고른 LOT 한 건을 기록한다(건별 저장, 스펙 §5-8). */
    keypadSubmit: '기록',
    keypadClear: '전체 지움',
    keypadBackspace: '한 자 지움',
    /* 큐에 담긴 것도 「기록됨」이다 — C-1 이 즉시 성공 표시를 택했다. 미전송 여부는 머리줄이 낸다. */
    recordedMark: '기록됨',
    pendingMark: '기록 전',
    /** 수령한 LOT 중 아직 스캔하지 않은 것. */
    notScannedMark: '스캔 전',
    /** 편집 영역에 고른 자재가 없을 때. */
    noSelection: '목록에서 자재를 고르거나 LOT 라벨을 스캔하세요.',
    /** 수령한 LOT을 골랐지만 아직 스캔하지 않았을 때. 담기는 스캔으로만 한다. */
    scanToInput: 'LOT 라벨을 스캔하면 투입 수량을 입력할 수 있습니다.',
    moldEmpty: '지정한 금형이 없습니다.',
    /** 같은 LOT의 수령 줄이 없을 때. 출고에 귀속되지 않은 자재다. */
    receivedNone: '수령 내역 없음',
    /** 품질 판정과 **다른 축**이다. 나란히 두면 모순처럼 읽혀 칩으로 따로 둔다. */
    heldMark: '보류 중',
    /* IQC 에서 적은 4M 변경품(omf-all-around#63) — 투입을 막지 않고 알린다. */
    fourMChangeMark: '4M 변경품',
    /** 표시명을 못 받았을 때. 원문 코드를 그대로 보이므로 담당자에게 전할 단서는 남는다. */
    statusLabelUnavailable: '상태 이름을 불러오지 못해 코드로 표시합니다.',
    shotCount: (current: number, guaranteed: number): string =>
      `타발 ${current.toLocaleString('ko-KR')} / ${guaranteed.toLocaleString('ko-KR')}`,
    /* 적정 타수가 마스터에 없으면 남은 타수를 낼 수 없다. 0으로 채우지 않는다. */
    shotCountUnknown: (current: number): string =>
      `타발 ${current.toLocaleString('ko-KR')}, 적정 타수 미등록`,
    /* 넘어도 막지 않는다(미결 #6 — 경고만). 그 사실을 문구가 함께 말한다. */
    shotCountExceeded: '적정 타수를 넘었습니다. 투입할 수 있지만 금형 교체를 검토하세요.',
  },

  /** 하단 바 「남은 일」(C-5). 문장 끝에 마침표를 두지 않는다. */
  remaining: {
    workOrderMissing: '작업지시가 지정되지 않았습니다. 작업 시작에서 작업지시를 고르세요',
    scan: '자재 LOT을 스캔하세요',
    record: (lotNo: string): string => `${lotNo}의 투입 수량을 입력하고 기록하세요`,
    recordMany: (count: number, lotNo: string): string =>
      `기록하지 않은 자재 ${String(count)}건. ${lotNo}의 투입 수량을 입력하고 기록하세요`,
    ready: '투입 확정으로 진행할 수 있습니다',
    done: '생산 작업으로 진행할 수 있습니다',
  },

  /** 투입 확정 — 기록을 마친 목록을 닫는다. 서버를 부르지 않는다(스펙 §5-8). */
  confirm: {
    action: '투입 확정',
    /**
     * 잠긴 사유. 하단 바 「남은 일」 자리에 그대로 선다.
     *
     * ⛔ 아래 셋을 한 문장으로 합치지 않는다(공유계약 F-6). 「권한이 없다」와 「확인할 수 없다」는
     * 작업자가 할 일이 다르다.
     */
    reasons: {
      unavailable: '투입 권한을 확인하지 못했습니다. 투입 권한 다시 조회를 누르세요',
      unidentified:
        '단말이나 작업지시의 공정을 확인하지 못했습니다. 작업 시작에서 작업지시를 다시 고른 뒤 들어오세요.',
      checking: '투입 권한을 확인하는 중입니다',
      /* 건별 저장이라 「아직 기록되지 않은 줄」이 남아 있다는 뜻이다 — 닫으면 그 줄이 버려진다. */
      qtyMissing: '기록하지 않은 자재가 있습니다. 투입 수량을 입력하고 기록하거나 빼세요',
      workerMissing: '작업자가 확인되지 않았습니다. 사번을 확인한 뒤 다시 들어오세요',
    },
    /** 이 버튼이 하는 일은 **권한 조회 한 번**이다. */
    retry: '투입 권한 다시 조회',
    /** 몇 건으로 닫았는가. 기록은 이미 건별로 끝나 있다. */
    closed: (count: number): string => `자재 ${String(count)}건으로 투입을 마쳤습니다.`,
    /** 다음 작업. 화면 이름 그대로 적는다(`pop-screen-catalog` 의 `P-02-04`). */
    goToProductionResult: '생산 작업으로',
    failed: '투입을 기록하지 못했습니다.',
  },
} as const;
