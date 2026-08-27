export const popMaterialLotLabel = {
  title: '자재LOT 등록·라벨 발행',
  receipts: {
    paneLabel: '입하 목록',
    caption: '라벨을 아직 발행하지 않은 입하 건',
    columns: {
      select: '선택',
      inboundReceiptNo: '입하번호',
      supplier: '공급사',
      receiptDate: '입하일',
    },
    select: '선택',
    selected: '선택됨',
    /** 행마다 「선택」이 되풀이되면 어느 건인지 알 수 없다 — 접근 이름에 입하번호를 넣는다. */
    selectRow: (receiptNo: string) => `${receiptNo} 선택`,
    deselectRow: (receiptNo: string) => `${receiptNo} 선택 해제`,
    empty: '발행할 입하 건이 없습니다.',
    /**
     * 계약이 입하 건 목록에 미부착 여부 조건을 주지 않는다 — 그 값은 라인에 있다.
     * 지금 보이는 것이 「라벨 미발행 건 전부」이지 「미부착 건만」이 아님을 밝힌다.
     * 공유계약 G-2 — 미확정인 것을 확정처럼 보이지 않는다.
     */
    filterNotice:
      '라벨을 발행하지 않은 입하 건을 모두 보입니다. 부착 여부는 품목 줄에서 확인하세요.',
    beyondLast: '이 쪽에는 결과가 없습니다. 이전 쪽으로 돌아가세요.',
    loadFailed: '입하 목록을 불러오지 못했습니다.',
    retry: '다시 불러오기',
  },
  pageNav: {
    label: '쪽 이동',
    prev: '◀ 이전',
    next: '다음 ▶',
    range: (from: number, to: number, total: number) => `${from}–${to} / 전체 ${total}건`,
    totalOnly: (total: number) => `전체 ${total}건`,
  },
} as const;
