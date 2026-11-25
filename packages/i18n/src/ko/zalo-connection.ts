/** W-CO-12 알림 연결 설정 — Zalo 연결 정보와 이벤트별 템플릿(001 신설, 결정 #20). */
export const zaloConnection = {
  panes: { status: '연결 상태', connection: 'Zalo 연결 정보', templates: '템플릿 설정' },
  /** 제목 옆 상태 칩 — 해당할 때만. 연결 오류(재등록 필요 · 마지막 오류)는 경고색, 발송 꺼짐은 무채색. */
  chips: {
    connectionError: '연결 오류',
    deliveryOff: '발송 꺼짐',
  },
  fields: {
    appId: '앱 ID',
    secretKey: '앱 비밀 키',
    refreshToken: '갱신 토큰',
    /** 템플릿 변수 값 자르기 길이 — 모든 템플릿 공통(계약 `paramMaxLength`). 템플릿 설정 상자 맨 위 한 줄. */
    paramMaxLength: '변수 값 길이 제한',
    templateId: '템플릿 ID',
    expiresAt: '액세스 토큰 만료 일시',
    refreshedAt: '마지막 갱신 일시',
    params: '템플릿 변수',
    errorCode: '오류 코드',
    errorMessage: '오류 원문',
  },
  values: {
    registered: '등록됨',
    notRegistered: '미등록',
    none: '—',
    charUnit: '자',
  },
  actions: {
    /** 비밀값 — 없으면 [등록], 있으면 [수정]. 연 칸을 닫는 단추는 [취소]. */
    register: '등록',
    change: '수정',
    cancelChange: '취소',
    copy: '변수명 복사',
    copyFor: (eventName: string): string => `${eventName} 변수명 복사`,
    revert: '취소',
    save: '저장',
    errorDetail: '오류 상세',
    reload: '다시 불러오기',
  },
  state: {
    saved: '저장했습니다',
    copied: '템플릿 변수 이름을 복사했습니다',
    reauth: '고객사 Zalo 담당자에게 새 갱신 토큰을 받아 [수정]으로 등록하세요',
    /** Zalo 오류 코드를 사람 말로 — 모르는 코드는 일반 문구, 코드와 원문은 「오류 상세」에 둔다. */
    lastError: (code: string): string =>
      code === '-124'
        ? 'Zalo 액세스 토큰이 유효하지 않습니다.'
        : 'Zalo 연결 중 오류가 발생했습니다.',
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 저장하세요',
  },
  /** 인계 작업 템플릿 카드(피처 002, FR-010·FR-022). 기존 6종 아래 별도 카드다(확정 2026-10-28). */
  handover: {
    title: '인계 작업 템플릿',
    /** 이벤트 템플릿의 복사(`copyFor`)와 접근 이름을 가른다. 보이는 글 「변수명 복사」를 담는다. */
    copyFor: (typeName: string): string => `${typeName} 인계 작업 변수명 복사`,
    /** 템플릿 ID 입력 칸 아래 도움말. */
    templateIdHelp:
      'Zalo OA에서 등록한 템플릿 ID를 입력하세요. ID를 비워 두면 알림센터로만 발송됩니다.',
  },
  errors: {
    appId: '앱 ID는 숫자 1~40자입니다.',
    secretRequired: '새 값을 입력하세요. 바꾸지 않으려면 [취소]를 누르세요.',
    secretTooLong: (max: number): string => `${String(max)}자를 넘을 수 없습니다.`,
    paramMaxLength: '20~400 사이의 정수를 입력하세요.',
    templateId: '템플릿 ID는 영문·숫자 1~40자이거나 비워 둡니다.',
  },
  /** 연결 정보 · 템플릿 설정(목록 · 상세) 통일 배치(omf-all-around#358). 검색은 템플릿 설정 상자 안. */
  workspace: {
    search: '템플릿명',
    searchPlaceholder: '템플릿명을 입력하세요',
    apply: '조회',
    clear: '초기화',
    list: '템플릿 목록',
    kind: '구분',
    name: '템플릿명',
    templateId: '템플릿 ID',
    kindWithCount: (label: string, count: number): string => `${label} ${String(count)}건`,
    kinds: { event: '이벤트', handover: '인계 작업' },
    empty: '조건에 맞는 템플릿이 없습니다.',
    hasError: '확인 필요',
    selectTitle: '템플릿을 선택하세요.',
  },
} as const;
