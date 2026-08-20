/**
 * W-06-10 연계 동기화 현황·실패 재처리.
 *
 * 이 저장소의 첫 조회 형 화면이다 — 목록을 읽는 것이 주 동작이고 쓰기는 재처리뿐이다.
 *
 * 상태·연계 종류·방향·대상 유형의 코드 값 목록이 확정되지 않았다. 화면은 이름을 지어내지 않고
 * 모르는 코드를 코드 문자열 그대로 낸다 — 여기에 값 목록을 채워 넣지 않는다.
 */
export const integrationSync = {
  title: '연계 동기화 현황',
  breadcrumbRoot: '기준정보',
  fields: {
    periodFrom: '기간 시작',
    periodTo: '기간 종료',
    status: '상태',
    interfaceCode: '연계 종류',
    direction: '방향',
    targetType: '대상 유형',
    retryMin: '시도 횟수 하한',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    retry: '재처리',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 메시지 키를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「재처리」로 이 버튼을 부를 수 없다.
     */
    retryRow: (messageKey: string): string => `${messageKey} 재처리`,
    reload: '다시 조회',
    batchRetry: '선택 일괄 재처리',
  },
  /**
   * 선택 일괄 재처리. **부분 실패를 허용한다** — 전체를 되돌리지 않으므로
   * 성공 건수와 실패 건별 사유를 함께 낸다.
   */
  batch: {
    selectionCount: (count: number): string => `선택 ${String(count)}건`,
    confirmTitle: (count: number): string => `선택한 ${String(count)}건을 다시 보낼까요?`,
    confirmDescription: '일부만 성공할 수 있습니다. 결과를 건별로 알려 드립니다.',
    resultTitle: '재처리 결과',
    failedListLabel: '보내지 못한 건',
    allSucceeded: (count: number): string => `${String(count)}건을 다시 보냈습니다.`,
    partial: (succeeded: number, failed: number): string =>
      `${String(succeeded)}건을 다시 보냈습니다. ${String(failed)}건은 보내지 못했습니다.`,
    /** 서버가 준 위치 번호가 보낸 건수 밖일 때. 그 항목을 버리지 않고 이렇게 밝힌다. */
    unknownItem: '어느 건인지 알 수 없습니다.',
    noReason: '사유를 받지 못했습니다.',
  },
  /**
   * 재처리 — 같은 메시지 키로 다시 보낸다. 새 건을 만들지 않는다.
   * 되돌리기 쉽지 않은 조작이라 확인을 한 단계 둔다.
   */
  retry: {
    confirmTitle: '다시 보낼까요?',
    confirmDescription: '같은 메시지 키로 다시 보냅니다. 새 건을 만들지 않습니다.',
    requested: '다시 보내도록 요청했습니다',
  },
  /**
   * 재처리 실패. 「저장」 어휘를 쓰는 공통 배너를 쓰지 않는다 —
   * 이 화면의 쓰기는 저장이 아니라 재처리 요청이라 「다시 저장하세요」가 뜻을 잃는다.
   */
  retryError: {
    title: '다시 보내지 못했습니다',
    /** 상태가 실패가 아닌 건. 서버 문구가 비어도 이 안내는 남는다. */
    notRetryable: '지금 상태에서는 다시 보낼 수 없습니다. 목록을 다시 조회해 상태를 확인하세요.',
    workerLease: '이 건을 처리하는 작업이 진행 중입니다. 잠시 뒤 다시 시도하세요.',
    /** 시작 시각을 알 때. 모르면 위 문구를 그대로 쓴다 — 시각을 지어내지 않는다. */
    workerLeaseAt: (time: string): string =>
      `이 건을 처리하는 작업이 ${time}부터 진행 중입니다. 잠시 뒤 다시 시도하세요.`,
    user: '다른 사용자가 이 건을 먼저 처리했습니다. 목록을 다시 조회해 상태를 확인하세요.',
    erpSync: '외부 시스템에서 이 건이 다시 동기화됐습니다. 목록을 다시 조회해 상태를 확인하세요.',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/integration-sync/message-table.tsx에 있다. */
  table: {
    messageKey: '메시지 키',
    interfaceCode: '연계 종류',
    status: '상태',
    retryCount: '시도',
    createdAt: '생성',
    lastErrorMessage: '마지막 오류',
    retry: '재처리',
  },
  /** 비활성 사유는 그 컨트롤의 이름으로 시작한다. */
  reasons: {
    searchNeedsPeriod: '조회는 기간을 모두 채운 뒤에 쓸 수 있습니다. 시작일과 종료일을 고르세요.',
    periodReversed: '기간 종료는 기간 시작보다 앞설 수 없습니다.',
    batchNeedsSelection: '선택 일괄 재처리는 목록에서 건을 고른 뒤에 쓸 수 있습니다.',
  },
  loading: {
    messages: '연계 메시지 목록을 불러오는 중',
    messageDetail: '연계 메시지 정보를 불러오는 중',
  },
  /**
   * 상세. 목록에 없는 항목만 여기서 늘어난다.
   *
   * 전송 내용(전문)은 **구획만 두고 값을 그리지 않는다** — 열람 범위가 정해지지 않았다.
   */
  detail: {
    title: '연계 메시지 상세',
    openAction: (messageKey: string): string => `${messageKey} 상세 열기`,
    direction: '방향',
    target: '대상',
    createdAt: '생성',
    availableAt: '다음 시도',
    sentAt: '전송',
    completedAt: '완료',
    lockedBy: '처리 중',
    lastErrorMessage: '마지막 오류',
    payload: '전송 내용',
    payloadAction: '전송 내용 보기',
    payloadLocked: '전송 내용은 열람 범위가 정해진 뒤에 볼 수 있습니다. 지금은 표시하지 않습니다.',
    /*
     * 대상은 유형 코드와 번호를 그대로 낸다. 유형에서 어느 목록을 찾을지의 지도가 없어
     * 화면이 이름을 만들 수 없다 — 지어내지 않는다.
     */
    targetValue: (typeCode: string, id: number): string => `${typeCode} · ${String(id)}`,
    lockedValue: (worker: string, at: string): string => `${worker} (${at})`,
  },
  /**
   * 상태 열의 보조 한 줄. 계약이 정의한 사실만 옮긴다 —
   * 「잠금이 오래됐다」·「재시도 한도를 넘었다」 같은 판정은 하지 않는다.
   */
  status: {
    failed: '실패',
    processing: (time: string): string => `${time}부터 처리 중`,
    /** 처리 중인 것은 분명한데 시작 시각이 없을 때. 시각을 지어내지 않는다. */
    processingNoTime: '처리 중',
    autoRetry: (time: string): string => `${time} 자동 재시도`,
  },
  /**
   * 조건 줄. 선택지는 조회한 기록에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * 「한 번도 실행되지 않은 것」만 적으면 기간·범위 밖의 값이 빠진 사실이 숨는다.
   */
  filters: {
    all: '전체',
    optionsNote:
      '선택지는 조회한 기간의 기록에서 만듭니다. 한 번도 실행되지 않았거나 이 기간에 없는 값은 목록에 없습니다.',
    chipStatus: (value: string): string => `상태: ${value}`,
    chipInterface: (value: string): string => `연계 종류: ${value}`,
    chipDirection: (value: string): string => `방향: ${value}`,
    chipTargetType: (value: string): string => `대상 유형: ${value}`,
    chipRetryMin: (value: string): string => `시도 횟수 하한: ${value}`,
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveInterface: '연계 종류 조건 제거',
    chipRemoveDirection: '방향 조건 제거',
    chipRemoveTargetType: '대상 유형 조건 제거',
    chipRemoveRetryMin: '시도 횟수 하한 조건 제거',
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
    noResultTitle: '조건에 맞는 기록이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    noPeriodTitle: '기간을 고르고 조회하세요',
    noPeriodDescription: '연계 기록은 기간을 정해야 조회할 수 있습니다.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
} as const;
