/**
 * P-05-01 툴 사용실적·타발수 입력.
 *
 * 이 화면의 말은 「툴」이다 — 계약의 자원 이름은 금형(`mold`)이지만 금형·지그를 함께 담는다.
 */
export const toolUsage = {
  title: '툴 사용실적 입력',

  entry: {
    /** 헤더에 작업지시·사번을 세운다. 없으면 그 자리를 비운다 — 「알 수 없음」을 쓰지 않는다. */
    workOrderLabel: '작업지시',
    workerLabel: '사번',
    online: '연결됨',
    offline: '연결 끊김',
  },

  scan: {
    sectionLabel: '툴 스캔',
    inputLabel: '금형 QR',
    placeholder: '금형 QR 을 비추세요',
    /** QR 이 안 읽힐 때의 폴백. 같은 칸에 손으로 친다 — 스캐너와 입력 자리를 나누지 않는다. */
    manualEntry: '코드 직접 입력',
    manualPlaceholder: '툴 코드를 입력하고 Enter',
    cavity: '캐비티',
    notFound: '그 코드의 툴이 없습니다. 코드를 다시 확인하세요.',
    disposed: '폐기된 툴입니다. 다른 툴을 스캔하세요.',
    clear: '툴 다시 고르기',
  },

  shot: {
    sectionLabel: '타발수 입력',
    inputLabel: '타발수',
    unit: '회',
    keypadLabel: '타발수 숫자 키패드',
    convertedLabel: '생산 수량으로 환산',
    baseQtyLabel: '수량',
    /** 환산이 어떻게 나온 값인지 식 그대로 보인다 — 「수량 500 × 2.5 = 1,250 회」 */
    convertedExpression: (baseQty: string, ratio: string, shots: string) =>
      `수량 ${baseQty} × ${ratio} = ${shots} 회`,
    /** 환산 결과는 정수로 맞춰 보낸다 — 계약이 타발수를 정수로 받는다. */
    roundedNote: '환산 결과는 가장 가까운 정수로 맞춰 보냅니다.',
    conversionUnavailable: '환산 비율이 설정돼 있지 않습니다. 직접 입력으로 기입하세요.',
    conversionLoading: '환산 비율을 불러오는 중입니다.',
    conversionOff: '이 범위는 환산을 쓰지 않도록 설정돼 있습니다. 직접 입력으로 기입하세요.',
  },

  cumulative: {
    sectionLabel: '누계',
    guaranteed: '적정타수',
    current: '누계(서버)',
    increment: '이번 입력',
    projected: '저장 후 누계',
    available: '사용 가능',
    /** 누계를 언제 받은 값인지. 서버가 시각을 주지 않아 «화면이 받은 시각»을 적는다. */
    asOf: (time: string) => `${time} 기준`,
    usageLabel: '적정타수 대비 사용률',
    /** 적정타수가 비어 있을 때. **저장은 막지 않는다** — 기록 자체는 남아야 한다. */
    guaranteedMissing: '적정타수 미등록 — 사용 가능 타수를 산출할 수 없습니다.',
    /** 연결이 끊기면 다른 단말의 입력분을 반영하지 못한다. 그럴듯한 숫자를 그리지 않는다. */
    offlineBase: '이후 다른 단말 입력분이 반영되지 않았습니다.',
    offlineProjection: '연결 후 확인',
    over: '적정타수를 넘습니다',
  },

  notice: {
    sectionLabel: '안내',
    /** 화면이 누계를 계산해 보내지 않는다는 사실을 상시 밝힌다. */
    serverAdds: '누계는 저장할 때 서버가 더합니다 — 이 화면은 미리 계산만 합니다.',
  },

  actions: {
    save: '실적 저장',
    reset: '다시 입력',
  },

  actionReasons: {
    saving: '실적 저장 — 저장하는 중입니다.',
    noTool: '실적 저장 — 툴을 먼저 스캔하세요.',
    noShot: '실적 저장 — 타발수를 1 이상 기입하세요.',
    noEntry:
      '실적 저장 — 작업지시와 사번이 있어야 저장할 수 있습니다. 작업 시작 화면을 거쳐 들어오세요.',
    offline: '실적 저장 — 연결이 끊겨 저장할 수 없습니다. 연결이 돌아오면 다시 저장하세요.',
  },

  save: {
    successTitle: '실적을 저장했습니다',
    /** 서버가 더한 누계를 그대로 보인다 — 화면의 예상치가 아니다. */
    successBody: '누계가 갱신됐습니다.',
    failTitle: '실적을 저장하지 못했습니다',
    /** 서버가 사유를 주지 않았는데 다시 눌러도 같은 답이 오는 갈래. */
    rejected: '보낸 값이나 업무 규칙에 걸려 저장되지 않았습니다. 값을 확인한 뒤 다시 저장하세요.',
    forbidden: '이 단말에서는 툴 사용실적을 입력할 수 없습니다. 담당자에게 문의하세요.',
  },
} as const;
