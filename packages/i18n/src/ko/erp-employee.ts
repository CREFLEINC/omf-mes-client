/**
 * 사원정보 조회 (ERP). 작업자 기본 정보는 전부 ERP 수신본이라 MES 는 읽기만 한다.
 *
 * 공장·부서는 응답이 식별자만 주므로 이름을 지어내지 않고 번호 그대로 낸다.
 */
export const erpEmployee = {
  title: '사원정보 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  panes: {
    filter: '조회 조건',
    list: '사원 목록',
  },
  fields: {
    q: '사번·성명',
    includeInactive: '퇴사자 포함',
  },
  table: {
    workerNo: '사번',
    workerName: '성명',
    plantId: '공장',
    departmentId: '부서',
    statusCode: 'ERP 상태',
    isActive: '재직',
  },
  values: {
    empty: '—',
    active: '재직',
    inactive: '퇴사',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  loading: {
    list: '사원 목록을 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 사원이 없습니다',
    beyondLastTitle: '이 쪽에는 사원이 없습니다',
  },
} as const;
