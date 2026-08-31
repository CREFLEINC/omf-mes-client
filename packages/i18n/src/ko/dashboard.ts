/**
 * W-CO-05 통합 대시보드 — 경영·생산이 로그인 직후 처음 보는 화면.
 *
 * 이 화면은 **숫자를 모아 보이기만 한다.** 카드마다 소유 화면이 따로 있고, 값이 이상하면
 * 그 화면으로 간다 — 그래서 문구도 「여기서 고친다」가 아니라 「어디로 가면 되는가」를 말한다.
 */
export const dashboard = {
  title: '통합 대시보드',
  breadcrumbRoot: '공통',

  panes: {
    filters: '기준 조건',
    cards: '지표',
    trend: '일일 생산실적 추이',
    alerts: '미처리 알람',
  },

  filters: {
    baseDate: '기준 날짜',
    plant: '공장',
    allPlants: '전체',
    refresh: '갱신',
    /** 자동 갱신이 없다는 사실을 조건 줄에 상시로 적는다 — 없으면 실시간으로 읽는다. */
    manualOnly: '자동으로 갱신되지 않습니다. 최신 값을 보려면 「갱신」을 누르세요.',
    plantLookupFailed: '공장 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    plantLookupTruncated: '공장 목록의 일부만 보입니다. 찾는 공장이 없으면 담당자에게 문의하세요.',
  },

  asOf: {
    /** 서버가 집계를 끝낸 시각이다 — 브라우저가 받은 시각이 아니다. */
    label: (at: string): string => `기준 ${at}`,
    /** 서버가 기준 시각을 주지 않았을 때. 시각을 지어내지 않고 없다는 사실만 적는다. */
    unknown: '집계 기준 시각을 알 수 없습니다.',
    /** 갱신에 실패해도 직전 값을 지우지 않는다 — 회색 화면만 남기지 않는다. */
    stale: (at: string): string => `기준 ${at} · 갱신에 실패해 직전 값을 보이고 있습니다.`,
  },

  cards: {
    /** 값을 낼 수 없는 카드. ⛔ 0으로 그리지 않는다 — 0은 「가동하지 않았다」로 읽힌다. */
    notYet: '아직 없음',
    /** 분모에서 뺀 것이 있는 카드. 뺐다는 사실을 카드 본문에 적는다. */
    excluded: (count: number): string => `${String(count)}건 제외`,
    statusPartial: '일부만 셈',
    statusNotYet: '값 없음',
    deltaUp: (text: string): string => `직전 기준일 대비 ${text} 상승`,
    deltaDown: (text: string): string => `직전 기준일 대비 ${text} 하락`,
    deltaFlat: '직전 기준일과 같음',
    /** 카드를 눌러 소유 화면으로 갈 수 있을 때. */
    openHint: (label: string): string => `${label} 상세 화면으로 이동`,
    /**
     * 어느 카드에서도 아직 상세로 갈 수 없을 때 **구획에 한 번** 적는다.
     * 카드마다 붙이면 같은 문장이 다섯 번 서서 정작 숫자가 안 읽힌다.
     * ⛔ 그럴듯한 주소를 지어내지 않는다 — 지어내면 사용자가 엉뚱한 자리에 도착한다.
     */
    drilldownClosed:
      '아직 카드에서 상세 화면으로 바로 갈 수 없습니다. 왼쪽 메뉴에서 해당 화면을 여세요.',
    empty: '보여 줄 지표가 없습니다. 기준 날짜나 공장을 바꿔 보세요.',
    emptyTitle: '지표 없음',
  },

  trend: {
    target: '목표',
    unitSuffix: (unit: string): string => `단위 ${unit}`,
    emptyTitle: '추이 없음',
    empty: '이 기간에 그릴 생산실적이 없습니다.',
    /** 계약이 추이를 선택 항목으로 두어 아예 오지 않을 수 있다. */
    absent: '생산실적 추이가 이 응답에 오지 않았습니다.',
    detail: '자세히',
  },

  alerts: {
    emptyTitle: '미처리 알람 없음',
    /** 알람 0건은 오류가 아니라 정상 상태다. */
    empty: '지금 확인할 알람이 없습니다.',
    unread: '미확인',
    read: '확인함',
    /** 위치는 계층 텍스트로만 그린다 — 평면 배치·도면 구획을 쓰지 않는다. */
    locationUnknown: '위치 정보 없음',
    emptyMessage: '내용이 비어 있습니다.',
    openCenter: '알림센터',
    openHint: '알림센터에서 이 알람 보기',
  },
} as const;
