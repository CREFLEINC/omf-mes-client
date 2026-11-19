export const reworkResultRegister = {
  title: '재작업 실적 등록',
  /** 왼쪽 목록 구획 제목 — 작업지시 목록 화면의 「작업지시」 구획과 같은 모양(#295). */
  workOrders: '재작업 작업지시',
  empty: '진행할 재작업 작업지시가 없습니다.',
  loadError: '재작업 정보를 불러오지 못했습니다.',
  selectWorkOrder: '재작업 W/O를 선택해 주세요.',
  /** 가운데 빈 화면 — 아직 작업지시를 고르지 않았을 때. */
  pickTitle: '재작업 작업지시를 고르세요',
  pickHint: '왼쪽 목록에서 고르면 실적을 입력합니다.',

  workOrderUnknown: 'W/O —',

  /**
   * 사번 — **라벨을 붙인다.** 숫자만 두면 무슨 번호인지 알 수 없다. POP 스펙들이 맥락 값
   * (작업지시·설비)에는 라벨을 붙이지 않고 **사번에만** 붙인다(`P-02-01`·`P-02-02` §3).
   */
  workerLabel: (workerNo: string): string => `사번 ${workerNo}`,
  workerUnknown: '사번 —',
  /* 쪽 넘김 랜드마크 이름(#1005). */
  pageNav: '재작업 작업지시 목록 페이지 이동',
  /** 목록 항목의 이름들. */
  list: {
    item: '품목',
    qty: '수량',
    status: '상태',
    disposition: '처분',
    sourceLot: '원 LOT',
    nonconformance: '부적합',
    progress: '재작업',
    reworkChip: '재작업',
    plannedChip: '배포 전',
  },
  /**
   * 배포 전 재작업 지시에 다는 표식(omf-all-around#47). 발행은 됐지만 배포 전이라
   * 실적을 받지 못한다 — 있다는 사실은 알리고 고르지는 못하게 한다.
   */
  notReleased: '배포를 먼저 진행해 주세요',
  sourceLot: '원 LOT',
  /**
   * 근거·처분 — **스펙 §3 ①의 라벨 그대로다**(「근거」·「처분」). 앞선 판은 「근거 부적합」·
   * 「처분 수량」이었는데, 값이 이미 「부적합 NC-… 」·「재작업 160 EA」로 무엇인지 말한다.
   */
  nonconformance: '근거',
  disposition: '처분',

  /** 「원 LOT  FG-…-0288  160 EA」 — 번호와 초기 수량을 잇는다. */
  /* ⚠ 겹공백을 쓰지 않는다 — 화면이 하나로 접어 감지기와 어긋난다(도면의 정렬은 표기일 뿐이다). */
  sourceLotValue: (lotNo: string, qty: string, uom: string): string =>
    uom === '' ? `${lotNo} ${qty}` : `${lotNo} ${qty} ${uom}`,
  /** 「근거  부적합 NC-2026-0071 · 외관 스크래치」 */
  nonconformanceValue: (no: string, description: string): string => `부적합 ${no} · ${description}`,
  /**
   * 「처분  재작업 160 EA  (08-07)」
   *
   * ⛔ **판정한 사람을 적지 않는다.** 스펙 도면은 「(08-07 김품질)」로 이름까지 그렸지만
   * 계약이 주는 것은 `decidedBy`(사용자 «식별자» 숫자)뿐이다 — 숫자를 사람 이름 자리에 두면
   * 그것이 사번인지 무엇인지 알 수 없다. 이름을 받는 경로가 생기면 그때 붙인다.
   */
  dispositionValue: (qty: string, uom: string, decidedOn: string): string =>
    `재작업 ${uom === '' ? qty : `${qty} ${uom}`} (${decidedOn})`,
  /** 수량 + 단위(단위 이름을 모르면 숫자만). */
  qtyWithUom: (qty: string, uom: string): string => (uom === '' ? qty : `${qty} ${uom}`),
  /** 목록의 재작업 진행 「10 / 40 EA」. */
  progressValue: (done: string, target: string, uom: string): string =>
    uom === '' ? `${done} / ${target}` : `${done} / ${target} ${uom}`,
  /** 값을 아직 못 받았을 때. ⛔ 빈칸으로 두면 「없다」로 읽힌다. */
  unknown: '확인 중',
  /** 구획 안 단계 줄(생산 작업과 같은 두 단계 · #295). */
  steps: {
    label: '재작업 단계',
    input: '실적 입력',
    defect: '불량 등록',
  },
  quantities: {
    goodQty: '양품',
    defectQty: '불량 수량',
    holdQty: '보류',
    scrapQty: '폐기',
  },
  /** 오른쪽 키패드 구획. */
  keypad: {
    title: '입력',
    unit: (uom: string): string => `단위 ${uom}`,
  },
  total: '합계',
  exceeded: (target: number, uom: string) =>
    uom === ''
      ? `처분 수량 ${target}을 넘을 수 없습니다.`
      : `처분 수량 ${target} ${uom}를 넘을 수 없습니다.`,
  partial: (remaining: number, uom: string) =>
    uom === ''
      ? `부분 실적입니다. 미처리 ${remaining}이 남습니다.`
      : `부분 실적입니다. 미처리 ${remaining} ${uom}가 남습니다.`,
  /** 도움말 창(규칙 14) — 상시 안내 줄 대신. */
  helpTitle: '재작업 실적 입력 안내',
  reworkHint: '재작업 후에도 불량인 수량만 입력해 주세요.',
  lotHint: '재작업 결과는 기존 LOT에 기록되며, 새로운 LOT는 생성되지 않습니다.',
  helpConfirm: '확인',
  defectCode: '불량 코드',
  defectCodePlaceholder: '불량 코드를 선택하세요',
  /** 목록을 못 받았거나 비었을 때 — 저장은 막지 않는다(리뷰 M1). */
  defectCodeLoadFailed: '불량 코드를 불러오지 못했습니다. 코드 없이도 저장할 수 있습니다.',
  defectCodeEmpty: '등록된 불량 코드 없음 · 코드 없이 저장 가능',
  defectCodeRetry: '다시 불러오기',
  reset: '입력 초기화',
  toDefect: '불량 등록',
  toDefectWithQty: (qty: string): string => `불량 등록 (${qty})`,
  prev: '이전',
  save: '실적 저장',
  queued: '실적을 저장했습니다.',
  queueError: '실적을 단말에 저장하지 못했습니다. 다시 시도해 주세요.',
  rejected: '서버가 실적을 받지 않았습니다.',
  /** 서버가 이유를 싣지 않았을 때 — 작업자가 할 일을 남긴다. */
  rejectedHint:
    '입력한 수량과 고른 작업지시를 확인해 다시 저장하세요. 같은 일이 되풀이되면 관리자에게 알리세요.',
  gateUnidentified:
    '단말이나 고른 작업지시의 공정을 확인하지 못해 저장할 수 없습니다. 화면을 다시 연 뒤 작업지시를 다시 고르세요.',
  gateChecking: '단말 기능을 확인하고 있습니다.',
  gateUnavailable: '단말 기능을 확인할 수 없어 저장할 수 없습니다.',
  pending: (count: number) => `미전송 ${count}건`,
} as const;
