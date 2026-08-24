/**
 * W-05-11 계측기 마스터 관리.
 *
 * ⭐ **계측기는 설비의 한 종류다** — 계약도 화면도 같은 자원을 쓰고 `equipmentTypeCode` 가
 * 가른다(스펙 §3-2). 그래서 문구만 「계측기」의 말을 쓴다.
 */
export const gaugeMaster = {
  title: '계측기 마스터 관리',
  breadcrumbRoot: '설비/툴',
  actions: {
    addGauge: '계측기 등록',
  },
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
   * ⚠ **유형을 고르기 «전»에는 계측기만 가려낼 수 없다.**
   *
   * 계약의 `equipmentTypeCode` 가 **값 하나만** 받아, 계측기 세 유형을 한 번에 거를 수단이
   * 없다(설계 질의 `omf-mes#195` 회신으로 값 목록은 확정됐다 — 남은 것은 거르는 수단이다).
   *
   * ⛔ **화면이 받아 온 것을 걸러 감추지 않는다.** 목록은 서버가 잘라 주는데, 그 안에서
   * 화면이 다시 걸러 내면 「이 공장에 계측기가 셋뿐」처럼 보이면서 실제로는 잘린 뒤쪽에
   * 더 있을 수 있다. **감추는 대신 밝힌다**(G-2).
   */
  typeFilterUnavailable:
    '유형을 고르기 전에는 계측기가 아닌 설비도 함께 보입니다. 계측기만 보려면 유형을 고르세요.',
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
  form: {
    typePlaceholder: '계측기 유형을 고르세요',
    createTitle: '계측기 등록',
    editTitle: '계측기 수정',
    plantPlaceholder: '공장을 고르세요',
    cyclePlaceholder: '주기 단위를 고르세요',
    uomPlaceholder: '단위를 고르세요',
  },
  /** ⭐ 감추지 않고 「왜 여기서 못 하는지」를 말한다(공유계약 G-2). */
  actionReasons: {
    plantFixed: '공장은 등록할 때 정해지며 이 화면에서 옮길 수 없습니다.',
    cycleNeedsCalibration: '검교정 대상으로 지정하면 주기를 입력할 수 있습니다.',
    statusOwnedElsewhere: '운용상태는 사용 중지·폐기 처리로 바뀝니다.',
    calibrationDateOwnedElsewhere: '검교정 일자는 검교정 이력 등록에서 정합니다.',
    alreadyInactive: '이미 사용 중지된 계측기입니다.',
    /** ⛔ 모르면 잠근다 — 열어 두면 눌러도 아무 일도 일어나지 않는다. */
    targetUnknown: '계측기 정보를 아직 불러오지 못했습니다.',
    alreadyDisposed: '이미 폐기된 계측기입니다.',
    /**
     * ⚠ 자산 상태 값 목록에 폐기 코드가 없으면 **이미 폐기된 자산인지 판정할 수 없다.**
     * 판정 없이 버튼을 열면 이미 끝난 자산에도 눌리는 컨트롤이 된다. 시드가 들어오면
     * 이 잠금은 저절로 풀린다(설계 `omf-mes#182`).
     */
    disposeUnavailable: '자산 상태 값 목록이 아직 준비되지 않아 폐기 처리를 할 수 없습니다.',
  },
  retire: {
    deactivateTitle: '계측기를 사용 중지할까요?',
    /** 중지해도 그 계측기가 남긴 검교정 기록은 그대로다 — 감추는 것과 지우는 것은 다르다. */
    deactivateImpact:
      '이 계측기가 남긴 검교정 기록은 그대로 남고, 새로 고를 때만 목록에서 빠집니다.',
    deactivateNotReversibleHere:
      '삭제하지 않습니다. 다만 이 화면에는 다시 켜는 수단이 없어, 되돌리려면 담당자에게 요청해야 합니다.',
    deactivateConfirm: '사용 중지',
    disposeTitle: '폐기 처리할까요?',
    /** 사용 중지와 «다른 축» 이다 — 그것은 감추는 것이고 이것은 자산이 끝난 것이다. */
    disposeImpact:
      '사용 중지와 다른 처리입니다. 사용 중지는 목록에서 감추는 것이고, 폐기는 자산이 끝난 것입니다.',
    disposeNotReversible: '되돌릴 수 없습니다. 폐기한 뒤에는 다시 불러와도 편집이 풀리지 않습니다.',
    disposeConfirm: '폐기 처리',
    target: (label: string): string => `${label} 을(를) 처리합니다.`,
    deactivateTarget: (label: string): string => `${label} 을(를) 사용 중지합니다.`,
    disposeTarget: (label: string): string => `${label} 을(를) 폐기 처리합니다.`,
  },
  fields: {
    plant: '공장',
    calibrationRequired: '검교정 대상',
    calibrationCycleType: '검교정 주기 단위',
    calibrationCycleInterval: '검교정 주기 간격',
    precisionValue: '정밀도',
    precisionUom: '정밀도 단위',
    lastCalibrationDate: '최근 검교정일',
    calibrationDueDate: '차기 검교정 예정일',
    notRecorded: '기록 없음',
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
  history: {
    title: '검교정 이력',
    loading: '검교정 이력을 불러오는 중',
    /** ⭐ 이 화면은 이력을 **읽기만 한다** — 등록은 검교정 이력 등록 화면의 몫이다. */
    readOnlyNote: '검교정 이력은 검교정 이력 등록에서 남깁니다. 여기서는 볼 수만 있습니다.',
    emptyTitle: '검교정 이력이 없습니다',
    emptyDescription: '검교정을 하고 이력을 남기면 여기에 나타납니다.',
    loadFailed: '검교정 이력을 불러오지 못했습니다.',
    /**
     * ⛔ **「최근」이라 말하지 않는다.** 계약에 정렬 조건이 없어 **어느 20건을 받았는지
     * 화면이 알 수 없다.** 「최근 20건」이라 쓰면 그 20건이 최신이라고 단언하는 것이 되고,
     * 서버가 오래된 것부터 준다면 그 말은 거짓이다. 화면은 받은 것을 세어 말할 뿐이다.
     */
    truncated: (shown: number, total: number): string =>
      `전체 ${total}건 중 ${shown}건을 표시합니다. 전체는 검교정 이력 화면에서 확인하세요.`,
    /** ⛔ 「다 보여 주고 있다」고 말하지 않는다 — 이 응답만으로는 알 수 없다. */
    mayHaveMore: (shown: number): string => `${shown}건을 표시합니다. 더 있을 수 있습니다.`,
    fields: {
      performedOn: '실시일',
      historyType: '구분',
      result: '결과',
      nextDueOn: '차기 예정일',
      agency: '검교정 기관',
      certificateNo: '성적서 번호',
    },
  },
  validation: {
    required: '필수 항목입니다.',
    codeBlank: '공백만으로는 계측기번호를 만들 수 없습니다.',
    /** ⭐ 짝 제약 — 하나만으로는 다음 예정일을 셀 수 없다 */
    cycleRequired: '검교정 대상이면 주기 단위와 간격을 함께 입력하세요.',
    intervalPositiveInteger: '주기 간격은 1 이상의 정수로 입력하세요.',
    precisionUomRequired: '정밀도 값을 입력했으면 단위도 고르세요.',
    precisionValueRequired: '단위를 골랐으면 정밀도 값도 입력하세요.',
    precisionPositive: '정밀도는 0보다 큰 수로 입력하세요.',
    precisionScale: (scale: number): string =>
      scale === 0
        ? '고른 단위는 소수점 아래 자리를 쓰지 않습니다.'
        : `고른 단위는 소수점 아래 ${scale}자리까지 쓸 수 있습니다.`,
  },
} as const;
