/**
 * W-CO-15 공장 근무일 설정(003 계획 기반 출고 요청, omf-all-around#66 · US7). 공장마다 주 5일제 · 주 6일제를
 * 고른다. 출고 작업일(생산일의 1근무일 전) 계산에 쓴다.
 */
export const plantWorkingDays = {
  /** 「공장별 근무일」 구획 제목 옆 ⓘ — 머리 아래에 늘 펼쳐 두지 않는다(관리웹 정리 시안 A). 한 문장씩 줄을 바꾼다. */
  description:
    '출고 작업일은 공장별 근무 요일을 기준으로 생산일 직전 근무일로 정합니다.\n공휴일은 별도로 제외하지 않습니다.\n미설정 공장은 주 5일 근무 기준을 적용합니다.',
  tableLabel: '공장별 근무일',
  columns: {
    plant: '공장',
    days: '주간 근무일',
    off: '휴일',
    example: '출고 작업일 예시',
    lastChanged: '최근 변경일',
  },
  options: {
    five: '주 5일제 (월~금)',
    six: '주 6일제 (월~토)',
  },
  groupLabel: (plant: string): string => `${plant} 주간 근무일`,
  /** 0 = 일 … 6 = 토. */
  weekdays: ['일', '월', '화', '수', '목', '금', '토'],
  values: {
    /** 예시 열 — 날짜만. 건너뛴 휴일은 옆 보조 글(사용자 지시 2026-11-26). */
    example: (date: string, weekday: string): string => `${date}(${weekday})`,
    skipped: (days: string): string => `${days} 제외`,
    none: '—',
  },
  /** 제목 옆 ⓘ 설명 앞머리 — 예시 생산일(사용자 지시 2026-11-26). */
  exampleNote: {
    lead: (date: string, weekday: string): string => `예시 생산일 ${date}(${weekday})`,
  },
  tags: {
    changed: '수정',
  },
  actions: {
    revert: '변경 취소',
    save: '저장',
    reload: '다시 불러오기',
  },
  state: {
    saved: '저장했습니다. 이후 만드는 출고 요청부터 적용됩니다.',
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 고치세요.',
    noPlants: '설정할 공장이 없습니다.',
  },
  /** 사용자 관리 화면과 같은 창(사용자 지시 2026-11-24). */
  discard: {
    title: '저장되지 않은 변경 사항',
    body: '저장하지 않고 나가면 변경 사항이 사라집니다.',
    keep: '계속 편집',
    confirm: '저장하지 않고 나가기',
  },
  /** 위 줄 주간 근무일 라벨(사용자 지시 2026-11-24) — 저장된 값으로 거른다. */
  daysFilter: {
    group: '주간 근무일',
    five: '주 5일제',
    six: '주 6일제',
  },
  /** 조회 조건 · 목록 통일 배치(omf-all-around#358) — 상세 상자 없이 목록 하나. */
  workspace: {
    filter: '조회 조건',
    list: '공장 목록',
    search: '공장 이름 검색',
    searchPlaceholder: '공장 이름을 입력하세요',
    apply: '조회',
    clear: '초기화',
    empty: '조건에 맞는 공장이 없습니다.',
  },
};
