/** W-CO-12 알림 연결 설정 — Zalo 연결 정보와 이벤트별 템플릿(001 신설, 결정 #20). */
export const zaloConnection = {
  title: '알림 연결 설정',
  subtitle: 'Zalo 연결 정보',
  breadcrumbRoot: '시스템 관리',
  panes: { status: '연결 상태', connection: '연결 정보', templates: '이벤트별 템플릿' },
  status: {
    ACTIVE: '정상',
    NOT_CONFIGURED: '미설정',
    REAUTH_REQUIRED: '재등록 필요',
  },
  fields: {
    appId: '앱 ID',
    secretKey: '앱 비밀 키',
    refreshToken: '갱신 토큰',
    paramMaxLength: '값 최대 길이',
    templateId: (eventName: string): string => `${eventName} 템플릿 ID`,
    expiresAt: '접속 토큰 만료',
    refreshedAt: '마지막 갱신',
    params: '파라미터',
  },
  values: {
    registered: '●●●●●● 등록됨',
    notRegistered: '등록 안 됨',
    none: '—',
    charUnit: '자',
  },
  actions: {
    change: '바꾸기',
    cancelChange: '바꾸지 않기',
    copy: '복사',
    copyFor: (eventName: string): string => `${eventName} 파라미터 복사`,
    revert: '되돌리기',
    save: '저장',
    reload: '다시 불러오기',
  },
  state: {
    saved: '저장했습니다',
    copied: '파라미터 이름을 복사했습니다',
    reauth: '고객사 Zalo 담당자에게 새 갱신 토큰을 받아 [바꾸기]로 등록하세요',
    deliveryDisabled: '이 서버는 Zalo 발송이 꺼져 있습니다',
    lastError: (code: string, message: string): string => `${code} ${message}`.trim(),
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 저장하세요',
  },
  /** 인계 작업 템플릿 카드(피처 002, FR-010·FR-022). 기존 6종 아래 별도 카드다(확정 2026-10-28). */
  handover: {
    title: '인계 작업 템플릿',
    /** 이벤트 칸의 복사(`copyFor`)와 접근 이름을 가른다 — 같은 화면에 16개가 선다. */
    copyFor: (typeName: string): string => `${typeName} 템플릿 파라미터 이름 복사`,
    /* 「MES Handover - …」는 고객사에 전달한 영문 템플릿 이름 접두 그대로다. */
    notice:
      // ui-check-ignore: C-13 영문 템플릿 이름 접두
      '고객사가 Zalo OA 에 「MES Handover - …」 템플릿을 등록하고 받은 ID 를 넣습니다. 비어 있으면 그 작업의 Zalo 는 보내지 않고 발송 이력에 「템플릿 미설정」으로 남습니다(알림센터는 그대로 받습니다).',
  },
  errors: {
    appId: '앱 ID는 숫자 1~40자입니다.',
    secretRequired: '새 값을 입력하세요. 바꾸지 않으려면 [바꾸지 않기]를 누르세요.',
    secretTooLong: (max: number): string => `${String(max)}자를 넘을 수 없습니다.`,
    paramMaxLength: '20~400 사이의 정수를 입력하세요.',
    templateId: '템플릿 ID는 영문·숫자 1~40자이거나 비워 둡니다.',
  },
} as const;
