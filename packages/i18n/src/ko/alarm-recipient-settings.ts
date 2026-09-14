export const alarmRecipientSettings = {
  title: '알람 수신자 설정',
  breadcrumbRoot: '알림',
  description: '알림 유형마다 받을 조직·역할 또는 사용자를 지정합니다.',
  panes: { events: '알림 유형', recipients: '수신 규칙', preview: '실제 수신자 미리보기' },
  fields: {
    recipientType: '지정 방식',
    businessUnit: '사업부',
    role: '역할',
    user: '사용자',
    zalo: 'Zalo 알림',
  },
  values: {
    role: '조직·역할',
    user: '개인',
    inactive: ' (비활성)',
    /** 미리보기 표의 상태 칸. 위 `inactive`는 선택칸 이름에 붙는 꼬리라 앞 공백이 있어 다르다. */
    statusActive: '사용 중',
    statusInactive: '비활성',
  },
  actions: { add: '수신 규칙 추가', remove: '수신 규칙 제거', preview: '미리보기', save: '저장' },
  state: {
    loading: '설정을 불러오는 중',
    noEvents: '설정할 알림 유형이 없습니다.',
    noRecipients: '등록된 수신 규칙이 없습니다.',
    noRecipientsWarning: '수신 규칙이 없어 이 알림을 받을 사람이 없습니다. 저장은 할 수 있습니다.',
    saved: '수신자 설정을 저장했습니다.',
    clean: '바뀐 내용이 없어 저장할 필요가 없습니다.',
    previewEmpty: '현재 규칙으로 확인된 수신자가 없습니다.',
    lookupLoading: '선택 목록을 불러오는 중입니다.',
    previewReady: (count: number, resolvedAt: string): string =>
      `${resolvedAt} 기준 · 중복을 제외한 ${String(count)}명`,
    zaloDisabled:
      'Zalo 알림은 받을 곳이 아직 등록되지 않아 켤 수 없습니다. 알림센터 수신에는 영향을 주지 않습니다.',
  },
  errors: {
    requiredBusinessUnit: '사업부를 선택해 주세요.',
    requiredRole: '역할을 선택해 주세요.',
    requiredUser: '사용자를 선택해 주세요.',
    duplicate: '같은 수신 규칙이 이미 있습니다.',
    lookupFailed: '선택 목록을 불러오지 못했습니다. 다시 시도해 주세요.',
    /** 쪽을 다 돌았는데 서버가 말한 수에 못 미친다 — 반쪽 목록으로 고르게 두지 않는다. */
    lookupIncomplete: '선택 목록을 전부 불러오지 못했습니다.',
  },
  columns: {
    event: '알림 유형',
    count: '설정 수',
    user: '사용자',
    department: '부서',
    status: '상태',
  },
} as const;
