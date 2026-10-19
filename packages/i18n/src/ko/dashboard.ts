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
    alerts: '미확인 알림',
    shipment: '출하 현황',
  },

  filters: {
    baseDate: '기준 날짜',
    /** ⭐ 기간 조회(사용자 확정 2026-10-16) — 빠른 선택 + 시작~종료 직접 고르기. */
    period: '기간',
    customPeriod: '직접 지정',
    quick: { today: '오늘', yesterday: '어제', last7: '최근 7일', thisMonth: '이번 달' },
    periodOrder: '시작일이 종료일보다 늦습니다.',
    periodTooLong: (days: number): string => `기간은 최대 ${String(days)}일까지 고를 수 있습니다.`,
    periodFuture: '오늘 이후 날짜는 고를 수 없습니다.',
    /** 지난 기간 — 값이 바뀌지 않아 자동 갱신을 하지 않는다(「갱신」은 그대로). */
    autoRefreshOff: '지난 기간 · 자동 갱신 안 함',
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
    /** ⭐ 증감 표기(사용자 결정 2026-10-16) — ↑ · ↓, 변동 없음은 기호 없이 「전일과 동일」. */
    deltaUp: (text: string): string => `전일 대비 ↑ ${text}`,
    deltaDown: (text: string): string => `전일 대비 ↓ ${text}`,
    deltaFlat: '전일과 동일',
    /** 생산 수량 칸의 증감 — 「전일 대비」 글자와 색을 입힌 기호 · 수치를 나눠 그린다. */
    deltaBase: '전일 대비',
    /** 이틀 이상 기간 — 「직전 기간」(같은 길이의 바로 앞 기간)과 견준다. */
    deltaUpPeriod: (text: string): string => `직전 기간 대비 ↑ ${text}`,
    deltaDownPeriod: (text: string): string => `직전 기간 대비 ↓ ${text}`,
    deltaFlatPeriod: '직전 기간과 동일',
    deltaBasePeriod: '직전 기간 대비',
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
    empty: '미확인 알림이 없습니다.',
    emptyMessage: '내용이 비어 있습니다.',
    openCenter: '알림센터 보기',
    unknownEvent: '알림',
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
    line: '생산 라인',
    allLines: '전체',
    shownOf: (total: string, shown: string): string => `전체 ${total}대 중 ${shown}대 표시`,
    showAll: '전체 설비 보기',
    allTitle: (total: string): string => `전체 설비 ${total}대`,
    legend: '상태별 대수',
    /** ⭐ 용어(사용자 지정 2026-10-16) — 값이 「프레스」 같은 설비 유형이라 「톤수」는 부정확하다. */
    equipmentType: '설비 종류',
    todayQty: '오늘 생산량',
    ngQty: '불량 수량',
    defectRate: '불량률',
    standardCycleTime: '표준 사이클 타임',
    /** 타일 한 줄(좁은 칸이라 축약 그대로 · 마우스 올림 `title` 에는 풀어 쓴 용어) — 「NG 3 · 0.2%」. */
    ngLine: (ng: string, rate: string): string => `NG ${ng} · ${rate}`,
    cycleLine: (value: string): string => `C/T ${value}`,
    seconds: (value: string): string => `${value}초`,
    percent: (value: string): string => `${value}%`,
    reason: '상태 사유',
    elapsed: '상태 지속 시간',
    /** 경과 시간. 1시간이 안 되면 분만 적는다. */
    elapsedText: (hours: number, minutes: number): string =>
      hours === 0 ? `${String(minutes)}분` : `${String(hours)}시간 ${String(minutes)}분`,
    since: '상태 시작 시각',
    /** 값이 없는 칸. 0과 다르다 — 0을 적으면 「잰 결과가 0」으로 읽힌다. */
    none: '—',
    reasonUnknown: '사유 미등록',
    /** ⭐ 「비가동」이 상태값으로 따로 있어 「멈춘 설비」와 혼동됐다(사용자 결정 2026-10-16). */
    stoppedTitle: '가동 외 설비 현황',
    stoppedElapsedColumn: '경과 시간',
    /** 그룹에 다 보이지 않은 대수 — 누르면 「전체 설비 보기」 창. */
    stoppedMore: (count: string): string => `외 ${count}대`,
    /** 「외 n대」 창(사용자 지시 2026-10-16) — 제목 「정지 설비」 아래 줄 · 목록 열 제목. */
    stoppedMoreCount: (count: string): string => `추가 설비 ${count}대`,
    stoppedEquipmentColumn: '설비명',
    stoppedReasonColumn: '사유',
    stoppedGroupCaption: (status: string): string => `${status} 설비`,
    /** ⛔ 「모든 설비가 가동 중」이라 단정하지 않는다(사용자 지시 2026-10-16) — 목록이 비었다는 사실만 말한다. */
    stoppedEmpty: '현재 가동 외 설비가 없습니다.',
    statusColumn: '가동 상태',
    openDetail: (code: string): string => `${code} 상세 보기`,
    groupRun: '상태 시간',
    groupOutput: '생산 실적',
    groupWork: '현재 작업',
    workOrder: '작업지시 번호',
    noWork: '진행 중인 작업이 없습니다.',
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
    remainingQty: (qty: string): string => `남은 ${qty}`,
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
    tagPeriod: '선택 기간',
    runningOfTotal: '가동 설비',
    availability: '시간가동률',
    /** 서버 설명이 올 때만 쓰는 짧은 기준 줄(원문은 설명 단추의 툴팁). */
    availabilityBasis: '계획 가동시간 기준',
    workedEquipment: (count: string): string => `작업\u00a0설비\u00a0${count}대`,
    /** ⭐ 툴팁 문구 — 사용자 지정(2026-10-16), 그대로 쓴다. */
    availabilityTip: '계획된 가동시간 중 실제 가동한 시간의 비율입니다.',
    /** ⭐ 사용자 결정 2026-10-16 — 서버 notYetReasonCode = CALENDAR_UNRESOLVED 일 때만. */
    availabilityCalendarMissing: '근무 일정 미등록',
    availabilityCalendarMissingTip:
      '조회 기간에 근무 일정이 등록되지 않은 날짜가 있어 가동률을 계산할 수 없습니다.',
    productionQty: '생산 수량',
    /** 이 띠에서는 「NG」 대신 「불량」(사용자 지시 2026-10-16). */
    defectLine: (qty: string): string => `불량 ${qty} EA`,
    defectRate: '종합 불량률',
    defectRateNote: '생산 수량 중 불량 비율',
    /** ⭐ 툴팁 문구 — 사용자 지정(2026-10-16), 그대로 쓴다. */
    defectRateTip: '전체 생산 수량 중 불량 수량이 차지하는 비율입니다.',
    /** 시안의 「평균 C/T 달성」 자리 — 실측 C/T 가 없어 표준 C/T 기준 성능률을 둔다. */
    performance: '성능률',
    /** ⭐ 툴팁 문구 — 사용자 지정(2026-10-16), 그대로 쓴다. */
    performanceTip: '표준 사이클 타임을 기준으로 계산한 추정값입니다.',
    oeeTip: '표준 사이클 타임을 기준으로 계산한 설비종합효율 추정값입니다.',
    myUnreadAlertsTip:
      '현재 계정에서 확인하지 않은 알림 수입니다. 선택한 공장과 관계없이 전체 알림을 집계합니다.',
    estimated: '추정',
    oee: 'OEE(설비종합효율)',
    /** 실제 의미는 로그인 사용자의 안 읽은 알림 수다. */
    myUnreadAlerts: '미확인 알림',
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
    /** 일별 꺾은선 툴팁(품질 종합) — 값이 없는 날은 「—」. */
    tipNone: '—',
    tipRate: (value: string): string => `${value}%`,
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
    /** 이틀 이상 기간 — 「당월」 · 「당월 누계」 · 「금일」 자리(사용자 확정 2026-10-16). */
    tagPeriod: '선택 기간',
    tagNow: '현재',
    passRateOf: (kind: string): string => `${kind} 합격률`,
    prevMonth: (rate: string): string => `전월 ${rate}`,
    /** ⭐ 품질 종합 KPI(사용자 지시 2026-10-19) — 비교 값이 없으면 증감을 지어내지 않는다. %p 표기. */
    prevMissing: '전월 데이터 없음',
    prevMissingPeriod: '직전 기간 데이터 없음',
    deltaUpPp: (p: string): string => `↑ ${p}%p`,
    deltaDownPp: (p: string): string => `↓ ${p}%p`,
    lotLegend: { accepted: '합격', rejected: '불합격', held: '검사 보류' },
    prevPeriod: (rate: string): string => `직전 기간 ${rate}`,
    deltaUp: (p: string): string => `↑ ${p}p`,
    deltaDown: (p: string): string => `↓ ${p}p`,
    deltaFlat: '전월과 동일',
    deltaFlatPeriod: '직전 기간과 동일',
    /** 모수가 0이라 합격률을 낼 수 없다. ⛔ 0%로 그리지 않는다. */
    rateNone: '—',
    percent: (value: string): string => `${value}%`,
    todayLots: '금일 검사 LOT',
    monthLots: '검사 LOT',
    pqcLots: '공정검사 LOT',
    oqcLots: '출하검사 LOT',
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
    phenomena: '불량 유형 TOP 5',
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
    /** 품질 종합 KPI — 기준 기간은 배지가 말하므로 설명은 짧게(사용자 지시 2026-10-19). */
    customerReturnNoteShort: '반품 입고 기준',
    /** ⭐ 「현재 현황」 상태별 LOT 목록 창(사용자 결정 2026-10-19 「서버 추가 + 팝업」). */
    lots: {
      countLots: (count: string): string => `${count} LOT`,
      countCases: (count: string): string => `${count}건`,
      truncated: (total: string, shown: string): string => `전체 ${total}건 중 ${shown}건 표시`,
      loading: 'LOT 목록을 불러오는 중입니다.',
      failed: 'LOT 목록을 불러오지 못했습니다.',
      empty: '해당하는 LOT 이 없습니다.',
      lotColumn: 'LOT · 품목',
      infoColumn: '상세',
      qtyColumn: '수량 · 시각',
      noLot: 'LOT 번호 없음',
      listLabel: (status: string): string => `${status} 목록`,
    },
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
