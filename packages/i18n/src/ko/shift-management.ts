/** W-06-26 교대 관리(omf-all-around#318) — 공장별 주간·야간 교대 시간. */
export const shiftManagement = {
  /** 교대 목록 제목 오른쪽 ⓘ 말풍선(사용자 정정 2026-11-25 · 글자 그대로). */
  intro:
    '공장별로 주간·야간 교대의 시작 시각과 종료 시각을 설정합니다. 종료 시각이 시작 시각보다 이르면 다음 날 종료로 저장됩니다.\n예: 20:00~08:00 → 당일 20:00 시작, 다음 날 08:00 종료',
  filters: {
    label: '조건',
    plant: '공장',
  },
  /** 위 줄 오른쪽 사용 유무 라벨 — 누르면 그 상태만 보이고 다시 누르면 풀린다. 0건 라벨은 숨긴다. */
  chips: {
    label: '사용 유무',
    active: '사용',
    inactive: '미사용',
    filterOn: (label: string): string => `${label}만 보기`,
    filterOff: (label: string): string => `${label} 거르기 해제`,
  },
  noPlant: '볼 수 있는 공장이 없습니다.',
  add: '교대 추가',
  tableLabel: '교대 목록',
  empty: '등록된 교대가 없습니다. [교대 추가]로 주간과 야간 교대를 등록하세요.',
  columns: {
    code: '교대 코드',
    name: '교대명',
    start: '시작 시간',
    end: '종료 시간',
    status: '사용 유무',
    actions: '관리',
  },
  values: {
    /** 자정을 넘겨 다음 날 끝나는 교대의 종료 시간. */
    nextDayEnd: (time: string) => `다음 날 ${time}`,
  },
  edit: '수정',
  editRow: (name: string) => `${name} 교대 수정`,
  deactivate: '사용 중지',
  deactivateRow: (name: string) => `${name} 교대 사용 중지`,
  dialog: {
    addTitle: '교대 추가',
    editTitle: '교대 수정',
    plant: '공장',
    code: '교대 코드',
    codePlaceholder: '예: S01',
    codeAuto: '다음 번호가 자동으로 들어갑니다. 필요하면 바꿀 수 있습니다.',
    codeLocked: (count: number) => `작업이나 실적에 ${count}건 쓰인 교대라 코드는 바꿀 수 없습니다.`,
    name: '교대명',
    namePlaceholder: '예: 주간, 야간',
    start: '시작 시간',
    end: '종료 시간',
    startHour: '시작 시간(시)',
    startMinute: '시작 시간(분)',
    endHour: '종료 시간(시)',
    endMinute: '종료 시간(분)',
    hourHead: '시',
    minuteHead: '분',
    timePlaceholder: '시간 선택',
    nextDayNote: '종료 시간이 시작 시간보다 빠르거나 같아 다음 날 끝나는 교대로 저장됩니다.',
    cancel: '취소',
    save: '저장',
    loading: '교대 정보를 불러오는 중입니다.',
  },
  deactivateDialog: {
    title: '교대 사용 중지',
    body: (name: string) =>
      `${name} 교대를 사용 중지합니다. 이미 기록된 작업과 실적은 그대로 남고, 이후 교대 선택과 작업 시간 판정에서 빠집니다.`,
    cancel: '취소',
    confirm: '사용 중지',
  },
  toast: {
    saved: '저장했습니다.',
    deactivated: '사용 중지했습니다.',
  },
};
