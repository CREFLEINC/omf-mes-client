export const workOrderRelease = {
  candidateList: {
    pane: '배포 후보 작업지시 목록',
    fields: { workOrderNo: 'W/O 번호', item: '품목', quantity: '지시 수량' },
    actions: { select: (workOrderNo: string): string => `${workOrderNo} 선택` },
    values: { missingItem: '품목 표시명 없음' },
    loading: '배포 후보 작업지시 목록을 불러오는 중입니다.',
    empty: {
      title: '배포 후보 작업지시가 없습니다.',
      description: '다른 쪽으로 이동해 다시 확인하세요.',
      beyondTitle: '현재 쪽에 배포 후보 작업지시가 없습니다.',
      beyondDescription: '첫 쪽 또는 이전 쪽으로 이동해 다시 확인하세요.',
    },
  },
  pane: '작업지시 배포 전 확인',
  heading: (workOrderNo: string): string => `선택한 W/O — ${workOrderNo}`,
  empty: {
    notSelectedTitle: '배포할 작업지시를 선택하세요.',
    notSelectedDescription: '목록에서 작업지시를 선택하면 정적 확인 결과를 볼 수 있습니다.',
  },
  status: {
    staticPassed: '정적 확인을 통과했습니다. 남은 입력 조건은 계속 확인하세요.',
    alreadyReleased: '이미 배포된 작업지시입니다. 다시 배포할 수 없습니다.',
    validationBlocked: '검증 결과의 차단 항목을 해결한 뒤 다시 확인하세요.',
    validationUnavailable:
      '검증 결과를 불러올 수 없습니다. 다시 선택하거나 새로고침한 뒤 계속하세요.',
  },
  locations: {
    missingTitle: '기본 위치가 누락됨',
    missingDescription: '다음 기본 위치가 설정되지 않았습니다.',
    wip: 'WIP 위치',
    finishedGoods: '완제품 위치',
    scrap: '스크랩 위치',
  },
} as const;
