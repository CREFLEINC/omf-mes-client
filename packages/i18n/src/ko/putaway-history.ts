/**
 * M-01-14 적치 기록 — 서버에 남은 적치를 「내 기록」 또는 「이 기기」로 영업일 하루씩 다시 본다.
 *
 * 적치 화면 아래에 쌓던 「적치됨」 목록은 화면을 나가면 사라졌다. 이 화면은 서버에 반영된 적치만
 * 보인다 - 전송 대기는 건수만, 전송하지 못한 것은 「전송 실패한 기록」에서 본다. 줄은 읽기 전용이다.
 */
export const putawayHistory = {
  title: '적치 기록',
  /** 탭 묶음의 이름(낭독기용). */
  tabsLabel: '조회 기준',
  tabs: {
    mine: '내 기록',
    terminal: '이 기기',
  },
  /** 일요일부터. 날짜 옆 괄호에 선다. */
  weekdays: ['일', '월', '화', '수', '목', '금', '토'],
  dateLabel: (date: string, weekday: string, today: boolean) =>
    today ? `오늘, ${date} (${weekday})` : `${date} (${weekday})`,
  prevDay: '이전 날',
  nextDay: '다음 날',
  /** 날짜 아래 — 지금 무엇을 기준으로 보는지와 건수. */
  basis: {
    mine: (workerNo: string, workerName: string, count: number) =>
      `${workerNo} ${workerName}, 기기 무관, ${String(count)}건`,
    terminal: (terminalCode: string | null, count: number) =>
      `${terminalCode === null ? '이 기기' : `이 기기 ${terminalCode}`}, 작업자 무관, ${String(count)}건`,
  },
  listLabel: '적치 기록 목록',
  loading: '적치 기록을 불러오는 중입니다',
  loadFailed: '적치 기록을 확인할 수 없습니다. 연결을 확인하세요.',
  more: (loaded: number, total: number) => `더 보기 (${String(loaded)} / ${String(total)})`,
  empty: {
    title: '이 날 적치한 기록이 없습니다',
    mine: '날짜를 바꾸거나 「이 기기」를 보세요.',
    terminal: '날짜를 바꿔 보세요.',
  },
  /** 서버에 아직 없는 적치 — 목록에 넣지 않고 건수와 입구만. */
  queued: {
    title: (count: number) => `전송 대기 ${String(count)}건 — 보내지면 여기에 나옵니다`,
    action: '전송 대기 보기',
  },
  offline: {
    title: '연결이 끊겼습니다',
    loadedAt: (time: string) => `${time} 에 불러온 목록입니다. 연결되면 새로 불러옵니다.`,
    none: '연결되면 불러옵니다.',
  },
  /** 줄 아래 — 전표(지시) 번호, 시각, 작업자. */
  meta: (documentNo: string, time: string, worker: string) => `${documentNo}, ${time}, ${worker}`,
  /** 적치 방식. 지시 적치는 지시가 어디서 생겼는지를 괄호로. */
  mode: {
    DESIGNATED: '지정 위치',
    UNDESIGNATED: '미지정 위치',
    TEMPORARY: '임시 적치',
    TASK: (source: string) => `지시 적치(${source})`,
    TASK_TEMPORARY: (source: string) => `지시 임시 완료(${source})`,
  },
  source: {
    PURCHASE: '구매',
    PRODUCT: '제품',
    REPLENISHMENT: '보충',
  },
  defective: '불량',
  cancelled: '입고 취소됨',
  cancelRequested: '취소 요청 중',
  /** 아래 단추 — 적치 화면 이름을 받아 「…로」. */
  back: (screen: string) => `${screen}로`,
} as const;
