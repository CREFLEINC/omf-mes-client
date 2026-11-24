/**
 * ERP 수신 — ERP 받기 표 여덟의 상태와 「지금 읽기」(omf-mes-server#757 · 장부 P-81).
 *
 * 「ERP 연동 현황·이력」 묶음의 탭이다(사용자 지시 2026-10-27 — 연동 현황·이력 위에 접혀 있던 받기 상태를 탭으로 뗐다).
 * 「지금 읽기」는 다음 주기를 기다리지 않는 한 회차다 — 아직 읽지 않은 줄만 가져오고, 이미 읽은 줄을 다시 가져오지 않는다.
 */
export const erpInbound = {
  title: 'ERP 수신',
  /** 서버에서 ERP 연동이 꺼져 있을 때만 — 단추가 왜 잠겼는지. */
  disabledReason: 'ERP 연동이 꺼져 있어 지금 읽기를 쓸 수 없습니다.',
  /** 탭 막대 오른쪽 칩 — 이 서버의 수신 켜짐(ERP_SYNC_ENABLED). */
  chips: {
    label: 'ERP 수신 상태',
    receiveOn: '수신 ON',
    receiveOff: '수신 OFF',
    /** 받는 표 전체의 최근 수신 건수 합 — 0건이면 세우지 않는다(송신의 「송신 대기 N」과 같은 꼴 · #358). */
    applied: (count: number): string => `수신 반영 ${count.toLocaleString()}`,
    failed: (count: number): string => `수신 실패 ${count.toLocaleString()}`,
    held: (count: number): string => `수신 보류 ${count.toLocaleString()}`,
  },
  /** 목록 상자 | 상세 상자(#358). */
  panes: {
    list: 'ERP 수신 목록',
  },
  table: {
    label: 'ERP 수신 표',
    /** ERP에서 받아 오는 자료의 종류(품목 · 거래처 · 수주 …) — 「표」는 시스템 말이라 바꿨다(#358). */
    name: '수신 항목',
    state: '상태',
    lastFinishedAt: '최근 수신 일시',
    read: '읽음',
    applied: '반영',
    failed: '실패',
    held: '보류',
    nextRunAt: '다음 수신 예정 일시',
    /** 묶음 — 기준정보 · 전표(#358). */
    lane: '구분',
    /** 마지막 읽기의 실패 사유(#358). */
    lastErrorMessage: '오류 내용',
    action: '지금 읽기',
  },
  actions: {
    runNow: '지금 읽기',
    /* 행 버튼의 접근 이름. 보이는 글자를 그대로 담아 음성 조작이 부를 수 있게 둔다. */
    runNowRow: (name: string): string => `${name} 지금 읽기`,
  },
  state: {
    running: '읽는 중',
    requested: '대기 중',
    never: '기록 없음',
    succeeded: '성공',
    failed: '실패',
  },
  requestedAt: (time: string): string => `${time} 요청`,
  runErrorTitle: '읽기를 요청하지 못했습니다',
  finished: {
    succeeded: (name: string, applied: number): string =>
      `${name} 읽기를 마쳤습니다. ${String(applied)}건을 반영했습니다.`,
    withFailures: (name: string, applied: number, failed: number): string =>
      `${name} 읽기를 마쳤습니다. ${String(applied)}건을 반영했고 ${String(failed)}건은 반영하지 못했습니다.`,
    failed: (name: string): string => `${name} 읽기에 실패했습니다. 상태 열의 사유를 확인하세요.`,
  },
  loading: 'ERP 수신 상태를 불러오는 중',
  empty: '받는 표가 없습니다',
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
} as const;
