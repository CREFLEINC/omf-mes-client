/**
 * W-02-08 W/O 진행현황 조회.
 *
 * ⭐ 이 화면은 **집계가 주 기능인 첫 조회 화면**이고, 그래서 공유계약 §L(조회·집계) 6조항이
 * 여기서 나왔다. 문구도 그 조항들을 그대로 비춘다 — 기간을 비울 수 없다(L-3) · 기준 시각을
 * 항상 보인다(L-5) · 자동 갱신이 없으니 새로고침이 유일한 갱신 수단이다(L-6).
 *
 * 요약 집계와 지연 판정은 서버가 준다(계약의 `summary` · `progress.delayStatusCode`) — 화면은 모양만 바꾼다.
 * 같은 조회 결과를 표나 날짜 축 일정으로 본다.
 */
export const workOrderProgress = {
  title: 'W/O 진행현황',

  /** 조회 조건. */
  filters: {
    legend: '조회 조건',
    period: '기간',
    from: '시작일',
    to: '종료일',
    productionLine: '라인',
    productionOrder: 'P/O',
    keyword: 'W/O 번호',
    keywordPlaceholder: 'W/O 번호의 일부',
    search: '조회',
    reset: '초기화',
    /** 공정 조건 — 계약의 `processId`. 「조건 더보기」에 접힌다. */
    process: '공정',
    /** 「조건 더보기」에 접힌 칸에 걸린 조건의 칩(C-6). 상태는 표 위 조건 칩이 맡는다(C-17). */
    chipProductionOrder: (value: string): string => `P/O: ${value}`,
    chipProcess: (value: string): string => `공정: ${value}`,

    /** 고르지 않은 상태. ⛔ 「선택 안 함」이 아니라 **무엇이 조회되는지**를 적는다. */
    all: '전체',

    /** L-3 — 비울 수 없다. 그래서 「왜 막혔나」가 아니라 「무엇을 채우면 되나」를 적는다. */
    periodRequired: '시작일과 종료일을 모두 고르세요.',
    periodInvalid: '달력에 없는 날짜입니다. 다시 고르세요.',
    periodReversed: '시작일이 종료일보다 뒤입니다. 두 날짜를 바꿔 주세요.',

    /**
     * ⛔ 넓은 기간을 **막지 않는다** — 넓게 봐야 하는 일이 실제로 있다. 느려질 수 있다는
     * 사실만 미리 알린다(예고이지 금지가 아니다).
     */
    periodWide: '기간이 3개월을 넘습니다. 조회가 느릴 수 있습니다.',

    /**
     * G-1·G-2 — 선택지를 세울 수 없으면 **지우지 않고 끄고 이유를 적는다.** 조용히 사라지면
     * 「원래 없는 기능」으로 읽히고, 값이 채워지는 날에도 아무도 눈치채지 못한다.
     */
    lookupFailed: '선택지를 받지 못했습니다. 새로고침해 보세요.',

    /**
     * ⛔ **「여기 없으면 없는 것」으로 읽히지 않게 한다.** 선택지는 앞의 몇 건만 받아 둔
     * 것이라, 찾는 것이 안 보이는 이유가 「없어서」가 아니라 「아직 못 받아서」일 수 있다.
     */
    optionsTruncated: (shown: number): string =>
      `앞의 ${String(shown)}건만 선택지에 있습니다. 찾는 것이 없다면 아직 못 받은 것일 수 있습니다.`,
  },

  /**
   * 식별자를 사람이 읽는 이름으로 바꾸지 못했을 때 그 자리에 서는 말.
   *
   * ⛔ **숫자 식별자로 메우지 않는다.** `5001` 은 사용자가 쓰는 말이 아니라, 그것을 내면
   * 그것이 품목명인 줄 알고 읽는다. 모르면 모른다고 적는다.
   */
  nameUnknown: '이름 확인 중',

  /**
   * 목록 — **전부 읽기 전용**이다. 이 화면에는 저장 액션이 없다.
   *
   * ⚠ 수량을 **다섯 그대로** 보인다. 정본이 「양품/불량/손실」 셋으로 접으라 했지만 계약은
   * 다섯 칸이고, 접는 규칙이 아직 정해지지 않았다(omf-mes#60) — 특히 **보류가 셋 어디에도
   * 들어가지 않는다.** 지어내 접으면 합계가 조용히 어긋나므로 **받은 대로 보인다.**
   */
  list: {
    title: '목록',
    columns: {
      workOrderNo: 'W/O 번호',
      itemId: '품목',
      itemCode: '품목코드',
      itemName: '품목명',
      process: '공정',
      orderQty: '지시',
      goodQty: '양품',
      defectQty: '불량',
      holdQty: '보류',
      scrapQty: '스크랩',
      reworkQty: '재작업',
      achievementRate: '달성률',
      statusCode: '상태',
      plannedEndAt: '계획 종료',
      delay: '지연',
    },

    /** 값이 없을 때. 「0」이 아니라 「모른다」는 뜻이다. */
    blank: '—',

    empty: '조건에 맞는 W/O 가 없습니다. 기간이나 조건을 넓혀 보세요.',
    loadError: '목록을 받지 못했습니다. 잠시 뒤 다시 시도하세요.',
    loading: '목록을 받는 중입니다.',

    /** 줄을 눌러 상세를 연다 — 화면 읽기 도구에도 무엇을 여는지 들려야 한다. */
    select: (workOrderNo: string): string => `${workOrderNo} 상세 열기`,

    /** 지연은 서버 판정(`progress.delayStatusCode`)이다. 정상인 줄은 칸을 비운다. */
    delayed: '지연',

    /**
     * ⛔ 계획 종료가 없으면 **판정할 수 없다.** 빈칸으로 두면 「정상」으로 읽히므로 그 뜻을
     * 값 자리에 적는다(스펙 §5-3).
     */
    delayUnknown: '판정 불가',
  },

  /**
   * 요약 — 조건에 맞는 W/O **전체** 기준이다(쪽과 무관, 계약의 `summary`).
   * 값이 0 인 보류 · 스크랩 · 재작업 · 판정 불가 칸과 0 건인 상태 칩은 두지 않는다.
   */
  summary: {
    label: '요약',
    total: '전체 W/O',
    countUnit: '건',
    achievementRate: '달성률',
    goodQty: '양품',
    defectQty: '불량',
    holdQty: '보류',
    scrapQty: '스크랩',
    reworkQty: '재작업',
    delayed: '지연',
    undeterminable: '판정 불가',
    /** 상태 조건 칩 묶음의 이름. 칩은 「이름 건수」다. */
    statusLabel: '상태',
    statusAll: '전체',
    statusChip: (label: string, count: number): string =>
      `${label} ${count.toLocaleString('ko-KR')}`,
  },

  /** 보기 전환 — 같은 조회 결과를 표나 날짜 축 일정으로 본다. */
  view: {
    label: '보기',
    table: '표',
    timeline: '일정',
  },

  /** 일정 보기 — 계획 시작부터 종료까지를 막대로, 넘긴 만큼을 지연 구간으로 그린다. */
  timeline: {
    title: '일정',
    schedule: '일정',
    legendPlan: '계획 구간',
    legendDone: '만든 비율',
    legendWaiting: '배포 전',
    legendLate: '지연 구간',
    legendNow: '기준 시각',
    /** 막대를 글로 읽는 말 — 화면 읽기 도구와 마우스를 올렸을 때 쓴다. */
    planned: (start: string, end: string): string => `계획 ${start} ~ ${end}`,
    plannedFrom: (start: string): string => `계획 시작 ${start}`,
    noSchedule: '계획 일정 없음',
  },

  /** 쪽 이동. DS 에 전용 부품이 없어 조합으로 만든다. */
  page: {
    label: '쪽 이동',
    prev: '이전',
    next: '다음',
    /** 「128건 중 1–50」 — 지금 보는 자리와 전체를 함께 적는다. */
    range: (start: number, end: number, total: number): string =>
      `${String(total)}건 중 ${String(start)}–${String(end)}`,
    total: (total: number): string => `${String(total)}건`,

    /**
     * ⛔ 조건이 좁아져 **없는 쪽**을 가리키게 됐을 때. 「결과가 없습니다」로 적으면 조건이
     * 잘못된 줄 알고 조건을 더 만지게 된다 — 어떻게 풀 것인가를 적는다(G-3).
     */
    beyondLast: '이 쪽에는 결과가 없습니다. 조건이 좁아져 쪽 번호가 남았습니다.',
    toFirst: '첫 쪽으로',
  },

  /** 고른 W/O 의 상세. 가장자리 패널이 DS 에 없어 가운데 창으로 시작한다. */
  detail: {
    title: '선택한 W/O',
    close: '닫기',
    loading: '상세를 받는 중입니다.',
    loadError: '상세를 받지 못했습니다. 잠시 뒤 다시 시도하세요.',

    workOrderNo: 'W/O 번호',
    statusCode: '상태',
    orderQty: '지시 수량',
    goodQty: '양품',
    defectQty: '불량',
    holdQty: '보류',
    scrapQty: '스크랩',
    reworkQty: '재작업',
    achievementRate: '달성률',
    process: '공정',
    productionOrder: 'P/O',
    plannedStartAt: '계획 시작',
    plannedEndAt: '계획 종료',
    completedAt: '완료',
    closedAt: '마감',
    remarks: '비고',

    crewLoading: '작업 세션·작업자별 실적을 받는 중입니다.',
    crewLoadError: '작업 세션·작업자별 실적을 받지 못했습니다.',
    sessionsTruncated: '작업 세션 일부를 불러오지 못했습니다.',
    resultsTruncated: '실적 일부를 불러오지 못했습니다.',
    unknownWorker: '알 수 없음',
    roles: { MAIN: '정', SUB: '부', BOTH: '정·부' },
    workerLabel: (workerName: string, workerNo: string): string => `${workerName} (${workerNo})`,
    sessions: {
      heading: '작업 세션',
      session: (sessionNo: number): string => `세션 ${String(sessionNo)}`,
      startedAt: '시작',
      endedAt: '종료',
      ongoing: '진행',
      empty: '작업 세션이 없습니다.',
      noParticipants: '참여자가 없습니다.',
      columns: {
        worker: '작업자',
        role: '정/부',
        joinedAt: '참여',
        leftAt: '이탈',
        minutes: '참여 분',
      },
    },
    defectTypes: {
      heading: '불량 유형별',
      empty: '불량 기록이 없습니다.',
      untyped: '유형 없음',
      columns: { type: '불량 유형', qty: '수량' },
    },
    workerResults: {
      heading: '작업자별 실적',
      empty: '실적이 없습니다.',
      columns: {
        worker: '작업자',
        role: '정/부',
        goodQty: '양품',
        defectQty: '불량',
        holdQty: '보류',
        scrapQty: '스크랩',
        reworkQty: '재작업',
      },
    },
  },

  /** L-5 — 집계는 조회 시점의 스냅샷이라 언제 기준인지가 값의 일부다. 표기는 통합 대시보드의 「마지막 갱신」과 같다(#360). */
  basis: {
    label: (at: string): string => `마지막 갱신 ${at}`,
    refresh: '갱신',
  },
} as const;
