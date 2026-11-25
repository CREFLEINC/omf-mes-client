/** W-06-26 교대 관리(omf-all-around#318) — 공장별 주간·야간 교대 시간. */
export const shiftManagement = {
  intro:
    '공장마다 주간과 야간 교대 시간을 등록합니다. 종료 시간이 시작 시간보다 빠르면 다음 날 끝나는 교대(예: 야간)로 저장됩니다.',
  filters: {
    label: '조건',
    plant: '공장',
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
