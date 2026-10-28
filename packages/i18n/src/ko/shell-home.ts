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
  /**
   * 업무 화면의 작업마다 무엇을 하는 화면인지 한 줄. 이름이 비슷한 작업(입하 · 입고 · 적치)을
   * 이름만으로 고르면 끝까지 읽어야 갈린다.
   */
  screens: {
    inboundReceipt: '공급사 도착을 기록 · 라벨 스캔으로 시작',
    materialLotScan: '도착 때 못 스캔한 LOT 을 나중에 등록',
    inboundVariance: '예정과 다른 입하를 남김 · 등록 뒤 수정 불가',
    recycleEntry: '재생재를 자재 묶음으로 등록',
    iqcSkipRequest: '요청만 올림 · 승인은 관리웹',
    putaway: '입하한 자재를 적치 위치에 넣고 입고 완료',
    temporaryPutaway: '적치 위치에 못 넣을 때 임시 위치에 먼저 둠',
    stockTransfer: '위치 사이 재고 옮기기 · 반출 뒤 도착 스캔',
    materialPicking: '출고 지시대로 자재를 꺼냄',
    physicalCount: '위치의 실물을 세어 기록',
    materialLocation: 'LOT · 품목이 어느 위치에 있는지 조회',
    shopfloorReceipt: '생산창고로 들어온 자재 받기',
    wipHandover: '공정 사이 재공품 넘기기',
    repairRoundtrip: '수리 보낸 것과 돌아온 것 스캔',
    equipmentInspection: '설비 점검 항목 기록',
    equipmentFailure: '고장 증상과 사진 보고',
    productReceipt: '완성 제품을 창고에 입고 · 적치',
    productPicking: '출하 지시대로 제품 꺼내기',
    packingRepack: '포장을 나누거나 합치기',
  },
  /** 이 사번이 많이 들어간 작업. 사번마다 따로 센다. */
  frequent: '자주 쓰는 작업',
  /** 교대 때 다음 사람이 사번을 넣도록 지금 사번을 내리고 사번 확인으로 간다. */
  switchWorker: '사용자 전환',
  /** 업무 화면 맨 아래의 설정. 기기 등록 해제처럼 드물게 쓰는 것을 모은다. */
  settings: {
    label: '설정',
    device: '기기',
  },
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
  /**
   * 남은 작업 배지(피처 002). 수는 기기(단말)의 창고(없으면 공장) 기준이고 그 화면 목록 건수와 같다.
   * 접근 이름에는 줄이지 않은 실제 수를 싣는다(「9+」가 아니라 「12건」).
   */
  workCount: {
    left: '남은 작업',
    label: (name: string, count: number) => `${name}, 남은 작업 ${String(count)}건`,
    basisWarehouse: (warehouseName: string) => `이 기기: ${warehouseName} 기준`,
    basisPlant: '이 기기: 공장 전체 기준',
  },
} as const;
