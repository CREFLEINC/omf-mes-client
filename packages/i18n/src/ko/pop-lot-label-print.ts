/**
 * P-02-07 · LOT 라벨 출력·부착 (POP)
 *
 * ⚠ **목록의 「상태」·「양품」 열을 채우지 못한다.** 목록 조회에 생산 진척을 함께 받는 질의가
 * 없고 상세에만 있다(#143 · #151 이 같은 회신을 기다린다). 비어 있는 열에는 반드시 사유를
 * 붙인다 — 말없이 비우면 「미달이 없다」·「양품이 0이다」로 읽힌다.
 */
export const popLotLabelPrint = {
  title: 'LOT 라벨 출력',

  entry: {
    /** 작업지시 없이 들어온 경우 — POP 은 작업지시를 고른 뒤 진입한다. */
    workOrderMissing: '작업지시를 알 수 없어 대상 LOT 을 불러오지 못했습니다.',
    workOrderMissingHint: '작업 시작 화면에서 작업지시를 고른 뒤 다시 들어오십시오.',
    workOrderLabel: '작업지시',
  },

  lotList: {
    heading: '완료 LOT',
    lotNoColumn: 'LOT 번호',
    statusColumn: '상태',
    goodQtyColumn: '양품',
    issueCountColumn: '발행',
    select: '선택',
    selected: '선택됨',

    /** 값이 없는 자리에 넣는 표시. 숫자 0 과 구분되어야 한다. */
    valuePending: '—',
    /**
     * 「상태」·「양품」이 비어 있는 이유. 두 열이 같은 사유를 공유하므로 안내도 하나다.
     * ⛔ 내부 이슈 번호를 넣지 않는다 — 사용자가 쓰지 않는 말이다.
     */
    progressPending:
      '상태(완료·미달)와 양품 수는 아직 목록에 표시할 수 없습니다. LOT 을 고르면 오른쪽에서 확인할 수 있습니다.',

    /** 발행 이력 — 「한 번도 안 찍힌 것」이 현장의 관심사라 따로 말한다. */
    notIssued: '미출력',
    issuedCount: (count: number) => `${String(count)}회`,
    issueCountUnknown: '발행 이력을 확인하지 못했습니다.',

    empty: '완료된 LOT 이 없습니다.',
    emptyHint: 'LOT 완료 처리를 마치면 이 목록에 나타납니다.',
    loadFailed: '완료 LOT 목록을 불러오지 못했습니다.',
    retry: '다시 시도',

    /** 2단 출력의 나머지 한 단이 다른 화면에 있다는 안내(스펙 §5-3). */
    tagNotice: '인식표는 인식표 발행 화면에서 개체 단위로 발행합니다.',
  },

  printer: {
    label: '프린터',
    none: '등록된 프린터가 없습니다',
    unknown: '프린터 상태를 확인하지 못했습니다',
    noStatusMessage: '상태 정보 없음',
    retry: '다시 시도',
  },

  detail: {
    placeholder: 'LOT 을 고르면 상세와 출력 조작이 여기에 나타납니다.',
    loading: 'LOT 상세를 불러오는 중입니다.',
    loadFailed: 'LOT 상세를 불러오지 못했습니다.',
    retry: '다시 시도',
    lotNo: 'LOT 번호',
    itemLabel: '품목',
    goodQtyLabel: '양품 수',
    statusLabel: '완료 판정',
    issueHistoryLabel: '발행 이력',
    neverIssued: '발행한 적 없음',
    judgment: {
      UNDER: '미달',
      NORMAL: '완료',
      OVER: '초과',
    },
    unknown: '확인할 수 없음',
  },
  action: {
    print: '라벨 출력',
    reprint: '재출력',
    issueFailed: '발행 기록을 만들지 못했습니다.',
    gateRetry: '설정 다시 확인',
    blocked: {
      noTarget: '왼쪽에서 LOT 을 고르세요.',
      noWorker: '사번을 확인한 뒤 출력할 수 있습니다.',
      gateDenied: '이 단말은 라벨 출력 기능이 설정되지 않았습니다.',
      gateUnknown: '단말의 라벨 출력 설정을 확인할 수 없습니다.',
      noPrinter: '사용할 수 있는 프린터가 없습니다.',
      printerUnknown: '프린터 상태를 확인할 수 없습니다.',
      shellUnavailable: 'POP 단말에서만 라벨을 출력할 수 있습니다.',
      issueCountUnknown: '발행 이력을 확인한 뒤 출력할 수 있습니다.',
      reissueReasonMissing: '재출력 사유를 골라야 합니다.',
    },
  },
  print: {
    issued: '발행 기록을 만들었습니다.',
    succeeded: '라벨을 출력했습니다.',
    shellUnavailableTitle: '발행 기록은 남았습니다.',
    shellUnavailableBody: '이 환경에서는 프린터로 보낼 수 없습니다.',
    failedTitle: '라벨 인쇄를 끝내지 못했습니다.',
    failedBody: '발행 기록은 남아 있습니다.',
    retry: '확인',
  },
  reissueDialog: {
    title: '재출력 사유',
    description: '재출력 사유를 남겨야 발행 이력이 맞습니다.',
    label: '사유',
    placeholder: '사유를 고르세요',
    confirm: '재출력',
    cancel: '취소',
    empty: '고를 수 있는 재출력 사유가 없습니다.',
    loadFailed: '재출력 사유를 불러오지 못했습니다.',
  },
} as const;
