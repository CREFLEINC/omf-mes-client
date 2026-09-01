/**
 * M-05-02 설비고장 현장보고 — 현장이 고장을 알린다.
 *
 * 설비담당은 증상 한 줄만 보고 출동한다. 그래서 증상을 필수로 두고 무엇을 적어야 하는지
 * 형태를 이끈다. 끊겨 있어도 알림을 끄지 않는다 - 끄면 보고자가 알린 줄 안다.
 *
 * 상세 처리는 W-05-04 소관이고 그 문구는 equipment-failure.ts 에 있다.
 */
export const equipmentFailureReport = {
  title: '설비 고장 보고',
  equipment: {
    legend: '설비',
    scanLabel: '설비 스캔',
    scanPlaceholder: '설비 QR을 비추세요',
    pickLabel: '목록에서 고르기',
    pickPlaceholder: '설비를 고르세요',
    loading: '설비 목록을 불러오는 중입니다',
    loadFailed: '설비 목록을 불러오지 못했습니다',
    notFound: (code: string) => `${code} 설비를 찾지 못했습니다`,
    /** 막지 않는다. 다른 증상일 수 있어 사람이 보고 정한다. */
    openBreakdowns: (count: number) => `이 설비에 처리 중인 고장 ${String(count)}건`,
  },
  symptom: {
    legend: '현상',
    label: '증상',
    placeholder: '유압 누유 · 실린더 하부',
    hint: '무엇이 어떻게 되었는지 한 줄로 적어 주세요.',
    required: '증상을 적어 주세요',
  },
  photo: {
    legend: '사진',
    take: (count: number, max: number) => `촬영 (${String(count)}/${String(max)})`,
    thumbnail: '찍은 사진',
    full: '사진은 세 장까지 붙일 수 있습니다.',
    /** 사진 한 장이 수백 KB 라 쌓이면 단말 보관소가 감당하지 못한다. */
    tooHeavy: '보내지 못한 사진이 많아 지금은 더 찍을 수 없습니다.',
    failed: '사진을 가져오지 못했습니다',
    waiting: (count: number) => `사진 ${String(count)}장도 함께 기다립니다.`,
  },
  state: {
    legend: '지금 상태',
    label: '발생 상태',
    stopped: '설비가 멈췄다',
    abnormal: '돌지만 이상하다',
    /** 이 화면은 비가동을 만들지 않는다. 안내만 한다. */
    downtimeNotice: '비가동 실적은 POP에서 따로 입력합니다.',
    stoppedAtLabel: '정지 시각',
    stoppedAtHint: '모르면 비워 두세요.',
  },
  notify: {
    legend: '알림',
    label: '설비담당에게 알린다',
    /** 끊겼다고 끄지 않는다. 아직 못 갔다는 것을 보이는 것이 맞다. */
    offline: '연결되면 알립니다. 급하면 직접 연락하세요.',
  },
  /** 되돌아온 건 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: {
    report: '설비 고장 보고',
    photo: '고장 사진',
  },
  submit: '고장 보고',
  /** 누가 한 일인지 없이 기록을 남길 수 없다. 서버가 사번 없는 쓰기를 받지 않는다. */
  noWorker: '사번을 확인해야 보고할 수 있습니다',
  queued: {
    title: '보고를 담아 두었습니다',
    description: '연결되면 보냅니다. 아직 설비담당에게 가지 않았습니다.',
  },
  sent: {
    title: '고장을 보고했습니다',
  },
  /** 담긴 것과 다른 말을 쓴다. 기다려도 가지 않으므로 지금 무엇을 할지 정해야 한다. */
  rejected: {
    title: '보고가 되돌아왔습니다',
    description: '서버가 받지 않았습니다. 아직 설비담당에게 가지 않았습니다.',
    action: '되돌아온 기록 보기',
  },
  another: '다른 고장 보고',
} as const;
