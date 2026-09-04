/**
 * M-02-01 WIP 공정 이동 스캔 — 완료된 생산LOT 을 다음 공정으로 넘긴다.
 *
 * 온라인 전용이다. 연결이 끊기면 진입을 막는다 - 스캔은 연속 작업이라, 다 해 놓고 저장에서
 * 막히면 작업을 통째로 버린다.
 *
 * 받는 쪽 화면이 없다. 인계와 수령을 서버가 같은 시각으로 함께 찍어 단추가 하나다.
 */
export const wipHandover = {
  title: 'WIP 공정 이동',
  offline: {
    title: '연결이 필요한 작업입니다',
    /** 왜 다른 스캔은 되는데 이건 안 되나가 작업자에게는 이상하게 보인다. */
    description:
      '공정 인계는 담아 두었다 보내지 않습니다. 다음 공정이 무엇인지 서버에 물어야 하기 때문입니다.',
  },
  lot: {
    legend: '생산LOT 스캔',
    scanLabel: 'LOT 스캔',
    scanPlaceholder: 'LOT QR을 비추세요',
    manualLabel: '직접 입력',
    manualSubmit: '넣기',
    loading: 'LOT을 불러오는 중입니다',
    loadFailed: 'LOT을 확인할 수 없습니다. 연결을 확인하세요.',
    notFound: (code: string) => `${code} LOT을 찾지 못했습니다`,
    /* 초기 수량은 계획이다. 여기 적는 것은 실제로 만들어 낸 양이다. */
    qty: (qty: string) => `완료 수량 ${qty}`,
    /* 모르는 채로 넉넉한 쪽으로 물러서지 않는다 - 되돌릴 수 없는 쓰기다. */
    qtyUnknown: '완료 수량을 확인할 수 없어 인계할 수 없습니다',
    problem: {
      notProduction: '생산LOT이 아닙니다. 공정 인계는 생산LOT만 넘깁니다.',
      notCompleted: '생산 완료 처리가 필요합니다',
      /** 재고 이동에서는 허용되지만 공정 인계에서는 막는다. 근거를 함께 적는다. */
      held: '홀드 중인 LOT 입니다',
      heldWhy: '다음 공정이 홀드품을 투입하면 불량이 퍼집니다. 보류를 먼저 푸세요.',
    },
  },
  next: {
    legend: '다음 공정',
    /* 구획 제목과 같은 말을 쓰지 않는다. 좁은 화면에 같은 줄이 둘로 붙는다. */
    label: '인계할 공정',
    placeholder: '다음 공정을 고르세요',
    loading: '다음 공정을 불러오는 중입니다',
    loadFailed: '다음 공정을 확인할 수 없습니다. 연결을 확인하세요.',
    /** 최종 공정이면 다음이 없다. 오류가 아니라 여기서 끝났다는 뜻이다. */
    none: '다음 공정이 없습니다. 최종 공정이면 출하로 갑니다.',
    /** 배포됐으나 진행 전인 공정이 이 경고가 겨냥한 가장 흔한 상태다. */
    notStarted: '아직 시작되지 않은 공정입니다. 미리 보낼 수 있습니다.',
    option: (workOrderNo: string, operation: string) =>
      operation === '' ? workOrderNo : `${operation} (${workOrderNo})`,
  },
  qty: {
    label: '인계 수량',
    problem: {
      notNumber: '수량을 숫자로 적으세요',
      notPositive: '수량은 0보다 커야 합니다',
      overCompleted: (limit: string) => `완료 수량 ${limit} 을(를) 넘을 수 없습니다`,
    },
  },
  submit: '인계 확정',
  noWorker: '사번을 확인한 뒤에 인계할 수 있습니다',
  sent: {
    title: '인계했습니다',
    /** 받는 쪽 화면이 없다. 기다릴 것이 없다는 것을 말한다. */
    description: '수령도 함께 기록됐습니다. 받는 쪽에서 따로 확인할 것이 없습니다.',
  },
  failed: {
    title: '인계하지 못했습니다',
    retry: '다시 보내기',
  },
  another: '다음 인계',
} as const;
