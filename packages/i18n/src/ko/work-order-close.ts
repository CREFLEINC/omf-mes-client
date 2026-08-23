export const workOrderClose = {
  confirm: {
    title: (workOrderNo: string): string => `작업지시 마감 — ${workOrderNo}`,
    target: (workOrderNo: string): string => `대상 작업지시: ${workOrderNo}`,
    irreversible: '작업지시 마감은 되돌릴 수 없습니다. 정정이 필요하면 생산실적을 상계 처리하세요.',
    erp: 'ERP 송신은 별도로 진행되며, 이 확인은 ERP 송신 완료를 의미하지 않습니다.',
    cancel: '취소',
    confirm: '작업지시 마감',
  },
  status: {
    pane: '작업지시 마감 입력 상태',
    heading: '현재 입력 상태',
    loading: '현재 입력 조건을 확인하는 중입니다.',
    complete: '현재 입력 조건이 모두 갖춰졌습니다.',
    blockers: {
      OPEN_SESSION: '열린 작업 세션을 마감하세요.',
      REMAINDER_DISPOSITION_REQUIRED: '잔량 처리 방법을 선택하세요.',
      VARIANCE_REASON_REQUIRED: '변동 사유를 선택하세요.',
    },
  },
  input: {
    pane: '작업지시 마감 입력',
    heading: '마감 입력',
    classification: {
      label: '수량 판정',
      SHORTFALL: '미달',
      EXACT: '정상',
      OVERAGE: '초과',
    },
    exactNote: '수량이 일치하여 추가 사유 입력이 필요하지 않습니다.',
    remainder: {
      legend: '잔량 처리',
      CARRY_OVER: '이월',
      WRITE_OFF: '소멸',
    },
    reason: {
      label: '변동 사유',
      placeholder: '사유를 선택하세요.',
      empty: '선택할 사유가 없습니다.',
    },
  },
  outboundItems: {
    pane: '작업지시 마감 ERP 송신 항목',
    heading: 'ERP 송신 항목',
    group: 'ERP 송신 항목 선택',
    loading: 'ERP 송신 항목 설정을 불러오는 중입니다.',
    empty: {
      title: '설정된 ERP 송신 항목이 없습니다.',
      description: '설정을 다시 불러와 확인하세요.',
    },
    lockedFallback: '이 송신 항목은 변경할 수 없습니다.',
    sendTiming: (note: string): string => `송신 시점: ${note}`,
  },
} as const;
