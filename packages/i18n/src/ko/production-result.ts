/**
 * P-02-04 작업실적 등록(LOT·제품 선택).
 *
 * 이 화면의 말은 「실적」이고 받는 수량은 **양품 하나**다 — 불량·손실은 이 화면에 오지 않는다.
 */
export const productionResult = {
  title: '생산 실적 등록',

  flow: {
    header: {
      erpWorkOrder: 'ERP W/O',
      /* ⚠ ERP 쪽 번호와 나란히 서는 자리라 어느 쪽 번호인지 밝힌다(사용자 지시 2026-09-10). */
      workOrder: 'MES W/O',
      item: '품목',
    },
    currentLot: {
      title: 'LOT 진행',
      current: '현재 LOT',
      sequence: (current: number | null, total: number | null) =>
        `${current === null ? '—' : String(current)} / ${total === null ? '—' : String(total)}`,
      completed: '마감된 LOT 목록 보기',
      completedTitle: '마감된 LOT',
      completedEmpty: '마감된 LOT이 없습니다.',
      pageNav: '마감된 LOT 페이지 이동',
      pageUp: '페이지 위',
      pageDown: '페이지 아래',
      pagePosition: (page: number, totalPages: number) =>
        `${String(totalPages)}쪽 중 ${String(page)}쪽`,
      none: '생산할 LOT이 없습니다. 관리웹에서 W/O 마감을 진행하세요.',
      loadFailed: '현재 LOT을 불러오지 못했습니다.',
    },
    quantity: {
      title: '생산 수량',
      target: '생산 목표수량',
      actual: '실제 생산수량',
      invalid: '0보다 큰 수량을 입력하세요.',
    },
    tag: {
      title: '인식표',
      issued: '출력한 인식표',
      count: (count: number) => `${String(count)}개`,
      issueMissing: (count: number) => `부족한 인식표 ${String(count)}장 출력`,
      matched: '실제 생산수량과 인식표 개체 수가 일치합니다.',
      tooMany: '이미 만든 인식표 개체 수보다 실제 생산수량을 작게 낮출 수 없습니다.',
      summaryFailed: '인식표 발행 이력을 확인할 수 없어 생산 라벨 출력을 열지 않습니다.',
      restoreDocuments: (count: number) => `발행 기록이 없는 인식표 ${String(count)}장 복구`,
      printIncomplete: (count: number) =>
        `인쇄 대기 또는 실패 인식표 ${String(count)}장을 확인해 재출력하세요.`,
      printOutcome: {
        PENDING: '인쇄 대기',
        SUCCEEDED: '인쇄 성공',
        FAILED: '인쇄 실패',
      },
      reissue: '선택한 인식표 재출력',
      reissueReason: '인식표 재출력 사유',
      reissueReasonPlaceholder: '사유를 고르세요',
      reasonLoadFailed: '재출력 사유를 불러오지 못했습니다.',
      reasonEmpty: '고를 수 있는 재출력 사유가 없어 재출력할 수 없습니다.',
      issuing: '인식표를 발행하고 있습니다.',
      printFailed: '인식표 발행 기록은 남았지만 물리 인쇄에 실패했습니다.',
      reportFailed:
        '인식표는 인쇄됐지만 결과를 보고하지 못했습니다. 다시 인쇄하지 말고 보고만 다시 보내세요.',
      loadFailed: '인식표 개체를 확인할 수 없어 생산 라벨 출력을 열지 않습니다.',
      targetUnknown: '인식표 대상 여부를 확인할 수 없어 출력을 열지 않습니다.',
      printerUnavailable: '인식표를 지원하는 프린터가 없습니다.',
    },
    output: {
      title: 'LOT 라벨',
      template: '생산 LOT 라벨',
      printer: '프린터',
      printerUnknown: '확인할 수 없음',
      issue: '생산 라벨 출력',
      retryIssue: '라벨 발행 다시 시도',
      retryPrint: '발행된 라벨 다시 인쇄',
      retryReport: '결과 다시 전송',
      queued: '생산 실적을 미전송 큐에 저장했습니다. 서버 적용 뒤 라벨 발행을 이어갑니다.',
      saving: '생산 실적을 서버에 적용하는 중입니다.',
      issuing: '생산 실적 저장 완료 · 라벨 발행 중',
      printing: '생산 실적 저장 완료 · 라벨 인쇄 중',
      printed: '생산 LOT 라벨 인쇄 완료 · 부착한 라벨을 스캔하세요.',
      issueFailed: '생산 실적은 저장됐지만 라벨 발행에 실패했습니다.',
      renditionFailed: '라벨 발행은 완료됐지만 인쇄 데이터를 받지 못했습니다.',
      printFailed: '라벨 발행은 완료되었지만, 인쇄되지 않았습니다.',
      reportFailed: '라벨 인쇄는 완료되었습니다. 결과를 다시 전송해 주세요.',
      legacyMismatch: '생산 실적 없이 생성된 이전 라벨 이력이 있습니다. LOT 마감을 열지 않습니다.',
      mismatchBlocked: '실적·라벨 상태 확인 필요',
      shellUnavailable: 'Electron POP 셸의 인쇄 통로를 확인할 수 없습니다.',
      printerUnavailable: '사용 가능한 라벨 프린터가 없습니다.',
    },
    scan: {
      title: '스캔 대기',
      label: '부착한 LOT 번호 스캔',
      /*
       * ⚠ **한 줄로 합친 문구다**(사용자 지시 2026-09-10). 스캔이 어긋났을 때 「지금 무엇이
       * 잘못됐나」와 「그래서 무엇을 하나」가 두 줄로 갈려 있었다.
       */
      mismatch:
        '입력한 LOT과 일치하는 라벨을 찾을 수 없습니다. LOT을 다시 확인한 후, 동일한 라벨을 다시 스캔해주세요.',
      completing: 'LOT 생산 등록을 마감하고 있습니다.',
      completed: 'LOT 마감 완료 · 다음 LOT으로 전환합니다.',
      failed: 'LOT을 마감하지 못했습니다. 같은 라벨을 다시 스캔하세요.',
      alreadyCompleted: '이미 마감된 LOT입니다. 현재 LOT 상태를 다시 불러옵니다.',
    },
    gate: {
      input: '이 단말은 생산 실적 입력을 사용할 수 없습니다.',
      print: '이 단말은 라벨 출력을 사용할 수 없습니다.',
      complete: '이 단말은 LOT 마감을 사용할 수 없습니다.',
      unknown: '단말 기능 구성을 확인할 수 없습니다.',
    },
    retry: '다시 시도',
    close: '닫기',
  },

  entry: {
    workOrderLabel: '작업지시',
    itemLabel: '품목',
    workerLabel: '사번',
    missingWorkOrder: '작업지시를 받지 못해 실적을 등록할 수 없습니다.',
    missingWorker: '사번이 확인되지 않아 저장할 수 없습니다. 사번 인증을 먼저 하세요.',
    loadFailed: '작업지시를 불러오지 못했습니다.',
  },

  /** 단말 기능 구성 판정. 「확인할 수 없다」와 「권한이 없다」를 다르게 말한다. */
  gate: {
    checking: '실적 입력 권한을 확인하는 중입니다.',
    denied: '이 단말은 이 공정의 실적 입력 권한이 없습니다. 담당자에게 문의하세요.',
    unavailable: '실적 입력 권한을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    unidentified: '단말이 확인되지 않아 실적을 등록할 수 없습니다.',
    retry: '다시 시도',
  },

  /** 연결 상태와 미동기 건수 — 상시 표시가 필수 요건이다(공유계약 C-1). */
  sync: {
    pending: (count: number) => `미전송 ${String(count)}건`,
  },

  /** 검사 선행(R54). 대상인데 아직 안 했으면 실적을 먼저 넣지 않는다. */
  pqc: {
    blockedTitle: 'PQC 검사가 남아 있습니다',
    blockedBody: '이 작업지시의 제품 검사를 먼저 마쳐야 실적을 등록할 수 있습니다.',
    goInspect: '검사 화면으로',
    loadFailed: '검사 의뢰를 확인할 수 없어 실적 입력을 열지 않습니다.',
  },

  lot: {
    sectionLabel: '대상 LOT',
    lotLabel: '대상 LOT',
    itemLabel: '제품',
    change: '변경',
    select: '선택',
    empty: '이 작업지시에 대상 LOT 이 없습니다.',
    loadFailed: '대상 LOT 을 불러오지 못했습니다.',
  },

  quantity: {
    sectionLabel: '실적 입력',
    goodQtyLabel: '양품수량',
    remarksLabel: '비고',
    keypadLabel: '수량 키패드',
    /* 읽는 기계에는 이름이 가고 눈에는 기호가 보인다 — 인식표 키패드도 같은 규칙이다. */
    backspace: '한 자 지움',
    clearGlyph: '지움',
    quickAdd: (step: number) => `＋${String(step)}`,
    /**
     * 잔여수량 — 스펙 §3-2 의 「잔여수량 380 / 500」.
     *
     * ⛔ **뒤 숫자에 「지시」라고 적지 않는다.** 스펙에 그 낱말이 없다. 설계는 낱말 대신
     * **무게로 가른다** — 검증본이 앞 숫자를 진하게(`.val`), 뒤 숫자와 단위를 한 급 흐리고
     * 작게(`.unit`) 그린다. 낱말을 덧대면 라벨(「잔여수량」)까지 셋이 겹쳐 읽힌다
     * (「잔여수량 150 / 지시 120」 — 사용자 지적 2회).
     *
     * ⚠ 앞선 「숫자 둘을 빗금으로만 잇지 않는다」는 지적은 **둘이 같은 굵기·같은 크기였을 때**의
     * 것이다. 무게가 갈리면 어느 쪽이 주인공인지 낱말 없이 보인다.
     */
    remaining: '잔여수량',
    /** 뒤 숫자는 지시 수량이다 — 딸린 정보라 화면이 한 급 낮춰 그린다. */
    orderedSuffix: (ordered: string, uom: string | null) =>
      uom === null ? `/ ${ordered}` : `/ ${ordered} ${uom}`,
    remainingUnknown: '잔여수량을 확인할 수 없습니다.',
  },

  /** 초과 생산은 허용이다 — 막지 않고 한 번 확인한다(✓확정 QA #27). */
  overrun: {
    title: '잔여수량을 넘습니다',
    body: (qty: string, remaining: string) =>
      `입력한 ${qty}이(가) 잔여 ${remaining}을(를) 넘습니다. 초과 생산으로 저장할까요?`,
    confirm: '초과로 저장',
    /*
     * ⚠ **액션바의 「다시 입력」과 이름을 겹치지 않는다.** 겹치면 화면에 같은 이름의 버튼이
     *    둘 서서 읽어 주는 도구도 사람도 갈라 보지 못한다(실측 — 시험이 둘을 함께 집었다).
     *    여기서 하는 일은 «수량 하나»를 고치러 돌아가는 것이라 그렇게 적는다.
     */
    cancel: '수량 고치기',
  },

  actions: {
    save: '저장',
    /*
     * ⚠ **「취소」가 아니라 「다시 입력」이다**(사용자 결정 2026-09-07). 스펙 §3·§5-2 는 이 자리를
     *    「취소」로 적었지만, 같은 일을 하는 자리를 다른 POP 화면 셋이 「다시 입력」으로 부른다
     *    (`P-04-03`·`P-05-01`·`P-05-02` — 그쪽 스펙이 그렇게 적었다). 낱말이 화면마다 갈리면
     *    같은 단말을 쓰는 작업자가 둘을 다른 조작으로 읽는다. **요청서로 알렸다.**
     *
     * ⛔ 이 조작은 **화면 안의 입력을 비우는 것**이지 저장된 것을 무르는 것이 아니다 —
     *    「취소」는 후자로 읽힐 여지가 있어 바꾼 쪽이 뜻에도 가깝다.
     */
    cancel: '다시 입력',
  },

  save: {
    successTitle: '실적을 저장했습니다',
    /** 오프라인이어도 즉시 성공이다 — 큐에 담긴 사실을 함께 말한다(C-1 #2·#4). */
    queuedBody: '연결되면 자동으로 보냅니다.',
    failTitle: '실적을 저장하지 못했습니다',
    /** 저장 후 분기 — 잔여가 남으면 이어서, 0 이면 LOT 완료로. */
    continueBody: '잔여수량이 남아 있습니다. 이어서 입력하세요.',
    lotDoneTitle: '이 LOT 의 잔여수량이 없습니다',
    lotDoneBody: '생산LOT 완료 처리로 넘어가세요.',
  },
} as const;
