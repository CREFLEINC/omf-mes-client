/** 부품 공장 IQC 수입검사(omf-all-around#211) — 고객사 성적서·레퍼런스 화면의 말을 따른다. */
export const partsIqcInspection = {
  title: 'IQC (수입검사) 조회·판정',
  breadcrumbRoot: '품질 관리',
  plant: '공장',

  /** 검사 이력 · 오늘 입고(사용자 지시 2026-10-30). */
  tabs: { input: '검사 진행', history: '검사 이력' },
  history: {
    loading: '검사 이력을 불러오는 중입니다.',
    failed: '검사 이력을 불러오지 못했습니다.',
    empty: '검사 이력이 없습니다.',
    emptyHint: '검사 결과를 저장하면 이곳에 기록됩니다.',
    round: '회차',
    roundNo: (n: number) => `${String(n)}회차`,
    inspectedAt: '검사일시',
    inspector: '검사자',
    inspectedQty: '검사 수량',
    rejectedQty: '불합격량',
    judgment: '판정',
    status: '상태',
    statusOf: { DRAFT: '작성 중', CONFIRMED: '확정' } as Record<string, string>,
    noMeasurements: '검사 이력이 없습니다.',
    defects: '불량 유형',
  },
  today: '오늘 입고',
  todayOn: '오늘 입고만 보기 ON — 누르면 끕니다',
  todayOff: '오늘 들어온 검사 건만 봅니다',

  /** 검사 기준 조회 팝업(사용자 지시 2026-10-30). */
  plan: {
    open: '기준 조회',
    title: '검사 기준 상세',
    edit: '수정',
    version: '버전',
    versionNo: (no: number) => `${String(no)}판`,
    /** 검사 회차(사용자 지시 2026-11-18 · omf-all-around#296) — 결과 창에서 열 때만. */
    seq: '검사 회차',
    seqNo: (no: number) => `${String(no)}회차`,
    facts: {
      planCode: '기준서 코드',
      effectiveFrom: '적용 시작일',
    },
    dataTypeOf: { NUMERIC: '수치형', BOOLEAN: '선택형', TEXT: '텍스트형' } as Record<
      string,
      string
    >,
    sampling: '검사 방식',
    full: '전수검사',
    /* 시료 수를 풀어 쓴다 — 「3개」만으로는 검사 항목 개수로 읽혔다(사용자 지시 2026-11-23 · #353). */
    ratio: (r: number) => `샘플 LOT 의 ${String(r)}%`,
    qty: (n: number) => `샘플 ${String(n)}개`,
    no: 'No.',
    method: '유형',
    count: '차수',
    acceptance: '허용 불량 수',
    okNg: 'OK / NG',
    items: '검사 항목',
    itemCount: (n: number) => `(${String(n)}개)`,
    /** 등록된 검사 항목이 없을 때 — 「도면 미등록」과 같은 자리(사용자 지시 2026-11-26). */
    itemsNone: '검사 항목 미등록',
  },

  dialog: {
    reinspectNote: '제출하면 새 검사 회차가 추가되며, 기존 결과는 유지됩니다.',
    title: 'IQC 수입검사',
    loading: '검사 정보를 불러오는 중입니다.',
    loadFailed: '검사 정보를 불러오지 못했습니다.',
    noPlan: '적용된 검사 기준이 없습니다. 종합 판정만 입력하고, 판정 근거 자료는 첨부해 주세요.',
    planVersionNote:
      '변경한 검사 기준은 새로 발행되는 IQC 검사 건부터 적용됩니다. 이미 발행된 건에는 발행 당시의 기준이 적용됩니다.',
    setPlan: '검사기준 설정',
    confirmed: (judgment: string) => `이미 확정된 검사입니다 — 판정: ${judgment}`,
    workerMissing:
      '이 계정에 연결된 작업자가 없어 검사자를 정할 수 없습니다. 관리자에게 작업자 연결을 요청하세요.',
    discardConfirm: '입력한 내용이 저장되지 않았습니다. 검사를 닫으면 입력값이 모두 사라집니다.',
  },

  target: {
    heading: '검사 대상',
    itemCode: '자재 코드 No.',
    itemName: '자재명',
    plan: '검사 기준서',
    planName: '모델',
    condition: '검사 조건',
    /** 「AQL 1.0」 — 정수도 소수 한 자리로(G2 L13). */
    conditionAql: (aql: number) =>
      `AQL ${Number.isInteger(aql) ? aql.toFixed(1) : String(aql)} · 육안 검사`, // ui-check-ignore: C-13 설계 확정 표기 「AQL 1.0 · 육안 검사」(screens/W-01-01.md)
    conditionNone: '미지정',
    /* AQL 샘플링 기준 — LOT 수량으로 표에서 낸 시료 수 · 합격/불합격 판정 수(omf-all-around#264). */
    conditionAqlPlan: (aql: number, level: string, n: number, ac: number, re: number) =>
      `AQL ${String(aql)} · ${level} → 시료 ${String(n)}개, 불량 ${String(ac)}개 이하 합격 · ${String(re)}개 이상 불합격`,
    sample: '시료 수',
    /** AQL 기준이면 위 「검사 조건」이 외관 시료를 말한다 — 이 줄은 치수 항목의 시료 · 허용 수다(omf-all-around#264). */
    sampleDimension: '치수 시료 수',
    sampleValue: (n: number, c: number) => `시료 n=${String(n)}, C=${String(c)}`,
    dimensionCount: '치수 항목',
    inspector: '검사자',
  },

  lot: {
    heading: 'LOT 정보',
    supplier: '공급업체',
    lotNo: 'LOT 번호',
    qty: 'LOT 수량',
    receivedAt: '입하일시',
    inspectedQty: '검사 수량',
    invalidInspectedQty: '1 이상 정수를 입력하세요.',
    inspectedAt: '검사일시',
    inspectedTime: '검사일시',
    inspectedHour: '검사 시각(시)',
    inspectedMinute: '검사 시각(분)',
    hourHead: '시',
    minuteHead: '분',
    timePlaceholder: '시각을 선택하세요',
  },

  dimension: {
    /** 치수 · 기타 항목을 한 상자로(사용자 지시 · #252). */
    heading: '검사 항목',
    progress: (done: number, total: number) => `${String(done)}/${String(total)} 항목`,
    item: 'No.',
    /** 규격 왼쪽 — 항목 이름(#247 · 사용자 지시 2026-11-10). */
    content: '검사 내용',
    spec: '규격',
    sample: (n: number) => `n${String(n)}`,
    judgment: '판정',
    cell: (seq: number, n: number) => `항목 ${String(seq)} n${String(n)} 측정값`,
    state: { err: '규격 밖', empty: '미입력', wait: '덜 적음', done: '완료' },
    none: '검사 항목 없음',
  },

  drawing: {
    heading: '기준서 도면',
    alt: (n: number) => `검사기준서 도면 ${String(n)}`,
    none: '도면 미등록',
    prev: '이전 도면',
    next: '다음 도면',
  },

  visual: {
    unit: '개',
    checks: '기타 검사 항목',
    checkNo: 'No.',
    checkItem: '검사 항목',
    /** 텍스트 항목의 글 칸(#247 · 사용자 지시 2026-11-10) — 다른 항목 줄은 비어 있다. */
    checkValue: '측정 결과',
    checkValueLabel: (name: string) => `${name} 측정 결과`,
    /** AQL 기준에서 NG 인 항목의 찾은 불량 수(omf-all-around#264) */
    defects: '불량 수',
    defectsLabel: (name: string) => `${name} 불량 수`,
    defectsRequired: 'NG 를 고른 항목에 찾은 불량 수(1 ~ 검사 수량)를 적어 주세요.',
    remarks: '비고',
    remarksPlaceholder: '비고를 입력하세요',
  },

  verdict: {
    heading: '판정',
    suggested: '자동 판정 결과',
    pending: '검사 항목 입력 후 판정 결과를 확인하세요.',
    noPlan: '검사 기준이 없어 자동 판정을 하지 않습니다.',
    waiting: '판정 대기',
    overall: '종합 판정',
    rejectedQty: (qty: number) => `(불량 수량 ${String(qty)})`,
    reason: '판정 변경 사유',
    reasonHint: '자동 판정과 다르게 확정하려면 사유를 입력하세요.',
  },

  judgment: { ACCEPTED: '합격', REJECTED: '불합격', HELD: '보류' } as Record<string, string>,
  /** 생략된 의뢰의 읽기 전용 요약(#225). */
  skipped: {
    /* 생략으로 닫힌 의뢰 안내(사용자 정정 2026-11-23 · omf-all-around#353). */
    notice: '기본 설정에 따라 검사를 생략했습니다.',
    /* 생략 건 요약 — IQC · PQC · OQC 공통 틀(#353). */
    requestNo: '의뢰번호',
    /** 생략 건은 진행할 검사가 없어 첫 탭 이름을 「검사 상세」로(사용자 정정 2026-11-23 · #353). */
    detailTab: '검사 상세',
    /** 품목은 품목코드 · 품목명 두 칸으로 나눠 보인다(품목 표기 분리). */
    itemCode: '품목코드',
    itemName: '품목명',
    titlePqc: 'PQC 공정검사',
    titleOqc: 'OQC 출하검사',
  },

  requestStatus: {
    /* 상단 건수 칩(대기 · 진행)과 같은 말(사용자 지시 2026-11-16 · #274). */
    REQUESTED: '대기',
    IN_PROGRESS: '진행',
    SKIPPED: '검사 생략',
  } as Record<string, string>,
  ok: 'OK',
  ng: 'NG',

  footer: {
    undo: '되돌리기',
    redo: '다시 실행',
    clear: '비우기',
    submit: '제출',
    submitting: '제출 중…',
    submitted: '검사를 확정했습니다.',
  },
  /** 제출 확인 창(사용자 시안 2026-11-04). 조사는 판정 끝 글자의 받침으로 고른다(합격으로 · 보류로). */
  confirm: {
    title: (judgment: string): string => {
      const last = judgment.charCodeAt(judgment.length - 1) - 0xac00;
      const batchim = last >= 0 && last <= 11171 ? last % 28 : 0;
      return `${judgment}${batchim === 0 || batchim === 8 ? '로' : '으로'} 확정하시겠습니까?`;
    },
    note: '확정 후에는 판정을 변경할 수 없습니다.',
    target: '검사 대상',
    lot: 'LOT',
    supplier: '공급업체',
    dimension: '치수 검사',
    dimensionValue: (out: number, missing: number) =>
      `규격 밖 ${String(out)} · 미입력 ${String(missing)}`,
    checksValue: (ng: number, missing: number) => `NG ${String(ng)} · 미판정 ${String(missing)}`, // ui-check-ignore: C-13 사용자 지시 표기(#247)
    ok: '이상 없음',
    check: '확인 필요',
    back: '돌아가기',
    action: (judgment: string) => `${judgment} 확정`,
  },
};
