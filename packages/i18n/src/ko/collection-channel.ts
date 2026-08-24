/**
 * W-05-07 수집 채널 매핑 관리.
 *
 * ⭐ **이 화면이 하는 일은 「설비가 보내오는 이름」을 「검사 항목」에 잇는 것 하나다**(스펙 §5-1).
 * 통신 설정도, 수신 로그 조회도 여기 있지 않다.
 *
 * ⛔ **잇지 않은 채널의 값은 버려진다** — 그 사실을 화면이 말한다(스펙 §9-2). 「매핑 없음」만으로는
 * 결과를 알 수 없다. 설정한 사람은 저장되고 있다고 믿는다.
 */
export const collectionChannel = {
  title: '수집 채널 매핑 관리',
  breadcrumbRoot: '설비/툴',
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  equipment: {
    paneTitle: '설비',
    searchLabel: '설비 검색',
    searchPlaceholder: '설비번호 또는 설비명',
    plantAll: '전체 공장',
    loading: '설비 목록을 불러오는 중',
    emptyTitle: '등록된 설비가 없습니다',
    emptyDescription: '설비를 등록하면 여기에 나타납니다.',
    noMatchTitle: '조건에 맞는 설비가 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    /** 잘림을 감추지 않는다 — 찾는 설비가 목록에 없을 수 있다. */
    truncated: (shown: number, total: number): string =>
      `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
    /** 행이 곧 손잡이다 — 접근 이름에 무엇이 열리는지 담는다. */
    selectLabel: (code: string, name: string): string => `${code} ${name}의 수집 채널 보기`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemovePlant: '공장 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipPlant: (label: string): string => `공장: ${label}`,
  },
  channels: {
    paneTitle: '채널 매핑',
    /** 무엇의 채널을 보고 있는지 페인 머리에 남긴다 — 좌우가 멀어지면 고른 것을 잊는다. */
    paneOf: (code: string, name: string): string => `${code} · ${name}의 수집 채널`,
    /** 설비를 고르기 전에는 조회 자체가 없다 — 빈 표가 아니라 무엇을 해야 하는지 말한다. */
    noEquipmentTitle: '설비를 고르세요',
    noEquipmentDescription: '왼쪽에서 설비를 고르면 그 설비의 수집 채널이 나타납니다.',
    loading: '수집 채널 목록을 불러오는 중',
    emptyTitle: '등록된 수집 채널이 없습니다',
    emptyDescription: '이 설비에서 받을 신호를 채널로 등록하면 여기에 나타납니다.',
    noMatchTitle: '조건에 맞는 수집 채널이 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 보세요.',
    unmappedOnly: '미매핑만 보기',
    /**
     * ⭐ **버려진다고 명시한다**(스펙 §9-2). 「매핑 없음」이라고만 쓰면 결과를 알 수 없다.
     *
     * ⛔ **「로그에는 남습니다」라고 말하지 않는다** — 설비 수신이 연계 메시지에 담기는지가
     * 아직 확인되지 않았다. 확인되지 않은 것을 위로로 삼으면 없는 경로를 찾아 헤매게 된다.
     */
    unmappedSummary: (count: number): string =>
      `대상 검사 항목이 없는 채널이 ${count}개 있습니다. 이 채널로 들어오는 값은 저장되지 않고 버려집니다.`,
    unmappedSummaryTitle: '받아도 쓰이지 않는 채널이 있습니다',
    /**
     * ⚠ 미매핑 조건은 화면이 걸고, 서버가 목록을 자르면 **받아 온 것만** 덮는다.
     * 그 사실을 감추면 잘려 나간 쪽의 미매핑 채널이 없는 것처럼 보인다.
     */
    unmappedOnLoadedOnly:
      '미매핑 조건은 지금 불러온 목록에만 적용됩니다. 잘린 부분에 미매핑 채널이 더 있을 수 있으니 조건을 좁혀 조회하세요.',
    /** ⛔ 「다 보여 주고 있다」고 말하지 않는다 — 전체 건수가 오지 않으면 알 수 없다. */
    listTruncated: (shown: number, total: number): string =>
      `전체 ${total}건 중 ${shown}건을 표시합니다.`,
    mayHaveMore: (shown: number): string => `${shown}건을 표시합니다. 더 있을 수 있습니다.`,
  },
  /**
   * 이 매핑이 **언제** 적용되는지 — 품목·공정 조건.
   *
   * ⭐ **비면 「전체」다.** 고르지 않은 것이 아니라 **전체를 뜻하는 값**이다 — 빈 칸으로
   * 두면 설정을 빠뜨린 것으로 읽힌다.
   *
   * ⚠ **유일 범위를 이룬다.** 같은 설비의 같은 채널이 「품목 A 면 외경, 품목 B 면 두께」로
   * 갈릴 수 있어, 조건 없이 잠그면 둘째 행이 중복으로 거부된다.
   */
  scope: {
    columnHeader: '조건',
    all: '전체',
    itemLabel: '품목 조건',
    processLabel: '공정 조건',
    anyOption: '전체 (조건 없음)',
    note: '비우면 전체입니다 — 이 설비의 이 채널은 언제나 그 항목으로 갑니다.',
    /** 한 행이 두 축을 다 지정할 수 있다. 값 이름 안의 이음쇠와 갈리는 쇠를 쓴다. */
    join: ' / ',
    entry: (axisLabel: string, valueLabel: string): string => `${axisLabel} ${valueLabel}`,
    item: '품목',
    process: '공정',
  },
  fields: {
    activation: '사용',
    plant: '공장',
    equipment: '설비',
    equipmentCode: '설비번호',
    equipmentName: '설비명',
    channelKey: '채널명',
    signalName: '신호 이름',
    unit: '단위',
    inspectionItem: '대상 검사 항목',
    isActive: '사용',
    notRecorded: '기록 없음',
  },
  /**
   * ⭐ **연결 여부는 두 값이 아니라 세 값이다**(공유계약 G-9 확장 · 스펙 §9-2).
   *
   * ⛔ **「미매핑」과 「연결됨」을 같은 말로 그리지 않는다** — 앞은 값이 버려진다는 뜻이고
   * 뒤는 정상이다. 그리고 **「연결됨」은 「무엇에 연결됐는지 안다」는 뜻이 아니다** — 목록에는
   * 항목의 이름이 오지 않는다. 아는 척하지 않고 아는 만큼만 적는다.
   */
  mapping: {
    unmapped: '미매핑',
    mapped: '연결됨',
    nameUnavailable: '연결된 검사 항목의 이름은 이 목록에 오지 않습니다 — 연결 여부만 표시합니다.',
  },
  actions: {
    addChannel: '채널 추가',
    importFromLog: '수신 로그에서 가져오기',
  },
  /**
   * ⭐ **외부에서 오는 이름은 손으로 치게 하지 않는다**(스펙 §9-1).
   *
   * 채널명은 설비가 정한다. 사람이 문서를 보고 옮겨 적으면 **오타 하나로 수신값이 조용히
   * 버려진다** — 이름이 어긋난 채널은 매핑에 걸리지 않고, 걸리지 않은 값은 저장되지 않는다.
   * 그래서 «실제로 들어온 것»에서 골라 담는 길을 둔다.
   *
   * ⛔ 그렇다고 손 입력을 막지는 않는다 — 아직 한 번도 안 온 채널을 미리 등록할 수 있어야 한다.
   */
  importLog: {
    title: '수신 로그에서 가져오기',
    description:
      '이 설비에서 최근 들어온 신호입니다. 채널로 만들 것을 고르세요. 이름은 받은 그대로 담기므로 옮겨 적다 틀릴 일이 없습니다.',
    loading: '최근 수신 신호를 불러오는 중',
    /** ⭐ 비활성 사유는 그 컨트롤의 이름으로 시작한다 — 시각적으로 끊겨도 대상을 되찾는다. */
    noObservationsReason:
      '수신 로그에서 가져오기는 이 설비에서 받은 기록이 있어야 쓸 수 있습니다. 아직 들어온 신호가 없습니다.',
    emptyTitle: '고를 신호가 없습니다',
    emptyDescription: '아직 잇지 않은 신호가 없습니다. 전체를 보려면 조건을 끄세요.',
    unmappedOnly: '아직 잇지 않은 것만',
    /** ⭐ 감추지 않고 왜 못 고르는지 말한다(공유계약 G-2). */
    alreadyMapped: '이미 등록됨',
    loadFailed: '최근 수신 신호를 불러오지 못했습니다.',
    confirm: '고른 신호를 채널로 만들기',
    selectedCount: (count: number): string => `${String(count)}건 선택`,
    /** ⛔ 「모두 만들었습니다」라고 말하지 않는다 — 한 건씩 나가므로 일부만 될 수 있다. */
    resultTitle: '가져오기 결과',
    createdCount: (count: number): string => `${String(count)}건을 채널로 만들었습니다.`,
    failedCount: (count: number): string =>
      `${String(count)}건은 만들지 못했습니다. 아래에 남겨 두었으니 다시 시도하거나 손으로 등록하세요.`,
    /** 실패한 줄에 서버가 준 사유를 그대로 붙인다 — 뭉개면 무엇을 고칠지 알 수 없다. */
    failedRow: (channelKey: string, reason: string): string => `${channelKey} — ${reason}`,
    unknownReason: '알 수 없는 이유로 실패했습니다.',
    fields: {
      channelKey: '신호 이름',
      lastValue: '최근 값',
      observedAt: '받은 시각',
    },
    /** ⚠ 시각을 아는 척 다듬지 않는다 — 서버가 준 표기를 그대로 세운다. */
    notRecorded: '기록 없음',
  },
  form: {
    createTitle: '수집 채널 등록',
    editTitle: '수집 채널 수정',
    unitPlaceholder: '단위를 고르세요',
    /** 등록 창은 «고른 설비»에 매인다 — 어느 설비에 더하는지 창이 스스로 말한다. */
    equipmentFixed: (code: string, name: string): string => `${code} · ${name}`,
  },
  /**
   * ⭐ **이 화면의 일이 여기서 끝난다** — 채널을 검사 항목에 잇는 것.
   *
   * ⚠ 계약에 검사 항목의 «전체» 목록이 없다. 항목은 검사기준의 버전에 속하므로
   * 세 칸을 차례로 좁혀야 항목에 닿는다.
   */
  itemPicker: {
    legend: '대상 검사 항목',
    planLabel: '검사기준',
    versionLabel: '검사기준 버전',
    itemLabel: '검사 항목',
    planPlaceholder: '검사기준을 고르세요',
    versionPlaceholder: '버전을 고르세요',
    itemPlaceholder: '검사 항목을 고르세요',
    versionOption: (planVersion: number, statusLabel: string): string =>
      `Rev ${String(planVersion)} · ${statusLabel}`,
    /** 이 화면은 상태 값 목록을 받지 않는다 — 코드를 그대로 둔다(공유계약 G-9). */
    unmapAction: '연결 해제',
    unmapped: '이어 둔 검사 항목이 없습니다. 이 채널로 들어오는 값은 저장되지 않고 버려집니다.',
    /**
     * ⛔ **아는 척하지 않는다.** 목록도 상세도 항목의 이름을 내려주지 않아, 이어 둔 것이
     * «무엇인지» 화면이 알 수 없다. 감추면 사용자는 확인했다고 믿는다.
     *
     * ⚠ **이 말은 「아직 못 찾았을 때」만 한다.** 아래에서 골라 이름을 알게 된 뒤에도
     * 「확인할 수 없다」고 하면, 바로 옆에 이름을 적어 두고 모른다고 말하는 셈이 된다.
     */
    mappedUnknown:
      '검사 항목이 이어져 있습니다. 어느 항목인지는 이 화면에서 확인할 수 없으니, 확인하려면 아래에서 다시 고르세요.',
    mappedKnown: (name: string): string => `이 채널의 값은 ${name} 항목으로 갑니다.`,
    versionNeedsPlan: '검사기준을 먼저 고르면 버전을 고를 수 있습니다.',
    itemNeedsVersion: '버전을 먼저 고르면 검사 항목을 고를 수 있습니다.',
    noVersions: '이 검사기준에는 아직 버전이 없습니다.',
    noItems: '이 버전에는 아직 검사 항목이 없습니다.',
    plansLoadFailed: '검사기준 목록을 불러오지 못했습니다.',
    versionsLoadFailed: '버전 목록을 불러오지 못했습니다.',
    itemsLoadFailed: '검사 항목 목록을 불러오지 못했습니다.',
  },
  /**
   * ⭐ **단위가 다르면 경고만 한다 — 변환하지 않는다**(스펙 §5-5).
   *
   * ⛔ 변환 규칙을 어디에도 저장하지 않았다. 화면이 임의로 옮기면 **측정값이 조용히
   * 어긋나고**, 어긋난 뒤에는 어느 쪽이 맞는지 아무도 모른다.
   */
  unitMatch: {
    mismatchTitle: '단위가 서로 다릅니다',
    mismatch: (channelUnitCode: string, itemUnitCode: string): string =>
      `이 채널은 ${channelUnitCode}로 받고 고른 검사 항목은 ${itemUnitCode}를 씁니다. 값을 자동으로 바꾸지 않으니, 보내는 쪽이나 항목 정의를 맞춰 주세요.`,
    /** ⛔ 「모른다」를 「같다」로 접지 않는다 — 침묵하면 맞는 것으로 읽힌다(G-9). */
    unknown:
      '고른 검사 항목의 단위를 확인하지 못해 이 채널의 단위와 견주지 못했습니다. 저장은 되지만 단위가 맞는지 직접 확인하세요.',
  },
  /**
   * 사용 여부를 바꾼다.
   *
   * ⭐ **이 화면은 끄기와 켜기를 «둘 다» 갖는다** — 형제 화면들과 다르다. 그쪽은 사용 중지에
   * 전용 경로가 있고 되살리는 경로가 없어 「다시 켤 수단이 없다」고 말해야 하지만, 여기서는
   * `isActive` 가 수정 본문의 한 필드라 **끄는 것도 켜는 것도 같은 요청**이다. 계약이
   * 허용하는 것을 화면이 임의로 막지 않는다.
   */
  activation: {
    deactivateAction: '사용 중지',
    resumeAction: '사용 재개',
    deactivateLabel: (channelKey: string): string => `${channelKey} 사용 중지`,
    resumeLabel: (channelKey: string): string => `${channelKey} 사용 재개`,
    deactivateTitle: '이 채널을 사용 중지할까요?',
    resumeTitle: '이 채널을 다시 켤까요?',
    target: (channelKey: string): string => `${channelKey} 채널을 처리합니다.`,
    /**
     * ⚠ **「값이 버려진다」고도 「값이 담긴다」고도 말하지 않는다.** 사용 안 함이 수집까지
     * 멈추는지가 아직 확인되지 않았다(설계 질의). **모르는 것을 단정하면 사용자는 그 말을
     * 믿고 라인을 세우거나 세우지 않는다** — 둘 다 되돌리기 비싸다.
     */
    deactivateImpact:
      '사용 중지하면 이 채널이 목록에서 빠집니다. 채널과 이어 둔 검사 항목은 지워지지 않습니다.',
    /** ⭐ 되돌릴 수 있다는 사실을 밝힌다 — 형제 화면과 여기가 갈리는 자리다. */
    deactivateReversible:
      '지우는 것이 아니라 끄는 것입니다. 「미사용 포함」을 켜면 다시 찾아 켤 수 있습니다.',
    resumeImpact: '다시 켜면 이 채널이 목록에 돌아옵니다. 이어 둔 검사 항목도 그대로입니다.',
    /** 창을 열었지만 아직 대상을 받지 못했다 — 모르면 잠근다(누르면 아무 일도 없는 것보다 낫다). */
    loadingTarget: '채널 정보를 불러오는 중입니다.',
  },
  /** ⭐ 감추지 않고 「왜 여기서 못 하는지」를 말한다(공유계약 G-2). */
  actionReasons: {
    /** ⚠ 이 설비의 수신이 아직 없다 — 신호가 오면 목록이 채워진다(설계 `omf-mes#67`). */
    importNeedsObservations:
      '수집 채널 등록은 손으로도 할 수 있습니다. 아래 「채널 추가」를 쓰세요.',
    equipmentFixed: '설비는 왼쪽에서 고른 것으로 정해지며 이 창에서 옮길 수 없습니다.',
    channelKeyFixed: '채널명은 등록할 때 정해지며 나중에 바꿀 수 없습니다.',
  },
  validation: {
    required: '필수 항목입니다.',
    channelKeyBlank: '공백만으로는 채널명을 만들 수 없습니다.',
    /**
     * ⛔ **유일 범위를 문구에 담는다**(공유계약 A-1).
     *
     * 「이 설비에 같은 이름의 채널이 이미 있습니다」는 **거짓이다** — 조건이 다르면 같은
     * 이름이 여러 행 설 수 있다(설계 회신 `omf-mes#203` 질문1 · 통지 client#388).
     * 무엇이 겹쳤는지 말하지 않으면 사용자는 **고칠 자리를 찾지 못한다.**
     */
    duplicateScope: (channelKey: string): string =>
      `이 설비의 ${channelKey} 채널에 품목·공정 조건이 같은 매핑이 이미 있습니다. 조건을 다르게 하거나 그 매핑을 고치세요.`,
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    inactiveSuffix: ' (미사용)',
  },
} as const;
