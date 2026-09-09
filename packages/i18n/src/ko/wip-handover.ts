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
    title: '연결이 있어야 할 수 있습니다',
    /** 왜 다른 스캔은 되는데 이건 안 되나가 작업자에게는 이상하게 보인다. */
    description:
      '공정 인계는 전송 대기에 넣을 수 없습니다. 다음 공정이 무엇인지 확인해야 하기 때문입니다.',
    /*
     * 들어올 때 끊긴 것과 하다가 끊긴 것은 다르다. 하던 것을 치우면 작업자는 사라진 줄 알고
     * 스캔을 처음부터 다시 한다.
     */
    duringWork: '연결이 끊겼습니다. 적은 것은 그대로 두었으니 연결되면 이어서 하세요.',
  },
  /* 이 화면은 연속 작업이다. 건별로 넘기고 마지막에 한 번 마친다. */
  done: {
    count: (count: string) => `인계됨 ${count}건`,
    row: (lotNo: string, workOrderNo: string, qty: string) => `${lotNo} → ${workOrderNo} ${qty}`,
    submit: '인계 마치기',
  },
  lot: {
    legend: '생산LOT 스캔',
    scanLabel: 'LOT 스캔',
    scanPlaceholder: 'LOT QR을 스캔하세요',
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
      held: '보류 중인 LOT입니다',
      heldWhy: '보류 중인 물건을 다음 공정에 넣으면 불량이 퍼집니다. 보류를 먼저 푸세요.',
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
    /*
     * 상태를 함께 보인다. 고른 뒤가 아니라 고르기 전에 알아야 취소된 공정을 안 고른다.
     *
     * 어떤 상태를 보일지 화면이 가르지 않는다 - 일부만 보이면 그것이 판정이 되고, 이 화면의
     * 취소·중단 처리는 아직 정해지지 않았다.
     */
    option: (workOrderNo: string, operation: string, status: string) => {
      const head = operation === '' ? workOrderNo : `${operation} (${workOrderNo})`;

      return status === '' ? head : `${head} · ${status}`;
    },
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
  noWorker: '사번을 먼저 확인하세요',
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
