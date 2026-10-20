/**
 * POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다(공유계약 G-34).
 *
 * ⚠ 화면마다 다른 말을 만들지 않는다. 같은 조작이 화면마다 다르게 읽히면 작업자가 헷갈린다.
 */
export const popChrome = {
  /** 머리줄의 화면 이동 선택 단추. */
  screenNav: '화면 이동',
  /** 머리줄의 사번 놓기 단추. */
  userSwitch: '사용자 전환',
  /**
   * 사번을 확인하지 못했을 때 맨 위 경고 띠(`patterns/pop-worker-missing-banner`). 모든 POP 화면이
   * 같은 말을 쓴다(사용자 지시 2026-09-17).
   */
  workerMissing: '사번이 확인되지 않았습니다. 사번 인증을 먼저 진행해주세요.',
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
   * 작업장 콘솔(`patterns/pop-console`) — 상태바 · 현재작업 패널 · 단계 표시줄 · 액션바 · 작업 메뉴.
   *
   * ⭐ 화면 이름은 여기 다시 적지 않는다 — 단계·메뉴의 이름은 `pop-screen-catalog` 의 이름과 같은
   *    말이어야 한다(목록에서 누른 이름과 열린 화면의 이름이 다르면 작업자가 의심한다).
   */
  console: {
    /** 업무 영역(부서) — 홈·작업 메뉴의 묶음 이름이자 상태바의 위치(`patterns/pop-screen-catalog` `PopArea`). */
    areas: {
      production: '생산',
      material: '구매·자재',
      quality: '품질',
      shipping: '출하',
      equipment: '설비',
    },
    /** 상태바 왼쪽의 길잡이 — 어느 화면에서든 돌아갈 곳이 있다(`nav-trail`). */
    nav: {
      label: '화면 길잡이',
      home: '홈',
      back: '이전',
      location: '현재 위치',
    },
    home: {
      title: '홈',
      recent: '최근 화면',
      /** 최근 화면이 작업지시를 달고 있으면 함께 적는다 — 같은 화면이라도 어느 지시였는지가 다르다. */
      recentWithWorkOrder: (name: string, workOrderId: number): string =>
        `${name} · W/O #${String(workOrderId)}`,
      screens: '업무 화면',
    },
    statusBar: {
      equipmentNone: '설비 미지정',
      workOrderNone: '작업지시 미선택',
      workOrder: (workOrderNo: string): string => `작업지시 ${workOrderNo}`,
      workerUnknown: '사번 미확인',
      worker: (workerNo: string): string => `사번 ${workerNo}`,
      online: '연결됨',
      offline: '연결 끊김',
      synced: '전송 완료',
      unsynced: (count: number): string => `전송 대기 ${String(count)}건`,
      menu: '작업 메뉴',
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
    menu: {
      title: '작업 메뉴',
      close: '닫기',
      loading: '이동할 수 있는 화면을 확인하는 중…',
      unknown: '이동할 수 있는 화면을 확인하지 못했습니다',
      empty: '이동할 수 있는 화면이 없습니다',
    },
    feedback: {
      acknowledge: '확인',
      region: '알림',
      blockedTitle: '확인이 필요합니다',
    },
  },
};
