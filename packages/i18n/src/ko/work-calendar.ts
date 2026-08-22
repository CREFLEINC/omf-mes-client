/**
 * W-05-09 작업 캘린더 설정.
 *
 * ⭐ **날짜 선택기가 아니다** — 한 달을 펼쳐 칸마다 상태를 칠하는 **편집 그리드**다(스펙 §5).
 */
export const workCalendar = {
  title: '작업 캘린더 설정',
  breadcrumbRoot: '설비/툴',
  actions: {
    addCalendar: '캘린더 등록',
  },
  loading: {
    calendars: '캘린더 목록을 불러오는 중',
  },
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  empty: {
    noneTitle: '등록된 캘린더가 없습니다',
    noneDescription: '캘린더를 등록하면 여기에 나타납니다.',
    noMatchTitle: '조건에 맞는 캘린더가 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
  },
  filters: {
    searchLabel: '캘린더 검색',
    searchPlaceholder: '캘린더 코드 또는 이름',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
  },
  fields: {
    calendarCode: '캘린더 코드',
    calendarName: '캘린더 이름',
    isActive: '사용',
    applicationCount: '따르는 대상',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
  },
  form: {
    createTitle: '캘린더 등록',
    editTitle: '캘린더 수정',
    /** ⭐ 「몇이 이 캘린더를 따르는가」 — 사용 중지 판단의 근거가 되는 값이다. */
    applicationCount: (count: number): string => `${count}곳`,
    applicationNone: '따르는 대상이 없습니다.',
    /** ⛔ 모르는 것을 「0곳」으로 그리지 않는다 — 아직 안 불러온 것과 없는 것은 다르다(G-9). */
    applicationUnknown: '아직 불러오지 못했습니다.',
  },
  validation: {
    required: '필수 항목입니다.',
    codeBlank: '공백만으로는 캘린더 코드를 만들 수 없습니다.',
  },
} as const;
