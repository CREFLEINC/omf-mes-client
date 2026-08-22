/**
 * W-05-13 툴/금형/지그 마스터 관리.
 *
 * ⭐ **테이블 이름은 금형이지만 담는 것은 모든 도구다** — 금형·지그·그 밖의 도구를
 * `toolTypeCode` 가 가른다(스펙 §3). 그래서 문구는 「툴」의 말을 쓴다.
 */
export const toolMaster = {
  title: '툴/금형/지그 마스터 관리',
  breadcrumbRoot: '설비/툴',
  actions: {
    addTool: '툴 등록',
  },
  loading: {
    tools: '툴 목록을 불러오는 중',
  },
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    noneTitle: '등록된 툴이 없습니다',
    noneDescription: '툴을 등록하면 여기에 나타납니다.',
    noMatchTitle: '조건에 맞는 툴이 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
  },
  filters: {
    searchLabel: '툴 검색',
    searchPlaceholder: '툴코드 또는 툴명',
    plantAll: '전체 공장',
    typeAll: '전체 유형',
    /** ⭐ 적정타수가 비면 사용 가능 타수도 초과율도 셀 수 없다 — **채울 것을 세는 자리**다. */
    guaranteedMissingOnly: '적정타수 없는 것만',
    pmDueOnly: '예방보전 도래만',
    sortLabel: '정렬',
    sort: {
      shotUsageDesc: '초과율 높은 순',
      nextPmAsc: '다음 예정일 이른 순',
      code: '코드 순',
    },
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemovePlant: '공장 조건 제거',
    chipRemoveType: '유형 조건 제거',
    chipRemoveGuaranteedMissing: '적정타수 없는 것만 조건 제거',
    chipRemovePmDue: '예방보전 도래만 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipPlant: (label: string): string => `공장: ${label}`,
    chipType: (label: string): string => `유형: ${label}`,
  },
  fields: {
    toolCode: '툴코드',
    toolName: '툴명',
    toolType: '도구 유형',
    plant: '공장',
    status: '운용상태',
    pm: '예방보전',
    availableShotCount: '사용 가능 타수',
    shotUsageRatio: '초과율',
    cavityCount: '캐비티 수',
    guaranteedShotCount: '적정타수',
    currentShotCount: '누계 타발수',
    pmTriggerType: '예방보전 판정 기준',
    pmCycleInterval: '예방보전 주기 간격',
    pmCycleUnit: '예방보전 주기 단위',
    lastPmDate: '마지막 예방보전일',
    nextPmDate: '다음 예방보전 예정일',
    labelIssueCount: '발행한 라벨 회차',
    notRecorded: '기록 없음',
  },
  form: {
    createTitle: '툴 등록',
    editTitle: '툴 수정',
    plantPlaceholder: '공장을 고르세요',
    typePlaceholder: '도구 유형을 고르세요',
    cycleUnitPlaceholder: '주기 단위를 고르세요',
    labelIssued: (count: number): string => `${count}회`,
  },
  /**
   * 예방보전을 무엇으로 판정하는가. **계약이 네 값과 뜻을 함께 못박았다** — 화면이 지어낸
   * 값이 아니라 계약의 말을 옮긴 것이다.
   */
  pmTrigger: {
    shot: '타발수',
    date: '날짜',
    both: '타발수와 날짜',
    none: '하지 않음',
  },
  /** 날짜 주기의 단위. 계약이 두 값만 받는다. */
  pmCycleUnit: {
    day: '일',
    month: '개월',
  },
  retire: {
    deactivateTitle: '툴을 사용 중지할까요?',
    /** 중지해도 그 툴이 남긴 실적은 그대로다 — 감추는 것과 지우는 것은 다르다. */
    deactivateImpact: '이 툴이 남긴 실적은 그대로 남고, 새로 고를 때만 목록에서 빠집니다.',
    deactivateNotReversibleHere:
      '삭제하지 않습니다. 다만 이 화면에는 다시 켜는 수단이 없어, 되돌리려면 담당자에게 요청해야 합니다.',
    deactivateConfirm: '사용 중지',
    deactivateTarget: (label: string): string => `${label} 을(를) 사용 중지합니다.`,
    disposeTitle: '폐기 처리할까요?',
    /** 사용 중지와 «다른 축» 이다 — 그것은 감추는 것이고 이것은 자산이 끝난 것이다. */
    disposeImpact:
      '사용 중지와 다른 처리입니다. 사용 중지는 목록에서 감추는 것이고, 폐기는 자산이 끝난 것입니다.',
    disposeNotReversible: '되돌릴 수 없습니다. 폐기한 뒤에는 다시 불러와도 편집이 풀리지 않습니다.',
    disposeConfirm: '폐기 처리',
    disposeTarget: (label: string): string => `${label} 을(를) 폐기 처리합니다.`,
    /**
     * ⭐ **참조가 있으면 건수를 함께 보인 뒤 부른다**(계약 주석 · 공유계약 B-4).
     * 물리 삭제가 없는 자원이라 「몇이 이 툴에 매여 있는가」가 판단의 근거다.
     */
    referenceCount: (count: number): string => `이 툴을 참조하는 자료가 ${count}건 있습니다.`,
    referenceNone: '이 툴을 참조하는 자료는 없습니다.',
    /** ⛔ **모르는 것을 「없다」로 그리지 않는다**(공유계약 G-9). */
    referenceUnknown: '이 툴을 참조하는 자료의 건수는 셀 수 없습니다.',
    /** 라벨은 시스템 밖으로 나간 것이라 참조 건수와 다른 사실이다. */
    labelIssued: (count: number): string =>
      `이 툴의 라벨이 ${count}회 발행돼 현장에 나가 있습니다.`,
  },
  /** ⭐ 감추지 않고 「왜 여기서 못 하는지」를 말한다(공유계약 G-2). */
  actionReasons: {
    plantFixed: '공장은 등록할 때 정해지며 이 화면에서 옮길 수 없습니다.',
    cycleNeedsDateAxis: '판정 기준에 날짜를 넣으면 주기를 입력할 수 있습니다.',
    statusOwnedElsewhere: '운용상태는 사용 중지·폐기 처리로 바뀝니다.',
    /** ⭐ 스펙 §6 의 첫 항목 — 여기서 손으로 고칠 수 있으면 실적과 마스터가 조용히 어긋난다. */
    shotCountOwnedElsewhere:
      '누계 타발수는 툴 사용실적 입력이 더하고, 툴 예방보전 실적 등록이 되돌립니다.',
    pmDateOwnedElsewhere: '마지막 예방보전일은 툴 예방보전 실적 등록에서 정합니다.',
    alreadyInactive: '이미 사용 중지된 툴입니다.',
    alreadyDisposed: '이미 폐기된 툴입니다.',
    /** ⛔ 모르면 잠근다 — 열어 두면 눌러도 아무 일도 일어나지 않는다. */
    targetUnknown: '툴 정보를 아직 불러오지 못했습니다.',
    /**
     * ⚠ 자산 상태 값 목록에 폐기 코드가 없으면 **이미 폐기된 자산인지 판정할 수 없다.**
     * 판정 없이 버튼을 열면 이미 끝난 자산에도 눌리는 컨트롤이 된다. 시드가 들어오면
     * 이 잠금은 저절로 풀린다(설계 `omf-mes#182`).
     */
    disposeUnavailable: '자산 상태 값 목록이 아직 준비되지 않아 폐기 처리를 할 수 없습니다.',
  },
  notes: {
    /**
     * ⚠ 도구 유형 값 목록이 아직 없어(추적 `omf-mes#145`) **어느 코드가 금형인지 화면이
     * 판정할 수 없다.** 잠그는 대신 뜻을 밝힌다 — 값 목록이 들어오면 잠글 수 있다.
     */
    cavityMeaningfulForMold: '캐비티 수는 금형에서만 뜻이 있습니다.',
    /**
     * ⭐ **막지 않고 알린다.** 「적정타수 없는 것만」 조회 조건이 있다는 것은 이 상태로 저장하는
     * 것을 **업무가 허용한다**는 뜻이다 — 막으면 나중에 채우는 길이 사라진다.
     */
    guaranteedMissingBlocksShotAxis:
      '적정타수가 비어 있으면 사용 가능 타수와 초과율을 셀 수 없고, 타발수로는 예방보전이 도래하지 않습니다.',
  },
  validation: {
    required: '필수 항목입니다.',
    codeBlank: '공백만으로는 툴코드를 만들 수 없습니다.',
    cavityPositiveInteger: '캐비티 수는 1 이상의 정수로 입력하세요.',
    /** ⛔ 0 을 받지 않는다 — 적정타수 0 은 「없음」이 아니라 「이미 다 썼다」로 셈된다. */
    guaranteedPositiveInteger: '적정타수는 1 이상의 정수로 입력하세요. 없으면 비워 두세요.',
    cycleRequired: '판정 기준에 날짜를 넣었으면 주기 간격과 단위를 함께 입력하세요.',
    intervalPositiveInteger: '주기 간격은 1 이상의 정수로 입력하세요.',
  },
  values: {
    /**
     * ⭐ 미사용 표식은 **칸이 아니라 이름에 붙는다.** 목록에 칸을 하나 더 두면 표가 하한을
     * 넘겨 짓눌리는데(`docs/layout-conventions.md`), 「미사용 포함」을 켰을 때 어느 것이
     * 미사용인지는 **반드시 보여야 한다** — 보이지 않으면 그 조건이 아무 뜻도 갖지 못한다.
     */
    inactiveSuffix: ' (미사용)',
  },
  /**
   * ⭐ 타수를 세 모양으로 그린다.
   *
   * ⛔ **없는 값을 0 으로 채우지 않는다.** 사용 가능 타수 0 은 「지금 다 썼다」는 뜻이라
   * 예방보전이 즉시 도래한 것처럼 보인다 — 값이 없는 것과 0 인 것은 다른 사실이다(G-9).
   * ⭐ **못 세는 이유가 「적정타수가 비어서」이면 그렇게 말한다** — 그것은 채워야 할 것이고,
   * 「산출 불가」로만 적으면 사용자가 무엇을 하면 되는지 알 수 없다.
   */
  shots: {
    guaranteedMissing: '적정타수 없음',
    notCalculable: '산출 불가',
    percent: (ratio: string): string => `${ratio}%`,
  },
  /**
   * ⭐ 예방보전을 네 모양으로 그린다(공유계약 G-13 의 확장).
   *
   * ⛔ **「판정 없음」과 「도래 전」은 다른 말이어야 한다** — 앞은 모르는 것이고 뒤는 정상이다.
   * 모르는 것을 정상으로 그리면 도래한 툴이 정상으로 보인다(G-9).
   * ⛔ **「대상 아님」도 정상과 가른다** — 예방보전을 하지 않기로 한 툴은 셀 것이 없다.
   */
  pm: {
    notRequired: '대상 아님',
    due: '도래',
    /** 무엇이 「예방보전」인지는 칸 이름이 말한다 — 배지가 되풀이하면 표가 그만큼 넓어진다. */
    dueByAxis: (axis: string): string => `${axis} 도래`,
    beforeDue: '도래 전',
    unknown: '판정 없음',
    axis: {
      shot: '타발수',
      date: '날짜',
    },
  },
} as const;
