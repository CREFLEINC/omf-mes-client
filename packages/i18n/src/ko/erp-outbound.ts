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
    /** 목록 상자 제목 — 「송신 항목 목록 N건」(#358). */
    list: 'ERP 송신 목록',
    pending: '송신 예정',
    /** 상세 상자 제목(#358). */
    detail: '송신 항목 상세',
  },
  /** 조회 상자 — 송신 항목 이름으로 화면 안에서 거른다(서버 요청은 그대로 · #358). */
  filters: {
    label: '조회 조건',
    search: '송신 항목 검색',
    searchPlaceholder: '송신 항목 이름을 입력하세요',
    /** 상태 선택칸 — 전체 · 송신 대기 · 송신 실패 · 송신 꺼짐(#358). */
    state: '송신 상태 선택',
    all: '전체',
    sendOff: '송신 꺼짐',
  },
  /** 두 구획 사이 끌기 막대(키보드 ←·→ 로도 움직인다). */
  splitter: '끌어서 송신 항목·송신 예정 폭 조절',
  /** 막대 위쪽 끝의 단추 — 송신 항목을 왼쪽으로 완전히 접고 편다. */
  listCollapse: '송신 항목 접기',
  listExpand: '송신 항목 펼치기',
  table: {
    item: '송신 항목',
    /** 문구는 사람이 읽기 쉽게(연동 현황·이력과 같은 말 · #358). */
    send: '송신 여부',
    pending: '송신 대기',
    failed: '송신 실패',
    /** 메시지 키에서 연계 코드를 뗀 번호 — 입고 번호 같은 업무 번호(연동 현황·이력의 「문서 번호」와 같다). */
    messageKey: '문서 번호',
    createdAt: '생성 일시',
    availableAt: '송신 예정 일시',
    retryCount: '재시도 횟수',
    lastErrorMessage: '오류 내용',
    /** 상세 정보 상자(#358). */
    sendTiming: '송신 시점',
    lockReason: '끌 수 없는 이유',
  },
  /** 건수 · 횟수 값 — 「3건」 · 「1회」(#358). */
  counts: (count: number): string => `${count.toLocaleString()}건`,
  times: (count: number): string => `${String(count)}회`,
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
  openMessage: (title: string): string => `${title} 상세 열기`,
  empty: {
    pickItem: '송신 항목을 선택하세요.',
    pickItemDescription: '선택한 항목의 송신 예정 건을 확인할 수 있습니다.',
    /** 이름 검색에 맞는 송신 항목이 없을 때. */
    noMatch: '조건에 맞는 송신 항목이 없습니다',
    /** 반품 · 실사 조정 — 서버에 아직 송신이 없다. */
    noInterface: '아직 ERP로 보내지 않는 항목입니다',
    noPending: '보낼 건이 없습니다',
    beyondLast: '이 쪽에는 보낼 건이 없습니다',
  },
  /** 탭 막대 오른쪽의 상태 칩 — 송신 항목 전체의 합. 누르면 이 탭으로 온다. */
  chips: {
    /** 이 서버의 송신 켜짐(ERP_SEND_ENABLED) — 꺼져 있으면 대기가 쌓여도 보내지 않는다. */
    sendOn: '송신 ON',
    sendOff: '송신 OFF',
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
