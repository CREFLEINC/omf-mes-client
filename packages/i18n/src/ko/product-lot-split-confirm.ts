/**
 * M-04-05 LOT 분리 확인(PDA · 피처 013 · omf-all-around#303 · 시안 M0405).
 *
 * POP 에서 나눈 두 LOT 에 라벨을 붙였음을 두 라벨 스캔으로 확인한다. 확인 전에는 두 LOT 의 출하 피킹 · 재분리가 막힌다.
 */
export const productLotSplitConfirm = {
  title: 'LOT 분리 확인',
  guide: 'POP 에서 나눈 두 LOT 의 라벨을 붙였으면 두 라벨을 차례로 스캔하세요. 순서는 상관없습니다',

  scan: {
    label: '분리 라벨 스캔',
    hint: '원래 LOT 또는 새 LOT 라벨',
    manualLabel: '직접 입력',
    manualSubmit: '확인',
    looking: (lotNo: string) => `${lotNo} 의 분리를 찾는 중입니다`,
    confirming: '분리를 확인하는 중입니다',
  },

  pair: {
    label: '확인할 분리',
    head: (at: string, location: string) => `분리 POP ${at}, ${location}`,
    parent: '원래 LOT',
    child: '새 LOT',
    scanned: '스캔함',
    waiting: '스캔 기다림',
  },

  notice: {
    needParentTitle: '원래 LOT 라벨을 스캔하세요',
    needParent: (qty: string) =>
      `새 LOT 라벨을 읽었습니다. 원래 상자의 바꿔 붙인 라벨(수량 ${qty})을 스캔하세요`,
    needChildTitle: '새 LOT 라벨을 스캔하세요',
    needChild: (qty: string) =>
      `원래 LOT 라벨을 읽었습니다. 새 상자의 라벨(수량 ${qty})을 스캔하세요`,
    doneTitle: '분리를 확인했습니다',
    done: '두 LOT 모두 이제 출하 피킹을 할 수 있습니다',
    wrongTitle: '이 분리의 라벨이 아닙니다',
    wrong: (lotNo: string) =>
      `${lotNo} 는 지금 확인 중인 분리의 LOT 이 아닙니다. 남은 라벨을 스캔하세요`,
    alreadyTitle: '이미 확인된 분리입니다',
    already: (at: string, worker: string | null) =>
      worker === null
        ? `${at}에 확인했습니다. 바꾼 것은 없습니다`
        : `${at} ${worker} 이 확인했습니다. 바꾼 것은 없습니다`,
    alreadyNoDetail: '다른 PDA 가 먼저 확인했습니다. 바꾼 것은 없습니다',
    noneTitle: '확인할 분리가 없습니다',
    none: (lotNo: string) => `${lotNo} 은 POP 에서 나눈 기록이 없습니다. LOT 번호를 확인하세요`,
    offlineTitle: '연결이 끊겨 확인할 수 없습니다',
    offline: '연결을 확인하고 다시 시도하세요. 확인은 연결된 상태에서만 됩니다',
    failedTitle: '확인하지 못했습니다',
    failed: '처음부터 다시 스캔하세요',
  },

  actions: {
    exit: '나가기',
    next: '다른 분리 확인',
    retry: '다시 시도',
    reset: '처음부터',
  },
};
