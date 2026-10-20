/**
 * 모바일 셸의 화면 목록.
 *
 * 묶음 이름은 설계 IA 의 타일을 그대로 쓴다. 도메인으로 묶으면 어느 소속인가가 되는데,
 * 현장은 무슨 일을 하러 왔나로 찾는다 - 적치하러 온 사람이 자재창고를 뒤지지 않는다.
 *
 * 아직 서지 않은 타일은 그리지 않는다. 빈 타일은 눌러도 갈 곳이 없다.
 */
export const shellHome = {
  label: '화면 목록',
  tiles: {
    inbound: '입하',
    putaway: '적치',
    picking: '피킹/출고',
    recycle: '재생재',
    urgent: '긴급 요청',
    transfer: '이동',
    stocktaking: '실사',
    productionMove: '생산 이동/수리',
    shipment: '출하 스캔',
    equipment: '설비',
  },
  /* 타일이 아니다 - 작업이 아니라 앱이 이고 다니는 것이라 설계 IA 에 자리가 없다. */
  shell: '전송 상태',
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
