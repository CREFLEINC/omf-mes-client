/**
 * P-05-02 비가동 실적 입력. **POP(현장 단말) 화면**이라 관리웹과 어휘가 갈린다.
 *
 * - 설비가 멈춘 자리에서 장갑을 낀 채 읽는다. 한 줄에 한 가지만 말한다.
 * - **「진행 중」은 상태가 아니라 끝 시각이 비어 있는 것**이다(스펙 §5-3). 문구도 그 사실을
 *   그대로 말한다 — 「진행 중 상태로 바꿨습니다」처럼 없는 상태를 지어내지 않는다.
 * - 겹침은 **막지 않고 알리기만 한다**(스펙 §6-1). 경고 문구가 저장을 막는 것처럼 읽히면 안 된다.
 * - 오프라인에서 오늘 집계는 **이 단말이 넣은 것만** 보인다. 그 범위를 문구가 말한다(§6-2).
 */
export const downtimeRegister = {
  title: '비가동 실적 입력',
  header: {
    equipment: (equipmentCode: string): string => `설비 ${equipmentCode}`,
    /** 주소에 설비가 없으면 이 화면이 무엇을 기록하는지 정해지지 않는다. */
    equipmentMissing: '설비가 지정되지 않았습니다. 설비를 고른 뒤 다시 들어오세요.',
    worker: (workerNo: string): string => `사번 ${workerNo}`,
    /** 사번이 없으면 쓰기가 서버에서 거부된다 — 누르기 전에 그 사실을 말한다. */
    workerUnknown: '사번 미확인',
    /** 미전송 건수는 즉시 성공 표시의 전제라 상시 보인다(공유계약 C-1 #4). */
    unsent: (count: number): string => `미전송 ${String(count)}건`,
    sent: '전송 완료',
    offline: '연결 끊김',
  },
  ongoing: {
    title: '진행 중 비가동',
    /** 경과 시간은 저장값이 아니라 화면이 매 순간 다시 그리는 값이다(스펙 §5-3). */
    elapsed: (startedAtLabel: string, elapsedLabel: string): string =>
      `${startedAtLabel} 부터 ${elapsedLabel} 진행 중`,
    reason: (reasonName: string): string => `사유: ${reasonName}`,
    close: '지금 종료',
    closed: '비가동을 종료했습니다',
    /** 진행 중이 있으면 새 구간을 시작할 수 없다(스펙 §6-1). 어디로 가야 하는지까지 적는다. */
    blocksNew: '진행 중 비가동을 먼저 종료하세요.',
  },
  interval: {
    title: '구간',
    startedAt: '시작',
    endedAt: '종료',
    date: '날짜',
    time: '시각',
    /** 단말 시각을 그대로 넣는 기본 경로다(스펙 §5-2). */
    now: '지금',
    stillOngoing: '아직 진행 중',
    durationUnknown: '진행 중이라 산출할 수 없습니다',
    /** 아직 구간을 치지 않은 상태 — 「진행 중」과 다르다. 자리는 비우되 없애지 않는다. */
    durationNotYet: '—',
  },
  reason: {
    title: '사유',
    category: '대분류',
    detail: '소분류',
    categoryPlaceholder: '대분류 선택',
    detailPlaceholder: '소분류 선택',
    /** 값 목록이 확정되기 전의 임시 표시다(미결 처리 — 자리표시 상수 + 안내). */
    placeholderNotice: '사유 코드 목록이 아직 확정되지 않았습니다. 임시 목록입니다.',
    remarks: '메모',
    remarksPlaceholder: '사유 코드로 담기지 않는 사연을 적습니다',
  },
  breakdown: {
    title: '연결된 고장',
    /** 고장 연결은 선택이다 — 비가동의 다수는 고장이 아니다(스펙 §5-4). */
    select: '고장 연결',
    detach: '해제',
    empty: '이 설비에 열린 고장이 없습니다',
    /** 고장의 정지 시각을 시작 시각으로 «제안»만 한다. 자동으로 넣지 않는다(스펙 §5-4). */
    suggestStart: (timeLabel: string): string => `이 고장의 정지 시각 ${timeLabel} 을 넣을까요?`,
    applySuggestion: '시작 시각에 넣기',
    offlineNotice: '연결이 끊긴 동안 다른 단말이 접수한 고장은 보이지 않습니다.',
  },
  today: {
    title: '오늘 이 설비',
    summary: (count: number, totalLabel: string): string =>
      `비가동 ${String(count)}건 · 합계 ${totalLabel}`,
    basis: (timeLabel: string): string => `${timeLabel} 기준`,
    empty: '오늘 기록된 비가동이 없습니다',
    /** 오프라인 집계의 범위를 이름으로 말한다(스펙 §6-2 · §9-3). */
    localOnly: '내 단말 입력분만',
    localOnlyDescription: '다른 단말·관리웹 입력분은 반영되지 않았습니다.',
    ongoingRow: '진행 중',
  },
  actions: {
    reset: '다시 입력',
    save: '실적 저장',
    saved: '비가동 실적을 저장했습니다',
    /** 큐에 담긴 순간이 성공이다(공유계약 C-1 #2) — 다만 아직 서버에 닿지 않았음을 밝힌다. */
    queued: '저장했습니다. 연결되면 서버로 보냅니다.',
  },
  errors: {
    /** 짝 제약 — 두 필드에 함께 붙인다(스펙 §6-1). */
    endedBeforeStarted: '종료가 시작보다 빠릅니다.',
    future: '아직 오지 않은 시각입니다.',
    /** 끝을 적으려다 만 상태 — 「비운 것」과 다르다. 진행 중으로 넘기려면 체크가 필요하다. */
    endedIncomplete: '종료 날짜와 시각을 함께 입력하거나, 「아직 진행 중」을 선택하세요.',
    /** 목록은 받았는데 합계만 못 받은 상태. 합계 자리를 0으로 채우지 않는다. */
    summaryUnavailable: '합계를 불러오지 못했습니다',
    startedRequired: '시작 시각을 입력하세요.',
    /** 시작 칸을 적으려다 만 상태. 「안 친 것」과 달라 누르기 전에도 말한다. */
    startedIncomplete: '시작 날짜와 시각을 함께 입력하세요.',
    reasonRequired: '비가동 사유를 고르세요.',
    /** 겹침은 경고다 — 저장을 막지 않는다(스펙 §6-1 · 미결 처리 「만들지 않는다」). */
    overlapWarning: (rangeLabel: string): string => `${rangeLabel} 과 겹칩니다. 그대로 저장됩니다.`,
    workerMissing: '실적 저장 — 사번을 확인할 수 없어 저장할 수 없습니다.',
    equipmentMissing: '실적 저장 — 설비가 지정되지 않아 저장할 수 없습니다.',
    /** 게이팅이 닫힌 것과 판정하지 못한 것은 작업자가 할 일이 다르다(공유계약 F-6). */
    gateDenied: '실적 저장 — 이 단말에서는 실적을 입력할 수 없습니다.',
    gateUnavailable: '실적 저장 — 입력 권한을 확인할 수 없습니다.',
    gateChecking: '실적 저장 — 입력 권한을 확인하는 중입니다.',
    saveFailed: '저장하지 못했습니다.',
    closeFailed: '종료하지 못했습니다.',
  },
} as const;
