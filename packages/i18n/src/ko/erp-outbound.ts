/**
 * W-06-12 ERP 송신 — 송신 항목 다섯과, 고른 항목의 송신 예정 목록(연계 메시지 중 송신 · 대기).
 *
 * 「ERP 연동 현황·이력」 묶음의 탭이다. 송신 항목의 켜고 끄기는 아직 이 화면에 없다 — 보기만 한다.
 * 송신 예정은 서버의 송신기가 아직 보내지 않은 건(`PENDING`)이다. 다 보내면 목록에서 빠진다.
 */
export const erpOutbound = {
  title: 'ERP 송신',
  panes: {
    items: '송신 항목',
    pending: '송신 예정',
  },
  /** 두 구획 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: '끌어서 송신 항목·송신 예정 폭 조절',
  /** 막대 위쪽 끝의 단추 — 송신 항목을 왼쪽으로 완전히 접고 편다. */
  listCollapse: '송신 항목 접기',
  listExpand: '송신 항목 펼치기',
  table: {
    item: '송신 항목',
    send: '송신',
    pending: '대기',
    failed: '실패',
    messageKey: '메시지 키',
    target: '대상',
    createdAt: '생성',
    availableAt: '보낼 시각',
    retryCount: '시도',
    lastErrorMessage: '마지막 오류',
  },
  /** 송신 열 — 켜짐 · 꺼짐, 끌 수 없는 항목(생산 실적)은 필수. */
  send: {
    on: '켜짐',
    off: '꺼짐',
    required: '필수',
  },
  /** 행 단추의 접근 이름 — 보이는 이름을 그대로 담는다. */
  pickRow: (name: string): string => `${name} 선택`,
  /** 송신 예정 구획의 제목 — 고른 항목과 건수. */
  pendingTitle: (name: string, count: number): string => `${name} · 송신 예정 ${String(count)}건`,
  /** 메시지 키 링크 — 「ERP 연동 현황·이력」에서 그 건의 상세를 연다. */
  openMessage: (messageKey: string): string => `${messageKey} 상세 열기`,
  empty: {
    pickItem: '송신 항목을 고르세요',
    /** 반품 · 실사 조정 — 서버에 아직 송신이 없다. */
    noInterface: '아직 ERP로 보내지 않는 항목입니다',
    noPending: '보낼 건이 없습니다',
    beyondLast: '이 쪽에는 보낼 건이 없습니다',
  },
  /** 탭 막대 오른쪽의 상태 칩 — 송신 항목 전체의 합. 누르면 이 탭으로 온다. */
  chips: {
    label: 'ERP 송신 상태',
    pending: (count: number): string => `송신 대기 ${String(count)}`,
    failed: (count: number): string => `송신 실패 ${String(count)}`,
  },
  loading: {
    items: '송신 항목을 불러오는 중',
    pending: '송신 예정 목록을 불러오는 중',
  },
  values: {
    empty: '—',
  },
} as const;
