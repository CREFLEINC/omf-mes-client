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
    rejectedQty: '불합격 수량',
    judgment: '판정',
    status: '상태',
    statusOf: { DRAFT: '작성 중', CONFIRMED: '확정' } as Record<string, string>,
    noMeasurements: '검사 이력이 없습니다.',
    defects: '불량 유형',
  },
  today: '오늘 입고',
  todayOn: '오늘 입고만 보기 켜짐 — 누르면 끕니다',
  todayOff: '오늘 들어온 검사 건만 봅니다',

  /** 검사 기준 조회 팝업(사용자 지시 2026-10-30). */
  plan: {
    open: '기준 조회',
    title: '검사 기준 상세',
    edit: '수정',
    version: '버전',
    versionNo: (no: number) => `${String(no)}판`,
    facts: {
      planCode: '기준서 코드',
      planName: '모델명',
      effectiveFrom: '적용 시작일',
    },
    dataTypeOf: { NUMERIC: '수치형', BOOLEAN: '선택형', TEXT: '텍스트형' } as Record<
      string,
      string
    >,
    sampling: '검사 방식',
    full: '전수검사',
    ratio: (r: number) => `LOT 의 ${String(r)}%`,
    qty: (n: number) => `${String(n)}개`,
    no: '번호',
    method: '방법',
    count: '시료 수',
    acceptance: '허용 불량 수',
    okNg: 'OK / NG',
    items: '검사 항목',
    itemCount: (n: number) => `(${String(n)}개)`,
  },

  dialog: {
    reinspectNote: '제출하면 새 검사 회차가 추가되며, 기존 결과는 유지됩니다.',
    title: 'IQC 수입검사',
    loading: '검사 정보를 불러오는 중입니다.',
    loadFailed: '검사 정보를 불러오지 못했습니다.',
    noPlan:
      '이 품목에 적용할 검사기준이 없어 검사를 입력할 수 없습니다. 검사기준을 먼저 확정하세요.',
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
    conditionAql: (aql: number) => `AQL ${String(aql)} · 육안 검사`,
    conditionNone: '미지정',
    sample: '시료 수',
    sampleValue: (n: number, c: number) => `시료 n=${String(n)}, C=${String(c)}`,
    dimensionCount: '치수 항목',
    inspector: '검사자',
  },

  lot: {
    heading: 'LOT 정보',
    supplier: '공급업체',
    lotNo: 'LOT 번호',
    qty: 'LOT 수량',
    receivedAt: '입고일시',
    inspectedQty: '검사 수량',
    invalidInspectedQty: '1 이상 정수를 입력하세요.',
    inspectedAt: '검사일시',
    inspectedTime: '검사 시각',
    inspectedHour: '검사 시각(시)',
    inspectedMinute: '검사 시각(분)',
    hourHead: '시',
    minuteHead: '분',
    timePlaceholder: '시각 선택',
  },

  dimension: {
    heading: '치수 측정',
    progress: (done: number, total: number) => `${String(done)}/${String(total)} 항목`,
    item: 'No.',
    /** 규격 왼쪽 — 항목 이름(#247 · 사용자 지시 2026-11-10). */
    content: '검사 내용',
    spec: '규격',
    sample: (n: number) => `n${String(n)}`,
    judgment: '판정',
    cell: (seq: number, n: number) => `항목 ${String(seq)} n${String(n)} 측정값`,
    state: { err: '규격 밖', empty: '미입력', wait: '덜 적음', done: '완료' },
    none: '측정 항목 없음',
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
    remarks: '비고',
    remarksPlaceholder: '비고를 입력하세요',
  },

  verdict: {
    heading: '판정',
    suggested: '자동 판정 결과',
    pending: '검사 항목 입력 후 판정 결과를 확인하세요.',
    waiting: '판정 대기',
    overall: '종합 판정',
    rejectedQty: (qty: number) => `(불량 수량 ${String(qty)})`,
    reason: '판정 변경 사유',
    reasonHint: '자동 판정과 다르게 확정하려면 사유를 입력하세요.',
  },

  judgment: { ACCEPTED: '합격', REJECTED: '불합격', HELD: '보류' } as Record<string, string>,
  /** 생략된 의뢰의 읽기 전용 요약(#225). */
  skipped: {
    notice: (basis: string | null): string =>
      basis === null
        ? '검사를 생략한 의뢰입니다. 입력할 검사 결과가 없습니다.'
        : `검사를 생략한 의뢰입니다(${basis}). 입력할 검사 결과가 없습니다.`,
    basis: { DEFAULT: '기본 설정', APPROVAL: '결재 승인' } as Record<string, string>,
  },
  requestStatus: {
    REQUESTED: '검사 대기',
    IN_PROGRESS: '검사 진행 중',
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
    checksValue: (ng: number, missing: number) => `NG ${String(ng)} · 미판정 ${String(missing)}`,
    ok: '이상 없음',
    check: '확인 필요',
    back: '돌아가기',
    action: (judgment: string) => `${judgment} 확정`,
  },
};
