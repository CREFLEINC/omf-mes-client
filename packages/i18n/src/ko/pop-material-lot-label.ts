export const popMaterialLotLabel = {
  /**
   * 화면 이름 — 가운뎃점으로 두 일을 잇지 않는다(규범 C-13 · 개편안 승인 2026-10-24 · omf-all-around#184).
   * ⚠ 화면 목록(`patterns/pop-screen-catalog.ts`)의 이름과 같아야 한다 — 고치면 함께 고친다.
   */
  title: '자재 LOT 라벨 발행',
  /**
   * 왼쪽 위 두 보기. 발행 대기는 아직 라벨이 없는 입하 줄, 다시 인쇄는 이미 발행한 줄이다.
   * ⭐ 「발행 완료」 대신 할 일을 이름으로 쓴다 — 그 보기에서 하는 일이 다시 인쇄뿐이다.
   */
  tabs: {
    label: '보기',
    pending: '발행 대기',
    reprint: '다시 인쇄',
  },
  /**
   * 찾기 칸 — 스캐너 입력도 받는다. 칸 이름은 하나로 두고 대상은 안내 문구에 적는다(규범 C-13).
   */
  search: {
    label: '찾기',
    pendingPlaceholder: '품목코드 또는 입하번호',
    reprintPlaceholder: 'LOT 번호 또는 품목코드',
    clear: '지우기',
  },
  /** 왼쪽 공급사 목록. 큰 숫자는 남은 장수다(LOT 하나에 한 장 — 사용자 결정 2026-10-24). */
  suppliers: {
    label: '공급사',
    unit: '장',
    /** 대기 줄이 한 건의 입하에서만 왔으면 그 시각, 여러 건이면 가장 이른 시각부터. */
    at: (when: string) => `${when} 입하`,
    since: (when: string) => `${when} 입하부터`,
    /** 다시 인쇄 보기 — 그 공급사에서 가장 최근 입하. */
    latest: (when: string) => `최근 입하 ${when}`,
    pendingEmpty: '발행할 자재가 없습니다.',
    reprintEmpty: '최근 2주 안에 발행한 라벨이 없습니다.',
  },
  /**
   * 발행 대기의 입하 기간(사용자 지시 2026-10-27) — 기본은 이번 주, 주는 월요일부터다.
   * ⭐ 기간보다 먼저 입하됐는데 아직 남은 줄은 띠로 알린다 — 그냥 지나가지 않게. 「보기」로 그 줄만 모아 본다.
   */
  period: {
    label: '입하 기간',
    today: '오늘',
    week: '이번 주',
    month: '이번 달',
    all: '전체',
    pastTitle: (count: number) => `지난 입하 미발행 ${count}장`,
    pastRange: (from: string, to: string) =>
      from === to ? `${from} 입하` : `${from} ~ ${to} 입하`,
    showPast: '보기',
    /** 지난 줄을 보는 중 — 고른 기간으로 돌아가는 단추. */
    backTo: (period: string) => `${period} 보기`,
    empty: (period: string) => `${period} 입하분 중 발행할 자재가 없습니다.`,
  },
  table: {
    columns: {
      check: '선택',
      itemCode: '품목코드',
      itemName: '품목명',
      qty: '수량',
      receivedAt: '입하',
      result: '결과',
      lotNo: 'LOT 번호',
      issued: '발행',
      /** 마지막 열 — 수입검사 대상인가(사용자 지시 2026-10-26). */
      iqc: 'IQC',
    },
    selectAll: '전체 선택',
    /**
     * 상세 목록 머리의 품목코드 칸 — **고른 공급사의 줄 안에서만** 거른다(사용자 지시 2026-10-27).
     * 왼쪽 찾기 칸(모든 공급사 · 품목코드 또는 입하번호)과 따로 둔다. 한 공급사에 줄이 수백 개일 수 있다.
     */
    itemFilter: {
      label: '목록에서 품목코드 찾기',
      placeholder: '품목코드',
      clear: '품목코드 지우기',
    },
    /** IQC 열의 값 — 검사 대상 줄에만 적는다. 그 줄은 IQC 라벨이 한 장 더 나간다(omf-all-around#110). */
    iqcRequired: '필수',
    /** 줄 전체가 체크 칸이다 — 읽어 주는 도구가 줄을 가를 수 있게 품목·수량·입하 시각을 이름에 싣는다. */
    rowName: (itemCode: string, itemName: string, qty: string, receivedAt: string) =>
      `${itemCode} ${itemName} ${qty} ${receivedAt} 입하`,
    range: (from: number, to: number, total: number) => `${from}–${to} / ${total}줄`,
    pageNav: '쪽 이동',
    prev: '◀ 이전',
    next: '다음 ▶',
    /**
     * 20초마다 스스로 다시 받지만, 기다리지 않고 바로 볼 수단으로 남긴다(omf-all-around#29).
     * 왼쪽 기간 아래에 둔다 — 표 아래 구석에서는 보이지 않았다(사용자 지시 2026-10-27).
     */
    refresh: '새로 고침',
    /** 새로 고침 옆 — 서버에서 마지막으로 받은 시각(초까지). 눌렀는데 받았는지 알 수 있게 한다. */
    refreshedAt: (time: string) => `${time} 받음`,
    loadFailed: '입하 목록을 불러오지 못했습니다.',
    retry: '다시 불러오기',
    noMatch: '찾는 품목이 없습니다.',
    pickSupplier: '왼쪽에서 공급사를 고르세요.',
    /** 다시 인쇄 표의 「발행」 칸 — 마지막 회차와 시각. */
    issuedAt: (seq: number, when: string) => `${seq}회 ${when}`,
    lotLoading: 'LOT 번호 확인 중',
    /** 결과 표 머리 오른쪽 — 몇 장이 나왔고 몇 장이 안 나왔는가. */
    resultSummary: (printed: number, unfinished: number) =>
      unfinished === 0 ? `${printed}장 인쇄` : `${printed}장 인쇄, ${unfinished}장 남음`,
  },
  /** 줄마다 제자리에 붙는 결과. 길게 쓰지 않는다 — 다음 할 일은 아래 동작 바가 말한다. */
  status: {
    printed: '인쇄됨',
    running: '보내는 중',
    waiting: '대기',
    notSelected: '선택 안 함',
    stopped: '멈춤',
    /** 보내기 직전에 다시 보니 다른 단말이 먼저 찍었다 — 실패가 아니다. */
    alreadyIssued: '이미 발행됨',
    /** 종이는 나왔고 IQC 라벨만 안 나왔다 — 「실패」로 읽히면 자재 라벨을 한 장 더 찍는다. */
    iqcMissing: '인쇄됨, IQC 라벨 안 나옴',
    failed: {
      printFailed: '인쇄 안 됨',
      reportFailedAfterPrint: '인쇄됨, 기록 안 됨',
      issueForbidden: '이 단말은 발행 불가',
      registerConflict: '등록 지연',
      iqcPlanMissing: 'IQC 검사기준 없음',
      labelStateLocked: '발행할 수 없는 LOT',
      other: '발행 안 됨',
    },
  },
  /** 하단 동작 바 — 왼쪽은 지금 상태 한 줄, 오른쪽은 주 동작. */
  bar: {
    empty: '발행할 품목을 고르세요',
    selected: (count: number) => `${count}장 선택`,
    clear: '선택 해제',
    issue: (count: number) => `라벨 ${count}장 발행`,
    issueIdle: '라벨 발행',
    running: (supplier: string) => `${supplier} 발행 중`,
    progress: (done: number, total: number) => `${total}장 중 ${done}장`,
    stop: '멈춤',
    stopping: '이번 장까지 찍고 멈춥니다',
    done: (count: number) => `${count}장 인쇄했습니다`,
    confirm: '확인',
    failed: (count: number) => `${count}장이 나오지 않았습니다`,
    stopped: (count: number) => `${count}장이 남았습니다`,
    retry: (count: number) => `${count}장 다시 발행`,
    /**
     * 발행 단위 — N장마다 멈추고 이어서(사용자 지시 2026-10-27). 「전체」는 멈추지 않는다.
     * 작업자가 N장을 붙이고 다음 N장을 찍는다 — 라벨이 프린터 앞에 쌓여 섞이지 않게.
     */
    unit: {
      label: '발행 단위',
      all: '전체',
      each: (count: number) => `${count}장`,
      /** 고른 장수가 단위보다 많을 때 왼쪽 상태 줄에 덧붙인다. */
      note: (count: number) => `${count}장마다 멈춤`,
    },
    /** 한 단위를 다 찍고 쉬는 중. */
    paused: (done: number, total: number) => `${total}장 중 ${done}장 발행`,
    pausedNote: (remaining: number) => `라벨을 붙인 뒤 이어서 발행하세요 · 남은 ${remaining}장`,
    resume: (count: number) => `다음 ${count}장 발행`,
    /** 실패한 까닭마다 할 일. 다시 눌러도 같은 답이 오는 것은 다시 하라고 하지 않는다. */
    next: {
      printFailed: '프린터 연결과 용지를 확인하세요',
      reportFailedAfterPrint: '라벨은 나왔습니다. 다시 찍지 마세요',
      issueForbidden: '라벨 프린터가 있는 단말에서 발행하세요',
      registerConflict: '잠시 뒤 다시 발행하세요',
      iqcPlanMissing: '품질팀에 IQC 검사기준 등록을 요청하세요',
      labelStateLocked: '불량이나 폐기 LOT 은 라벨을 발행하지 않습니다',
      other: '잠시 뒤 다시 발행하세요',
      stopped: '남은 장을 이어서 발행할 수 있습니다',
      /** 받은 사유 목록에 「인쇄 실패」가 없어 화면이 스스로 다시 찍지 못한다(`PRINT_FAILURE_REASON_CODE`). */
      needsReason: '「다시 인쇄」에서 사유를 골라 찍으세요',
    },
  },
  /** 머리줄 오른쪽의 상태 묶음. 다른 POP 화면과 같은 말을 쓴다. */
  device: {
    /** ⭐ 번호가 뒤에 붙는다 — 「단말# 5」(사용자 지시 2026-09-14). */
    terminalLabel: '단말#',
    terminalUnknown: '확인되지 않음',
  },
  printer: {
    label: '프린터',
    /** 머리줄 칩을 누르면 뜨는 창의 제목. */
    choose: '프린터 선택',
    close: '닫기',
    /**
     * 브라우저 실행·옛 설치본 — 셸이 고른 프린터를 받지 못한다(2단계 검증 2026-10-16). 고르는 창을 열지 않는다.
     * ⛔ 고른 것처럼 보이는데 기본 프린터로 나가면 그쪽이 더 나쁘다.
     */
    shellOnly: '설치본에서만 프린터를 고를 수 있습니다.',
    /** 이 단말에 기억해 둔 프린터가 목록에서 사라졌다 — 기본으로 돌아간 것을 말한다. */
    storedMissing: (name: string) =>
      `기억해 둔 프린터 「${name}」를 찾을 수 없어 기본 프린터로 인쇄합니다.`,
    none: '사용할 수 있는 프린터가 없습니다.',
    /** ⛔ 「없다」와 「모른다」를 같은 모양으로 그리지 않는다(공유계약 G-9). */
    unknown: '프린터 상태를 확인할 수 없습니다.',
    retry: '다시 확인',
  },
  /** 다시 인쇄 보기. 2회차부터는 사유가 필수다(서버 규칙). */
  reprint: {
    reasonLabel: '사유',
    reasonPrompt: '사유를 고르세요',
    /** 값 목록이 비면 보낼 수 없다 — 사유 없이 보내면 422 다. */
    reasonsEmpty: '고를 수 있는 재발행 사유가 없습니다. 사유 없이는 다시 인쇄할 수 없습니다.',
    reasonsFailed: '재발행 사유를 불러오지 못했습니다.',
    action: (count: number) => `${count}장 다시 인쇄`,
    actionIdle: '다시 인쇄',
    empty: '다시 찍을 라벨을 고르거나 스캔하세요',
    summary: (reason: string) => `사유 ${reason}`,
    scanned: (count: number) => `스캔한 LOT ${count}장`,
    /** 스캔한 번호가 최근 2주 발행분에 없다 — 찾는 범위를 말한다. */
    notFound: '최근 2주 안에 발행한 라벨에서 찾지 못했습니다.',
    lookupFailed: 'LOT 을 찾지 못했습니다. 다시 스캔하세요.',
    /** 고른 LOT 이 라벨을 낼 수 없는 상태 — 누르기 «전»에 막고 까닭을 말한다. */
    lotBlocked: (status: string) => `「${status}」 LOT 은 라벨을 다시 찍을 수 없습니다`,
    lotStatus: { DEFECTIVE: '불량', SCRAPPED: '폐기' } as Record<string, string | undefined>,
  },
  /**
   * 라벨에 찍히는 말 — 수량 줄 오른쪽의 입하일. 라벨은 그림으로 찍으므로 화면 언어를 그대로 쓴다.
   */
  label: {
    received: (date: string) => `입하 ${date}`,
  },
} as const;
