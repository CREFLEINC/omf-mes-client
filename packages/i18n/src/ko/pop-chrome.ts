/**
 * POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다(공유계약 G-34).
 *
 * ⚠ 화면마다 다른 말을 만들지 않는다. 같은 조작이 화면마다 다르게 읽히면 작업자가 헷갈린다.
 */
export const popChrome = {
  /**
   * 사번을 확인하지 못했을 때 맨 위 경고 띠(`patterns/pop-worker-missing-banner`). 모든 POP 화면이
   * 같은 말을 쓴다(사용자 지시 2026-09-17).
   */
  workerMissing: '작업자가 확인되지 않아 기록할 수 없습니다. [작업자 확인]으로 사번을 넣어 주세요.',
  /** 선택 단추가 따로 이름을 받지 않았을 때의 기본 이름. */
  select: '선택',

  /** 선택 팝업(`patterns/pop-select`). 쪽 넘김 단추는 `popPageNav` 를 쓴다. */
  selectDialog: {
    /** 무엇을 고르는지 이름을 알 수 없을 때. */
    fallbackName: '항목',
    title: (name: string): string => `${name} 선택`,
    searchLabel: '목록 검색',
    searchPlaceholder: '목록에서 검색',
    /**
     * 스캐너로도 고를 수 있는 목록(`scannable`)에서 같은 칸이 쓰는 말.
     *
     * ⭐ **찍는 것과 치는 것을 한 칸이 받는다** — 칸이 둘이면 작업자가 어디에 찍어야 하는지
     *    고르게 된다. 찍은 값이 후보 하나와 정확히 같아지면 스스로 골라 닫힌다.
     */
    scanLabel: '스캔 또는 목록 검색',
    scanPlaceholder: '스캔하거나 목록에서 검색',
    clearSearch: '검색어 지우기',
    empty: '표시할 항목이 없습니다.',
    position: (page: number, totalPages: number, count: number): string =>
      `${String(page)} / ${String(totalPages)} · 전체 ${String(count)}건`,
  },

  /**
   * 작업장 콘솔(`patterns/pop-console`) — 상단 바 · 부서 레일 · 현재작업 패널 · 단계 · 액션바 · 홈.
   *
   * ⭐ 화면 이름은 여기 다시 적지 않는다 — 단계·타일의 이름은 `pop-screen-catalog` 의 이름과 같은
   *    말이어야 한다(목록에서 누른 이름과 열린 화면의 이름이 다르면 작업자가 의심한다).
   */
  console: {
    /** 업무 영역(부서) — 부서 레일·홈 카드의 이름이자 상단 바의 위치(`pop-screen-catalog` `PopArea`). */
    areas: {
      production: '생산',
      material: '구매·자재',
      quality: '품질',
      shipping: '출하',
      equipment: '설비',
    },
    /** 상단 바 왼쪽의 길잡이 — 어느 화면에서든 돌아갈 곳이 있다(`nav-trail`). */
    nav: {
      label: '화면 길잡이',
      home: '홈',
      back: '이전',
      location: '현재 위치',
    },
    /** 왼쪽 부서 레일 — 홈 · 부서들 · 단말. 어느 화면에서든 한 번에 다른 부서로 간다. */
    rail: {
      label: '부서',
      terminal: '단말',
    },
    /** 영역 안의 업무 묶음 — 부서 화면의 묶음 이름(`pop-screen-catalog` `PopTaskGroup`). */
    groups: {
      run: '작업 진행',
      packing: '포장',
      change: '중단·교체',
      materialFlow: '자재 입출고·라벨',
      inspect: '검사',
      defect: '불량 등록',
      shipPrep: '출하 준비',
      rework: '재작업',
      equipmentLog: '설비 실적',
    },
    /**
     * 타일에 이름과 함께 서는 **한 줄 설명** — 화면 코드로 찾는다.
     *
     * ⭐ 이름만으로는 처음 보는 작업자가 어느 것을 눌러야 하는지 모른다(「출하 포장」과 「생산 포장」).
     *    무엇을 하는 화면인지를 동사로 적는다.
     */
    hints: {
      'P-01-01': '입고 자재에 LOT을 매기고 라벨을 붙입니다',
      'P-01-02': '출고할 자재의 QR 라벨을 뽑습니다',
      'P-02-01': '작업지시를 골라 생산을 시작합니다',
      'P-02-03': '자재 LOT·금형을 스캔해 투입합니다',
      'P-02-04': '생산 수량과 불량을 등록합니다',
      'P-02-08': '생산한 LOT을 포장 단위로 담습니다',
      'P-02-09': '포장 라벨을 다시 뽑습니다',
      'P-02-10': '작업을 멈추고 사유를 남깁니다',
      'P-02-11': '작업 중 부품 교체를 기록합니다',
      'P-02-12': '긴급 작업지시를 만들고 확인합니다',
      'P-02-13': '공정 중 제품을 검사하고 판정합니다',
      'P-02-14': '불량 자재 LOT을 보류로 등록합니다',
      'P-04-01': '출하할 제품을 포장합니다',
      'P-04-03': '재작업한 수량과 결과를 등록합니다',
      'P-04-04': '다시 묶은 포장에 새 라벨을 뽑습니다',
      'P-04-05': '포장 상자를 묶고 납품 라벨을 냅니다',
      'P-04-06': '출하 전 검사 결과를 판정합니다',
      'P-05-01': '금형 QR을 찍고 타발수를 기록합니다',
      'P-05-02': '설비가 멈춘 시간과 사유를 기록합니다',
      'P-06-01': '창고 적재 위치 라벨을 뽑습니다',
    } as Readonly<Record<string, string>>,
    home: {
      title: '홈',
      /** 부서 카드 줄의 이름. */
      areas: '업무 영역',
      /** 부서 카드 아래 — 그 부서에 이 단말이 열 수 있는 화면 수. */
      screenCount: (count: number): string => `화면 ${String(count)}개`,
      signInTitle: '작업자를 확인하세요',
      signInBody: '누구로 기록할지 정하면 기록하는 화면을 쓸 수 있습니다. 조회는 지금도 됩니다.',
      worker: '작업자',
      workerNote: '이 단말의 기록은 이 사번으로 남습니다.',
      workerChange: '작업자 변경',
      recent: '이어서 하기',
      recentEmpty: '아직 연 화면이 없습니다. 연 화면이 여기 쌓여, 하던 일로 바로 돌아갑니다.',
      /** 오른쪽 아래 — 이 단말이 무엇으로 등록돼 있는가. 설치 담당자를 부를 때 읽어 준다. */
      terminal: '이 단말',
      /** 최근 화면이 작업지시를 달고 있으면 함께 적는다 — 같은 화면이라도 어느 지시였는지가 다르다. */
      recentWithWorkOrder: (name: string, workOrderId: number): string =>
        `${name} · W/O #${String(workOrderId)}`,
      /** 생산 흐름의 입구를 크게 세운 카드의 단추. */
      start: '시작하기',
      screens: '업무 화면',
    },
    /** 부서 화면 — 묶음별 타일. */
    area: {
      /** 머리줄 아래 — 묶음 이름을 잇는다. */
      summary: (groups: string, count: number): string => `${groups} · 화면 ${String(count)}개`,
      /** 이 단말에 이 부서 화면이 하나도 없을 때. 주소로 들어온 경우뿐이다. */
      empty: '이 단말에서 열 수 있는 이 부서 화면이 없습니다.',
    },
    statusBar: {
      equipmentNone: '설비 미지정',
      workOrderNone: '작업지시 미선택',
      workOrder: (workOrderNo: string): string => `작업지시 ${workOrderNo}`,
      /** 사번이 없을 때 [작업자] 단추 — 누르면 작업자 확인 창이 열린다. */
      signIn: '작업자 확인',
      worker: (workerNo: string): string => `사번 ${workerNo}`,
      online: '연결됨',
      offline: '연결 끊김',
      synced: '전송 완료',
      unsynced: (count: number): string => `전송 대기 ${String(count)}건`,
      /** 시계 위 날짜의 요일 — 일요일부터. */
      weekdays: ['일', '월', '화', '수', '목', '금', '토'] as readonly string[],
    },
    /** 설비 상태등 옆 글자 — 단말이 아는 것은 «세션» 상태다. 설비 PLC 상태를 지어내지 않는다. */
    session: {
      running: '가동 중',
      stopped: '중단',
      none: '세션 없음',
      unknown: '확인 중',
    },
    currentWork: {
      title: '현재 작업',
      empty: '작업지시를 고르면 목표·양품·불량이 여기에 보입니다.',
      loading: '작업지시를 불러오는 중…',
      failed: '작업지시를 확인하지 못했습니다.',
      item: '품목',
      operation: '공정',
      target: '목표',
      good: '양품',
      defect: '불량',
      rate: (rate: string): string => `달성률 ${rate}%`,
      progressUnknown: '실적 누계를 받지 못했습니다.',
      sessionStarted: (time: string): string => `${time} 시작`,
    },
    steps: {
      label: '작업 단계',
      needWorkOrder: '작업지시를 먼저 고르세요',
    },
    actions: {
      label: '이상 보고',
      next: (step: string): string => `다음: ${step}`,
    },
    /** 이 단말이 갈 수 있는 화면을 판정하지 못했을 때(홈·부서 화면 공통). */
    access: {
      loading: '이동할 수 있는 화면을 확인하는 중…',
      unknown: '이동할 수 있는 화면을 확인하지 못했습니다',
      empty: '이동할 수 있는 화면이 없습니다',
    },
    /** 부서 레일 바닥의 [단말]이 여는 창 — 이 단말이 무엇인지와 재등록. 설치 담당자용이다. */
    terminal: {
      title: '단말 정보',
      code: '단말 코드',
      type: '단말 유형',
      equipment: '설비',
      processes: '공정',
      none: '없음',
      close: '닫기',
      reRegisterNote: '단말 재등록은 설치 담당자가 합니다. 보내지 못한 기록이 있으면 막힙니다.',
    },
    feedback: {
      acknowledge: '확인',
      region: '알림',
      blockedTitle: '확인이 필요합니다',
    },
  },
};
