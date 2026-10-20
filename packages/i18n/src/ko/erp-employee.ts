/**
 * 사원정보 조회 (ERP). 작업자 기본 정보는 전부 ERP 수신본이라 MES 는 읽기만 한다.
 *
 * 사업장·공장·부서는 응답이 식별자만 주므로 이름을 지어내지 않고 번호 그대로 낸다.
 */
export const erpEmployee = {
  title: '사원정보 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  readOnlyNote: 'ERP 에서 받은 사원정보입니다. MES 에서는 고칠 수 없습니다.',
  fields: {
    q: '사번·성명',
    includeInactive: '퇴사자 포함',
  },
  table: {
    workerNo: '사번',
    workerName: '성명',
    nameKo: '한국어 명칭',
    nameVi: '베트남어 명칭',
    plantId: '공장',
    departmentId: '부서',
    statusCode: 'ERP 상태',
    isActive: '재직',
  },
  detail: {
    label: '사원 상세',
    openAction: (workerNo: string): string => `${workerNo} 상세 보기`,
    businessUnitId: '사업장',
    appUserId: '연결된 사용자',
    selectHint: '목록에서 사원을 고르면 상세가 보입니다.',
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
    detail: '사원 상세를 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 사원이 없습니다',
    noResultDescription: '검색어를 바꾸거나 퇴사자 포함을 켜 보세요.',
    beyondLastTitle: '이 쪽에는 사원이 없습니다',
    beyondLastDescription: '첫 쪽으로 돌아가 다시 보세요.',
  },
} as const;
