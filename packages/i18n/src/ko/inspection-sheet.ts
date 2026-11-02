/** 제품 검사표 조회(관리웹 · 품질 관리 · W-03-13·W-03-14 · omf-all-around#89). */
export const inspectionSheet = {
  title: '제품 검사표 조회',
  breadcrumbRoot: '품질 관리',

  statuses: { IN_PROGRESS: '작성 중', COMPLETED: '완료' } as Record<string, string>,

  list: {
    heading: '검사표 목록',
    caption: '제품 검사표 목록',
    /* LOT · 시리얼 스캔 칸 하나 — 검사 실적의 LOT 스캔 칸과 같은 이름 · 모양(사용자 지시 2026-11-02 · #217). */
    scan: 'LOT 스캔',
    scanPlaceholder: 'LOT·시리얼 바코드 스캔 또는 전체 번호 입력',
    /* 상태 칩(탭 줄 오른쪽) — 검사 실적의 판정 칩과 같은 자리 · 모양(#217). */
    statuses: '검사표 상태',
    statusAll: '전체',
    from: '시작일 선택',
    to: '종료일 선택',
    search: '조회',
    reset: '초기화',
    /* 상세 조건 펼치기 — 모델 · 작업지시(사용자 지시 2026-11-02 · #217). */
    detailOpen: '상세 보기 펼치기',
    detailClose: '상세 보기 접기',
    model: '모델 검색',
    modelPlaceholder: '모델을 입력하세요',
    workOrder: '작업지시 검색',
    workOrderPlaceholder: '작업지시 번호를 입력하세요',
    layout: '양식 선택',
    periodReversed: '종료일은 시작일보다 빠를 수 없습니다.',
    empty: '조건에 맞는 검사표가 없습니다.',
    loading: '검사표를 불러오는 중입니다.',
    loadFailed: '검사표 목록을 불러오지 못했습니다.',
    retry: '다시 시도',
    openRow: (serialNo: string) => `${serialNo} 검사표 보기`,
    /* 목록 · 상세 한 화면(#217) — 고르기 전 상세 자리 안내. */
    pickTitle: '검사표를 선택하세요',
    pickHint: '목록에서 검사표를 선택하면 내용을 확인할 수 있습니다.',
  },

  columns: {
    serialNo: '시리얼 번호',
    model: '모델',
    lotNo: '생산 LOT 번호',
    workOrder: '작업지시',
    progress: '검사 완료',
    ng: '불합격 공정',
    status: '상태',
    approval: '승인과 확인',
    createdAt: '작성일시',
  },

  detail: {
    heading: (serialNo: string) => `검사표 ${serialNo}`,
    /* 상세 머리 · 진행 · 탭(사용자 시안 2026-11-02 · #217). */
    title: '제품 검사표 상세',
    progress: {
      label: '검사표 진행',
      inspection: (done: number, total: number): string =>
        `공정 검사 (${String(done)}/${String(total)})`,
      approval: '승인 혹은 확인',
      done: '완료',
    },
    tabsLabel: '검사표 상세 구분',
    tabs: {
      basic: '기본 정보',
      items: (count: number): string => `검사 항목 ${String(count)}개`,
      /* 탭마다 건수 — 검사 조회·판정 탭과 같은 「이름 N건」(사용자 지시 2026-11-02). */
      ngs: (count: number): string => `불량·조치 이력 ${String(count)}건`,
      events: (count: number): string => `서명·승인 이력 ${String(count)}건`,
    },
    itemsEmpty: '검사 항목이 없습니다.',
    finalizeNote: '서명과 승인이 모두 완료되면 검사표가 확정됩니다.',
    loading: '검사표를 불러오는 중입니다.',
    loadFailed: '검사표를 불러오지 못했습니다.',
    close: '닫기',
    /* 기본 정보 탭 머리 두 카드(사용자 시안 2026-11-02 · #217). */
    overview: {
      basic: '기본 정보',
      progress: '진행 현황',
      inspection: '검사 완료',
      ngSteps: '불합격 공정',
      waitInspection: '모든 공정 검사가 완료되면 승인할 수 있습니다.',
    },
    serialNo: '시리얼 번호',
    model: '모델',
    lot: '생산 LOT 번호',
    workOrder: '작업지시',
    layout: '양식',
    writer: '작성자',
    createdAt: '작성일시',
    approved: '승인',
    checked: '확인',
    none: '—',
    header: '제품 정보',
    headerFields: {
      modelText: '모델',
      specText: '사양',
      destinationText: '발송지',
      pcbLotNo: 'PCB 기판 LOT 번호',
      sdLotNo: 'SD LOT 번호',
      stapleLotNo: '스테이플(침) LOT 번호',
      fwProductionVersion: '생산 펌웨어 버전',
      fwQualityVersion: '품질 펌웨어 버전',
      materialText: '재료',
      structureText: '구조 및 중량',
      productNameText: '제품명',
      powerText: '전압 및 주파수',
      motorText: '전동기 수량',
      tempPackNote: '가포장(오포장) 상황 기록',
      overallResultCode: '제품 검사 결과',
    } as Record<string, string>,
    rohs: (on: boolean): string => (on ? 'RoHS 대응 표시 있음' : 'RoHS 대응 표시 없음'),
    fourM: '투입 자재 변경 내역',
    fourMNote:
      '이 시리얼을 만들 때 쓰던 4M 변경품 자재입니다(투입 시각 기준 추정). 계보 기록 이전 작업지시는 작업지시 단위입니다.',
    fourMNone: '투입된 변경 자재가 없습니다.',
    fourMColumns: { changeType: '변경 유형', item: '자재', lot: '자재 LOT 번호', remarks: '비고' },
    steps: '공정별 검사',
    stepsCaption: '공정별 검사와 서명',
    stepColumns: {
      step: '공정',
      judgment: '판정',
      inspector: '검사자',
      inspectedAt: '검사 일시',
      signRequired: '서명 필요',
      sign: '서명',
      actions: '관리',
    },
    notRecorded: '검사 대기',
    signRequiredYes: '필요',
    signRequiredNo: '불필요',
    oqc: '(출하검사 화면)',
    items: (name: string) => `${name} 항목 판정`,
    /* 공정 줄 「상세 보기」 팝업(사용자 지시 2026-11-02 · #217). */
    stepDetail: {
      button: '상세',
      open: (name: string): string => `${name} 상세 보기`,
      title: (name: string): string => `${name} 상세`,
    },
    itemColumns: {
      sequenceNo: '순서',
      code: '항목 번호',
      name: '검사 항목',
      method: '전수/발취',
      judgment: '판정',
    },
    methods: { FULL: '전수', SAMPLE: '발취' } as Record<string, string>,
    ngs: '불량·조치 이력',
    ngsEmpty: '불량·조치 이력이 없습니다.',
    ngColumns: {
      no: 'NG',
      found: '발견',
      content: '불량 내용',
      repair: '수리',
      recheck: '재검',
    },
    events: '서명·승인 이력',
    eventsEmpty: '서명·승인 이력이 없습니다.',
    eventColumns: {
      actedAt: '처리일시',
      event: '구분',
      step: '공정',
      actor: '처리자',
      reason: '사유',
    },
    eventLabels: {
      SIGN_STEP: '단계 서명',
      APPROVE: '승인',
      CHECK: '확인',
      REOPEN: '승인·확인 취소',
      APPROVAL_CLEARED: '수정으로 승인과 확인 풀림',
    } as Record<string, string>,
  },

  actions: {
    sign: '서명하기',
    signRow: (step: string) => `${step} 서명`,
    approve: '승인',
    check: '확인',
    /* 취소 단추 — 승인 · 확인이 모두면 일괄 취소, 하나면 그것의 취소(사용자 지시 2026-11-02 · #217). */
    reopen: { all: '일괄 취소', approve: '승인 취소', check: '확인 취소' } as Record<
      'all' | 'approve' | 'check',
      string
    >,
    /* 승인 · 확인이 막히는 까닭(사용자 지시 2026-11-02 · #217). */
    blockedUnsigned: (steps: string): string =>
      `서명이 필요한 공정이 남아 있어 승인·확인할 수 없습니다: ${steps}`,
    blockedNg: (steps: string): string =>
      `최종 판정이 NG인 공정이 있어 승인·확인할 수 없습니다: ${steps}`,
    signed: (step: string) => `${step}에 서명했습니다.`,
    approved: '승인했습니다.',
    checked: '확인했습니다.',
    completed: '승인과 확인이 모두 되어 검사표가 완료됐습니다.',
    reopened: (label: string): string => `${label}했습니다. 검사표가 작성 중으로 돌아갔습니다.`,
    noPermission: '권한이 없어 서명·승인·확인이 불가합니다.',
    permissionSettings: '권한 설정',
  },

  /* 엑셀 내려받기(PDF 출력 대신 · 사용자 지시 2026-11-02 · #217). */
  excel: {
    button: '엑셀 다운로드',
    fileName: (serialNo: string): string => `제품검사표_${serialNo}.xlsx`,
    fileType: '엑셀 파일',
    failed: '파일을 저장하지 못했습니다.',
  },

  /* 서명 확인 창(사용자 지시 2026-11-02 · #217). */
  signDialog: {
    title: '서명',
    body: (step: string): string =>
      `${step}에 서명하시겠습니까? 서명하면 로그인한 계정 이름과 시각이 남습니다.`,
    ok: '서명',
  },

  /* 승인 · 확인 확정 창(사용자 지시 2026-11-02 · #217). */
  confirmDialog: {
    title: { approve: '검사표 승인', check: '검사표 확인' } as Record<'approve' | 'check', string>,
    ok: { approve: '승인', check: '확인' } as Record<'approve' | 'check', string>,
    body: {
      approve: '검사표를 승인하시겠습니까?',
      check: '검사표를 확인하시겠습니까?',
    } as Record<'approve' | 'check', string>,
    note: {
      approve: '승인자와 승인 일시가 기록됩니다.',
      check: '확인자와 확인 일시가 기록됩니다.',
    } as Record<'approve' | 'check', string>,
    completes: '승인과 확인이 모두 되어 검사표가 완료되고, 이후에는 고칠 수 없습니다.',
  },

  /* 취소 창(사용자 시안 2026-11-02 · #217) — 제목 · 확인 단추는 취소 단추 이름과 같다. */
  reopenDialog: {
    body: {
      all: '승인과 확인이 취소되고 작성 중 상태로 변경됩니다.',
      approve: '승인이 취소되고 작성 중 상태로 변경됩니다.',
      check: '확인이 취소되고 작성 중 상태로 변경됩니다.',
    } as Record<'all' | 'approve' | 'check', string>,
    reason: '취소 사유',
    placeholder: '취소 사유를 입력해 주세요.',
    required: '취소 사유를 입력해 주세요.',
    close: '닫기',
  },
};
