/**
 * P-04-04 재구성 신규 라벨 발행.
 *
 * 고정 설계 P-04-04의 발행 대기 → 대상 선택 → 발행·미리보기·인쇄 흐름.
 */
export const repackLabelIssue = {
  /* 설계 §3 머리줄이 「재구성 신규 라벨 발행」이다 — 「신규」가 이 화면이 무엇을 뽑는지 가른다. */
  title: '재구성 신규 라벨 발행',

  /** 진입 — 작업자만 단말 세션에서 받는다. 대상은 발행 대기 목록에서 고른다. */
  entry: {
    handlingUnitLabel: '포장',
    workerLabel: '사번',
    missingHandlingUnit: '발행 대기 목록에서 대상 포장을 선택하세요.',
    missingWorker: '사번이 확인되지 않아 라벨을 발행할 수 없습니다. 사번 인증을 먼저 하세요.',
  },

  pending: {
    sectionLabel: '발행 대기',
    caption: '라벨을 아직 발행하지 않은 신규 포장',
    /*
     * ⭐ **열은 설계 §3 ① 도면 그대로다** — 원 포장 · 유형 · 새 포장 · 잔량 · 확정 시각.
     *
     * ⛔ 신규 포장 «번호»를 이 표에 두지 않는다. 번호는 아래 ② 발번 구획이 보인다.
     */
    sourceColumn: '원 포장',
    typeColumn: '유형',
    newColumn: '새 포장',
    remainderColumn: '잔량',
    occurredColumn: '확정 시각',
    /** 합병은 원 포장이 여럿이다 — 도면이 `CTN-…-0088+89` 로 잇는다. */
    sourceJoin: '+',
    newCount: (count: number): string => `${count}건`,
    /**
     * 재구성 유형의 표시명. ⚠ 계약이 세 값을 열거해 두었다(`SPLIT`·`MERGE`·`RECONFIGURE`) —
     * 공통코드가 아니라 스키마가 못박은 값이라 화면이 이름을 갖는다.
     *
     * ⛔ 모르는 값을 지어내지 않는다 — 받은 코드를 그대로 보인다.
     */
    repackType: (code: string): string =>
      code === 'SPLIT'
        ? '분할'
        : code === 'MERGE'
          ? '합병'
          : code === 'RECONFIGURE'
            ? '재구성'
            : code,
    /** 잔량이 남지 않았다(합병). */
    noRemainder: '—',
    /** 재구성 사건을 찾지 못한 칸. 값이 없는 것과 모르는 것을 같은 표시로 둔다. */
    unknown: '—',
    /**
     * 재구성 사건을 못 찾은 줄의 첫 칸(#1044).
     *
     * ⛔ **아무 말도 하지 않는 줄을 세우지 않는다.** 한때 이 줄은 포장 번호조차 없이 모든 칸이
     * 「—」 라, 작업자가 눌러 보기 전에는 무엇인지 알 수 없었다. 번호는 늘 오므로 적고, 나머지가
     * 왜 비었는지도 함께 적는다.
     *
     * ⛔ **「없다」로 말하지 않는다** — 못 찾은 것과 없는 것은 다르다(전례 `progressUnknown`).
     */
    unknownEvent: (handlingUnitNo: string): string => `${handlingUnitNo} · 재구성 이력 확인 불가`,
    /**
     * 줄을 고르는 단추의 읽어 주는 이름 — **보이는 글자가 앞에 온다**(WCAG 2.5.3).
     * 화면에는 원 포장이 서 있고 고르는 대상은 그 줄이 만든 새 포장이라, 둘을 함께 읽는다.
     *
     * ⚠ 재구성 사건을 못 찾은 줄도 이것을 탄다 — 그때 `sourceText` 가 `unknownEvent` 다.
     * 문구를 따로 두지 않는다: 같은 말을 두 자리에 두면 한쪽만 고쳐져 조용히 어긋난다.
     */
    selectRow: (sourceText: string, handlingUnitNo: string): string =>
      `${sourceText} · 새 포장 ${handlingUnitNo} 선택`,
    selected: '선택됨',
    loading: '발행 대기 포장을 불러오는 중입니다.',
    empty: '현재 발행을 기다리는 포장이 없습니다.',
    loadFailed: '발행 대기 목록을 불러오지 못했습니다.',
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
    /*
     * 포장 유형 — 공통코드로 표시명을 푼다. ⛔ **코드를 그대로 세우지 않는다**(#1045):
     * 현장은 `BOX` 를 읽지 않고, 같은 값을 다른 화면은 「박스」로 쓴다.
     */
    typeLoading: '유형을 확인하는 중',
    typeFailed: '유형을 확인하지 못했습니다',
    /* 표시명을 못 받았을 때만 코드를 보인다. 이름을 지어내지 않는다(전례 #1022). */
    typeUnknown: (code: string): string => `${code} (표시명 없음)`,
    empty: '이 포장에 담긴 내용물이 없습니다.',
    /** ⛔ 「모른다」를 「없다」로 말하지 않는다(G-9) — 아직 받는 중인 것과 못 받은 것을 가른다. */
    loading: '대상 포장을 불러오는 중입니다.',
    loadFailed: '포장을 불러오지 못했습니다.',
    namesFailed: 'LOT·품목 이름을 불러오지 못해 일부 칸이 비어 있습니다.',
    /** 한 포장에 LOT 이 여럿이어도 라벨은 포장 단위 한 장이다(스펙 §4-B — 대상 LOT 을 비운다). */
    mixedLot: (lotCount: number): string => `LOT ${String(lotCount)}건`,
  },

  /** 발행 구획 — 회차·사유·프린터. */
  issue: {
    sectionLabel: '라벨 발행',
    targetsLabel: '인쇄 대상',
    newLabelWaiting: '신규 포장을 선택하면 새 라벨이 기본 선택됩니다.',
    newLabel: (handlingUnitNo: string): string => `새 포장 라벨 · ${handlingUnitNo}`,
    remainderLabel: (handlingUnitNo: string, issueCount: number): string =>
      `잔량 라벨 재출력 · ${handlingUnitNo} (기존 ${String(issueCount)}회)`,
    /**
     * 잔량 줄의 안내 — **한 줄이 둘을 다 말한다**(사용자 지시 2026-09-11). 번호를 새로
     * 매기지 않는다는 것과, 다시 뽑을 까닭이 수량 변경뿐이라는 것이다.
     */
    remainderNumberNote: '기존 번호를 그대로 사용하며, 수량이 변경된 경우에만 다시 출력합니다.',
    remainderFailed: '잔량 라벨 재출력 대상을 확인하지 못했습니다.',
    targetRequired: '인쇄할 라벨을 하나 이상 선택하세요.',
    /** 회차는 서버가 매긴다. 화면은 「이번이 몇 번째가 될 것인가」를 세지 않는다. */
    reissue: (issueCount: number): string =>
      `이미 ${String(issueCount)}번 발행했습니다. 다시 발행하면 재발행으로 기록되고 사유가 필요합니다.`,
    summaryLoading: '발행 현황을 확인하는 중입니다.',
    summaryFailed: '발행 현황을 불러오지 못했습니다. 사유 입력이 필요한지 알 수 없습니다.',
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

    /* 설계 §3 액션바가 「발번·인쇄」다 — 이 화면이 하는 일은 번호를 매기고 뽑는 것이다. */
    submit: '발번·인쇄',
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
    /** 받기는 했는데 그려지지 않는다 — 「못 받았다」와 다른 사실이라 따로 말한다. */
    notDrawable: '받은 라벨을 화면에 그릴 수 없습니다. 인쇄는 그대로 할 수 있습니다.',
    print: '인쇄',
    close: '닫기',
    /** 창을 닫아도 발행은 남는다 — 감추지 않고 말한다. */
    closeNote: '닫아도 발행 기록은 남습니다. 인쇄는 나중에 다시 할 수 있습니다.',
  },

  /** 발행 이력 — 회차별로 쌓인다(K-1). */
  history: {
    sectionLabel: '발행 이력',
    empty: '발행 이력이 없습니다.',
    failed: '발행 이력을 불러오지 못했습니다.',
    seq: (issueSeq: number): string => `회차 ${String(issueSeq)}`,
    /** 읽을 수 없는 시각. ⛔ 지어내지 않는다 — 모르면 모른다고 둔다. */
    unknownAt: '—',
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
    /** 인쇄 실패는 새 회차와 PRINT_FAILURE 사유로 재발행한다(K-7). */
    failedBody: '발행 기록은 남았습니다. 프린터를 확인하고 실패 사유로 재발행하세요.',
    retry: '재발행 후 다시 인쇄',
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
