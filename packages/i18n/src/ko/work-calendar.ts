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
    editCalendar: '캘린더 수정',
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
  /**
   * 달력 그리드. **날짜 선택기가 아니라 한 달을 펼쳐 칸마다 상태를 칠하는 자리**다(스펙 §5).
   */
  grid: {
    title: '일자 설정',
    loading: '일자 설정을 불러오는 중',
    /** ⛔ 캘린더를 고르기 전에는 그릴 것이 없다 — 빈 달력을 세우지 않는다. */
    pickCalendar: '왼쪽에서 캘린더를 고르면 그 달의 일자 설정이 여기 보입니다.',
    monthLabel: (year: number, month: number): string => `${year}년 ${month}월`,
    previousMonth: '이전 달',
    nextMonth: '다음 달',
    thisMonth: '이번 달',
    loadFailed: '일자 설정을 불러오지 못했습니다.',
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
    /**
     * ⭐ **네 갈래를 서로 다른 말로 그린다.** 계약은 설정이 있는 날만 내려 주므로,
     * 받지 않은 날을 「가동」으로 그리면 **실제로 쉬는 날이 일하는 날로 보인다**(G-9).
     */
    status: {
      unset: '미설정',
      working: '가동',
      holiday: '휴무',
      partial: '부분 가동',
    },
  },
  retire: {
    title: '캘린더를 사용 중지할까요?',
    target: (label: string): string => `${label} 을(를) 사용 중지합니다.`,
    /**
     * ⭐ **참조가 있으면 건수를 함께 보인 뒤 부른다**(계약 주석 · 공유계약 B-4).
     * 물리 삭제가 없는 자원이라 「몇이 이 캘린더를 따르는가」가 판단의 근거다.
     */
    applicationCount: (count: number): string =>
      `${count}곳이 이 캘린더를 따르고 있습니다. 중지하면 그 대상들이 상위 층을 따르게 됩니다.`,
    applicationNone: '이 캘린더를 따르는 대상이 없습니다.',
    /** ⛔ **모르는 것을 「없다」로 그리지 않는다**(공유계약 G-9). */
    applicationUnknown: '이 캘린더를 따르는 대상의 수를 아직 불러오지 못했습니다.',
    /** 중지해도 일자 설정은 그대로다 — 감추는 것과 지우는 것은 다르다. */
    impact: '이 캘린더에 넣은 일자 설정은 그대로 남고, 새로 고를 때만 목록에서 빠집니다.',
    notReversibleHere:
      '삭제하지 않습니다. 다만 이 화면에는 다시 켜는 수단이 없어, 되돌리려면 담당자에게 요청해야 합니다.',
    confirm: '사용 중지',
    /** ⛔ 모르면 잠근다 — 열어 두면 눌러도 아무 일도 일어나지 않는다. */
    targetUnknown: '캘린더 정보를 아직 불러오지 못했습니다.',
    alreadyInactive: '이미 사용 중지된 캘린더입니다.',
  },
  validation: {
    required: '필수 항목입니다.',
    codeBlank: '공백만으로는 캘린더 코드를 만들 수 없습니다.',
  },
} as const;
