/**
 * P-02-10 작업 중단(홀드) 등록.
 *
 * 이 화면의 말은 「중단」이다 — 계약의 자원 이름은 작업 세션(`work_session`)과 세션 사건
 * (`work_session_event`)이지만, 현장에서 하는 일은 지금 하던 작업을 멈추는 것 하나다.
 */
export const workHoldRegister = {
  title: '작업 중단',

  entry: {
    workOrderLabel: '작업지시',
    workerLabel: '사번',
    workerUnknown: '사번 미확인',
    /** 작업지시 없이 들어온 자리. 목록을 스스로 열지 않는 화면이라 되돌아갈 곳을 말한다. */
    missingWorkOrder: '작업지시를 받지 못했습니다. 작업 시작 화면에서 지시를 고른 뒤 들어오세요.',
  },

  /**
   * 세션 구획 — 이 화면은 **세션이 열려 있어야만 성립한다**(스펙 §5-2).
   * 세션이 없는 것은 오류가 아니라 「아직 시작하지 않았다」이므로 그렇게 말한다.
   */
  session: {
    sectionLabel: '현재 세션',
    sessionNo: (no: number) => `세션 #${String(no)}`,
    startedLabel: '시작',
    elapsedLabel: '경과',
    statusLabel: '상태',
    loading: '세션을 확인하는 중입니다.',
    loadFailed: '현재 세션을 불러오지 못했습니다.',
    /** ⛔ 진입 차단 — 세션이 없으면 중단을 기록할 수 없다(스펙 §6). */
    none: '진행 중인 작업 세션이 없어 중단을 등록할 수 없습니다. 작업을 먼저 시작하세요.',
    unknownValue: '확인할 수 없음',
  },

  /** 이벤트 이력 — 기록 전용이다. 정정 경로가 없다는 사실을 목록 옆에 세운다. */
  history: {
    sectionLabel: '이벤트 이력',
    timeColumn: '시각',
    typeColumn: '구분',
    reasonColumn: '사유',
    empty: '기록된 이벤트가 없습니다.',
    loadFailed: '이벤트 이력을 불러오지 못했습니다.',
    recordOnlyNotice: '이벤트는 정정할 수 없습니다. 잘못 등록했으면 재개한 뒤 다시 중단하세요.',
  },

  /** 중단 등록 입력. 사유는 ⓐ 차단이다 — 고르지 않으면 등록할 수 없다(스펙 §6). */
  form: {
    sectionLabel: '중단 등록',
    reasonLabel: '중단 사유',
    reasonRequired: '중단 사유를 고르세요.',
    /** ⚠ 값 목록이 공통코드에 아직 없어 화면이 임시 목록을 들고 있다(착수 이슈 §4). */
    reasonProvisional: '중단 사유는 임시 목록입니다.',
    remarksLabel: '비고',
    remarksPlaceholder: '필요하면 적으세요',
  },

  /** 이벤트 유형 표시명. 화면은 코드가 아니라 이 말을 보인다. */
  eventTypes: {
    START: '세션 시작',
    STOP: '중단',
    RESUME: '재개',
    END: '세션 종료',
    CONTROL_OVERRIDE: '통제 우회',
  },

  /** 중단 사유 표시명 — 스펙 §3 목업의 7값. */
  reasons: {
    EMERGENCY_ORDER: '긴급 오더 끼어들기',
    EQUIPMENT_FAILURE: '설비 고장',
    TOOL_FAILURE: '도구 고장',
    MATERIAL_SHORTAGE: '자재 결품',
    MOLD_CHANGE: '금형 교체',
    QUALITY_ISSUE: '품질 이슈',
    OTHER: '기타',
  },

  errors: {
    retry: '다시 시도',
  },
} as const;
