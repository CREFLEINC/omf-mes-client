/**
 * P-04-04 재구성 신규 라벨 발행.
 *
 * ⚠ **지금 서 있는 것은 발행·인쇄뿐이다**(`omf-mes#418`). ① 발행 대기 목록과 ② 신규 발번은
 * 계약이 「무엇을 몇 개 만들어야 하는가」와 「이미 처리한 건인가」를 나르지 못해 만들지 않았다 —
 * 그래서 이 문구 묶음에도 그 두 구획의 말이 없다.
 */
export const repackLabelIssue = {
  title: '재구성 라벨 발행',

  /** 진입 — 대상 포장·사번을 받는다. 없으면 그 사실을 사유로 말한다. */
  entry: {
    handlingUnitLabel: '포장',
    workerLabel: '사번',
    missingHandlingUnit: '대상 포장을 받지 못해 라벨을 발행할 수 없습니다.',
    missingWorker: '사번이 확인되지 않아 라벨을 발행할 수 없습니다. 사번 인증을 먼저 하세요.',
  },

  /** 단말 기능 구성 판정. 「확인할 수 없다」와 「권한이 없다」를 다르게 말한다. */
  gate: {
    checking: '출력 권한을 확인하는 중입니다.',
    denied: '이 단말에서는 라벨을 출력할 수 없습니다. 담당자에게 문의하세요.',
    unavailable: '출력 권한을 확인할 수 없습니다. 잠시 후 다시 시도하세요.',
    unidentified: '단말이 확인되지 않아 라벨을 발행할 수 없습니다.',
    /**
     * ⛔ 온라인 전용이다(스펙 §6) — 라벨을 서버가 그리므로 끊긴 채로는 발행해도 인쇄할 것이
     * 오지 않는다. 큐에 쌓아 두는 갈래를 두지 않는다.
     */
    offline:
      '연결이 끊겨 라벨을 발행할 수 없습니다. 라벨은 서버가 그립니다 — 연결된 뒤에 다시 하세요.',
  },

  /** 화면 머리의 장비 상태 — 인쇄가 안 될 때 가장 먼저 보는 자리다. */
  device: {
    printerLabel: '프린터',
    printerUnknown: '프린터를 확인할 수 없습니다',
    printerNone: '쓸 수 있는 프린터가 없습니다',
    terminalLabel: '단말',
    terminalUnknown: '확인되지 않음',
    online: '연결됨',
    offline: '오프라인',
  },

  /** 대상 포장 구획 — 무엇에 붙일 라벨인가. */
  handlingUnit: {
    sectionLabel: '대상 포장',
    noLabel: '포장 번호',
    typeLabel: '유형',
    contentsLabel: '내용물',
    lotColumn: 'LOT',
    itemColumn: '품목',
    qtyColumn: '수량',
    unknownValue: '—',
    empty: '이 포장에 담긴 내용물이 없습니다.',
    loadFailed: '포장을 불러오지 못했습니다.',
    namesFailed: 'LOT·품목 이름을 불러오지 못해 일부 칸이 비어 있습니다.',
    /** 한 포장에 LOT 이 여럿이어도 라벨은 포장 단위 한 장이다(스펙 §4-B — 대상 LOT 을 비운다). */
    mixedLot: (lotCount: number): string => `LOT ${String(lotCount)}건`,
  },

  /** 발행 구획 — 회차·사유·프린터. */
  issue: {
    sectionLabel: '라벨 발행',
    /** 회차는 서버가 매긴다. 화면은 「이번이 몇 번째가 될 것인가」를 세지 않는다. */
    firstIssue: '이 포장의 라벨을 처음 발행합니다.',
    reissue: (issueCount: number): string =>
      `이미 ${String(issueCount)}번 발행했습니다. 다시 발행하면 재발행으로 기록되고 사유가 필요합니다.`,
    summaryFailed: '발행 이력을 불러오지 못했습니다. 사유 입력이 필요한지 알 수 없습니다.',
    lastIssuedAt: '마지막 발행',
    /** 앞선 인쇄가 실패로 남아 있으면 다시 뽑아야 한다는 사실을 먼저 말한다. */
    lastPrintFailed:
      '마지막 인쇄가 실패로 기록돼 있습니다. 라벨이 나오지 않았다면 다시 발행하세요.',

    reasonLabel: '재발행 사유',
    reasonPlaceholder: '사유를 고르세요',
    reasonRequired: '재발행이라 사유가 필요합니다.',
    reasonsFailed: '재발행 사유 목록을 불러오지 못했습니다.',
    reasonsEmpty: '고를 수 있는 재발행 사유가 없습니다.',

    printerLabel: '프린터',
    printerPlaceholder: '프린터를 고르세요',
    printersFailed: '프린터 목록을 불러오지 못했습니다.',
    /** 프린터 축이 단말 마스터에 아직 없어 비어 올 수 있다(착수 이슈 §6). */
    printersEmpty: '이 단말에 등록된 프린터가 없습니다. 담당자에게 문의하세요.',

    submit: '라벨 발행·인쇄',
    preview: '미리보기',
    /** 렌디션 경로가 발행 기록 번호를 받는다 — 발행 전에는 볼 것이 없다(착수 이슈 §6). */
    previewBeforeIssue: '발행한 뒤에 볼 수 있습니다.',
    /** 「확인할 수 없다」에만 준다 — 「권한이 없다」에는 다시 물을 것이 없다(G-3). */
    gateRetry: '다시 확인',
  },

  /** 미리보기 — 서버가 그린 라벨을 그대로 보인다(결정 18 · K-5). */
  preview: {
    title: '라벨 미리보기',
    alt: '발행된 라벨 이미지',
    loading: '라벨을 받는 중입니다.',
    failed: '라벨 이미지를 받지 못했습니다.',
    print: '인쇄',
    close: '닫기',
    /** 창을 닫아도 발행은 남는다 — 감추지 않고 말한다. */
    closeNote: '닫아도 발행 기록은 남습니다. 인쇄는 나중에 다시 할 수 있습니다.',
  },

  /** 발행 이력 — 회차별로 쌓인다(K-1). */
  history: {
    sectionLabel: '발행 이력',
    empty: '아직 발행한 적이 없습니다.',
    failed: '발행 이력을 불러오지 못했습니다.',
    seq: (issueSeq: number): string => `회차 ${String(issueSeq)}`,
    outcome: {
      PENDING: '인쇄 결과 미보고',
      SUCCEEDED: '인쇄 성공',
      FAILED: '인쇄 실패',
    },
  },

  /** 인쇄 절차 — 발행과 갈라져 있다(K-4). */
  print: {
    issued: '발행됐습니다',
    succeeded: '라벨이 인쇄됐습니다.',
    failedTitle: '인쇄하지 못했습니다',
    /** ⛔ 인쇄 실패를 발행 실패로 말하지 않는다. 복구는 「다시 인쇄」다. */
    failedBody: '발행 기록은 남았습니다. 프린터를 확인하고 다시 인쇄하세요.',
    retry: '다시 인쇄',
    /**
     * ⛔ **종이는 나왔다.** 「인쇄하지 못했다」고 말하면 사용자가 한 장을 더 뽑는다 —
     * 여기서 할 일은 결과 보고를 다시 보내는 것뿐이다.
     */
    reportFailedTitle: '인쇄됐지만 결과를 서버에 남기지 못했습니다',
    reportFailedBody: '라벨은 나왔습니다. 다시 인쇄하지 마세요 — 결과 보고만 다시 보냅니다.',
    reportRetry: '보고 다시 보내기',
    shellUnavailable: '이 화면에서는 프린터로 보낼 수 없습니다. POP 단말에서 인쇄하세요.',
  },

  error: {
    issueTitle: '라벨을 발행하지 못했습니다',
    /** 403 — 화면이 막는 것이 아니라 서버가 막은 것이다(스펙 §6). */
    forbidden: '이 단말에는 출력 권한이 없습니다. 담당자에게 문의하세요.',
    /** 다시 눌러도 같은 답이 오는 상태. 값을 고치기 전에는 결과가 같다. */
    rejected: '서버가 요청을 받아들이지 않았습니다. 입력을 확인하세요.',
  },
} as const;
