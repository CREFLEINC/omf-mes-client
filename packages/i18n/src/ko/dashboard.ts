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
    cards: '지표',
    trend: '일일 생산실적 추이',
    alerts: '미처리 알람',
    equipment: '설비 현황',
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
    autoRefresh: (minutes: number): string =>
      `${String(minutes)}분마다 자동으로 갱신됩니다. 바로 최신 값을 보려면 「갱신」을 누르세요.`,
    plantLookupFailed: '공장 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    plantLookupTruncated: '공장 목록의 일부만 보입니다. 찾는 공장이 없으면 담당자에게 문의하세요.',
  },

  asOf: {
    /** 서버가 집계를 끝낸 시각이다 — 브라우저가 받은 시각이 아니다. */
    label: (at: string): string => `기준 ${at}`,
    /** 서버가 기준 시각을 주지 않았을 때. 시각을 지어내지 않고 없다는 사실만 적는다. */
    unknown: '집계 기준 시각을 알 수 없습니다.',
    /** 갱신에 실패해도 직전 값을 지우지 않는다 — 회색 화면만 남기지 않는다. */
    stale: (at: string): string => `기준 ${at} · 갱신에 실패해 직전 값을 보이고 있습니다.`,
  },

  cards: {
    /** 값을 낼 수 없는 카드. ⛔ 0으로 그리지 않는다 — 0은 「가동하지 않았다」로 읽힌다. */
    notYet: '아직 없음',
    /** 분모에서 뺀 것이 있는 카드. 뺐다는 사실을 카드 본문에 적는다. */
    excluded: (count: number): string => `${String(count)}건 제외`,
    statusPartial: '일부만 셈',
    statusNotYet: '값 없음',
    deltaUp: (text: string): string => `직전 기준일 대비 ${text} 상승`,
    deltaDown: (text: string): string => `직전 기준일 대비 ${text} 하락`,
    deltaFlat: '직전 기준일과 같음',
    /** 카드를 눌러 소유 화면으로 갈 수 있을 때. */
    openHint: (label: string): string => `${label} 상세 화면으로 이동`,
    /**
     * 어느 카드에서도 아직 상세로 갈 수 없을 때 **구획에 한 번** 적는다.
     * 카드마다 붙이면 같은 문장이 다섯 번 서서 정작 숫자가 안 읽힌다.
     * ⛔ 그럴듯한 주소를 지어내지 않는다 — 지어내면 사용자가 엉뚱한 자리에 도착한다.
     */
    drilldownClosed:
      '아직 카드에서 상세 화면으로 바로 갈 수 없습니다. 왼쪽 메뉴에서 해당 화면을 여세요.',
    empty: '보여 줄 지표가 없습니다. 기준 날짜나 공장을 바꿔 보세요.',
    emptyTitle: '지표 없음',
  },

  trend: {
    target: '목표',
    unitSuffix: (unit: string): string => `단위 ${unit}`,
    emptyTitle: '추이 없음',
    empty: '이 기간에 그릴 생산실적이 없습니다.',
    /** 계약이 추이를 선택 항목으로 두어 아예 오지 않을 수 있다. */
    absent: '생산실적 추이가 이 응답에 오지 않았습니다.',
    detail: '자세히',
  },

  alerts: {
    emptyTitle: '미처리 알람 없음',
    /** 알람 0건은 오류가 아니라 정상 상태다. */
    empty: '지금 확인할 알람이 없습니다.',
    unread: '미확인',
    read: '확인함',
    /** 위치는 계층 텍스트로만 그린다 — 평면 배치·도면 구획을 쓰지 않는다. */
    locationUnknown: '위치 정보 없음',
    emptyMessage: '내용이 비어 있습니다.',
    openCenter: '알림센터',
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
    runningOfTotal: '가동 / 전체',
    countUnit: '대',
    line: '라인',
    allLines: '전체',
    tilesTitle: '호기별 상태',
    /** 라인으로 거른 뒤의 대수. 전체 대수는 위 집계 줄이 말한다. */
    shownCount: (count: number): string => `${String(count)}대 표시`,
    tonnage: '톤수',
    todayQty: '금일 생산',
    ngQty: 'NG',
    defectRate: '불량률',
    standardCycleTime: '표준 C/T',
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
    stoppedLead: '가동 중이 아닌 설비입니다. 오래 멈춘 것부터 보입니다.',
    stoppedEmptyTitle: '멈춘 설비 없음',
    stoppedEmpty: '지금 고른 범위의 설비가 모두 가동 중입니다.',
    equipmentColumn: '호기',
    statusColumn: '상태',
    openDetail: (code: string): string => `${code} 상세 보기`,
    detailTitle: (code: string, name: string): string => `${code} · ${name}`,
    workOrder: '현재 작업지시',
    item: '품목',
    close: '닫기',
    emptyTitle: '설비 없음',
    empty: '이 공장에 표시할 생산 설비가 없습니다.',
    lineEmpty: '고른 라인에 설비가 없습니다.',
    /** 서버가 아직 설비 섹션을 주지 않을 때(2차 규격 배포 전). ⛔ 「설비 없음」과 같은 말로 그리지 않는다. */
    absentTitle: '설비 현황 없음',
    absent: '설비 현황이 이 응답에 오지 않았습니다.',
    /** 첫 조회가 실패해 보일 값이 없을 때. 재시도는 화면 위 오류 배너가 맡는다. */
    failed: '설비 현황을 불러오지 못했습니다. 위의 「다시 시도」를 누르세요.',
  },

  /** 출하 현황(omf-all-around#114). 네 칸 모두 기준 날짜 · 공장 기준이다. */
  shipment: {
    todayShipped: '오늘 출하 실적',
    todayShipmentCount: (count: string): string => `출하 확정 ${count}건`,
    waiting: '출하 대기',
    waitingNote: '기준 날짜까지 요청됐고 아직 출하하지 않은 요청',
    next: '다음 출하',
    /** 기준 날짜 이후 가장 이른 미출하 요청이 없을 때. */
    nextNone: '예정 없음',
    nextDate: (date: string): string => `출하 요청일 ${date}`,
    /** 요청 수량이 아니라 아직 출하하지 않은 잔량이다(규격 보정). */
    remainingQty: (qty: string): string => `남은 수량 ${qty}`,
    customerUnknown: '고객 미지정',
    overdue: '납기 지연',
    overdueNote: '납기가 지났는데 출하 잔량이 남은 수주 줄',
    qtyUnit: 'EA',
    countUnit: '건',
    overdueStatus: '지연 있음',
    absentTitle: '출하 현황 없음',
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
   * 품질 현황(omf-all-around#113).
   *
   * ⛔ 「선별」이라는 말을 쓰지 않는다 — MES 용어는 **검사 보류**(판정 보류)와 **전수 재검**이다.
   * ⛔ 목표선 · 목표값을 그리지 않는다(MES DB에 없음). 합격률은 최종 판정 기준이고 보류는 빠진다.
   */
  quality: {
    monthPassRate: (kind: string): string => `${kind} 당월 합격률`,
    passRate: '당월 합격률',
    prevMonth: (rate: string): string => `전월 ${rate}`,
    /** 모수가 0이라 합격률을 낼 수 없다. ⛔ 0%로 그리지 않는다. */
    rateNone: '—',
    percent: (value: string): string => `${value}%`,
    passRateRule: '최종 판정 기준 · 검사 보류는 합격률에서 뺍니다.',
    todayLots: '금일 검사 LOT',
    monthLots: '당월 검사 LOT',
    lotBreakdown: (accepted: string, rejected: string, held: string): string =>
      `합격 ${accepted} · 불합격 ${rejected} · 검사 보류 ${held}`,
    monthDefectQty: '당월 불합격 수량',
    qtyUnit: 'EA',
    lotUnit: 'LOT',
    countUnit: '건',
    dailyTitle: '일별 합격률',
    dailyRecent: '최근 9일',
    dailyColumn: '일자',
    /** 단일 유형 그래프 — 합격률을 낼 수 없는 날은 점을 찍지 않는다(0으로 찍으면 바닥으로 떨어진 날로 읽힌다). */
    dailyGapNote: '검사가 없어 합격률을 낼 수 없는 날은 그래프에서 빠집니다.',
    dailyEmpty: '이 기간에 합격률을 낼 수 있는 날이 없습니다.',
    vendorDefects: '업체별 IQC 불량 수량',
    vendorDefectsLead: '당월 · 많은 순 상위 5',
    phenomena: '불량현상 구성비',
    phenomenaMonth: '당월',
    /** 불량 기록이 쌓이지 않아 빈 배열이 온다(불량 기록 등록 경로 미구현). */
    noRecordsTitle: '기록 없음',
    noRecords: '아직 집계할 불량 기록이 없습니다.',
    recentLots: '최근 검사 LOT 판정',
    recentLotsLead: '최근 5건',
    recentEmpty: '최근 검사 판정이 없습니다.',
    column: {
      inspectedAt: '검사 일시',
      kind: '구분',
      vendor: '업체',
      customer: '고객',
      equipment: '호기',
      item: '품목',
      lotNo: 'LOT',
      qty: '수량(EA)',
      judgment: '판정',
      qtyOnly: '수량',
      rate: '불량률',
    },
    judgment: {
      ACCEPTED: '합격',
      REJECTED: '불합격',
      HELD: '검사 보류',
    },
    none: '—',
    topVendor: '최다 불량 업체',
    itemDefects: '품목(CODE)별 불량',
    receiptHold: '입고 보류 LOT',
    receiptHoldNote: '지금 보류 중인 입하 LOT',
    fullReinspect: '전수 재검',
    fullReinspectNote: (input: string, restored: string): string =>
      `투입 ${input} · 양품 복원 ${restored}`,
    pendingLots: '검사 대기 LOT',
    pendingLotsNote: '판정 전 PQC 의뢰',
    reworkRequests: '재작업 의뢰',
    reworkRequestsNote: '당월 처분 재작업',
    worstEquipment: '최고 불량률 호기',
    equipmentDefectRates: '호기별 불량률',
    equipmentDefectRatesLead: '기준일 · 높은 순 상위 8',
    customerReturn: '고객 반품',
    customerReturnNote: '당월 고객 반품 입고 수량',
    ncMonthQty: '당월 부적합 수량',
    ncOpen: '미종결 부적합',
    ncOverdue: '조치 기한 초과',
    ncScrap: '폐기',
    ncScrapNote: '당월 처분 폐기',
    ncReworkReleased: '재투입',
    ncReworkReleasedNote: '당월 재작업 후 재투입(합격)',
    ncPareto: '불량현상별 부적합 수량',
    ncCauseGroups: '원인 구분별 부적합 수량',
    absentTitle: '품질 현황 없음',
    absent: '품질 현황이 이 응답에 오지 않았습니다.',
    failed: '품질 현황을 불러오지 못했습니다. 위의 「다시 시도」를 누르세요.',
  },
} as const;
