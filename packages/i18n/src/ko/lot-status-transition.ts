export const lotStatusTransition = {
  title: 'Lot Status 판정·전이 처리',
  breadcrumbRoot: '품질관리',
  historyNotice: '전이 이력은 별도 이력으로 저장되지 않는다',
  historyLink: 'Lot Status 변경 이력 보기',
  /** 등록·해제 사유는 공통코드 선택지다(§5-4 · G-31). 없으면 지어내지 않고 잠근다(G-2). */
  reason: {
    holdLabel: '보류 사유',
    releaseLabel: '해제 사유',
    placeholder: '사유를 선택하세요',
    required: '사유를 선택하세요.',
    pending: '사유 목록을 불러오는 중입니다.',
    failed: '사유 목록을 불러오지 못했습니다. 목록이 서야 진행할 수 있습니다.',
    truncated: '사유 목록 일부만 받아 진행할 수 없습니다.',
    empty: '등록된 사유 값이 없습니다. 공통코드에 값이 서야 진행할 수 있습니다.',
    /** 화면이 저장을 막는 이유 — 선택지에 없는 값은 보내지 않는다. */
    unknown: '선택지에 없는 사유입니다. 다시 고르세요.',
  },
} as const;
