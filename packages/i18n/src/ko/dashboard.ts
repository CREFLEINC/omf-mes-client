/**
 * W-CO-05 통합 대시보드 — 경영·생산이 로그인 직후 처음 보는 화면.
 *
 * 이 화면은 **숫자를 모아 보이기만 한다.** 카드마다 소유 화면이 따로 있고, 값이 이상하면
 * 그 화면으로 간다 — 그래서 문구도 「여기서 고친다」가 아니라 「어디로 가면 되는가」를 말한다.
 */
export const dashboard = {
  title: '통합 대시보드',
  breadcrumbRoot: '공통',

  panes: {
    filters: '기준 조건',
    trend: '일일 생산실적 추이',
    alerts: '미처리 알람',
    shipment: '출하 현황',
  },

  filters: {
    baseDate: '기준 날짜',
    plant: '공장',
    allPlants: '전체',
    refresh: '갱신',
    /**
     * 자동 갱신 주기를 조건 줄에 상시로 적는다(omf-all-around#115). 주기는 화면의 상수에서 받는다 —
     * 숫자를 여기 박으면 주기를 바꿀 때 문구만 남는다.
     */
    autoRefresh: (minutes: number): string => `${String(minutes)}분마다 자동 갱신`,
    /**
     * 마지막으로 **조회가 성공한** 시각(서버 집계 시각이 아니다 · 사용자 지시 2026-10-16). ⛔ 「기준」이라는
     * 말을 쓰지 않는다 — 조건 줄의 「기준 날짜」와 헷갈린다.
     */
    lastUpdated: (at: string): string => `마지막 갱신 ${at}`,
    /** 갱신이 실패해 마지막 성공 값을 그대로 보이고 있을 때. 값을 지우지 않는다. */
    refreshFailed: '갱신 실패 — 직전 값 표시 중',
    plantLookupFailed: '공장 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    plantLookupTruncated: '공장 목록의 일부만 보입니다. 찾는 공장이 없으면 담당자에게 문의하세요.',
  },

  cards: {
    /** 값을 낼 수 없는 카드. ⛔ 0으로 그리지 않는다 — 0은 「가동하지 않았다」로 읽힌다. */
    notYet: '아직 없음',
    /** 분모에서 뺀 것이 있는 카드. 뺐다는 사실을 카드 본문에 적는다. */
    excluded: (count: number): string => `${String(count)}건 제외`,
    /** 기준일 전날 대비(서버 규칙) — 「전일 대비 ▲ 4%」. */
    deltaUp: (text: string): string => `전일 대비 ▲ ${text}`,
    deltaDown: (text: string): string => `전일 대비 ▼ ${text}`,
    deltaFlat: '전일 대비 동일',
    /** 카드를 눌러 소유 화면으로 갈 수 있을 때. */
    openHint: (label: string): string => `${label} 상세 화면으로 이동`,
  },

  trend: {
    target: '목표',
    unitSuffix: (unit: string): string => `단위 ${unit}`,
    empty: '이 기간에 그릴 생산실적이 없습니다.',
    /** 계약이 추이를 선택 항목으로 두어 아예 오지 않을 수 있다. */
    absent: '생산실적 추이가 이 응답에 오지 않았습니다.',
    detail: '자세히',
  },

  alerts: {
    /** 알람 0건은 오류가 아니라 정상 상태다. */
    empty: '미처리 알람이 없습니다.',
    unread: '미확인',
    read: '확인함',
    /** 위치는 계층 텍스트로만 그린다 — 평면 배치·도면 구획을 쓰지 않는다. */
    locationUnknown: '위치 정보 없음',
    emptyMessage: '내용이 비어 있습니다.',
    openCenter: '알림센터 보기',
  },

  /**
   * 설비 현황(omf-all-around#111). 상태는 서버가 현장 기록(작업 세션 · 비가동 · 고장 · 계획정지)을
   * 조합해 판단한다 — 화면은 받은 상태를 그대로 말한다.
   */
  equipment: {
    status: {
      RUNNING: '가동',
      STOPPED: '정지',
      WAITING: '대기',
      CHANGEOVER: '교체',
      IDLE: '비가동',
    },
    boardTitle: '설비 가동 현황',
    boardSub: (count: number): string => `${String(count)}대 · 전체 설비`,
    tagLive: '실시간',
    countUnit: '대',
    line: '라인',
    allLines: '전체',
    legend: '상태별 대수',
    tonnage: '톤수',
    todayQty: '금일 생산',
    ngQty: 'NG',
    defectRate: '불량률',
    standardCycleTime: '표준 C/T',
    /** 타일 한 줄 — 「NG 3 · 0.2%」. */
    ngLine: (ng: string, rate: string): string => `NG ${ng} · ${rate}`,
    cycleLine: (value: string): string => `C/T ${value}`,
    seconds: (value: string): string => `${value}초`,
    percent: (value: string): string => `${value}%`,
    reason: '사유',
    elapsed: '경과 시간',
    /** 경과 시간. 1시간이 안 되면 분만 적는다. */
    elapsedText: (hours: number, minutes: number): string =>
      hours === 0 ? `${String(minutes)}분` : `${String(hours)}시간 ${String(minutes)}분`,
    since: '시작 시각',
    /** 값이 없는 칸. 0과 다르다 — 0을 적으면 「잰 결과가 0」으로 읽힌다. */
    none: '—',
    reasonUnknown: '사유 미등록',
    stoppedTitle: '멈춘 설비',
    stoppedSub: '사유 · 경과 시간',
    stoppedGroupCaption: (status: string): string => `${status} 설비`,
    /** ⛔ 「모든 설비가 가동 중」이라 단정하지 않는다(사용자 지시 2026-10-16) — 목록이 비었다는 사실만 말한다. */
    stoppedEmpty: '현재 멈춘 설비가 없습니다.',
    equipmentColumn: '호기',
    statusColumn: '상태',
    openDetail: (code: string): string => `${code} 상세 보기`,
    groupBasic: '설비 기본',
    groupRun: '가동',
    groupOutput: '생산 실적',
    groupWork: '현재 작업',
    detailTitle: (code: string, name: string): string => `${code} · ${name}`,
    workOrder: '현재 작업지시',
    item: '품목',
    empty: '이 공장에 표시할 생산 설비가 없습니다.',
    lineEmpty: '고른 라인에 설비가 없습니다.',
    /** 서버가 아직 설비 섹션을 주지 않을 때(2차 규격 배포 전). ⛔ 「설비 없음」과 같은 말로 그리지 않는다. */
    absent: '설비 현황이 이 응답에 오지 않았습니다.',
    /** 첫 조회가 실패해 보일 값이 없을 때. 재시도는 화면 위 오류 배너가 맡는다. */
    failed: '설비 현황을 불러오지 못했습니다. 위의 「다시 시도」를 누르세요.',
  },

  /** 출하 현황(omf-all-around#114). 네 줄 모두 기준 날짜 · 공장 기준이다. */
  shipment: {
    tagToday: '금일',
    todayShipped: '오늘 출하 실적',
    todayShipmentCount: (count: string): string => `출하 확정 ${count}건`,
    waiting: '출하 대기',
    waitingNote: '기준일까지 요청 · 미출하',
    next: '다음 출하',
    /** 기준 날짜 이후 가장 이른 미출하 요청이 없을 때. */
    nextNone: '예정 없음',
    /** 요청 수량이 아니라 아직 출하하지 않은 잔량이다(규격 보정). */
    remainingQty: (qty: string): string => `남은 수량 ${qty}`,
    customerUnknown: '고객 미지정',
    overdue: '납기 지연',
    overdueNote: '납기 경과 · 출하 잔량 있음',
    qtyUnit: 'EA',
    countUnit: '건',
    absent: '출하 현황이 이 응답에 오지 않았습니다.',
    failed: '출하 현황을 불러오지 못했습니다. 위의 「다시 시도」를 누르세요.',
  },

  /** 대시보드 안의 탭(omf-all-around#113). 탭은 같은 응답을 나눠 보인다 — 탭마다 다시 부르지 않는다. */
  tabs: {
    label: '대시보드 보기',
    overview: '대시보드',
    quality: '품질 종합',
    iqc: 'IQC 검사실적',
    pqc: 'PQC 검사실적',
    oqc: 'OQC 검사실적',
    nonconformance: '부적합 현황',
  },

  /**
   * 대시보드 탭의 KPI 띠(사용자 지시 2026-10-16, 시안 v1.3 기준 재구성). 카드가 있는 칸은 서버 카드 이름을 먼저
   * 쓰고, 여기 이름은 카드가 오지 않았을 때의 자리 이름이다.
   */
  kpi: {
    none: '—',
    tagLive: '실시간',
    tagToday: '금일',
    runningOfTotal: '가동 설비',
    availability: '시간가동률',
    /** 서버 설명이 올 때만 쓰는 짧은 기준 줄(원문은 설명 단추의 툴팁). */
    availabilityBasis: '계획 가동시간 기준',
    workedEquipment: (count: string): string => `작업 설비 ${count}대`,
    productionQty: '생산 수량',
    /** 이 띠에서는 「NG」 대신 「불량」(사용자 지시 2026-10-16). */
    defectLine: (qty: string): string => `불량 ${qty} EA`,
    defectRate: '종합 불량률',
    defectRateNote: '생산 수량 중 불량 비율',
    defectRateFormula: '불량 수량 ÷ 총생산 수량',
    /** 시안의 「평균 C/T 달성」 자리 — 실측 C/T 가 없어 표준 C/T 기준 성능률을 둔다. */
    performance: '성능률',
    performanceNote: '표준 C/T 기준',
    estimated: '추정',
    oee: 'OEE(설비종합효율)',
    /** 실제 의미는 로그인 사용자의 안 읽은 알림 수다. */
    myUnreadAlerts: '내 미확인 알림',
    /** 공장 조건이 적용되지 않는 값임을 짧게. */
    allPlants: '전체 공장',
    totalDefect: '총 불량',
  },

  /** 대시보드 그림 부품(순위 막대 · 누적 막대 · 꺾은선 · 파레토)의 공통 문구. */
  viz: {
    none: '—',
    noRecords: '아직 집계할 기록이 없습니다.',
    infoLabel: (name: string): string => `${name} 설명`,
    noRates: '이 기간에 합격률을 낼 수 있는 날이 없습니다.',
    dateColumn: '일자',
    itemColumn: '항목',
    qtyColumn: '수량',
    cumulativeColumn: '누적 비율',
    paretoVital: '누적 80%까지',
    paretoOther: '그 외',
    paretoCumulative: '누적 비율',
  },

  /**
   * 품질 현황(omf-all-around#113).
   *
   * ⛔ 「선별」이라는 말을 쓰지 않는다 — MES 용어는 **검사 보류**(판정 보류)와 **전수 재검**이다.
   * ⛔ 목표선 · 목표값을 그리지 않는다(MES DB에 없음). 합격률은 최종 판정 기준이고 보류는 빠진다.
   */
  quality: {
    tagMonth: '당월',
    tagMonthTotal: '당월 누계',
    tagToday: '금일',
    tagNow: '현재',
    passRateOf: (kind: string): string => `${kind} 합격률`,
    prevMonth: (rate: string): string => `전월 ${rate}`,
    deltaUp: (p: string): string => `▲ ${p}p`,
    deltaDown: (p: string): string => `▼ ${p}p`,
    deltaFlat: '전월과 같음',
    /** 모수가 0이라 합격률을 낼 수 없다. ⛔ 0%로 그리지 않는다. */
    rateNone: '—',
    percent: (value: string): string => `${value}%`,
    todayLots: '금일 검사 LOT',
    monthLots: '검사 LOT',
    pqcLots: '공정검사 LOT',
    oqcLots: '출하검사 LOT',
    lotBreakdown: (accepted: string, rejected: string, held: string): string =>
      `합격 ${accepted} · 불합격 ${rejected} · 검사 보류 ${held}`,
    monthDefectQty: '불량 수량',
    qtyUnit: 'EA',
    lotUnit: 'LOT',
    countUnit: '건',
    dailyTitleAll: 'IQC · PQC · OQC 일별 합격률',
    dailyTitleOf: (kind: string): string => `${kind} 일별 합격률`,
    dailySub: '% · 최종 판정 기준 · 검사 보류 제외 · 검사가 없는 날은 선을 끊음',
    dailyRecent: '최근 9일',
    qtyShareSub: 'EA · 비중',
    vendorDefects: '업체별 IQC 불량 수량',
    vendorTableSub: '수량 순',
    phenomena: '불량현상 구성비',
    phenomenaOf: (kind: string): string => `${kind} 불량현상 구성비`,
    recentLots: '최근 검사 LOT 판정 현황',
    recentLotsOf: (kind: string): string => `최근 ${kind} 판정 현황`,
    recentLotsLead: '최근 5건',
    recentEmpty: '최근 검사 판정이 없습니다.',
    column: {
      inspectedAt: '일시',
      kind: '구분',
      vendor: '업체',
      customer: '고객',
      equipment: '호기',
      item: '품목',
      qty: '수량(EA)',
      judgment: '판정',
      defectQty: '불량 수량(EA)',
      share: '비중',
    },
    judgment: {
      ACCEPTED: '합격',
      REJECTED: '불합격',
      HELD: '검사 보류',
    },
    none: '—',
    currentTitle: '현재 현황',
    heldLots: '검사 보류 LOT',
    heldLotsNote: '당월 판정 기준',
    topVendor: '최다 불량 업체',
    itemDefects: '품목(CODE)별 불량 구성',
    receiptHold: '입고 보류 LOT',
    receiptHoldNote: '지금 보류 중인 입하 LOT',
    fullReinspect: '전수 재검',
    fullReinspectNote: (input: string, restored: string): string =>
      `투입 ${input} · 양품 복원 ${restored}`,
    pendingLots: '검사 대기 LOT',
    pendingLotsNote: '판정 전 PQC 의뢰',
    reworkRequests: '재작업 의뢰',
    reworkRequestsNote: '당월 처분 재작업',
    reworkLine: (count: string): string => `재작업 의뢰 ${count}건`,
    worstEquipment: '최고 불량률 호기',
    worstEquipmentNote: (ng: string, rate: string): string => `NG ${ng} EA · ${rate}`,
    equipmentDefectRates: '호기별 불량률 상위 8',
    equipmentDefectRatesSub: '% · 기준일 생산실적',
    ngShort: (qty: string): string => `NG ${qty}`,
    customerReturn: '고객 반품',
    customerReturnNote: '당월 고객 반품 입고 수량',
    ncMonthQty: '부적합 발생 수량',
    ncOpen: '미종결 부적합',
    ncOverdue: '조치 기한 초과',
    ncScrap: '폐기',
    ncScrapNote: '당월 처분 폐기',
    ncReworkReleased: '재투입',
    ncReworkReleasedNote: '당월 재작업 후 재투입(합격)',
    ncPareto: '불량현상별 부적합 수량',
    paretoSub: 'EA · 막대 = 수량, 선 = 누적 비율(파레토)',
    ncCauseGroups: '원인 구분별 부적합 수량',
    ncCauseShare: '원인 구분별 구성',
    ncHandlingTitle: '부적합 처리 지표',
    absent: '품질 현황이 이 응답에 오지 않았습니다.',
    failed: '품질 현황을 불러오지 못했습니다. 위의 「다시 시도」를 누르세요.',
  },
} as const;
