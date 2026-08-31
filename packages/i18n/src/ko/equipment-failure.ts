/**
 * W-05-04 설비고장 상세처리 — 현장이 보고한 고장을 사무가 받아 처리하고 닫는다.
 *
 * ⭐ **사건 기록이지 전표가 아니다.** 상태를 되돌리는 길이 없고, 현장이 적은 것을 사무가
 * 고치지도 않는다. 그래서 이 화면의 문구는 「무엇을 고칠 수 있고 무엇을 고칠 수 없는가」와
 * 「이 버튼을 누르면 되돌릴 수 없다」를 계속 말한다.
 */
export const equipmentFailure = {
  title: '설비고장 상세처리',
  breadcrumbRoot: '설비/툴',

  panes: {
    filters: '조회 조건',
    list: '고장 목록',
    detail: '상세 처리',
  },

  filters: {
    equipment: '설비',
    status: '상태',
    period: '보고 기간',
    openOnly: '미처리만',
    withoutOrder: '보전 지시 없는 건만',
    all: '전체',
    search: '조회',
    reset: '초기화',
    periodInvalid: '달력에 없는 날짜입니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '종료일이 시작일보다 앞섭니다. 두 날짜를 바꿔 주세요.',
    equipmentLookupFailed: '설비 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    equipmentLookupTruncated:
      '설비 목록의 일부만 보입니다. 찾는 설비가 없으면 담당자에게 문의하세요.',
    /** 기본 조회가 「적체를 보는」 조회임을 밝힌다. */
    defaultNote: '기본은 미처리 전건이며 경과일이 긴 순으로 보입니다 — 밀린 것을 먼저 봅니다.',
  },

  table: {
    breakdownNo: '고장 번호',
    equipment: '설비',
    symptom: '증상',
    occurrenceState: '발생 상태',
    reportedAt: '보고 시각',
    status: '상태',
    reporter: '보고자',
    notAvailable: '—',
    emptyTitle: '고장이 없습니다',
    empty: '조건에 맞는 고장이 없습니다. 조건을 줄이거나 기간을 넓혀 보세요.',
    beyondLastTitle: '이 쪽에는 고장이 없습니다',
    beyondLast: '조건에 맞는 고장은 있지만 이 쪽에는 없습니다. 첫 쪽으로 돌아가세요.',
    firstPage: '첫 쪽으로',
    open: '열기',
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },

  detail: {
    emptyTitle: '고장을 고르세요',
    empty: '왼쪽 목록에서 고장을 고르면 여기에 상세가 열립니다.',

    reportHeading: '현장이 적은 것',
    /** ⛔ 현장 기록은 사무가 고치지 않는다. 감추지 않고 읽기 전용임을 말한다. */
    reportReadOnly:
      '증상·발생 상태·정지 시각·사진은 현장이 적은 것이라 여기서 고칠 수 없습니다. 바로잡을 것이 있으면 처리 내역에 덧붙이세요.',
    symptom: '증상',
    occurrenceState: '발생 상태',
    stoppedAt: '정지 시각',
    stoppedAtUnknown: '모름 — 현장이 적지 않았습니다',
    reportedAt: '보고 시각',
    reporter: '보고자',
    photos: '사진',
    photoCount: (count: number): string => `${String(count)}장`,
    /** 사진 자체를 여는 경로가 계약에 없다 — 건수만 밝힌다. */
    photosNotViewable: '사진을 여는 경로가 아직 없어 장수만 보입니다.',
    noPhotos: '사진이 없습니다.',

    downtimeHeading: '연결된 비가동',
    downtimeCountLabel: '건수',
    downtimeMinutesLabel: '합계 시간',
    downtimeCount: (count: number): string => `${String(count)}건`,
    downtimeMinutes: (minutes: number): string => `${String(minutes)}분`,
    downtimeMinutesUnknown: '합계를 낼 수 없습니다 — 끝나지 않은 구간이 있습니다.',
    /** ⚠ 완료 전에 알린다. 완료가 비가동을 닫아 주지 않는다. */
    openDowntimeWarning: (count: number): string =>
      `아직 끝나지 않은 비가동이 ${String(count)}건 있습니다. 고장을 완료해도 비가동은 닫히지 않습니다 — 현장 단말에서 따로 종료해야 합니다.`,

    handlingHeading: '처리 내용',
    causeCode: '원인 코드',
    handlingNote: '처리 내역',
    maintenanceOrder: '연결된 보전 지시',
    noMaintenanceOrder: '연결된 보전 지시가 없습니다. 발행은 보전지시 발행 화면에서 합니다.',
    handledAt: '처리 시각',
    save: '처리 내용 저장',
    saved: '처리 내용을 저장했습니다.',
  },

  status: {
    received: '접수',
    handling: '처리중',
    done: '완료',
  },

  occurrence: {
    stopped: '멈춤',
    abnormal: '돌지만 이상',
  },

  actions: {
    startHandling: '처리 중으로',
    complete: '완료',
    /** ⭐ 되돌리는 경로가 없다 — 누르기 전에 그 사실을 말한다. */
    startHandlingConfirmTitle: '이 고장을 처리 중으로 옮길까요?',
    startHandlingConfirm:
      '처리 중으로 옮기면 접수 상태로 되돌릴 수 없습니다. 사건 기록이라 상태를 되돌리는 길이 없습니다.',
    completeConfirmTitle: '이 고장을 완료할까요?',
    completeConfirm:
      '완료하면 이 건은 잠기고 되돌릴 수 없습니다. 잘못됐으면 새 고장 건으로 등록해야 합니다.',
    confirm: '진행',
    cancel: '취소',

    /** 비활성 사유 — 「무엇이 막혔는지 + 어떻게 풀 것인가」를 함께 담는다. */
    startHandlingLocked: '처리 중으로 옮기기는 접수 상태에서만 할 수 있습니다.',
    completeLockedDone: '이미 완료된 고장입니다.',
    completeLockedCause: '완료하려면 원인 코드를 고르세요.',
    completeLockedNote: '완료하려면 처리 내역을 적으세요.',
    /** 원인 코드 목록이 아직 없으면 완료 자체가 막힌다. */
    completeLockedNoCauseCodes:
      '원인 코드 목록이 아직 등록되지 않아 완료할 수 없습니다. 값이 등록되면 열립니다.',
    saveLockedDone: '완료된 고장은 처리 내용을 고칠 수 없습니다.',
  },

  codes: {
    causeEmpty: '원인 코드 목록이 아직 등록되지 않았습니다. 값이 등록되면 고를 수 있습니다.',
    provisional: '값 목록이 아직 확정되지 않아 일부만 보입니다. 없는 값은 담당자에게 문의하세요.',
    selectPlaceholder: '고르세요',
  },
} as const;
