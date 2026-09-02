/**
 * 모바일 셸의 화면 목록.
 *
 * 묶음 이름은 설계의 도메인 구분을 따른다. 화면이 늘 때 어느 묶음에 들어가는지가 그 구분으로
 * 정해져야, 목록이 길어져도 현장이 찾던 자리에서 찾는다.
 */
export const shellHome = {
  label: '화면 목록',
  groups: {
    warehouse: '자재창고',
    production: '생산실행',
    shipment: '제품출하',
    equipment: '설비·툴',
    common: '공통',
  },
} as const;
