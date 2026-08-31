/**
 * W-05-08 비가동 집계 조회 — 설비가 얼마나 섰고 왜 섰는지를 기간으로 묶어 본다.
 *
 * 이 화면의 문구는 **숫자가 무엇을 담고 무엇을 빼고 있는지**를 계속 말한다. 집계는 빼는 것이
 * 많은 자리라, 밝히지 않으면 사용자가 합계를 전부인 것으로 읽는다.
 */
export const downtimeSummary = {
  title: '비가동 집계 조회',
  breadcrumbRoot: '설비/툴',

  panes: {
    filters: '조회 조건',
    summary: '요약',
    detail: '분포',
  },

  filters: {
    period: '기간',
    plant: '공장',
    equipmentGroup: '설비 그룹',
    equipment: '설비',
    all: '전체',
    search: '조회',
    reset: '초기화',
    download: '내려받기',
    /** 기간이 필수인 화면이라 비활성 사유가 「어떻게 풀 것인가」를 담는다. */
    periodRequired: '기간을 고르면 조회할 수 있습니다. 시작일과 종료일을 모두 채우세요.',
    periodInvalid: '달력에 없는 날짜입니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '종료일이 시작일보다 앞섭니다. 두 날짜를 바꿔 주세요.',
    lookupFailed: (name: string): string =>
      `${name} 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.`,
    lookupTruncated: (name: string): string =>
      `${name} 목록의 일부만 보입니다. 찾는 값이 없으면 담당자에게 문의하세요.`,
  },

  summary: {
    operating: '조업 시간',
    plannedDowntime: '계획 비가동',
    actualDowntime: '실제 비가동',
    availability: '시간가동률',
    /** 조업 시간이 0이면 분모가 없다. ⛔ 0%로 그리면 「하루 종일 섰다」로 읽힌다. */
    availabilityUnavailable: '산출 불가',
    availabilityUnavailableNote: '조업 시간이 없어 시간가동률을 낼 수 없습니다.',
    /** ⛔ 설비종합효율은 이 화면이 그리지 않는다 — 세 항의 소유가 갈린다. */
    scopeNote: '이 화면은 시간가동률까지만 냅니다. 설비종합효율은 여기서 내지 않습니다.',

    openIntervals: '집계에서 빠진 구간',
    openIntervalsNote:
      '아직 끝나지 않아 합계에서 빠진 구간입니다. 「지금까지」로 자르면 조회할 때마다 값이 달라집니다.',
    openIntervalsOpen: '빠진 구간 보기',

    overlappingIntervals: '겹쳐 한 번만 센 구간',
    /** ⛔ 임의 배분은 근거 없는 숫자를 만든다. 그 사실을 표에도 적는다. */
    overlappingIntervalsNote:
      '두 구간이 같은 시간에 겹치면 합계에서 한 번만 셉니다. 어느 사유의 몫인지는 나눌 수 없어 사유별 분포에는 그만큼이 담기지 않습니다.',
    overlappingIntervalsOpen: '겹친 구간 보기',

    minorStops: '경미 정지',
    /** 임계는 화면이 정하지 않는다 — 응답이 내려준 값을 그대로 적는다. */
    minorStopsNote: (threshold: number): string =>
      `${String(threshold)}분보다 짧은 정지입니다. 위 합계에 들어 있고 따로 빼지 않습니다 — 잦다는 것 자체가 신호입니다.`,
    minorStopsThresholdUnknown:
      '경미 정지로 보는 기준 시간을 응답이 내려주지 않아 판정 근거를 적을 수 없습니다.',

    sessionsWithoutEquipment: '설비가 붙지 않은 작업',
    sessionsWithoutEquipmentNote:
      '조업 시간에는 들어가지만 설비별 분포에서는 빠집니다. 설비를 붙이면 분포에도 들어옵니다.',

    maintenance: '보전 건수',
    corrective: '사후 보전',
    preventive: '예방 보전',
    breakdownsWithoutOrder: '지시 없이 닫힌 고장',
    breakdownsWithoutOrderNote:
      '보전 지시 없이 완료된 고장 건수입니다. 비율의 분모는 사후·예방 보전 건수의 합입니다.',

    unitMinutes: '분',
    unitCount: '건',
  },

  tabs: {
    reason: '사유별',
    equipment: '설비별',
    period: '추이',
  },

  bucket: {
    label: '칸 크기',
    day: '일',
    week: '주',
    month: '월',
  },

  table: {
    reasonCode: '사유',
    equipmentCode: '설비',
    periodStart: '구간 시작',
    count: '건수',
    totalMinutes: '합계(분)',
    averageMinutes: '평균(분)',
    sharePercent: '비중',
    /** 사유별 분포가 전체와 어긋날 수 있다는 사실을 표 자체에 붙인다. */
    reasonCaption:
      '겹친 구간의 몫은 어느 사유에도 담기지 않습니다. 사유별 합이 실제 비가동과 다를 수 있습니다.',
    equipmentCaption: '설비가 붙지 않은 작업은 이 표에 나오지 않습니다. 요약의 건수로 함께 보세요.',
    periodCaption: '칸의 크기는 위 「칸 크기」가 정합니다.',
    unknownName: '이름 없음',
    /** 값을 낼 수 없는 칸. ⛔ 0으로 채우지 않는다. */
    notAvailable: '—',
    emptyTitle: '분포 없음',
    empty: '이 기간에 집계된 비가동이 없습니다.',
  },

  intervals: {
    openTitle: '집계에서 빠진 구간',
    overlappingTitle: '겹쳐 한 번만 센 구간',
    close: '닫기',
    equipment: '설비',
    reason: '사유',
    startedAt: '시작',
    endedAt: '종료',
    duration: '길이(분)',
    ongoing: '진행 중',
    emptyTitle: '구간 없음',
    empty: '해당하는 구간이 없습니다.',
    /**
     * 목록 조회에는 공장·설비 그룹으로 좁히는 수단이 없다. 그 조건을 걸어 둔 채 목록을 열면
     * 요약의 건수보다 많이 보일 수 있으므로, 그 사실을 창에서 밝힌다.
     */
    scopeMismatch:
      '이 목록은 공장·설비 그룹 조건으로 좁혀지지 않습니다. 위 요약의 건수보다 많이 보일 수 있습니다.',
  },

  download: {
    /** 서버에 내려받기 경로가 없어 화면이 파일을 만든다. 무엇을 담는지 밝힌다. */
    note: '지금 보고 있는 분포를 파일로 내려받습니다.',
    disabled: '내려받기는 조회한 뒤에 쓸 수 있습니다. 먼저 기간을 골라 조회하세요.',
    fileName: (tab: string, from: string, to: string): string =>
      `비가동집계_${tab}_${from}_${to}.csv`,
  },
} as const;
