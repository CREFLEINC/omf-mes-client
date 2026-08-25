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
    addEquipment: '설비 추가',
    disposeEquipment: '폐기 처리',
    keepEditing: '계속 편집',
    discardChanges: '변경 버리기',
  },
  actionReasons: {
    plantFixedAfterCreate:
      '등록 후에는 공장을 바꿀 수 없습니다. 다른 공장이면 그룹을 새로 등록하세요.',
    /** 상위 그룹 선택지에서 자기 자신과 하위를 뺀 이유. 고를 수 없는 값이 있다는 사실을 밝힌다. */
    parentExcludesSelfAndDescendants:
      '자기 자신과 하위 그룹은 상위로 고를 수 없습니다. 순환이 생깁니다.',
    /**
     * 사용 중지는 상세를 다시 불러오므로, 저장하지 않은 입력이 있으면 그것이 말없이 사라진다.
     * 막지 않고 사유를 밝힌다 — 무엇이 막혔는지와 어떻게 풀 수 있는지를 함께 담는다.
     */
    /**
     * 검교정 주기를 이 화면이 정하지 않는 이유. 계측기 마스터(W-05-11)가 소유한다
     * — `lastCalibrationDate` 와 같은 자리다(공유계약 B-13 · 설계 `omf-mes#188`).
     */
    calibrationCycleOwnedElsewhere:
      '검교정 주기는 계측기 마스터에서 정합니다. 여기서는 볼 수만 있습니다.',
    /**
     * 주기 없이 검교정 대상을 켤 수 없는 이유. 계약이 「참이면 주기 두 칸이 함께 필요하다」로
     * 짝을 묶었는데 주기는 이 화면이 정하지 않는다 — 켜 두면 저장에서 거절당한다.
     */
    calibrationNeedsCycle:
      '검교정 주기가 없어 켤 수 없습니다. 주기를 계측기 마스터에서 먼저 정하세요.',
    /** 검교정 일자 두 칸은 검교정 이력 등록이 정한다 — 여기서는 결과만 본다. */
    calibrationDatesReadOnly:
      '검교정 일자는 검교정 이력 등록에서 정해집니다. 여기서는 볼 수만 있습니다.',
    /** 운용 상태는 별도 경로가 바꾼다 — 폐기와 사용 중지가 서로 다른 축이다. */
    statusNotEditableHere: '운용 상태는 폐기 처리로만 바뀝니다. 사용 중지와는 다른 축입니다.',
    /**
     * 상세가 아직 오지 않았거나 오지 못했을 때. **모르면 잠근다** —
     * 열어 두면 사용자가 고친 값이 저장 시점에야 거부되고, 그 사유는 여기서 말할 수 없다.
     */
    codeLockUnknown: '설비 정보를 아직 불러오지 못해 코드를 바꿀 수 없습니다.',
    equipmentPlantFixed: '설비의 공장은 소속 그룹의 공장을 따릅니다.',
    /**
     * ⚠ 폐기를 지금 쓸 수 없는 이유. 자산 수명주기 상태의 값 목록도 그 공통코드 그룹 이름도
     * 아직 없어(설계 질의 omf-mes#185) **이미 폐기된 자산인지 화면이 판정할 수 없다** —
     * 판정 없이 버튼을 열면 이미 끝난 자산에도 눌리는 컨트롤이 된다.
     */
    /**
     * ⚠ 시드가 아직 들어가지 않아 값 목록이 빌 수 있다(설계 `omf-mes#182`).
     * 그때 감추지 않고 비활성 + 사유로 둔다(G-2) — 목록이 들어오면 이 잠금은 저절로 풀린다.
     */
    disposeUnavailable:
      '자산 상태의 값 목록을 아직 불러오지 못해 폐기를 쓸 수 없습니다. 목록이 준비되면 이 버튼을 쓸 수 있습니다.',
    deactivateNeedsCleanForm:
      '사용 중지는 저장하지 않은 변경이 있으면 쓸 수 없습니다. 먼저 저장하거나 취소하세요.',
  },
  loading: {
    groups: '설비 그룹을 불러오는 중',
    groupDetail: '설비 그룹 정보를 불러오는 중',
    equipments: '설비 목록을 불러오는 중',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  equipmentListTruncated: (shown: number, total: number): string =>
    `설비 전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    groupNoneTitle: '아직 등록된 설비 그룹이 없습니다',
    groupNoneDescription: '설비 그룹을 먼저 등록해야 설비를 그 아래에 둘 수 있습니다.',
    groupNoMatchTitle: '조건에 맞는 결과가 없습니다',
    groupNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    groupNotSelected: '좌측에서 설비 그룹을 먼저 고르세요',
    equipmentNoneTitle: '이 그룹에 등록된 설비가 없습니다',
    equipmentNoneDescription: '설비를 등록하면 이 그룹 아래에 나타납니다.',
    equipmentNoMatchTitle: '조건에 맞는 설비가 없습니다',
    equipmentNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
  },
  /**
   * 화면 수준 뷰. ⭐ **점검 항목 마스터는 그룹에 매이지 않는다**(스펙 §5-1-1) — 그룹을 고른
   * 뒤의 안쪽 탭이 아니라 여기서 갈린다.
   */
  views: {
    assets: '설비·설비그룹',
  },
  tabs: {
    group: '그룹 정보',
    equipment: '설비',
    /** ⭐ **부여지 마스터가 아니다** — 마스터는 화면 수준 탭이 따로 갖는다(§5-1-1). */
    inspection: '점검 항목 부여',
  },
  dialog: {
    discardTitle: '입력한 내용을 버릴까요?',
  },
  /**
   * 사용 중지 확인. **무엇이 일어나는지 먼저 밝힌다.**
   *
   * ⚠ 계약에 다시 켜는 경로가 없다 — 이 화면에서 되돌릴 수 없다는 사실을 감추지 않는다.
   */
  dispose: {
    title: '폐기 처리할까요?',
    target: (label: string): string => `${label} 을(를) 폐기 처리합니다.`,
    /** 사용 중지와 «다른 축» 이다 — 그것은 감추는 것이고 이것은 자산이 끝난 것이다. */
    impact:
      '사용 중지와 다른 처리입니다. 사용 중지는 목록에서 감추는 것이고, 폐기는 자산이 끝난 것입니다.',
    notReversible: '되돌릴 수 없습니다. 폐기한 뒤에는 다시 불러와도 편집이 풀리지 않습니다.',
    confirm: '폐기 처리',
  },
  deactivate: {
    title: '사용 중지할까요?',
    equipmentTitle: '설비를 사용 중지할까요?',
    /** 설비를 중지해도 그 설비가 남긴 기록은 그대로다 — 감추는 것과 지우는 것은 다르다. */
    equipmentImpact: '이 설비가 남긴 기록은 그대로 남고, 새로 고를 때만 목록에서 빠집니다.',
    target: (label: string): string => `${label} 을(를) 사용 중지합니다.`,
    membersNone: '이 그룹에 소속된 설비가 없습니다.',
    /** 소속 설비는 그대로 남는다 — 그룹이 목록에서 빠질 뿐이다. */
    members: (count: number): string =>
      `이 그룹에 설비 ${count}대가 소속돼 있습니다. 소속은 그대로 남고, 새로 고를 때만 이 그룹이 목록에서 빠집니다.`,
    notReversibleHere:
      '삭제하지 않습니다. 다만 이 화면에는 다시 켜는 수단이 없어, 되돌리려면 담당자에게 요청해야 합니다.',
    confirm: '사용 중지',
  },
  form: {
    createTitle: '설비 그룹 등록',
    editTitle: '설비 그룹 정보',
    parentNone: '없음 (최상위)',
  },
  equipmentForm: {
    createTitle: '설비 등록',
    editTitle: '설비 수정',
    groupNone: '소속 없음',
    processNone: '지정 없음',
  },
  validation: {
    required: '필수 입력 항목입니다.',
    codeBlank: '코드는 공백만으로 지정할 수 없습니다.',
    /**
     * 상위 그룹을 거슬러 올라가 자기 자신에 닿는 지정. 데이터베이스는 직계 자기참조만 막으므로
     * 화면이 나머지를 진다 — 막지 않으면 계층이 끊긴 채 저장되고 아무도 그것을 되돌리지 못한다.
     */
    parentCycle: '이 그룹을 상위로 지정하면 순환이 생깁니다. 다른 그룹을 고르세요.',
    equipmentGroupRequired: '설비를 등록할 그룹을 좌측에서 먼저 고르세요.',
  },
  equipmentFilters: {
    searchLabel: '설비 검색',
    /** 자산 수명주기 축. 사용 여부(미사용 포함)와 «다른 축» 이라 조건을 따로 둔다. */
    includeDisposed: '폐기 포함',
    chipRemoveIncludeDisposed: '폐기 포함 조건 제거',
    searchPlaceholder: '설비코드 또는 설비명',
    typeAll: '전체 유형',
    calibrationRequiredOnly: '검교정 대상만',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveType: '설비유형 조건 제거',
    chipRemoveCalibration: '검교정 대상 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipType: (label: string): string => `설비유형: ${label}`,
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
    hierarchy: '설비 위치',
    process: '소속공정',
    lastCalibrationDate: '최근 검교정일',
    calibrationDueDate: '차기 검교정 예정일',
    calibrationCycle: '검교정 주기',
    /**
     * 값이 없는 읽기 전용 칸. 선택칸의 「지정 없음」과 **다른 말이어야 한다** —
     * 같은 글자면 감지기가 어느 쪽을 잰 것인지 구분하지 못한다(실측으로 드러난 자리).
     */
    notRecorded: '기록 없음',
    equipmentCode: '설비코드',
    equipmentName: '설비명',
    equipmentType: '설비유형',
    status: '운용상태',
    calibrationRequired: '검교정 대상',
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
    /**
     * 지금 상위로 매여 있으나 고를 수 없는 값 — 자기 자신이거나 하위 그룹이다.
     * 값을 감추면 무엇이 매여 있는지 알 수 없고, 표식이 없으면 왜 고칠 수 없는지 모른다.
     */
    parentCycleSuffix: ' (순환 — 다른 값을 고르세요)',
    /**
     * 이름을 풀지 못한 상위 그룹. **번호만 덩그러니 두지 않는다** — 사용자는 내부 번호를
     * 읽는 사람이 아니다. 번호임을 밝히고 이름을 확인하지 못했다는 사실을 함께 낸다.
     */
    parentUnresolved: (value: string): string => `번호 ${value} (이름을 확인하지 못했습니다)`,
    calibrationYes: '대상',
    calibrationNo: '대상 아님',
    /** 주기 한 줄 — 간격과 단위를 함께 읽는다. 「12 개월」처럼 보인다. */
    calibrationCycle: (interval: number, unitLabel: string): string => `${interval} ${unitLabel}`,
    /** 소속 그룹이 없을 때. 빈칸으로 두지 않는다 — 비어 있음이 보여야 채운다(G-9). */
    noGroupAssigned: '소속 그룹 없음',
  },
  groupTable: {
    expand: '하위 그룹 펼치기',
    collapse: '하위 그룹 접기',
  },
  /**
   * 점검 항목 — **마스터와 부여는 다른 것이다**(공유계약 B-6).
   *
   * 항목이 «무엇인가»(판정 방식·상하한·필수 여부)는 마스터가 갖고, 「이 그룹이 그 항목을
   * **얼마 만에** 도는가」는 부여가 갖는다.
   */
  inspection: {
    paneTitle: '점검 항목',
    /** ⭐ 무엇을 뜻하는 목록인지 먼저 말한다 — 「항목 3개」만으로는 무엇을 도는지 모른다. */
    description:
      '이 그룹에 속한 설비가 도는 점검 항목입니다. 설비에 따로 부여하면 그쪽이 이깁니다.',
    loading: '점검 항목을 불러오는 중',
    emptyTitle: '부여된 점검 항목이 없습니다',
    emptyDescription: '점검 항목을 부여하면 이 그룹의 설비가 그 항목을 돕니다.',
    editAction: '점검 항목 부여',
    dialogTitle: '점검 항목 부여',
    /**
     * ⛔ **묶음 통째 교체라는 사실을 감추지 않는다**(계약의 `PUT`). 「지운 줄은 지워진다」를
     * 말하지 않으면 사용자는 더한 것만 반영된다고 읽는다.
     */
    dialogLead: '이 창에 남긴 것이 전부가 됩니다 — 지운 줄은 부여가 풀립니다.',
    addLabel: '항목 추가',
    addPlaceholder: '부여할 점검 항목을 고르세요',
    /** 고를 것이 없는 것과 목록을 못 받은 것은 다르다 — 앞엣것만 이 문구다. */
    allAssigned: '마스터의 점검 항목을 모두 부여했습니다.',
    /**
     * ⚠ **「어떻게 풀 것인가」를 함께 적는다**(공유계약 G-3 · 설계 회신 `omf-mes#220`).
     * 「없습니다」에서 멈추면 사용자는 어디로 가야 할지 모른다 — 만드는 자리가 «같은 화면»
     * 안이므로 그 탭 이름을 말한다.
     */
    masterEmpty:
      '등록된 점검 항목이 없습니다. 위의 「점검 항목」 탭에서 항목을 만든 뒤 부여하세요.',
    masterLoadFailed: '점검 항목 목록을 불러오지 못했습니다.',
    removeAction: '부여 해제',
    removeLabel: (itemName: string): string => `${itemName} 부여 해제`,
    fields: {
      plant: '공장',
      itemCode: '항목코드',
      itemName: '항목명',
      inspectionType: '점검 유형',
      cycle: '주기',
      cycleType: '주기 단위',
      cycleInterval: '주기 간격',
      cycleBaseDate: '기준일',
      activation: '사용',
    },
    /** 「3일마다」 — 수와 단위를 붙여 읽는 순서 그대로 둔다. */
    cycleText: (interval: number, unitLabel: string): string =>
      `${String(interval)}${unitLabel}마다`,
    /** ⭐ 비면 부여일이 기준이다(계약) — 빈 칸이 「안 정했다」가 아니라 값이라는 뜻이다. */
    baseDateNote: '비우면 부여한 날이 기준이 됩니다.',
    validation: {
      required: '필수 항목입니다.',
      intervalPositive: '주기 간격은 1 이상의 정수여야 합니다.',
    },
    /** 창을 열기 전에는 그룹을 골라야 한다 — 감추지 않고 사유를 말한다(G-2). */
    needsGroupReason: '그룹을 고르면 점검 항목을 부여할 수 있습니다.',
    /**
     * 「이 설비가 무엇을 도는가」의 **근거**.
     *
     * ⛔ **어디서 왔는지 말하지 않으면 사용자가 엉뚱한 자리를 고친다** — 그룹에서 온 항목을
     * 설비 화면에서 지우려 하거나, 설비에 부여해 둔 것을 그룹에서 찾는다.
     */
    resolution: {
      label: '적용 근거',
      equipment: '이 설비에 직접 부여한 항목입니다.',
      group: (groupLabel: string): string => `소속 그룹 ${groupLabel} 의 항목이 적용됩니다.`,
      /** ⚠ 층은 아는 사실이고 이름은 모르는 사실이다 — 지어내지 않는다(G-9). */
      groupUnknown: '소속 그룹의 항목이 적용됩니다.',
      none: '이 설비는 점검 대상이 아닙니다. 설비나 소속 그룹에 부여된 항목이 없습니다.',
    },
    equipmentPaneTitle: '점검 항목',
    equipmentDescription: '이 설비가 도는 점검 항목입니다.',
    equipmentEditAction: '이 설비에 부여',
    /** 줄이 여럿일 때 「부여」만으로는 어느 설비인지 알 수 없다 — 접근 이름에 대상을 담는다. */
    equipmentOpenLabel: (equipmentCode: string): string => `${equipmentCode} 의 점검 항목 부여`,
    equipmentDialogTitle: '설비의 점검 항목 부여',
    /**
     * ⛔ **「지우면 아무것도 안 돈다」가 아니다.** 설비의 부여를 비우면 해석이 한 층 위로
     * 올라가 소속 그룹의 것이 적용된다 — 「점검을 끈다」로 오해하면 안 된다.
     */
    equipmentDialogLead:
      '이 설비에 부여한 것이 소속 그룹의 것을 이깁니다. 모두 지우면 다시 소속 그룹의 항목이 적용됩니다.',
  },
  /**
   * 점검 항목 **마스터** — 부여와 다른 것이다(공유계약 B-6).
   *
   * ⭐ **만드는 자리가 이 화면이다**(설계 회신 `omf-mes#220` · 스펙 §5-1-1). 자리는 부여 창
   * «안»이 아니라 그룹·설비와 **나란한 목록**이다 — 창 안에 창이 생기고 만들다 만 항목이
   * 부여와 한 트랜잭션에 얽히는 것을 막는다.
   */
  inspectionItem: {
    tabLabel: '점검 항목',
    paneTitle: '점검 항목 마스터',
    description: '설비와 설비 그룹에 부여할 점검 항목을 여기서 만듭니다.',
    loading: '점검 항목을 불러오는 중',
    emptyTitle: '등록된 점검 항목이 없습니다',
    emptyDescription: '점검 항목을 만들면 설비·설비 그룹에 부여할 수 있습니다.',
    noMatchTitle: '조건에 맞는 점검 항목이 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 보세요.',
    addAction: '점검 항목 추가',
    createTitle: '점검 항목 등록',
    editTitle: '점검 항목 수정',
    searchLabel: '점검 항목 검색',
    searchPlaceholder: '항목코드 또는 항목명',
    typeAll: '전체 유형',
    /** 행이 곧 손잡이다 — 접근 이름에 무엇이 열리는지 담는다. */
    openLabel: (itemCode: string, itemName: string): string => `${itemCode} ${itemName} 수정`,
    fields: {
      plant: '공장',
      itemCode: '항목코드',
      itemName: '항목명',
      inspectionType: '점검 유형',
      judgmentMethod: '판정 방식',
      uom: '측정 단위',
      lowerLimit: '측정 하한',
      upperLimit: '측정 상한',
      requiredFlag: '필수 여부',
      inspectionPoint: '점검부위',
      sequenceNo: '표시 순서',
      isActive: '사용',
    },
    placeholders: {
      plant: '공장을 고르세요',
      inspectionType: '점검 유형을 고르세요',
      judgmentMethod: '판정 방식을 고르세요',
      uom: '단위를 고르세요',
    },
    /**
     * ⛔ **짝 제약을 창이 말한다.** 판정 방식이 「측정값」이면 단위·상하한이 함께 필요하다 —
     * 말하지 않으면 사용자는 세 칸이 왜 갑자기 필수가 됐는지 모른다.
     */
    measurementNote: '판정 방식이 「측정값」이면 단위와 상·하한이 함께 필요합니다.',
    /** ⛔ 계약의 수정 본문에 공장이 없다 — 옮길 수 없다는 뜻이다. */
    plantFixed: '공장은 등록할 때 정해지며 나중에 바꿀 수 없습니다.',
    /** ⭐ 지운 것이 아니라 잠근 것이다 — 부여된 곳이 있으면 코드를 바꿀 수 없다. */
    assignmentCount: (count: number): string =>
      count === 0
        ? '아직 어디에도 부여되지 않았습니다.'
        : `설비·설비 그룹 ${count}곳에 부여돼 있습니다.`,
    /** ⛔ 물리 삭제가 없다(B-4) — 사용 여부로 끈다. */
    inactiveNote: '사용을 끄면 새로 부여할 수 없습니다. 이미 부여된 곳은 그대로 남습니다.',
    validation: {
      required: '필수 항목입니다.',
      mustBeNumber: '숫자로 입력하세요.',
      /** ⛔ 계약이 `minimum: 1` 이다 — 0을 받으면 저장에서야 거절당한다. */
      sequencePositive: '표시 순서는 1 이상의 정수여야 합니다.',
      limitOrder: '측정 상한은 하한보다 크거나 같아야 합니다.',
    },
    values: {
      requiredYes: '필수',
      requiredNo: '선택',
    },
  },
} as const;
