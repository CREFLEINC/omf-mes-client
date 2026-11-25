export const common = {
  /*
   * 반드시 채워야 하는 칸의 라벨에 붙인다. 화면마다 다르게 적으면 같은 뜻이 두세 모양으로
   * 갈리고, 번역할 때도 자리마다 따로 옮기게 된다.
   */
  required: (label: string) => `${label} (필수)`,
  /* 비워도 되는 칸에 붙인다. 필수와 같은 자리·같은 모양으로 적어야 둘이 눈에 갈린다. */
  optional: (label: string) => `${label} (선택)`,
  save: '저장',
  cancel: '취소',
  add: '추가',
  search: '조회',
  reset: '초기화',
  confirm: '확인',
  close: '닫기',
  /*
   * 검색칸의 지우기 단추 접근명. 디자인 시스템이 기본값을 한국어로 들고 있어, 넘기지 않으면
   * 다른 언어로 열어도 이 자리만 한국어로 남는다. 조건을 모두 비우는 「초기화」와 다르다 —
   * 이것은 검색칸 하나만 비운다.
   */
  clear: '지우기',
  /** 선택지가 많은 선택 칸(`patterns/select.tsx`)의 목록 맨 위 검색창 — 접근명과 빈 결과. */
  selectSearch: '검색',
  selectNoMatch: '맞는 항목이 없습니다',
  selectLoading: '불러오는 중…',
  selectLoadFailed: '목록을 불러오지 못했습니다',
  deactivate: '사용 중지',
  /** 쓰는지 여부 라벨 — 관리웹 모든 화면이 「사용 / 미사용」 한 가지로 쓴다(사용자 지시 2026-11-24 · `patterns/usage-chip.tsx`). */
  usage: { active: '사용', inactive: '미사용' },
  saved: '저장했습니다',
  created: '등록했습니다',
  retry: '다시 시도',
  includeInactive: '미사용 포함',
  /** 조건에 맞는 것이 없는 빈 목록의 회색 보조 문구(`patterns/list-empty.tsx`). */
  listEmptyHint: '조회 조건을 바꿔 보세요.',
  /** 조회 조건 줄의 「조건 더보기」(C-6) — 자주 쓰는 세 칸 밖의 조건을 접어 둔다(`patterns/filter-more.tsx`). */
  filterMore: {
    open: '조건 더보기',
    close: '조건 접기',
    /** 접힌 칸에 걸린 조건 칩의 × 접근명. */
    remove: (label: string): string => `${label} 조건 제거`,
  },
  discardChangesConfirm: '입력한 내용이 저장되지 않았습니다. 변경을 파기할까요?',
  /*
   * 화면 뼈대의 이름들. 디자인 시스템이 기본값을 한국어로 들고 있어, 넘겨주지 않으면 다른
   * 언어로 열어도 이 자리만 한국어로 남는다.
   */
  oaOnly: {
    checking: '이 화면을 쓸 수 있는 공장인지 확인하는 중입니다.',
    notice:
      '이 화면은 OA 사업부 전용입니다. 로그인 계정의 공장 범위에 OA 공장이 없습니다. 필요하면 시스템 관리자에게 공장 범위를 요청하세요.',
    /** OA·부품 공장을 모두 가진 계정이 맨 위에서 「부품」을 고른 때(omf-all-around#336). */
    partsModeNotice:
      '이 화면은 OA 사업부 전용입니다. 맨 위에서 「OA 사업부」를 고르면 볼 수 있습니다.',
  },
  /** OA·부품 공장을 모두 가진 계정의 동작 고르기 — 상단 바(omf-all-around#336). */
  plantMode: {
    label: '공장 동작',
    oa: 'OA 사업부',
    parts: '부품 사업부',
  },
  shell: {
    brand: 'OMF-MES 모바일',
    main: '본문',
    skipToMain: '본문으로 건너뛰기',
    notifications: '알림',
    /** 사이드바의 접근명. 관리웹에만 선다 — 모바일에는 사이드바가 없다. */
    mainMenu: '주 메뉴',
    /** 표제 위 경로의 접근명. 관리웹에만 선다. */
    breadcrumb: '탐색 경로',
    /** 탭 막대 끝 「⋯」 단추의 접근명 — 그 화면에서 드물게 쓰는 기능(배치 바꾸기 등)을 모은 자리. */
    moreActions: '더보기',
    /** 모바일 앱바의 홈 단추 이름. 작업 화면에서 작업 목록으로 돌아간다. */
    home: '작업 목록',
    /** 모바일 앱바의 뒤로 단추 이름. 화면 안에서 지나온 단계로 하나 돌아간다. */
    back: '이전 단계',
    /** 되돌릴 단계가 없는 작업 화면의 뒤로 단추 이름. 그 작업이 걸린 업무의 작업 목록으로 간다. */
    backToArea: (area: string) => `${area} 작업 목록`,
    /** 목록에 없이 다른 화면에서만 들어오는 화면의 뒤로 단추 이름. 그 앞 화면으로 간다. */
    backToScreen: (screen: string) => `${screen} 화면`,
    /**
     * 사번 없이 작업 화면에 들어왔을 때 앱바 아래 알림. 화면에 들어서자마자 띄운다 - 다 적고
     * 등록하려는 순간에 알면 적은 것을 들고 사번 화면을 다녀와야 한다(사용자 지시 2026-10-21).
     */
    noWorker: '사번을 먼저 확인하세요',
    /** 사번 확인 화면으로 가는 길 - 알림의 단추와 앱바의 사번 칩. */
    signIn: '사번 확인',
    /** 앱바 사번 칩의 이름. 누르면 사번 확인 화면으로 가 교대한다(「사번 바꾸기」에서 바꿈, 사용자 지시 2026-11-23). */
    changeWorker: '사용자 전환',
    /** 첫 화면(사번 확인 · 작업 목록)에서 단말의 뒤로가기를 누르면 앱을 닫기 전에 묻는다(사용자 지시 2026-11-23). */
    exit: {
      title: '앱을 종료할까요?',
      cancel: '취소',
      proceed: '종료',
    },
  },
  connection: {
    online: '온라인',
    offline: '오프라인',
    /** 담긴 순간 성공으로 보이므로, 아직 닿지 않은 건수를 보이지 않으면 알 방법이 없다. */
    unsent: (count: number) => `전송 대기 ${String(count)}`,
    /** 실패한 것은 기다려도 가지 않는다. 대기와 같은 셈에 넣으면 갈 것으로 읽힌다. */
    returned: (count: number) => `전송 실패 ${String(count)}`,
    /*
     * 자동 재전송을 멈춘 상태. 사라졌다로 읽히면 안 된다 - 적은 것은 그대로 있고 보내기만
     * 멈춘 것이라, 본문이 그 사실을 먼저 말한다.
     */
    stalledTitle: '보낸 기록이 계속 등록되지 않습니다',
    stalledBody: '전송 대기 중인 기록은 그대로 있습니다. 잠시 뒤 다시 보내기를 누르세요.',
    stalledRetry: '다시 보내기',
  },
  /** 검사 조회·판정(IQC · PQC · OQC) 탭 줄 오른쪽 건수 칩(omf-all-around#185). */
  columnOrderHandle: '끌어서 열 순서 바꾸기',
  /** 목록 · 상세 화면의 목록 접기(omf-all-around#350) — 목록 제목 줄 「목록 접기」, 접힌 뒤 왼쪽 「목록」 탭. */
  paneList: {
    filter: '조회 조건',
    collapse: '목록 접기',
    tab: '목록',
    /* 쉼표 없이 — 쪽 이동 줄 「총 N건」 등 앱 전체 건수 표기와 같다(#350 리뷰). */
    count: (count: number): string => `${String(count)}건`,
  },
  inspectionHub: {
    /** 검사 기준 안내 문구 띠(omf-all-around#252). */
    guide: '검사 안내',
    guideCommon: '공통 안내',
    guideItem: '품목 안내',
    guideExpand: '펼치기',
    guideCollapse: '접기',
    label: '검사 의뢰 상태',
    requested: '대기',
    inProgress: '진행',
    completed: '완료',
    count: (label: string, count: number): string => `${label} ${String(count)}`,
    filterOn: (label: string): string => `${label} 의뢰만 보기`,
    filterOff: (label: string): string => `${label} 거르기 해제`,
    pendingOnly: '대기·진행만 보기', // ui-check-ignore: C-13 사용자 지시 문구(2026-10-26 · #185)
    /** 종합 판정 필터(omf-all-around#356) — 확정된 의뢰의 판정으로 거른다. */
    judgmentFilter: '종합 판정',
    judgmentAll: '전체',
    pickRequest: '검사 의뢰를 선택하세요.',
    pickRequestHint: '선택한 의뢰의 상세 정보가 표시됩니다.',
    close: '닫기',
    splitter: '목록과 상세 폭 나누기',
    heightSplitter: '목록과 상세 높이 나누기',
    /* 목록 접기 · 펼치기 단추(사용자 지시 · #252). */
    listCollapse: '목록 접기',
    listExpand: '목록 펼치기',
    layoutLabel: '목록·상세 배치', // ui-check-ignore: C-13 사용자 지시 문구(2026-10-26 · #185)
    layoutSideBySide: '좌우 배치',
    layoutStacked: '상하 배치',
    /** 검사 입력 단계(PQC · OQC · #197) — IQC 와 같은 말. */
    stepConfirm: '확정',
    stepChange: '펼쳐서 수정',
    /** 수량 줄의 입력 현황 「전체 34 EA 중 34 EA 미입력」(#197). */
    qtyTotalOf: (total: string): string => `전체 ${total} 중`,
    qtyShortBy: (short: string): string => `${short} 미입력`,
    qtyOverBy: (over: string): string => `${over} 초과`,
    qtyUncountable: '수량 확인 필요',
    /** 접힌 수량 단계의 요약(#197). */
    qtySummary: (accepted: string, rejected: string, held: string): string =>
      `합격 ${accepted} · 불합격 ${rejected} · 보류 ${held}`, // ui-check-ignore: C-13 IQC 와 같은 요약 표기(#197)
    /** 창이 좁아 좌우 배치를 쓸 수 없을 때 그 단추의 설명(#197). */
    layoutNarrow: '창이 좁아 상하로 배치됩니다.',
  },
  reference: {
    empty: '—',
    /*
     * 이름과 코드를 함께 보인다. 코드만으로는 무엇인지 알려면 외우고 있어야 하고, 이름만으로는
     * 실물 라벨과 눈으로 대조할 수 없다 - 라벨에 찍히는 것은 코드다.
     */
    named: (name: string, code: string) => `${name}(${code})`,
    unknown: '알 수 없음',
    /*
     * 단위는 수량 뒤에 붙는다. 못 찾았을 때 빈 글자를 끼우면 수량 뒤가 그냥 비어, 40 이
     * 마흔 개인지 마흔 킬로그램인지 가릴 수 없다 - 한 목록에 EA 와 KG 가 섞여 선다.
     *
     * 이 자리에 들어갈 수 있는 것은 짧은 말뿐이라 상태를 여럿으로 가르지 않는다. 단위는
     * 목록 한 번으로 받아 실패하면 화면 전체가 같은 상태이므로, 가르려면 화면이 한 번
     * 알리는 쪽이 맞다.
     */
    uomUnknown: '단위 없음',
    loading: '이름 불러오는 중',
    failed: '이름을 불러오지 못했습니다',
    /*
     * 현장 단말용. 연결이 끊긴 채 화면을 열면 목록은 캐시에서 뜨는데 이름만 못 받는다.
     * 못 받았다고만 적으면 안 된다는 말로 끝나, 기다리면 될 일에 담당자를 부르게 된다.
     *
     * 연결이 돌아오면 멈춘 조회를 다시 부르는 장치가 이미 있어 이름은 저절로 채워진다.
     * 그 사실을 적는다. 이름 조회가 실패하면 연결 표시도 오프라인으로 바뀌므로 까닭도 맞다.
     */
    failedOffline: '연결되면 표시됩니다',
    inactiveSuffix: ' (미사용)',
  },
  /*
   * 날짜 칸이 비었을 때 트리거에 보이는 글자. `TextField type="date"`는 브라우저가 `yyyy-mm-dd`
   * 마스크를 그려 줬지만 `DatePicker`의 트리거는 우리가 넣지 않으면 빈 칸으로 남는다.
   */
  selectDate: '날짜 선택',
  /** 기간을 시작 · 종료 두 칸으로 나눌 때, 날짜 이름이 따로 없는 「기간」의 두 칸 이름(`patterns/date-range-fields`). */
  startDate: '시작일',
  endDate: '종료일',

  /**
   * POP 머리줄의 사번. 화면마다 같은 말로 적는다(`patterns/pop-worker-tag`).
   *
   * 화면마다 제 문구를 갖고 있어 사번을 적는 방식이 셋으로 갈렸다.
   */
  popWorker: {
    label: '사번',
    /** 아직 못 받았다 - 없다가 아니라 모른다다. */
    unknown: '사번 미확인',
  },

  /**
   * 스캔 하나가 대상을 정하는 화면에서, 이미 정해진 뒤에 다른 것을 읽었을 때 되묻는 말.
   *
   * 옆 라벨을 스친 것인지 일부러 바꾼 것인지 화면은 모른다. 조용히 바뀌면 작업자는 앞엣것에
   * 적는 줄 알고 진행한다.
   */
  rescan: {
    title: '다시 스캔했습니다',
    body: (before: string, after: string) =>
      `지금 대상은 ${before} 입니다. 새로 읽은 ${after} 로 바꿀까요?`,
    keep: '그대로 두기',
    replace: '새로 읽은 값으로',
  },
  /**
   * 저장하지 않은 편집을 두고 다른 화면으로 옮길 때(사이드바 · 뒤로가기) 묻는 창 — 사용자 역할 권한 관리 창과 같은 문구(#358).
   */
  unsavedLeave: {
    title: '저장되지 않은 변경 사항',
    body: '저장하지 않고 나가면 변경 사항이 사라집니다.',
    keep: '계속 편집',
    confirm: '저장하지 않고 나가기',
  },
} as const;
