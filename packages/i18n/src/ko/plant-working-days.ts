/**
 * W-CO-15 공장 근무일 설정(003 계획 기반 출고 요청, omf-all-around#66 · US7). 공장마다 주 5일제 · 주 6일제를
 * 고른다. 출고 작업일(생산일의 1근무일 전) 계산에 쓴다.
 */
export const plantWorkingDays = {
  /* 설계 W-CO-15 · 사이드바와 같은 글자다. */
  title: '공장 근무일 설정',
  breadcrumbRoot: '시스템 관리',
  description:
    '출고 작업일(생산일에서 근무일 1일 전)을 셀 때 쓰는 공장별 주간 근무일입니다. 주말만 빼고 셉니다 — 공휴일과 근무달력은 쓰지 않습니다.',
  intro:
    '바꾼 설정은 이후 만드는 출고 요청부터 적용합니다. 이미 만든 요청의 출고 작업일은 그대로입니다. 설정하지 않은 공장은 주 5일제로 계산합니다.',
  tableLabel: '공장별 근무일',
  columns: {
    plant: '공장',
    days: '주간 근무일',
    off: '휴일',
    example: (date: string, weekday: string): string =>
      `예: 생산일 ${date}(${weekday})의 출고 작업일`,
    lastChanged: '마지막 변경',
  },
  options: {
    five: '주 5일제 (월~금)',
    six: '주 6일제 (월~토)',
  },
  groupLabel: (plant: string): string => `${plant} 주간 근무일`,
  /** 0 = 일 … 6 = 토. */
  weekdays: ['일', '월', '화', '수', '목', '금', '토'],
  values: {
    /** 예시 열 — 건너뛴 휴일을 함께 보인다. */
    example: (date: string, weekday: string, skipped: string): string =>
      skipped === '' ? `${date}(${weekday})` : `${date}(${weekday}) — ${skipped}을 건너뜀`,
    lastChanged: (date: string): string => `${date}부터 적용`,
    none: '—',
  },
  tags: {
    default: '기본값',
    changed: '바뀜',
  },
  actions: {
    revert: '되돌리기',
    save: '저장',
    reload: '다시 불러오기',
  },
  state: {
    saved: '저장했습니다. 이후 만드는 출고 요청부터 적용합니다',
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 고치세요.',
    noPlants: '설정할 공장이 없습니다.',
  },
  discard: {
    title: '저장하지 않은 변경이 있습니다',
    body: '지금 옮기면 바꾼 근무일이 저장되지 않고 사라집니다. 남기려면 「계속 편집」을 누른 뒤 저장하세요.',
  },
};
