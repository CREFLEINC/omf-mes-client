/**
 * M-01-04 자재 위치 확인. 모바일 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * (LOT 무관)은 빈 값이 아니라 확정된 뜻이다. 대시나 알 수 없음으로 두면 자료가
 * 빠졌다는 뜻이 되어 정반대로 읽힌다.
 *
 * (소진)은 행을 감추는 대신 붙인다. 수량 0 인 자리도 재고가 지나간 자리라
 * 감추면 작업자가 그 위치를 찾아보지 않는다.
 */
export const materialLocation = {
  title: '자재 위치 확인',
  scan: {
    label: '스캔 대기',
    placeholder: '자재 LOT을 읽어 주세요',
    manualEntry: '직접 입력',
  },
  lot: {
    /** 잔액이 LOT 단위로 나뉘지 않는다는 뜻이다. 없다는 뜻이 아니다. */
    noLot: '(LOT 무관)',
  },
  location: {
    title: '위치',
    /** 한 LOT이 여러 자리에 나뉘어 있을 때 첫 줄만 보면 나머지를 못 찾는다. */
    countSuffix: (count: number): string => `위치 ${String(count)}곳`,
    depleted: '(소진)',
    emptyTitle: '재고가 있는 위치가 없습니다',
    emptyDescription: '등록된 LOT이지만 지금 재고가 잡힌 자리가 없습니다.',
  },
  quantity: {
    onHand: '보유',
    available: '가용',
    reserved: '예약',
    /** 마이너스 재고가 정상인 품목이 있다. 오류가 아니라 확인이 필요한 값이다. */
    negativeNotice: '보유 수량이 음수입니다',
  },
  hold: {
    title: '보류 중',
    unconfirmed: '보류 여부를 확인하지 못했습니다',
    unconfirmedDescription: '묶여 있을 수 있으니 연결된 뒤에 확인하고 옮기세요.',
    wholeLot: '전량 보류',
    quantity: (amount: string): string => `${amount} 보류`,
    releaseCondition: (condition: string): string => `해제 조건: ${condition}`,
  },
  nextScan: '다음 스캔',
  loading: '조회 중입니다',
  notFound: {
    title: '등록되지 않은 LOT입니다',
    description: '읽은 번호를 확인하고 다시 스캔해 주세요.',
  },
  loadFailed: {
    title: '조회하지 못했습니다',
    retry: '다시 시도',
  },
  connection: {
    online: '온라인',
    offline: '오프라인',
  },
  /** 읽은 자릿수를 함께 보인다. 몇 자를 덜 읽었는지 알아야 다시 대는 위치를 잡는다. */
  invalidLength: (read: number, required: number): string =>
    `자재 LOT은 ${String(required)}자리입니다. ${String(read)}자리를 읽었습니다.`,
  offline: {
    title: '오프라인이라 조회할 수 없습니다',
    description: '저장해 둔 자료를 두지 않습니다. 연결되면 다시 시도해 주세요.',
    retry: '다시 시도',
  },
} as const;
