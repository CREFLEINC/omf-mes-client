/**
 * P-02-02 작업 전 점검 이력 확인·통제.
 *
 * ⭐ 이 화면은 **막을 때만 보이는 게이트**다 — 통과하면 뜨지 않는다(스펙 §9-3). 그래서 문구가
 * 「무엇을 저장했다」가 아니라 **「왜 못 하는가 · 무엇을 하면 되는가」**를 말한다.
 *
 * ⛔ **「이력 없음」을 「점검 안 함」으로 단정하지 않는다**(§5-4). 오프라인에서 한 점검은
 * 아직 서버에 없을 수 있다 — 그 사실을 함께 적는다. 자동으로 통과시키지는 않는다.
 *
 * ⛔ **우회 사유를 묻지 않는다**(§5-8). 긴급 작업지시인 것 자체가 사유다.
 */
export const workPrecheckGate = {
  title: '작업 전 점검 확인',

  header: {
    equipmentUnknown: '설비 확인 전',
    equipmentLabel: (code: string, name: string): string =>
      name.trim() === '' ? code : `${code} ${name}`,
    workOrderLabel: (workOrderNo: string): string => workOrderNo,
    workerUnset: '사번 미입력',
    workerLabel: (workerNo: string): string => `사번 ${workerNo}`,
  },

  /** ① 판정 구획 — 무엇이 막았는가를 한 줄로 말한다. */
  verdict: {
    checking: '점검 이력을 확인하고 있습니다.',

    blockedMissing: '작업을 시작할 수 없습니다',
    blockedMissingDetail: '주기 내 점검 기록이 없습니다.',

    blockedFailed: '작업을 시작할 수 없습니다',
    blockedFailedDetail: '점검에서 불합격이 나왔습니다.',

    warned: '점검 기록 없이 진행합니다',
    warnedDetail: '주기 내 점검 기록이 없습니다. 진행하면 그 사실이 기록됩니다.',

    /** 어떤 수준으로 판정했는지 함께 보인다 — 왜 막혔는지가 정책이라는 것을 말한다. */
    levelBlock: '통제 수준: 차단',
    levelWarn: '통제 수준: 경고',
    /**
     * ⚠ 적용 정책이 없을 때도 경고로 다룬다. 「설정이 없어 통과」로 읽히지 않게 그 사실을
     * 따로 적는다.
     */
    levelUnresolved: '통제 수준: 경고 (적용 정책 없음)',
  },

  /** ② 점검 이력 구획. */
  history: {
    title: '점검 이력',
    /** 어느 설비의 어느 기간을 본 것인가. */
    scope: (equipment: string, from: string): string => `설비 ${equipment} · 주기 내(${from}~)`,
    equipmentUnknown: '설비 미확인',

    typeLabel: (code: string): string => code,
    none: '없음',
    pass: '합격',
    fail: '불합격',
    /** 언제 · 누가 · 결과. */
    entry: (inspectedAt: string, workerNo: string, result: string): string =>
      workerNo.trim() === ''
        ? `${inspectedAt} · ${result}`
        : `${inspectedAt} · 사번 ${workerNo} · ${result}`,

    /** ⛔ 부여가 없는 것과 이력이 없는 것은 다르다. */
    notTargeted: '이 설비에는 부여된 점검 항목이 없습니다.',

    /** ⚠ 「없음」이 「안 했음」이 아닐 수 있다는 사실(§5-4). */
    unsentWarning: '미전송 점검이 있을 수 있습니다 — 점검 단말을 확인하세요.',

    /** ⚠ 고장은 보이되 막지 않는다(§5-6). */
    openBreakdowns: (count: number): string => `이 설비에 처리 중인 고장 ${count}건`,
  },

  /** ③ 무엇을 하면 되나 구획. */
  guide: {
    title: '무엇을 하면 되나',
    step1: '① 모바일에서 점검을 입력하고 전송합니다.',
    step2: '② 전송되면 이 화면에서 [ 다시 확인 ] 을 누릅니다.',
    /** ⚠ 우회는 긴급 작업지시에서만 열린다 — 열리지 않을 때 그 사유를 말한다. */
    emergency: '긴급 작업지시라면 우회할 수 있습니다 (기록이 남습니다).',
    emergencyOnly: '우회하고 시작: 긴급 작업지시에서만 할 수 있습니다.',
    /** ⛔ 불합격은 긴급이어도 우회로 풀리지 않는다. */
    failedNoOverride: '우회하고 시작: 불합격 점검은 우회할 수 없습니다. 설비 담당자에게 알리세요.',
  },

  actions: {
    back: '돌아가기',
    recheck: '다시 확인',
    proceed: '진행',
    override: '우회하고 시작',
    working: '기록하는 중',
  },

  /** 경고 수준에서 진행할 때의 확인 — 되돌릴 수 없는 조작이라 한 번 묻는다(§5-9). */
  confirm: {
    title: '점검 기록 없이 진행할까요?',
    body: '진행하면 「점검 기록 없이 시작함」이 기록에 남습니다.',
    overrideTitle: '점검을 우회하고 시작할까요?',
    overrideBody: '긴급 작업지시로 우회한 사실이 기록에 남습니다.',
    cancel: '취소',
    /* ⚠ 액션바의 [ 진행 ] 과 같은 이름을 쓰지 않는다 — 같은 화면에 두 개가 서면 무엇을 누르는지 갈리지 않는다. */
    confirm: '확인',
  },

  /**
   * ⛔ **확인하지 못한 상태를 통과로 다루지 않는다**(F-6). 조회가 실패하면 시작하지 않고
   * 사유와 다음 행동을 함께 말한다.
   */
  blocked: {
    offline: '연결이 끊겨 점검 이력을 확인할 수 없습니다. 연결이 복구되면 다시 확인하세요.',
    lookupFailed: '점검 이력을 확인하지 못해 시작할 수 없습니다. 다시 시도해 주세요.',
    equipmentUnknown: '이 단말에 연결된 설비를 확인하지 못해 점검을 판정할 수 없습니다.',
    workerMissing: '사번을 확인한 뒤에 판정할 수 있습니다.',
    recordFailed: '판정을 기록하지 못해 시작하지 않았습니다. 다시 시도해 주세요.',
  },
};
