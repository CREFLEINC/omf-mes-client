/**
 * M-05-01 설비 점검 입력 — 현장이 설비를 점검하고 이력을 남긴다.
 *
 * 이 기록이 작업 전 점검 통제의 근거라, 못 보낸 건은 통제에 반영되지 않는다. 무엇에
 * 반영되지 않는지를 이름으로 적는다.
 *
 * 점검은 진단이지 조치가 아니다. 불합격은 보전을 부르되 이 화면이 발행하지 않는다.
 */
export const equipmentInspection = {
  title: '설비 점검',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '설비 점검',
  equipment: {
    legend: '설비 선택',
    scanLabel: '설비 스캔',
    scanPlaceholder: '설비 QR을 비추세요',
    pickLabel: '목록에서 고르기',
    pickPlaceholder: '설비를 고르세요',
    loading: '설비 목록을 불러오는 중입니다',
    loadFailed: '설비 목록을 불러오지 못했습니다',
    notFound: (code: string) => `${code} 설비를 찾지 못했습니다`,
  },
  type: {
    legend: '점검 유형',
    daily: '일상',
    monthly: '정기',
  },
  items: {
    legend: '항목별 점검',
    progress: (done: number, total: number) => `${String(done)} / ${String(total)}`,
    loading: '점검 항목을 불러오는 중입니다',
    /** 등록돼 있지 않은 것과 확인하지 못한 것은 다르다. 뒤엣것을 앞엣것으로 말하지 않는다. */
    loadFailed: '점검 항목을 확인할 수 없습니다. 연결을 확인한 뒤 다시 고르세요.',
    none: '이 설비에 점검 항목이 등록돼 있지 않습니다',
    noneForType: '이 유형으로 등록된 점검 항목이 없습니다',
    /** 부여가 바뀌어도 다음 시작까지 옛 항목으로 점검한다. 언제 받은 것인지를 보인다. */
    receivedAt: (at: string) => `항목 기준: ${at} 수신`,
    required: '필수',
    range: (lower: string, upper: string, uom: string) => `기준 ${lower} ~ ${upper} ${uom}`,
    /** 기준이 비어 있으면 자동 판정이 서지 않는다. 감추지 않고 육안으로 넘긴다. */
    noRange: '기준 미등록 — 육안으로 판정하세요',
    measured: '측정값',
    ok: '합격',
    ng: 'NG',
    remarks: '항목 비고',
  },
  summary: {
    legend: '종합',
    counts: (ok: number, ng: number) => `합격 ${String(ok)} · NG ${String(ng)}`,
    /** 점검은 진단이다. 보전 지시는 설비담당이 따로 발행한다. */
    ngNotice: 'NG가 있어 보전이 요청됩니다.',
    remarks: '비고',
    remarksRequired: 'NG가 있어 비고를 적어야 합니다',
    remainingRequired: (name: string) => `필수 항목 ${name}이(가) 남았습니다`,
  },
  submit: '점검 완료',
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '점검을 담아 두지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  noWorker: '사번을 확인해야 점검할 수 있습니다',
  /** 못 보낸 점검은 서버에 없어 작업 통제가 점검을 안 한 것으로 읽는다. */
  unsent: (count: number) => `미전송 점검 ${String(count)}건 — 작업 통제에 반영되지 않습니다`,
  sent: {
    title: '점검을 기록했습니다',
  },
  queued: {
    title: '점검을 담아 두었습니다',
    description: '연결되면 보냅니다. 아직 작업 통제에 반영되지 않습니다.',
  },
  rejected: {
    title: '점검이 되돌아왔습니다',
    description: '서버가 받지 않았습니다. 작업 통제에 반영되지 않습니다.',
    action: '되돌아온 기록 보기',
  },
  another: '다른 설비 점검',
} as const;
