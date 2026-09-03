/**
 * M-01-07 임시 위치 적재 — 제자리에 둘 수 없는 것을 임시로 두고 그 사실을 남긴다.
 *
 * 정상 적치와 상태가 갈려야 정위치로 옮길 대상을 골라낼 수 있다.
 *
 * 사유와 비고 중 하나는 있어야 한다. 둘 다 비면 왜 임시로 두었는지가 남지 않는다.
 */
export const temporaryPutaway = {
  title: '임시 위치 적재',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '임시 적치',
  /** 지시는 앞 화면이 들고 온다. 이 화면이 따로 찾지 않는다. */
  noTask: {
    title: '적치 지시를 가지고 오세요',
    description: '이 화면은 적치·입고 완료에서 넘어옵니다. 거기서 지시를 고른 뒤에 오세요.',
    action: '적치·입고 완료로 가기',
  },
  task: {
    legend: '대상 지시',
    qty: (qty: string) => `수량 ${qty}`,
    recommended: (code: string) => `권장 위치 ${code}`,
    noRule: '권장 위치 없음',
    /** 실제 적치 위치는 완료된 건에만 채워진다. 또 적으면 두 기록이 남는다. */
    already: '이미 임시 적치되었습니다',
    alreadyAt: (code: string) => `현재 위치 ${code}`,
  },
  location: {
    legend: '임시 위치',
    scanLabel: '임시 위치 코드 스캔',
    scanPlaceholder: '위치 라벨을 비추세요',
    pickLabel: '목록에서 고르기',
    pickPlaceholder: '위치를 고르세요',
    loading: '위치를 불러오는 중입니다',
    loadFailed: '위치를 확인할 수 없습니다. 연결을 확인하세요.',
    none: '이 창고에 등록된 위치가 없습니다',
    notFound: (code: string) => `${code} 위치를 이 창고에서 찾지 못했습니다`,
    chosen: (code: string, name: string) => `${code} ${name}`,
    /** 임시 위치의 유형 값이 아직 없어 걸러 내지 않는다. */
    unfiltered: '임시 위치를 가려낼 값이 아직 없어 전체 위치를 보입니다',
    capacity: (qty: string) => `수용량 ${qty} — 임시 위치라 막지 않습니다`,
  },
  reason: {
    legend: '적치 사유',
    label: '사유',
    placeholder: '사유를 고르세요',
    loading: '사유를 불러오는 중입니다',
    loadFailed: '사유를 불러오지 못했습니다',
    /** 값이 없으면 고를 것이 없다. 비고로 적게 두고 그 사실을 말한다. */
    empty: '고를 사유가 아직 없습니다. 비고에 적으세요.',
    remarksLabel: '비고',
    /** 서버가 둘 다 비면 막는다. 무엇이 있어야 하는지를 먼저 말한다. */
    needsOne: '사유를 고르거나 비고를 적으세요',
  },
  submit: '임시 적치 등록',
  sent: {
    title: '임시 적치를 기록했습니다',
    /** 이 화면은 닫히지 않는다. 정위치로 옮기는 것은 다른 화면이 한다. */
    description: '정위치 이동은 재고 이동 화면에서 합니다. 그 화면은 아직 이 앱에 없습니다.',
  },
  queued: {
    title: '임시 적치를 담아 두었습니다',
    description: '연결되면 보냅니다. 아직 서버에 없습니다.',
  },
  rejected: {
    title: '임시 적치가 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  /** 단말 보관소가 거절한 경우. 적은 것이 어디에도 없으므로 기록되지 않았다고 말한다. */
  saveFailed: {
    title: '임시 적치를 담아 두지 못했습니다',
    description: '기록되지 않았습니다. 다시 시도하세요.',
  },
  noWorker: '사번을 확인한 뒤에 기록할 수 있습니다',
  done: '적치 화면으로',
} as const;
