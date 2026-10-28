/**
 * P-02-04 작업실적 등록(LOT·제품 선택).
 *
 * 이 화면의 말은 「실적」이고 받는 수량은 양품과 불량 유형별 수량이다(불량은 기록만 — 재고를 움직이지 않는다).
 */
export const productionResult = {
  /* 화면 이름은 「생산 작업」이다(사용자 지시 2026-10-19 · omf-all-around#107). 실적은 그 안의 한 구획이다. */
  title: '생산 작업',

  flow: {
    /**
     * 왼쪽 「현재 LOT」 구획(C-21). 제목 줄은 품목 이름, 정보 영역은 「라벨 값」 쌍, 수량은 「실적 / 기준」과
     * 막대 하나로 보인다. 음수를 보이지 않는다(초과는 칩).
     */
    work: {
      lot: 'LOT',
      lotProgress: 'LOT 실적',
      workOrderProgress: 'W/O 실적',
      /** 「실적 / 기준」(C-21). 단위가 없으면 숫자만. */
      progressText: (good: string, target: string, uom: string): string =>
        uom === '' ? `${good} / ${target}` : `${good} / ${target} ${uom}`,
      pqc: 'PQC',
      /** 검사 off: 의뢰 없음(사용자 지시 2026-10-19), 생략 허용 기준으로 생략(omf-all-around#119). */
      pqcNotInspected: '미검사',
      pqcSkipped: '생략',
      printerNone: '없음',
      /** 단계 표시(C-5). LOT마다 처음부터 반복한다. */
      stepsLabel: 'LOT 작업 단계',
      steps: { input: '실적 입력', scan: '라벨 스캔' },
      /** 잔량은 지금 넣을 칸 곁에만 둔다(C-21). */
      remaining: (qty: string): string => `잔량 ${qty}`,
      noLot: '생산할 LOT이 없습니다.',
      noWorkOrder: '작업지시가 지정되지 않았습니다.',
    },
    /**
     * 하단 바 「남은 일」(C-5). 머리말 없이 문장만, 끝 마침표 없이 쓴다. 앞의 것이 먼저다.
     */
    next: {
      noWorkOrder: '작업지시가 지정되지 않았습니다. 작업 지시 목록에서 작업지시를 고르세요',
      noWorker: '사번을 입력하세요',
      noLot:
        '이 W/O에 생산할 LOT이 없습니다. 생산을 마쳤으면 작업지시를 마감하고, 더 만들어야 하면 관리자에게 알리세요',
      queued: '실적을 단말에 저장했습니다. 연결되면 보내고 LOT 라벨을 발행합니다',
      saving: '실적을 저장하고 있습니다',
      issuing: 'LOT 라벨을 발행하고 있습니다',
      printing: 'LOT 라벨을 인쇄하고 있습니다',
      scan: '부착한 LOT 라벨을 스캔하세요',
      /** 〈다시 시도 버튼 이름〉+을/를. 조사는 화면이 붙인다(`patterns/josa`). */
      retry: (buttonWithObject: string): string => `${buttonWithObject} 누르세요`,
      legacyMismatch:
        '실적 없이 만든 이전 라벨 이력이 있어 LOT을 마감할 수 없습니다. 관리자에게 알리세요',
      completing: 'LOT을 마감하고 있습니다',
      completed: '다음 LOT을 불러오고 있습니다',
      printer: '사용할 수 있는 LOT 라벨 프린터가 없습니다. 관리자에게 프린터 연결을 요청하세요',
      shell: 'POP 프로그램의 인쇄 통로를 확인할 수 없습니다. 관리자에게 알리세요',
      tagUnknown: '인식표 대상인지 확인할 수 없습니다. 연결을 확인한 뒤 화면을 다시 여세요',
      tag: '인식표를 모두 출력해야 생산 라벨을 출력할 수 있습니다. 관리자에게 알리세요',
      qty: '양품 수량을 입력하세요',
      defectOnly: '불량만 등록하려면 불량 등록을 누르세요',
      defectType: '불량 유형을 고르세요',
      defectQty: '불량 수량을 입력하세요',
      defectDuplicate: '같은 불량 유형이 두 줄에 있습니다. 한 줄을 삭제하세요',
      ready: '라벨 스캔으로 진행할 수 있습니다',
    },
    currentLot: {
      current: '현재 LOT',
      completed: '마감된 LOT',
      completedTitle: '마감된 LOT',
      completedEmpty: '마감된 LOT이 없습니다.',
      pageNav: '마감된 LOT 페이지 이동',
      pageUp: '페이지 위',
      pageDown: '페이지 아래',
      pagePosition: (page: number, totalPages: number) =>
        `${String(totalPages)}쪽 중 ${String(page)}쪽`,
      /** 서버가 현재 LOT 을 한 건으로 정하지 못했다(옛 서버) — 엉뚱한 LOT 에 실적이 붙지 않게 막는다. */
      unreliable: (lotNos: string): string =>
        `서버가 현재 LOT을 하나로 정하지 못했습니다(LOT ${lotNos}). 다른 LOT에 실적이 붙지 않도록 입력을 막았습니다. 관리자에게 서버가 최신 판인지 확인을 요청하세요.`,
      loadFailed: '현재 LOT을 불러오지 못했습니다. 연결을 확인하고 「다시 시도」를 누르세요.',
    },
    quantity: {
      actual: '양품 수량',
      invalid: '0보다 큰 수량을 입력하세요.',
    },
    defects: {
      title: '불량',
      add: '불량 추가',
      row: (index: number): string => `불량 ${String(index)}`,
      type: '불량 유형',
      choose: '유형 선택',
      qty: '불량 수량',
      remove: (label: string): string => `${label} 삭제`,
      duplicate: '이미 있는 불량 유형입니다.',
      typeMissing: '유형을 고르세요',
      qtyMissing: '수량을 입력하세요',
      noProcess: '공정이 없는 W/O라 불량 유형을 고를 수 없습니다.',
      /* 키패드 이름 — 지금 어느 칸에 치는지 말한다. 칸 이름과 겹치지 않게 「키패드」를 붙인다. */
      keypadGood: '양품 수량 키패드',
      keypadFor: (target: string): string => `${target} 불량 수량 키패드`,
      pickerTitle: '불량 유형',
      /** 대분류를 고른 뒤의 창 제목(가운뎃점으로 잇지 않는다, C-13). */
      pickerTitleFor: (major: string): string => `${major} 불량 유형`,
      back: '← 대분류',
      cancel: '취소',
      loading: '불량 유형을 불러오는 중입니다.',
      loadFailed: '불량 유형을 불러오지 못했습니다.',
      empty: '이 공정에 정해진 불량 유형이 없습니다.',
      saveOnly: '불량 등록',
      saved: '불량을 등록했습니다.',
      queued: '불량을 단말에 저장했습니다. 연결되면 보냅니다.',
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
      template: '생산 LOT 라벨',
      printer: '프린터',
      issue: '생산 라벨 출력',
      retryIssue: '라벨 발행 다시 시도',
      retryPrint: '라벨 다시 인쇄',
      retryReport: '결과 다시 전송',
      /** 라벨 스캔 단계의 결과 한 줄(C-21). 할 일은 하단 바가 말한다. */
      printed: 'LOT 라벨을 인쇄했습니다.',
      issueFailed: '실적은 저장했지만 LOT 라벨을 발행하지 못했습니다.',
      renditionFailed: 'LOT 라벨을 발행했지만 인쇄 데이터를 받지 못했습니다.',
      printFailed: 'LOT 라벨을 발행했지만 인쇄하지 못했습니다.',
      reportFailed:
        'LOT 라벨을 인쇄했지만 결과를 보내지 못했습니다. 다시 인쇄하지 말고 결과만 다시 보내세요.',
      legacyMismatch: '실적 없이 만든 이전 라벨 이력이 있습니다.',
      shellUnavailable: 'POP 프로그램의 인쇄 통로를 확인할 수 없습니다.',
    },
    scan: {
      title: '라벨 스캔',
      label: '스캔',
      placeholder: '부착한 LOT 라벨',
      /*
       * ⚠ **한 줄로 합친 문구다**(사용자 지시 2026-09-10). 스캔이 어긋났을 때 「지금 무엇이
       * 잘못됐나」와 「그래서 무엇을 하나」가 두 줄로 갈려 있었다.
       */
      mismatch:
        '입력한 LOT과 일치하는 라벨을 찾을 수 없습니다. LOT을 다시 확인한 후, 동일한 라벨을 다시 스캔해주세요.',
      completed: 'LOT을 마감했습니다.',
      failed: 'LOT을 마감하지 못했습니다. 같은 라벨을 다시 스캔하세요.',
      alreadyCompleted: '이미 마감된 LOT입니다. 현재 LOT 상태를 다시 불러옵니다.',
      noAllocation: '이 LOT에 저장된 실적이 없어 마감할 수 없습니다. 실적을 먼저 저장하세요.',
      /* 마감된 작업지시는 다시 열 수 없다(서버에 재오픈이 없다) — 해제를 요청하라고 하면 갈 곳이 없다. */
      workOrderClosed: (menuPath: string, correction: string): string =>
        `이 작업지시는 이미 마감돼 LOT 을 미달로 마감할 수 없습니다. 마감된 작업지시는 다시 열 수 없으니, 수량을 고쳐야 하면 관리자에게 관리웹 ${menuPath}의 「${correction}」을 요청하세요.`,
    },
    /** 작업지시 마감 — 관리웹 W/O 마감과 같은 판정·입력을 현장에서 한다. 온라인에서만 된다. */
    woClose: {
      button: '작업지시 마감',
      title: (workOrderNo: string): string => `작업지시 마감 ${workOrderNo}`,
      loading: '마감할 작업지시를 확인하는 중입니다.',
      loadFailed: '작업지시를 불러오지 못했습니다. 연결을 확인하고 「다시 시도」를 누르세요.',
      fields: {
        orderQty: '지시 수량',
        goodQty: '양품 누계',
        judgment: '판정',
        shortfallQty: '미달 수량',
        overageQty: '초과 수량',
        remainder: '잔량 처리',
        reason: '사유',
        remarks: '소멸 사유(비고, 선택)',
      },
      judgments: { UNDER: '미달', NORMAL: '정상', OVER: '초과' },
      remainder: { CARRY_OVER: '이월', WRITE_OFF: '소멸' },
      carryOverNote: (menuPath: string): string =>
        `이월 W/O는 자동으로 만들어지지 않습니다. 관리웹 ${menuPath}에서 새로 편성합니다.`,
      prefilled: 'LOT 마감 때 고른 사유입니다. 바꿀 수 있습니다.',
      reasonsLoading: '사유를 불러오는 중입니다.',
      reasonsFailed: '사유를 불러오지 못했습니다. 연결을 확인하고 창을 다시 여세요.',
      reasonsEmpty: '고를 수 있는 사유가 없습니다. 관리자에게 사유 등록을 요청하세요.',
      voidedSlots: (count: number): string =>
        `실적이 없는 LOT ${String(count)}건은 마감과 함께 폐번됩니다.`,
      openLots: (count: number, lotNos: string): string =>
        `마감되지 않은 LOT ${String(count)}건(${lotNos})은 그 상태로 남습니다.`,
      irreversible: '마감하면 되돌릴 수 없습니다. ERP 실적 송신은 마감과 함께 대기열에 올라갑니다.',
      needRemainder: '미달이라 잔량 처리(이월 또는 소멸)를 골라야 마감할 수 있습니다.',
      needReason: '미달이나 초과라 사유를 골라야 마감할 수 있습니다.',
      judgmentMissing:
        '판정을 불러오지 못해 마감할 수 없습니다. 연결을 확인하고 「다시 시도」를 누르세요.',
      openLotsChecking: '진행 중인 LOT 을 확인하는 중입니다. 확인이 끝나면 마감할 수 있습니다.',
      openLotsUnknown:
        '진행 중인 LOT 을 확인하지 못했습니다. 마감해도 진행 중인 LOT 은 그 상태로 남습니다.',
      uncheckedLots: (count: number): string =>
        `확인하지 못한 미완료 LOT ${String(count)}건이 더 있습니다. 마감해도 그 LOT 은 그 상태로 남습니다.`,
      sessions: {
        checking: '이 작업지시의 작업 세션을 확인하는 중입니다.',
        loadFailed: '작업 세션을 확인하지 못했습니다. 연결을 확인하고 「다시 시도」를 누르세요.',
        blocked:
          '아래 작업 세션이 열려 있어 마감할 수 없습니다. 끝낼 곳에서 세션을 끝낸 뒤 다시 누르세요.',
        listLabel: '열린 작업 세션',
        terminal: '단말',
        worker: '작업자',
        state: '상태',
        where: '끝낼 곳',
        RUNNING: '진행',
        STOPPED: '중단',
        unknown: '확인할 수 없음',
        workerValue: (name: string, workerNo: string): string => `${name}(${workerNo})`,
        here: (holdScreen: string): string => `이 단말의 「${holdScreen}」 화면`,
        other: (webMenu: string): string => `그 단말, 또는 관리웹 ${webMenu}의 강제 종료`,
      },
      endForbidden:
        '이 단말의 작업 세션을 끝낼 권한이 없어 마감하지 않았습니다. 관리자에게 관리웹에서 세션을 강제 종료해 달라고 요청하세요.',
      endNotFound:
        '이 단말의 작업 세션을 찾지 못해 마감하지 않았습니다. 이미 끝났을 수 있으니 창을 닫고 다시 여세요.',
      endedButNotClosed:
        '이 단말의 작업 세션은 끝났지만 작업지시는 마감되지 않았습니다. 아래 까닭을 확인한 뒤 다시 누르세요.',
      cancel: '취소',
      confirm: '마감',
      done: (workOrderNo: string): string =>
        `${workOrderNo}를 마감했습니다. 작업 지시 목록으로 돌아갑니다.`,
      blocked: {
        denied: (webMenu: string, terminalMenu: string): string =>
          `이 단말은 작업지시 마감이 허용되지 않았습니다. 관리웹 ${webMenu}에서 마감하거나, 관리자에게 ${terminalMenu}에서 「작업지시 마감」을 켜 달라고 요청하세요.`,
        checking: '이 단말의 마감 권한을 확인하는 중입니다.',
        unavailable:
          '이 단말의 마감 권한을 확인하지 못했습니다. 연결을 확인하고 화면을 다시 여세요.',
        offline: '연결이 끊겨 마감할 수 없습니다. 연결을 확인한 뒤 다시 누르세요.',
        pending: (count: number): string =>
          `아직 보내지 못한 실적 ${String(count)}건이 있습니다. 실적이 모두 보내진 뒤 마감하세요.`,
        status:
          '이 작업지시는 아직 작업이 시작되지 않아 마감할 수 없습니다. 작업을 시작한 작업지시만 마감할 수 있습니다.',
        unidentified:
          '이 단말이나 공정을 확인하지 못해 마감할 수 없습니다. 관리자에게 단말 등록과 공정 매핑을 확인해 달라고 요청하세요.',
        cancelled: '취소된 작업지시는 마감할 수 없습니다.',
      },
      endFailed:
        '이 단말의 작업 세션을 끝내지 못해 마감하지 않았습니다. 연결을 확인하고 다시 누르세요.',
    },
    /** 목표에 못 미친 LOT 을 마감할 때 — 서버가 사유를 필수로 받는다. */
    underReason: {
      title: '미달 사유',
      summary: (target: string, actual: string): string => `LOT 수량 ${target}, 실적 ${actual}`,
      cancel: '취소',
      loading: '미달 사유를 불러오는 중입니다.',
      loadFailed: '미달 사유를 불러오지 못했습니다.',
      empty: '고를 수 있는 미달 사유가 없습니다.',
    },
    /**
     * 작업 세션 자동 종료 — 마지막 LOT 을 마감해 더 생산할 것이 남지 않았을 때 닫는다.
     *
     * ⛔ **잘 닫힌 것을 알리는 문구는 두지 않는다**(사용자 지시 2026-09-16). 그 자리에는 이미
     *    `currentLot.none` 이 서 있고, 성공 안내를 얹으면 같은 사건이 두 줄로 겹친다. 여기 남는
     *    것은 **어긋났을 때 할 일을 말하는 문구**뿐이다.
     *
     * ⛔ **서버 오류 원문을 그대로 쓰지 않는다.** 작업자에게는 「다음에 무엇을 하면 되는가」만
     *    말한다 — 실패했을 때 손으로 닫을 자리가 작업 중단 화면이라는 것이 그 「다음」이다.
     */
    session: {
      /** 다시 시도해서 풀릴 수 있는 실패 — 무엇을 하면 되는지까지 적는다. */
      failed: '작업 세션을 종료하지 못했습니다. 다시 시도하세요.',
      /**
       * ⛔ **다시 눌러도 풀리지 않는 실패.** 재시도는 같은 요청을 그대로 다시 보내므로 서버가
       * 상태·권한·대상 때문에 거절한 것이면 답이 같다 — 재시도 대신 «갈 곳»을 말한다.
       */
      unrecoverable: '작업 세션을 종료할 수 없습니다. [작업 중단] 화면에서 세션 상태를 확인하세요.',
      retry: '세션 종료 재시도',
      /**
       * 권한이 «거부»된 경우에만 쓴다. ⛔ 조회 중·조회 실패·단말 미식별에 이 문구를 쓰지
       * 않는다 — 그것은 «모른다»이지 «없다»가 아니라, 권한 있는 단말에 「권한 없음」이 뜬다.
       */
      denied: '이 단말은 이 공정의 작업 완료 권한이 없습니다. 작업 세션은 열린 채로 둡니다.',
      offline: '연결이 끊겨 작업 세션을 종료하지 못했습니다. 연결된 뒤 다시 시도하세요.',
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
    /**
     * 작업지시 없이 들어왔을 때 — **다음 행동까지 말한다**(#1151).
     *
     * ⚠ 공통 [화면 이동](G-34)은 작업지시를 싣지 않는다 — 설계가 정한 것은 「고르면 그 화면으로
     *   이동」까지다. 그 길로 들어오면 모든 값이 비는데, 이유와 할 일을 말하지 않으면 고장처럼
     *   보인다. 문장은 포장 화면들(`packing-work`·`work-hold-register`)과 같은 꼴로 맞춘다.
     */
    missingWorkOrder:
      '작업지시를 받지 못해 실적을 등록할 수 없습니다. 작업 지시 목록에서 작업지시를 고른 뒤 들어오세요.',
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

  /**
   * PQC(omf-all-around#107). 검사 on 이면 실적과 PQC 를 늘 반씩 띄운다 — 업무 순서는 «실적 입력 → PQC» 다
   * (사용자 결정 2026-10-19 · 앞선 「PQC 를 먼저 마쳐야 실적 등록」(R54)을 뒤집었다).
   */
  pqc: {
    goInspect: '검사 화면으로',
    splitTitle: 'PQC 제품 검사',
    splitNote: '검사 수량, 판정, 결과 확정',
    /** 검사 on/off 를 묻는 조회가 실패했다(리뷰 m6) — 조용히 실적만 보이지 않게 알린다. */
    loadFailed: 'PQC 정보를 불러오지 못했습니다. 다시 시도하세요.',
  },

  /** 「생산 작업」 화면의 왼쪽(검사 off 면 전체) 구획 머리. */
  zone: {
    title: '생산 실적',
    note: '실적 입력, 라벨 스캔',
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
    /* 지우기 문구는 「전체 지움」으로 통일한다(C-12). */
    clearGlyph: '전체 지움',
    decimalKey: '소수점',
    quickAdd: (step: number) => `＋${String(step)}`,
  },

  /**
   * 초과 생산은 허용이다 — **막지도, 되묻지도 않고 «말한다»**(✓확정 QA #27 · 사용자 결정
   * 2026-09-11).
   *
   * ⭐ 설계가 정한 것은 「초과 달성으로 **표시**하고 허용한다」까지다(`P-02-06` §5-4). 낱말을
   * 그 문서에서 그대로 가져온다.
   *
   * ⛔ **확인 팝업을 세우지 않는다.** 되묻는 형태의 근거로 `P-02-04` §6 이 적혀 있었으나,
   * 고정본의 그 절은 API 매핑이고 초과 조항이 없다 — 없는 근거였다. 되묻는 손짓은 정상
   * 작업마다 한 번씩 늘어나는데, 초과가 허용인 이상 그 손짓이 막아 주는 것도 없다.
   *
   * ⛔ **「지시」라고 적지 않는다** — 뒤 숫자에 그 낱말을 덧대 읽기 어려워진 지적이 두 번
   * 있었다(아래 `quantity.remaining` 머리말). 이 화면이 재는 축은 잔여다.
   */
  overrun: {
    notice: (over: string, remaining: string) =>
      `잔량 ${remaining}보다 ${over} 많습니다. 초과 생산도 등록할 수 있습니다.`,
    /** 잔량이 0인 지시. 「잔량 0보다 …」는 뺄셈처럼 읽힌다. 숫자를 빼고 사실만 적는다. */
    noticeNoRemaining: '이 작업지시에 잔량이 없습니다. 초과 생산도 등록할 수 있습니다.',
    /** 양품 누계가 지시 수량에 이르렀다. 서버의 완료 판정(정상, 초과)이 근거다. 칩 이름이다(C-21). */
    achieved: '계획 수량 달성',
    /** 음수 대신 넘은 양을 칩으로 보인다(C-21). */
    achievedOver: (over: string): string => `초과 달성 ${over}`,
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
