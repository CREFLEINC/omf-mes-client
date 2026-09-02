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
  /** 타일이 아니다 - 작업이 아니라 셸이 이고 다니는 것이라 IA 에 자리가 없다. */
  shell: '셸',
} as const;
