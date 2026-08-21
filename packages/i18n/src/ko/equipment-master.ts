/**
 * W-05-12 설비·설비그룹 마스터.
 *
 * ⭐ **화면은 「설비 그룹」이라고 부른다.** 계약의 설비 응답이 소속 그룹을 `productionLineId`
 * 라는 이름으로 내리지만 그것은 저장처의 이름이고, 사용자가 쓰는 말이 아니다. 필드 이름과
 * 화면 용어가 어긋나는 자리는 `mappers.ts` 한 곳으로 모은다.
 */
export const equipmentMaster = {
  title: '설비·설비그룹 마스터',
  breadcrumbRoot: '설비/툴',
  actions: {
    addGroup: '그룹 추가',
  },
  loading: {
    groups: '설비 그룹을 불러오는 중',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    groupNoneTitle: '아직 등록된 설비 그룹이 없습니다',
    groupNoneDescription: '설비 그룹을 먼저 등록해야 설비를 그 아래에 둘 수 있습니다.',
    groupNoMatchTitle: '조건에 맞는 결과가 없습니다',
    groupNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    groupNotSelected: '좌측에서 설비 그룹을 먼저 고르세요',
  },
  filters: {
    searchLabel: '설비 그룹 검색',
    searchPlaceholder: '그룹코드 또는 그룹명',
    plantAll: '전체 공장',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemovePlant: '공장 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipPlant: (label: string): string => `공장: ${label}`,
  },
  fields: {
    plant: '공장',
    groupCode: '그룹코드',
    groupName: '그룹명',
    groupType: '그룹유형',
    parentGroup: '상위그룹',
    isActive: '사용',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    noParent: '없음 (최상위)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (미사용)',
  },
  groupTable: {
    expand: '하위 그룹 펼치기',
    collapse: '하위 그룹 접기',
  },
} as const;
