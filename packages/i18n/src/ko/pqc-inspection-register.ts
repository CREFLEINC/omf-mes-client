/**
 * W-03-11 PQC 검사 등록·조회(관리웹 · omf-all-around#107).
 *
 * 검사 항목·결과 입력·확정의 말은 POP 의 PQC 제품 검사(`pqcInspection`)를 그대로 쓴다 — 같은 판정을
 * 두 자리가 다른 말로 부르지 않는다. 여기에는 목록·화면 틀의 말만 둔다.
 */
export const pqcInspectionRegister = {
  title: 'PQC (공정검사) 조회·판정',
  breadcrumbRoot: '품질 관리',

  queue: {
    heading: '검사 의뢰',
    caption: 'PQC 검사 의뢰 목록',
    pendingOnly: '대기·진행만 보기',
    empty: '조회된 검사 의뢰가 없습니다.',
    /** 빈 목록 아래 안내 — 제목과 함께 `EmptyState` 로 보인다(omf-all-around#171). */
    emptyHint: '검색 조건을 변경하거나 필터를 초기화하세요.',
    unavailable: '목록을 표시할 수 없습니다.',
    loading: 'PQC 검사 의뢰를 불러오는 중입니다.',
  },

  detail: {
    paneLabel: '검사 입력',
    nothingSelected: '왼쪽 목록에서 검사할 의뢰를 고르세요.',
    /** 상세는 목록과 나뉜 한 화면이다(#135 · IQC #133 과 같다) — 경로 셋째 단계와 돌아가기. */
    sectionTitle: '검사 기본 정보',
    backToList: '← 목록',
    leaveUnsaved: '변경사항을 저장하지 않았습니다',
    leaveUnsavedNote: '저장하지 않고 이동하면 입력한 내용이 사라집니다.',
    keepEditing: '계속 작성',
    leaveAnyway: '저장하지 않고 이동',
  },

  /** 목록 조건 줄(#135) — IQC 판정 화면(#133)과 같은 말. */
  filters: {
    item: '품목 검색',
    itemPlaceholder: '품목을 입력하세요',
    itemPick: '선택',
    itemClear: '품목 조건 지우기',
    workOrder: '작업지시 검색',
    workOrderPlaceholder: '작업지시를 입력하세요',
    workOrderNotFound: '일치하는 작업지시가 없습니다.',
    workOrderAmbiguous: '여러 작업지시가 맞습니다. 번호를 정확히 입력하세요.',
    workOrderFailed: '작업지시를 찾지 못했습니다. 다시 조회하세요.',
    lotNoRequest: '이 LOT 의 작업지시에 대기 중인 공정검사 의뢰가 없습니다.',
    keyword: '의뢰번호 검색',
    keywordPlaceholder: '의뢰번호를 입력하세요',
    apply: '조회',
    reset: '초기화',
  },

  /** 목록 표 열(#135) — 내부 번호 대신 작업지시 번호 · 품목 이름·코드. */
  columns: {
    lot: '대상 LOT',
    workOrder: '작업지시',
    item: '품목',
    targetQty: '검사 수량',
    status: '상태',
    requestedAt: '의뢰 일시',
  },

  /** 관리웹 상세(#135) — IQC 판정 화면(#133)과 같은 짜임·말. POP 의 말(`pqcInspection`)은 그대로 둔다. */
  web: {
    /** 생산 실적이 없어 판정을 막을 때(#135) — 관리웹 말. POP 의 말(`pqcInspection.result.noProductionResult`)은 그대로 둔다. */
    noProductionResult: '생산 실적이 없으므로 판정할 수 없습니다.',
    /** 검사기준이 없을 때 「검사 내용」 이름 옆 안내와 입력 칸 안내(#135) — 관리웹 말. POP 의 말(`pqcInspection.noStandard`)은 그대로 둔다. */
    noStandardNote:
      '이 의뢰에는 검사기준이 등록되어 있지 않습니다. 필요 시 검사 내용을 입력하세요.',
    remarksPlaceholder: '검사 내용을 입력하세요.',
    summary: {
      heading: '검사 기본 정보',
      inspectionRequestNo: '의뢰번호',
      workOrder: '작업지시',
      item: '품목',
      targetQty: '총 검사 수량',
      inspectionType: '검사 유형',
      inspectionTypeName: 'PQC (공정검사)',
      plan: '적용 검사 기준',
      noPlan: '미지정',
      lot: '대상 LOT',
      lotMore: (first: string, rest: number): string => `${first} 외 ${String(rest)}건`,
      requestedAt: '의뢰 일시',
    },
    items: {
      heading: '검사 항목별 결과',
      progress: (judged: number, total: number): string =>
        `판정 ${String(judged)} / ${String(total)}`,
      columns: {
        item: '검사 항목',
        spec: '규격',
        sample: '측정 회차',
        value: '측정 결과',
        judgment: '판정',
      },
      sampleOf: (sampleNo: number): string => `${String(sampleNo)}회차`,
      valueLabel: (item: string, sampleNo: number): string =>
        `${item} ${String(sampleNo)}회차 측정 결과`,
      judgmentLabel: (item: string, sampleNo: number): string =>
        `${item} ${String(sampleNo)}회차 판정`,
      tolerance: (value: number, delta: number): string => `${value} ± ${delta}`,
      target: (value: number): string => `기준값 ${value}`,
      withTarget: (limits: string, value: number): string => `${limits} (기준값 ${value})`,
    },
    quantity: {
      heading: '검사 수량 입력',
      targetQty: '총 검사 수량',
      round: (round: number): string => `${String(round)}회차`,
      inspectedQty: '검사 수량',
      accepted: '합격 수량',
      rejected: '불합격 수량',
      held: '보류 수량',
      entered: '입력 완료',
      remaining: '미입력',
      overBy: (over: string): string => `${over} 초과`,
      overNote: (over: string): string => `검사 수량보다 ${over} 많습니다.`,
      progressLabel: '검사 수량 대비 입력 합계',
    },
    judgment: {
      heading: '판정',
      label: '최종 판정',
      placeholder: '최종 판정을 선택하세요',
    },
    actions: {
      confirm: '판정 확정',
      confirmNote: '판정 확정 후 수정이 불가합니다.',
      confirmed: '판정이 확정되어 수정할 수 없습니다.',
    },
  },
};
