/**
 * P-05-01 툴 사용실적·타발수 입력.
 *
 * 이 화면의 말은 「툴」이다 — 계약의 자원 이름은 금형(`mold`)이지만 금형·지그를 함께 담는다.
 */
export const toolUsage = {
  title: '툴 사용실적 입력',

  /** 본문 맨 위 작업지시 띠(POP 통일 시안 #295). */
  band: {
    title: '작업지시 (W/O)',
    process: '공정',
    item: '제품',
    planQty: '계획수량',
  },

  /** 맨 오른쪽 「수량」 키패드 구획. */
  pad: {
    title: '입력',
    unit: (uom: string) => `단위 ${uom}`,
  },

  scan: {
    sectionLabel: '툴 스캔',
    inputLabel: '금형 QR',
    /* POP 통일 시안(#295) 문구 — 다른 화면의 스캔 칸과 같은 「○○을 스캔하세요」. */
    placeholder: '금형 QR을 스캔하세요',
    /** QR 이 안 읽힐 때의 폴백. 같은 칸에 손으로 친다 — 스캐너와 입력 자리를 나누지 않는다. */
    /** 다른 POP 화면과 같은 이름(사용자 지시 2026-09-17). */
    cavity: '캐비티',
    mold: '금형',
    moldName: '금형명',
    empty: '금형 QR을 스캔하세요',
    nextHint: '다음 실적은 금형 QR부터 스캔합니다.',
    notFound: '이 코드의 툴이 없습니다. 코드를 다시 확인하세요.',
    disposed: '폐기된 툴입니다. 다른 툴을 스캔하세요.',
  },

  shot: {
    sectionLabel: '타발수 입력',
    inputLabel: '타발수',
    unit: '회',
    convertedLabel: '생산 수량으로 타발수 계산',
    baseQtyLabel: '수량',
    /** 환산이 어떻게 나온 값인지 식 그대로 보인다 — 「수량 500 × 2.5 = 1,250 회」 */
    convertedExpression: (baseQty: string, ratio: string, shots: string) =>
      `수량 ${baseQty} × ${ratio} = ${shots} 회 · 가장 가까운 정수로 맞춥니다`,
    /** 사용자 지시 2026-09-17 — 뒤 안내 문장을 걷었다. */
    conversionUnavailable: '환산 비율이 설정되어 있지 않습니다.',
    conversionLoading: '환산 비율을 불러오는 중입니다.',
    conversionOff: '이 범위는 환산을 쓰지 않도록 설정돼 있습니다. 직접 입력으로 기입하세요.',
  },

  cumulative: {
    sectionLabel: '누계',
    guaranteed: '적정타수',
    current: '현재 누계',
    increment: '이번 입력',
    projected: '저장 후 예상 누계',
    available: '사용 가능',
    /** 누계를 언제 받은 값인지. 서버가 시각을 주지 않아 «화면이 받은 시각»을 적는다. */
    asOf: (time: string) => `${time} 기준`,
    usageLabel: '적정타수 대비 사용률',
    /**
     * 막대 «옆»에 보이는 짧은 이름.
     *
     * ⭐ 이 막대는 「남은 비율」이 아니라 「쓴 비율」이다. 사용 가능 줄에 놓여 있어 이름이 없으면
     * 「사용 가능 499,988 회 · 0%」가 «사용 가능이 0%»로 읽힌다 — 실측으로 그렇게 오해됐다.
     */
    usageBarLabel: '사용률',
    /** 적정타수가 비어 있을 때. **저장은 막지 않는다** — 기록 자체는 남아야 한다. */
    guaranteedMissing: '적정타수 미등록 — 사용 가능 타수를 산출할 수 없습니다.',
    /** 연결이 끊기면 다른 단말의 입력분을 반영하지 못한다. 그럴듯한 숫자를 그리지 않는다. */
    offlineBase: '이후 다른 단말 입력분이 반영되지 않았습니다.',
    offlineProjection: '연결 후 확인',
    /** 초과는 «수치 옆»에 붙인다 — 「−1,200 회(초과)」(스펙 §6-1). 따로 떨어진 문장으로 두지 않는다. */
    overSuffix: '(초과)',
  },

  actions: {
    save: '실적 저장',
    /** 타발수 칸 오른쪽 단추(사용자 지시 2026-09-17). 실적 저장과 같은 일을 한다. */
    confirm: '확인',
    reset: '입력 초기화',
  },

  /** 맨 위 띠로 선다 — 「실적 저장 —」 머리말은 걷었다(사용자 지시 2026-09-17). */
  actionReasons: {
    saving: '저장하는 중입니다.',
    noShot: '타발수를 1 이상 기입하세요.',
    noEntry: '작업지시와 사번이 있어야 저장할 수 있습니다. 작업지시 목록을 거쳐 들어오세요.',
    offline: '연결이 끊겨 저장할 수 없습니다. 연결이 돌아오면 다시 저장하세요.',
  },

  save: {
    successTitle: '실적을 저장했습니다.',
    failTitle: '실적을 저장하지 못했습니다',
    /** 서버가 사유를 주지 않았는데 다시 눌러도 같은 답이 오는 갈래. */
    rejected: '보낸 값이나 업무 규칙에 걸려 저장되지 않았습니다. 값을 확인한 뒤 다시 저장하세요.',
    forbidden: '이 단말에서는 툴 사용실적을 입력할 수 없습니다. 담당자에게 문의하세요.',
  },
} as const;
