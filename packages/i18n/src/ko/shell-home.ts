/**
 * 모바일 셸의 화면 목록.
 *
 * 작업은 자재가 흐르는 차례대로 네 업무로 묶는다(사용자 지시 2026-10-20). 도메인 소속으로
 * 묶지 않는다 - 현장은 무슨 일을 하러 왔나로 찾고, 적치하러 온 사람이 자재창고를 뒤지지 않는다.
 *
 * 아직 서지 않은 타일은 그리지 않는다. 빈 타일은 눌러도 갈 곳이 없다.
 */
export const shellHome = {
  label: '화면 목록',
  /**
   * 첫 화면의 네 업무. 자재가 흐르는 차례대로다. 요약은 그 업무에 무엇이 들었는지 — 이름만으로는
   * 「생산창고 입고」가 입고인지 생산 현장인지 헷갈린다.
   */
  areas: {
    label: '업무',
    inbound: { label: '입고', summary: '입하 · 자재 LOT · 입하 오류' },
    warehouse: { label: '창고', summary: '적치 · 이동 · 자재 출고 · 실사' },
    shopfloor: { label: '생산 현장', summary: '생산창고 입고 · 공정 이동 · 설비' },
    shipping: { label: '제품 출하', summary: '제품 입고 · 피킹 · 포장' },
    count: (count: number) => `작업 ${String(count)}개`,
    open: (label: string) => `${label} 작업 보기`,
  },
  /** 이 사번이 많이 들어간 작업. 사번마다 따로 센다. */
  frequent: '자주 쓰는 작업',
  /** 적다가 나간 작업. 홈 맨 위에 서서 그 자리로 바로 돌아간다. */
  resume: {
    label: '이어서 하기',
    open: (title: string) => `${title} 이어서 하기`,
  },
  /** 홈 맨 위의 전송 현황. 0 이면 서지 않는다. */
  status: {
    label: '전송 현황',
    pending: '전송 대기',
    rejected: '전송 실패',
    count: (count: number) => `${String(count)}건`,
  },
} as const;
