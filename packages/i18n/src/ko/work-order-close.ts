export const workOrderClose = {
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
