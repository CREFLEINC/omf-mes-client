/**
 * BOM 조회 (ERP). ERP 에서 받은 BOM 헤더와 구성품을 읽기만 한다 — MES 확장 열은 보이지 않는다.
 *
 * 상태 이름은 공통코드(MASTER_VERSION_STATUS)가 갖는다 — 여기에 값 목록을 적지 않는다.
 */
export const erpBom = {
  title: 'BOM 조회 (ERP)',
  breadcrumbRoot: '시스템 관리',
  readOnlyNote: 'ERP 에서 받은 정보입니다. MES 에서는 고칠 수 없습니다.',
  fields: {
    parentItem: '모품목',
    bomCode: 'BOM 코드',
  },
  actions: {
    pickParent: '모품목 선택',
    confirmPick: '선택',
  },
  panes: {
    boms: 'BOM 목록',
    components: '구성품',
  },
  bomTable: {
    bomCode: 'BOM 코드',
    bomVersion: 'Rev',
    status: '상태',
    isDefault: '기본',
    effectiveFrom: '유효 시작',
    effectiveTo: '유효 종료',
    baseQty: '기준 수량',
    openAction: (bomCode: string, bomVersion: number): string =>
      `${bomCode} Rev ${String(bomVersion)} 구성품 보기`,
  },
  componentTable: {
    sequenceNo: '순번',
    componentItem: '자품목',
    requiredQty: '소요량',
    scrapRate: '손실률',
    isMandatory: '필수',
    erpChildItemSeq: 'ERP 자품목 순번',
  },
  values: {
    empty: '—',
    yes: '예',
    no: '아니오',
    notPicked: '선택 안 함',
    loadingName: '불러오는 중',
    failedName: '불러오지 못함',
    unknown: '알 수 없음',
  },
  loading: {
    boms: 'BOM 목록을 불러오는 중',
    components: '구성품을 불러오는 중',
  },
  empty: {
    noParentTitle: '모품목을 고르세요',
    noParentDescription: '「모품목 선택」으로 품목을 고르면 그 품목의 BOM 이 보입니다.',
    noBomTitle: '조건에 맞는 BOM 이 없습니다',
    noBomDescription: 'BOM 코드를 비우거나 다른 모품목을 골라 보세요.',
    notSelected: 'BOM 목록에서 하나를 고르면 구성품이 보입니다.',
    noComponentTitle: '구성품이 없습니다',
    noComponentDescription: '이 BOM 에는 ERP 에서 받은 구성품이 없습니다.',
  },
} as const;
