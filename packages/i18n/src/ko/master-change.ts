/**
 * W-06-11 마스터 변경관리. 이 저장소의 **첫 읽기 전용 조회 형** 화면이라 쓰기 어휘가 하나도 없다.
 *
 * **「Rev」를 사용자 문구에 쓰지 않는다** — 업계 약어라 화면에서는 「개정」으로 쓴다.
 *
 * **전후 값의 항목 이름 문구가 이 묶음에 없다.** 계약이 그 값의 키 구조를 정하지 않아
 * 키→우리말 대응표를 두면 화면이 뜻을 지어낸다. 받은 키를 그대로 낸다.
 */
export const masterChange = {
  title: '마스터 변경관리',
  breadcrumbRoot: '기준정보',
  fields: {
    /*
     * 기간은 **한 컨트롤**이다(변경 통지 #63) — 시작·종료 두 칸이 `DatePicker mode="range"`
     * 하나로 합쳐졌다. 라벨도 하나여야 해서 두 칸 시절의 이름을 그대로 둘 수 없다.
     */
    period: '조회 기간',
    targetType: '대상 종류',
    targetId: '대상',
    eventType: '사건 종류',
    performedBy: '수행자',
    correlationId: '상관 식별자',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    viewDiff: '보기',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 발생 시각을 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「보기」로 이 버튼을 부를 수 없다.
     */
    viewDiffRow: (occurredAt: string): string => `${occurredAt} 변경 내용 보기`,
    newRevision: '신규 개정 발행',
  },
  /** 비활성 사유는 그 컨트롤의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    searchNeedsPeriod: '조회는 기간을 모두 채운 뒤에 쓸 수 있습니다. 시작일과 종료일을 고르세요.',
    periodReversed: '기간 종료는 기간 시작보다 앞설 수 없습니다.',
    /*
     * 개정 발행은 「어느 마스터의 어느 판을 복사할 것인가」를 요구하는데 이 화면에는 그 대상이 없다.
     * 버튼을 감추지 않는 이유는 개정 발행이 어디서 이루어지는지를 여기서 알 수 있어야 해서다.
     * 이동 링크는 두지 않는다 — 대상 식별자가 어느 표를 가리키는지 데이터로 판정되지 않는다.
     */
    newRevisionElsewhere:
      '신규 개정 발행은 이 화면에서 할 수 없습니다. 개정은 각 마스터 화면에서 발행합니다.',
  },
  loading: {
    events: '변경 이력 목록을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/master-change/event-table.tsx에 있다. */
  table: {
    occurredAt: '발생 시각',
    targetType: '대상 종류',
    targetId: '대상',
    eventType: '사건 종류',
    performedBy: '수행자',
    /** 받은 키 이름을 그대로 이어 담는 흡수 열. 이름을 우리말로 바꾸지 않는다. */
    changedKeys: '바뀐 항목',
    diff: '변경 내용',
  },
  /**
   * 변경 내용 창. **항목 이름 문구가 없다** — 전후 값의 키는 받은 그대로 낸다.
   *
   * 전후 값을 받지 못한 경우는 계약이 허용하고 목 서버가 실제로 그렇게 내려준다.
   * 빈 표를 내거나 값을 지어내지 않고 받지 못했다는 사실을 밝힌다.
   */
  diff: {
    title: '변경 내용',
    auditEventId: '이력 번호',
    terminalId: '단말',
    reason: '사유',
    noValuesTitle: '전후 값을 받지 못했습니다',
    noValuesDescription: '이 건에는 변경 전후 항목이 담겨 있지 않습니다.',
  },
  /**
   * 조건 줄. 선택지는 조회한 기록에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * ① 아직 확정되지 않은 **임시 목록**이라는 것 ② 이 기간의 기록에서 만들어
   * 한 번도 기록되지 않았거나 기간 밖의 값은 빠진다는 것.
   */
  filters: {
    all: '전체',
    optionsNote:
      '대상 종류·사건 종류는 아직 확정되지 않은 임시 목록입니다. 조회한 기간의 기록에서 만들어, 한 번도 기록되지 않았거나 이 기간에 없는 값은 목록에 없습니다.',
    chipTargetType: (value: string): string => `대상 종류: ${value}`,
    chipTargetId: (value: string): string => `대상: ${value}`,
    chipEventType: (value: string): string => `사건 종류: ${value}`,
    chipPerformedBy: (value: string): string => `수행자: ${value}`,
    chipCorrelationId: (value: string): string => `상관 식별자: ${value}`,
    chipRemoveTargetType: '대상 종류 조건 제거',
    chipRemoveTargetId: '대상 조건 제거',
    chipRemoveEventType: '사건 종류 조건 제거',
    chipRemovePerformedBy: '수행자 조건 제거',
    chipRemoveCorrelationId: '상관 식별자 조건 제거',
  },
  /**
   * 쪽 이동. 번호 목록을 두지 않는다 — 로그성 조회에서 「7쪽으로 점프」는 정상 경로가 아니고,
   * 조건을 좁히는 것이 정상 경로다.
   */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 변경 이력이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    noPeriodTitle: '기간을 고르고 조회하세요',
    noPeriodDescription: '변경 이력은 기간을 정해야 조회할 수 있습니다.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
} as const;
