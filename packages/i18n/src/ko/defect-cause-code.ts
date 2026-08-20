/**
 * W-06-03 불량·원인코드 2계층 마스터.
 *
 * 불량 코드와 원인 코드는 같은 화면 부품을 쓰므로 문구도 한 벌이다.
 * 탭마다 달라지는 말은 `tabs`·`filters`에만 있고 나머지는 두 탭이 그대로 공유한다 —
 * 탭이 셋으로 늘어도 여기에 항목만 더하면 된다.
 */
export const defectCauseCode = {
  title: '불량·원인코드',
  breadcrumbRoot: '기준정보',
  tabs: {
    defect: '불량코드',
    cause: '원인코드',
  },
  actions: {
    addCategory: '대분류 추가',
    addChild: '상세 추가',
  },
  actionReasons: {
    addChildNeedsCategory: '상세 추가는 대분류를 하나 고른 뒤에 쓸 수 있습니다.',
    parentLockedByChildren:
      '상위 대분류는 하위 코드가 있는 동안 바꿀 수 없습니다. 하위 코드를 다른 대분류로 옮기면 이 항목을 쓸 수 있습니다.',
    deactivateNeedsActive: '사용 중지는 이미 미사용인 코드에는 할 수 없습니다.',
  },
  loading: {
    codes: '코드 목록을 불러오는 중',
    codeDetail: '코드 정보를 불러오는 중',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /** 상위가 목록에 없는 코드를 모으는 그룹. 감추면 사용자는 코드가 사라진 줄 안다. */
  groupHeaderOrphan: '상위를 찾을 수 없는 코드',
  categoryWarning:
    '대분류는 전사에서 공통으로 쓰는 축입니다. 추가하면 모든 현장에서 함께 쓰이므로 신중히 정하세요.',
  parentListProvisional:
    '대분류 목록은 아직 임시입니다. 확정되면 이 항목의 선택지가 바뀔 수 있습니다.',
  empty: {
    codeNoneTitle: '아직 등록된 코드가 없습니다',
    codeNoneDescription: '「대분류 추가」로 첫 대분류를 등록하세요.',
    codeNoMatchTitle: '조건에 맞는 결과가 없습니다',
    codeNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    codeNotSelected: '왼쪽에서 코드를 고르거나 「대분류 추가」로 시작하세요',
  },
  filters: {
    defectSearchLabel: '불량코드 검색',
    defectSearchPlaceholder: '불량코드 또는 불량명',
    causeSearchLabel: '원인코드 검색',
    causeSearchPlaceholder: '원인코드 또는 원인명',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
  },
  fields: {
    code: '코드',
    name: '명칭',
    parent: '상위 대분류',
    isActive: '사용',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    noParent: '없음 (대분류)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (미사용)',
    /** 그룹 머리글 — 대분류의 코드와 명칭을 함께 낸다. */
    groupHeader: (code: string, name: string): string => `${code} · ${name}`,
  },
  validation: {
    required: '필수 입력 항목입니다.',
    codeBlank: '코드는 공백만으로 지정할 수 없습니다.',
    parentSelfReference: '자기 자신을 상위로 지정할 수 없습니다.',
    parentMustBeCategory: '상위는 대분류만 지정할 수 있습니다. 계층은 2단계까지입니다.',
    parentBlockedByChildren: '하위 코드가 있어 상위를 지정할 수 없습니다. 계층은 2단계까지입니다.',
  },
  /** 되돌리기 어려운 액션이라 확인을 한 단계 둔다. 무엇이 일어나는지 먼저 밝힌다. */
  deactivate: {
    title: '사용 중지할까요?',
    description: '삭제하지 않습니다. 사용 중지하면 새 작업에서 고를 수 없게 됩니다.',
    confirm: '사용 중지',
    /*
     * 「표시된 목록 기준」이라고 적는 이유: 목록이 잘렸으면 하위 건수가 실제보다 적을 수 있다.
     * 「N건입니다」라고 단정하면 사실과 다른 안내가 된다.
     */
    childCount: (count: number): string =>
      `이 대분류에는 표시된 목록 기준 하위 상세 코드 ${count}건이 있습니다.`,
  },
} as const;
