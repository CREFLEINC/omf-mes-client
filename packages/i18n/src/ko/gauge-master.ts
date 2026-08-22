/**
 * W-05-11 계측기 마스터 관리.
 *
 * ⭐ **계측기는 설비의 한 종류다** — 계약도 화면도 같은 자원을 쓰고 `equipmentTypeCode` 가
 * 가른다(스펙 §3-2). 그래서 문구만 「계측기」의 말을 쓴다.
 */
export const gaugeMaster = {
  title: '계측기 마스터 관리',
  breadcrumbRoot: '설비/툴',
  loading: {
    gauges: '계측기 목록을 불러오는 중',
  },
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /**
   * ⚠ 밀림 조건은 화면이 걸고, 서버가 목록을 자르면 **받아 온 것만** 덮는다.
   * 그 사실을 감추면 잘려 나간 쪽의 밀린 계측기가 없는 것처럼 보인다.
   */
  overdueOnLoadedOnly:
    '검교정 밀림 조건은 지금 불러온 목록에만 적용됩니다. 잘린 부분에 밀린 계측기가 더 있을 수 있으니 조건을 좁혀 조회하세요.',
  /**
   * ⚠ 계측기 유형 값 목록이 아직 없어 계측기만 가려낼 수 없다(설계 질의 `omf-mes#195`).
   * **감추지 않고 밝힌다** — 지금 보이는 것이 계측기만은 아니라는 사실을 알고 써야 한다.
   */
  typeFilterUnavailable:
    '계측기 유형 목록이 아직 준비되지 않아 전체 설비를 보이고 있습니다. 목록이 준비되면 계측기만 보입니다.',
  empty: {
    noneTitle: '등록된 계측기가 없습니다',
    noneDescription: '계측기를 등록하면 여기에 나타납니다.',
    noMatchTitle: '조건에 맞는 계측기가 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
  },
  filters: {
    searchLabel: '계측기 검색',
    searchPlaceholder: '계측기번호 또는 계측기명',
    plantAll: '전체 공장',
    typeAll: '전체 유형',
    /** 「아직 안 함」과 「만료」를 함께 잡는다 — 둘 다 채워야 할 것이다. */
    overdueOnly: '검교정 밀린 것만',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemovePlant: '공장 조건 제거',
    chipRemoveType: '유형 조건 제거',
    chipRemoveOverdue: '검교정 밀림 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipRemoveIncludeDisposed: '폐기 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipPlant: (label: string): string => `공장: ${label}`,
    chipType: (label: string): string => `유형: ${label}`,
    includeDisposed: '폐기 포함',
  },
  fields: {
    plant: '공장',
    gaugeCode: '계측기번호',
    gaugeName: '계측기명',
    gaugeType: '계측기 유형',
    status: '운용상태',
    calibration: '검교정',
    isActive: '사용',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    inactiveSuffix: ' (미사용)',
  },
  /**
   * ⭐ 검교정을 네 모양으로 그린다(스펙 §5-5 · 공유계약 G-13 확장).
   *
   * ⛔ **「아직 안 함」과 「대상 아님」은 다른 말이어야 한다** — 앞은 채워야 할 것이고
   * 뒤는 정상이다. 같은 말로 그리면 채워야 할 것이 정상으로 보인다.
   */
  calibration: {
    notRequired: '검교정 대상 아님',
    never: '검교정 이력 없음',
    valid: (days: number): string => (days === 0 ? '오늘까지 유효' : `${days}일 남음`),
    expired: (days: number): string => `만료 — ${days}일 경과`,
  },
} as const;
