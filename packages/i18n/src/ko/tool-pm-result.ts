/**
 * W-05-03 툴 PM 실적 등록 — 툴 예방보전을 하고 누계를 되돌린다.
 *
 * ⭐ **누계 리셋을 서버가 한다.** 화면은 「되돌린다」는 뜻과 되돌린 뒤의 시작값만 보내고,
 * ⛔ **툴 마스터를 직접 고치지 않는다.**
 *
 * ⭐ **한 칸에 두 갱신이 붙는다** — 사용실적은 **더하기**(현장 단말이 여럿 기여한다)이고
 * 리셋은 **바꾸기**다. 그래서 이 화면만 저장 충돌 보호를 건다.
 */
export const toolPmResult = {
  title: '툴 PM 실적 등록',
  breadcrumbRoot: '설비/툴',

  panes: {
    tool: '대상 툴',
    form: '실적 등록',
    list: '실적 목록',
  },

  tool: {
    select: '툴',
    selectPlaceholder: '툴을 고르세요',
    lookupFailed: '툴 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 툴이 없으면 담당자에게 문의하세요.',
    currentShot: '누계 타발수',
    guaranteed: '적정타수',
    notComputable: '산출 불가',
    /** ⭐ 잠금 토큰이 상세 조회에서 온다 — 불러오기 전에는 리셋을 보낼 수 없다. */
    loadingLock: '툴 정보를 불러오는 중입니다. 잠시 뒤 저장하세요.',
    lockFailed: '툴 정보를 불러오지 못해 누계 리셋을 저장할 수 없습니다. 다시 시도해 주세요.',
  },

  form: {
    order: '보전 오더',
    orderNone: '오더 없이 처리',
    orderNote: '오더 없이도 적을 수 있습니다 — 현장에서 이미 조치한 건이 있습니다.',
    startedAt: '시작일',
    finishedAt: '종료일',
    finishedAtNote: '아직 끝나지 않았으면 비워 두세요.',
    resultNote: '실적 내용',
    performer: '수행자',
    outsourced: '외주 보전',
    vendorName: '외주 업체',
    vendorNote: '거래처 마스터에서 고르지 않고 직접 적습니다.',

    resetCounter: '누계 타발수 되돌리기',
    /** ⭐ 서버가 처리한다 — 화면이 툴 마스터를 고치지 않는다. */
    resetNote:
      '되돌리기를 켜면 서버가 누계를 아래 시작값으로 바꿉니다. 화면이 툴 마스터를 직접 고치지 않습니다.',
    /** ⚠ 되돌리기는 바꾸기라 충돌 보호가 걸린다 — 더하기(사용실적 입력)와 다른 축이다. */
    resetLockNote:
      '되돌리기는 더하기가 아니라 바꾸기라, 저장하는 사이 누계가 달라졌으면 저장이 거부됩니다. 사용실적 입력에는 이 보호가 걸리지 않습니다 — 여러 단말이 함께 더하기 때문입니다.',
    shotAfterReset: '되돌린 뒤 시작값',
    shotAfterResetNote: '보통 0입니다. 오버홀이면 다를 수 있습니다.',
    /** 리셋 직전 누계는 서버가 얼려 둔다 — 화면이 보내지 않는다. */
    beforeResetNote:
      '되돌리기 직전의 누계는 서버가 남깁니다. 「이번 예방보전까지 얼마나 썼는지」가 수명 분석의 재료입니다.',

    closed: '오더 마감',
    /** ⭐ 마감은 오더가 있을 때만 뜻이 있다. */
    closedNoOrder: '오더를 골라야 마감할 수 있습니다.',

    parts: '보전 부위',
    /** ⚠ 부위별 결과 값 목록이 아직 없어 부위를 적을 수 없다. */
    partsLocked:
      '부위별 결과의 값 목록이 아직 등록되지 않아 부위를 적을 수 없습니다. 값이 등록되면 열립니다.',
    /** 부위는 별도 경로가 없고 실적과 한 번에 간다 — 그 사실은 값이 서면 드러난다. */
    partsMechanism: '부위는 따로 저장하지 않고 실적과 한 번에 저장됩니다.',

    submit: '실적 저장',
    reset: '입력 지우기',
    saving: '저장하는 중입니다.',
    /** 저장하면 폼이 비어 화면만으로는 저장됐는지 알 수 없다 — 그래서 말한다. */
    saved: '실적을 등록했습니다. 아래 목록에서 확인하세요.',
    /** 되돌리기는 되돌릴 수 없다 — 「했다」를 말하지 않으면 한 번 더 누른다. */
    savedWithReset:
      '실적을 등록하고 누계 타발수를 되돌렸습니다. 위 누계와 아래 목록에서 확인하세요.',
    requiredTool: '툴을 고르세요.',
    requiredStartedAt: '시작일을 고르세요.',
    requiredResultNote: '실적 내용을 적으세요.',
    requiredPerformer: '수행자를 고르세요.',
    requiredVendor: '외주 업체를 적으세요.',
    outsourcedPerformer: '외주 보전에는 수행자를 비웁니다. 업체와 담당자는 실적 내용에 적으세요.',
    invalidFinishedAt: '종료일이 시작일보다 앞섭니다. 두 날짜를 다시 고르세요.',
    invalidDate: '달력에 없는 날짜입니다. 날짜를 다시 고르세요.',
    requiredShotAfterReset: '되돌린 뒤 시작값을 적으세요. 0도 값입니다.',
    invalidShotAfterReset: '되돌린 뒤 시작값은 0 이상의 수여야 합니다.',
    userLookupFailed: '사용자 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    selectPlaceholder: '고르세요',
  },

  table: {
    startedAt: '시작',
    finishedAt: '종료',
    resultNote: '실적 내용',
    reset: '되돌림',
    shotBefore: '되돌리기 직전 누계',
    shotAfter: '시작값',
    closed: '마감',
    notAvailable: '—',
    ongoing: '진행 중',
    emptyTitle: '실적이 없습니다',
    empty: '이 툴에 등록된 실적이 없습니다.',
    selectToolTitle: '툴을 고르세요',
    selectTool: '위에서 툴을 고르면 그 툴의 실적이 보입니다.',
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },

  confirm: {
    title: '누계를 되돌릴까요?',
    lead: '되돌리면 누계 타발수가 바뀝니다. 되돌리기 전 값은 서버가 남깁니다.',
    summary: (before: string, after: string): string => `${before} → ${after}`,
    submit: '저장',
    cancel: '취소',
  },
} as const;
