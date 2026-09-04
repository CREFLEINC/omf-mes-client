/**
 * W-05-10 계측기 검교정 이력 등록 — 계측기의 검교정·점검·수리·폐기 이력을 한 표에 담는다.
 *
 * ⛔ **이력은 고칠 수 없다.** 그래서 이 화면의 문구는 「저장하면 끝이다」를 사람에게 계속
 * 알린다 — 저장 전 요약 확인, 파급 안내, 잘못 적었을 때의 길(새 이력을 덧붙인다)까지.
 */
export const gaugeCalibration = {
  title: '계측기 검교정 이력',
  breadcrumbRoot: '설비/툴',

  panes: {
    filters: '조회 조건',
    list: '이력 목록',
    form: '이력 등록',
  },

  filters: {
    equipment: '계측기',
    historyType: '이력 유형',
    period: '실시 기간',
    all: '전체',
    search: '조회',
    reset: '초기화',
    periodInvalid: '달력에 없는 날짜입니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '종료일이 시작일보다 앞섭니다. 두 날짜를 바꿔 주세요.',
    equipmentLookupFailed:
      '계측기 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    equipmentLookupTruncated:
      '계측기 목록의 일부만 보입니다. 찾는 계측기가 없으면 담당자에게 문의하세요.',
  },

  table: {
    performedOn: '실시일',
    historyType: '유형',
    result: '결과',
    equipment: '계측기',
    nextDueOn: '차기 기한',
    certificateNo: '성적서 번호',
    agency: '교정 기관',
    performer: '수행자',
    tolerance: '허용오차 메모',
    remarks: '비고',
    notAvailable: '—',
    emptyTitle: '이력이 없습니다',
    empty: '조건에 맞는 이력이 없습니다. 조건을 줄이거나 기간을 넓혀 보세요.',
    beyondLastTitle: '이 쪽에는 이력이 없습니다',
    beyondLast: '조건에 맞는 이력은 있지만 이 쪽에는 없습니다. 첫 쪽으로 돌아가세요.',
    firstPage: '첫 쪽으로',
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },

  form: {
    equipment: '계측기',
    historyType: '이력 유형',
    performedOn: '실시일',
    result: '결과',
    certificateNo: '성적서 번호',
    agencyType: '교정 기관 구분',
    agencyName: '교정 기관 이름',
    nextDueOn: '유효기한(차기 검교정 예정일)',
    tolerance: '허용오차 메모',
    remarks: '비고',
    /** 계약 필수(2026-09-02) — 이 이력이 계측기 사용을 막는가. 켜면 해제될 때까지 사용 불가로 판정된다. */
    blocksUse: '이 이력으로 사용을 차단',
    blocksUseNote: '켜면 해제 전까지 이 계측기는 사용할 수 없는 것으로 판정됩니다.',
    selectPlaceholder: '고르세요',
    submit: '이력 등록',
    reset: '입력 지우기',

    /** ⛔ 이력은 불변이다. 화면이 그 무게를 먼저 말한다. */
    immutableLead:
      '저장하면 이 이력은 고치거나 지울 수 없습니다. 잘못 적었으면 새 이력을 덧붙여 바로잡습니다.',
    /** ⭐ 저장이 계측기 마스터를 갱신한다 — 파급을 미리 밝힌다. */
    masterEffect:
      '검교정 유형이고 결과가 합격이면 계측기의 최근 검교정일과 차기 예정일이 함께 갱신됩니다.',
    /** 검교정 전용 칸을 감추지 않고 비활성 + 사유로 둔다. */
    calibrationOnly: '검교정 이력에만 적습니다.',
    /** 유효기한을 화면이 계산해 제안하지 못하는 이유. */
    nextDueManual:
      '검교정 주기의 길이를 화면이 알 수 없어 예정일을 제안하지 못합니다. 성적서에 적힌 날짜를 직접 고르세요.',

    requiredEquipment: '계측기를 고르세요.',
    requiredHistoryType: '이력 유형을 고르세요.',
    requiredPerformedOn: '실시일을 고르세요.',
    requiredResult: '결과를 고르세요.',
    invalidPerformedOn: '달력에 없는 날짜입니다. 실시일을 다시 고르세요.',
    invalidNextDueOn: '달력에 없는 날짜입니다. 유효기한을 다시 고르세요.',
    nextDueBeforePerformed: '유효기한이 실시일보다 앞섭니다. 두 날짜를 다시 고르세요.',
  },

  confirm: {
    title: '이 이력을 저장할까요?',
    /** 저장 전 요약. 「무엇을 저장하는가」를 한 줄로 되읽어 준다. */
    lead: '저장하면 고치거나 지울 수 없습니다. 아래 내용이 맞는지 확인하세요.',
    submit: '저장',
    cancel: '취소',
    masterEffect: '이 이력은 계측기의 최근 검교정일과 차기 예정일을 갱신합니다.',
    noMasterEffect: '이 이력은 계측기의 검교정일을 갱신하지 않습니다.',
  },

  codes: {
    /**
     * 값 목록이 확정되지 않은 선택칸의 안내. **화면이 값을 지어내지 않는다** —
     * 계약이 이름을 확정해 준 값만 담고, 나머지는 확정되면 목록이 늘어난다.
     */
    provisional: '값 목록이 아직 확정되지 않아 일부만 보입니다. 없는 값은 담당자에게 문의하세요.',
    /** 값이 하나도 없어 고를 수 없는 칸. 필수 칸이면 저장까지 막힌다. */
    empty: (name: string): string =>
      `${name} 값 목록이 아직 없어 고를 수 없습니다. 값이 등록되면 열립니다.`,
    /** 결과 코드가 없으면 필수 칸을 채울 수 없어 저장 자체가 막힌다. */
    resultBlocked: '결과 값 목록이 없어 이력을 저장할 수 없습니다. 값이 등록되면 열립니다.',
  },

  save: {
    success: '이력을 저장했습니다.',
  },
} as const;
