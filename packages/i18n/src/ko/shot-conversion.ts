/**
 * W-05-01 타발수 환산 파라미터 설정.
 *
 * ⭐ **타발수 = 생산 수량 × 비율.** 이 화면은 그 비율과 「환산을 쓸지」를 정한다.
 *
 * ⛔ **툴별 차이는 여기 없다** — 캐비티 수가 이미 담고 있고 그것은 툴 마스터의 것이다.
 * 두 화면이 한 계산의 입력을 나눠 갖고, 나누는 선이 「툴 고유 ↔ 품목·공정 정책」이다.
 */
export const shotConversion = {
  title: '타발수 환산 파라미터 설정',
  breadcrumbRoot: '설비/툴',
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /**
   * 환산을 켜고 끈다 — 이 화면의 스위치.
   *
   * ⛔ **환산을 켜도 손 입력이 사라지지 않는다**(스펙 §5-4 · QA #12). 손 입력이 **기본
   * 경로**이고 환산은 보조다. 적지 않으면 **켜는 순간 손 입력이 막히는 줄 안다.**
   */
  enabled: {
    paneTitle: '환산 사용',
    switchLabel: '생산 수량으로 타발수를 환산한다',
    loading: '환산 사용 여부를 불러오는 중',
    offNote: '끄면 타발수를 손으로만 입력합니다.',
    /** ⭐ 켤 때 반드시 함께 읽혀야 하는 문장이다 — 없으면 손 입력이 막힌 줄 안다. */
    stillManual:
      '켜도 손 입력은 그대로 됩니다. 환산은 보조 경로이며, 켜면 작업실적 입력에 「생산 수량으로 환산」 선택지가 늘어납니다.',
    /**
     * ⚠ **막지 않는다**(공유계약 G-12·G-15) — 정책은 나중에 더할 수 있고, 켜 두는 것이
     * 「이제 정책을 만들겠다」는 뜻일 수 있다. 다만 지금 상태로는 동작하지 않는다고 말한다.
     */
    noRatioWarning: '비율 정책이 하나도 없어 환산이 동작하지 않습니다. 아래에서 정책을 더하세요.',
    noRatioTitle: '환산을 켜 두었지만 쓸 비율이 없습니다',
    /** ⛔ 아직 정하지 않은 것을 「끔」으로 그리지 않는다(공유계약 G-9). */
    notSetTitle: '아직 정하지 않았습니다',
    notSet:
      '환산 사용 여부를 아직 정하지 않았습니다. 정하기 전까지는 타발수를 손으로만 입력합니다.',
    loadFailed: '환산 사용 여부를 불러오지 못했습니다.',
  },
  ratioList: {
    paneTitle: '비율 정책',
    loading: '비율 정책을 불러오는 중',
    emptyTitle: '등록된 비율 정책이 없습니다',
    emptyDescription: '정책을 더하면 여기에 나타납니다. 정책이 없으면 환산이 동작하지 않습니다.',
    noMatchTitle: '그 날에 유효한 정책이 없습니다',
    noMatchDescription: '기준일을 비우면 끝난 것까지 함께 볼 수 있습니다.',
    /**
     * ⭐ **범위가 겹치는 것이 정상이다** — 공장 기본 위에 품목 예외를 얹는 것이 이 표의 쓰임이다.
     * 겹치면 무엇이 이기는지를 표 곁에서 말해 두지 않으면, 사람마다 다르게 읽는다.
     */
    overlapNote: '범위가 겹치면 더 좁은 것이 이깁니다 — 품목 · 공정 · 공장 · 사업부 차례입니다.',
    /** ⚠ 화면이 판정하지 않는다 — 실제로 무엇이 적용되는지는 미리보기가 서버에 물어 답한다. */
    resolvedElsewhere: '지금 어느 정책이 적용되는지는 아래 미리보기에서 확인하세요.',
    listTruncated: (shown: number, total: number): string =>
      `전체 ${String(total)}건 중 ${String(shown)}건을 표시합니다. 기준일로 좁혀 보세요.`,
    effectiveOnLabel: '기준일',
    /** 비운 것이 기본이고, 그것이 「끝난 것까지 본다」는 뜻이다. */
    effectiveOnNote: '비우면 끝난 정책까지 함께 봅니다.',
    /**
     * ⛔ **범위 문구에 덧붙이지 않는다.** 범위는 축을 이어 만든 «조립된» 문장이고 값 이름에
     * 괄호가 들어갈 수 있어, 뒤에 「(종료됨)」을 붙이면 **그것이 값 이름의 일부로 읽힌다**
     * (브라우저 확인 실측 — 「공장 가상 1공장 (종료됨)」이 공장 이름처럼 보였다).
     * 끝났다는 것은 «기간»의 성질이므로 기간 칸에 둔다.
     */
    ended: '종료됨',
  },
  /**
   * 범위 축을 사람의 말로.
   *
   * ⭐ **차례가 곧 우선순위다**(품목 · 공정 · 공장 · 사업부). 표에 그 차례로 적어 두면
   * 「왜 이것이 이기는가」를 따로 설명하지 않아도 읽힌다.
   */
  scope: {
    all: '전체',
    itemId: '품목',
    processId: '공정',
    plantId: '공장',
    businessUnitId: '사업부',
    /**
     * 한 정책이 축을 둘 이상 지정할 수 있다 — 지정된 것을 우선순위 차례로 잇는다.
     *
     * ⛔ **값 이름 «안»에서 쓰는 이음쇠(`·`)와 달라야 한다.** 값 이름이 이미
     * 「ABC-123 · 하우징 커버 A」 꼴이라 축도 같은 쇠로 이으면 **축 경계가 사라진다** —
     * 「품목 ABC-123 · 하우징 커버 A · 공정 OP-INJ · 사출」이 점 네 개짜리 한 줄로 읽힌다
     * (브라우저 확인에서 실제 계약 응답으로 그렇게 보였다).
     */
    join: ' / ',
    entry: (axisLabel: string, valueLabel: string): string => `${axisLabel} ${valueLabel}`,
  },
  actions: {
    addPolicy: '정책 추가',
  },
  form: {
    createTitle: '비율 정책 등록',
    editTitle: '비율 정책 수정',
    scopeLegend: '적용 범위',
    /** ⭐ 비운 축이 「전체」다 — 「고르지 않음」이 아니라 값이다. */
    scopeNote:
      '고르지 않은 축은 전체를 뜻합니다. 좁게 지정할수록 겹칠 때 먼저 적용됩니다 — 품목 · 공정 · 공장 · 사업부 차례입니다.',
    scopeAll: '전체',
    ratioPlaceholder: '예: 0.25',
    /** ⭐ 무엇을 뜻하는 수인지 칸 옆에서 말한다 — 「비율」만으로는 무엇의 비율인지 모른다. */
    ratioNote: '생산 수량에 이 수를 곱해 타발수를 냅니다. 캐비티가 4개면 0.25입니다.',
    effectiveFrom: '유효 시작일',
    effectiveTo: '유효 종료일',
    effectiveToNote: '비우면 끝이 없습니다.',
    /** ⛔ 코드와 축은 바꾸지 않는다 — 바꾸면 다른 정책이 된다(계약). */
    scopeFixed:
      '적용 범위는 등록할 때 정해지며 이 창에서 바꿀 수 없습니다. 범위를 바꾸려면 이 정책을 끝내고 새로 등록하세요.',
  },
  /**
   * 정책을 끝낸다.
   *
   * ⛔ **지우지 않는다.** 계약에 삭제 경로가 없고, 그것은 실수가 아니다 — **과거 실적이 그때의
   * 비율로 계산됐다.** 지우면 그 계산의 근거가 사라진다.
   */
  end: {
    action: '정책 종료',
    label: (scope: string): string => `${scope} 정책 종료`,
    title: '이 정책을 끝낼까요?',
    target: (scope: string): string => `${scope} 범위의 정책을 끝냅니다.`,
    dateLabel: '유효 종료일',
    /** ⭐ 「지우는 것이 아니다」를 먼저 말한다 — 이 창에서 가장 오해하기 쉬운 자리다. */
    notDeleted:
      '지우는 것이 아니라 유효 종료일을 정하는 것입니다. 정책과 그 값은 남고, 종료일까지의 실적은 이 비율로 계산된 그대로입니다.',
    /** ⚠ 끝낸 뒤 무엇이 적용될지는 이 창이 알 수 없다 — 서버가 판정한다. */
    afterNote:
      '끝낸 뒤에는 더 넓은 범위의 정책이 대신 적용됩니다. 남는 정책이 없으면 환산이 동작하지 않습니다.',
    dateRequired: '유효 종료일을 정하세요.',
    dateBeforeStart: (from: string): string =>
      `유효 종료일은 시작일(${from})과 같거나 뒤여야 합니다.`,
    /** 이미 끝난 정책은 끝낼 것이 없다 — 감추지 않고 사유와 함께 잠근다(G-2). */
    alreadyEnded: '이미 끝난 정책입니다. 기간을 바꾸려면 수정에서 종료일을 고치세요.',
  },
  validation: {
    required: '필수 항목입니다.',
    /** ⛔ 0이면 타발수가 늘 0이라 예방보전이 영영 오지 않는다. DB가 막지 않아 화면이 막는다. */
    ratioPositive: '비율은 0보다 커야 합니다. 0이면 타발수가 늘 0이 되어 예방보전이 오지 않습니다.',
    ratioNumber: '비율은 수로 입력하세요.',
    /** ⚠ 막지 않는다 — 한 번에 여러 번 타발하는 공정이 있을 수 있다(설계 `omf-mes#67`). */
    ratioOverOne:
      '비율이 1보다 큽니다. 수량보다 타발수가 많아지는데 맞는지 확인하세요. 이대로 저장할 수 있습니다.',
    periodOrder: '유효 종료일은 시작일과 같거나 뒤여야 합니다.',
  },
  /**
   * 미리보기 — **범위 해석을 서버가 한다.**
   *
   * ⛔ **화면이 우선순위를 다시 구현하지 않는다**(스펙 §5-2 · 공유계약 B-17). 네 축이 전부
   * 비어 있을 수 있어 여러 정책이 동시에 맞는데, 그 판정을 화면이 다시 짜면 **같은 표가
   * 화면마다 다르게 읽힌다.** `effective` 경로가 답과 «그 근거»를 함께 준다.
   */
  preview: {
    paneTitle: '미리보기',
    description:
      '툴·품목·공정을 고르면 그 조합에 실제로 적용되는 정책과 그것으로 계산한 타발수를 보입니다.',
    toolLabel: '툴',
    itemLabel: '품목',
    processLabel: '공정',
    quantityLabel: '생산 수량',
    quantityPlaceholder: '예: 500',
    toolPlaceholder: '툴을 고르세요',
    anyScope: '지정 안 함',
    loading: '적용 정책을 확인하는 중',
    loadFailed: '적용 정책을 확인하지 못했습니다.',
    appliedTitle: '적용 정책',
    /** ⭐ 서버가 「어느 축으로 이겼는가」를 함께 준다 — 그것이 곧 왜 이 값인지의 설명이다. */
    matchedBy: (scopeLabel: string): string => `${scopeLabel} 범위로 맞았습니다.`,
    matchedScope: {
      ITEM: '품목',
      PROCESS: '공정',
      PLANT: '공장',
      BUSINESS_UNIT: '사업부',
      ALL: '전체',
    },
    /** ⛔ 「1.0」으로 채우지 않는다(G-9) — 없는 정책을 있는 것으로 만들면 계산이 조용히 돈다. */
    unresolvedTitle: '적용 정책 없음 — 환산 불가',
    unresolved:
      '이 조합에 맞는 비율 정책이 없습니다. 더 넓은 범위의 정책을 더하거나, 이 조합에 맞는 정책을 등록하세요.',
    ratioLabel: '적용 비율',
    cavityLabel: '캐비티 수',
    cavitySource: '툴 마스터에서 정합니다.',
    /**
     * ⭐ **스펙의 「캐비티 수 미등록」 예외는 계약이 닫았다** — `cavityCount` 가 필수이고
     * 최솟값이 1이라 툴이 있으면 반드시 있다. 그래서 남는 「없음」은 **툴을 고르지 않은
     * 것** 하나뿐이고, 그것은 오류가 아니라 아직 안 고른 상태다.
     */
    cavityNeedsTool: '툴을 고르면 캐비티 수를 함께 보입니다.',
    shotLabel: '타발수',
    shotCount: (shots: number): string => `${String(shots)} 회`,
    /** ⭐ 셈을 그대로 보인다 — 결과만 보이면 왜 그 수인지 알 수 없다. */
    formula: (quantity: number, ratio: number, shots: number): string =>
      `${String(quantity)} × ${String(ratio)} = ${String(shots)}`,
    cavityNote: (cavityCount: number): string =>
      `이 툴은 한 번에 ${String(cavityCount)}개가 나옵니다.`,
    /** ⚠ 캐비티 수와 비율이 어긋나면 알린다 — 둘은 같은 것을 두 곳에서 말한다. */
    cavityMismatch: (cavityCount: number, expected: string): string =>
      `캐비티 ${String(cavityCount)}개면 비율이 ${expected} 이어야 합니다. 지금 적용되는 비율과 다릅니다.`,
    needsQuantity: '생산 수량을 넣으면 타발수를 계산해 보입니다.',
    quantityNumber: '생산 수량은 0보다 큰 수로 입력하세요.',
  },
  fields: {
    scope: '범위',
    ratio: '비율',
    period: '유효기간',
    formula: '계산식',
    notRecorded: '기록 없음',
  },
  /** ⭐ 무엇을 뜻하는 수인지 계산식으로 보인다 — 「0.25」만으로는 무엇의 0.25인지 모른다. */
  formula: (ratio: number): string => `수량 × ${String(ratio)}`,
  period: {
    open: (from: string): string => `${from} ~`,
    closed: (from: string, to: string): string => `${from} ~ ${to}`,
  },
} as const;
