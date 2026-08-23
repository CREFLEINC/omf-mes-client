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
    /** 한 정책이 축을 둘 이상 지정할 수 있다 — 지정된 것을 우선순위 차례로 잇는다. */
    join: ' · ',
    entry: (axisLabel: string, valueLabel: string): string => `${axisLabel} ${valueLabel}`,
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
