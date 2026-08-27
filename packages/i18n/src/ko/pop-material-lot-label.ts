export const popMaterialLotLabel = {
  title: '자재LOT 등록·라벨 발행',
  receipts: {
    paneLabel: '입하 목록',
    caption: '입하 목록',
    columns: {
      select: '선택',
      receipt: '입하',
      item: '품목',
      quantity: '수량',
    },
    select: '선택',
    selected: '선택됨',
    /** 행마다 「선택」이 되풀이되면 어느 건인지 알 수 없다 — 접근 이름에 입하번호를 넣는다. */
    selectRow: (receiptNo: string, itemName: string) => `${receiptNo} ${itemName} 선택`,
    deselectRow: (receiptNo: string, itemName: string) => `${receiptNo} ${itemName} 선택 해제`,
    empty: '발행할 자재가 없습니다.',
    /**
     * 계약이 입하 건 목록에 미부착 여부 조건을 주지 않는다 — 그 값은 라인에 있다.
     * 지금 보이는 것이 「라벨 미발행 건 전부」이지 「미부착 건만」이 아님을 밝힌다.
     * 공유계약 G-2 — 미확정인 것을 확정처럼 보이지 않는다.
     */
    /**
     * 사전부착 건을 화면이 걸러 낸다(스펙 §6). 계약이 그 조건을 질의로 주지 않아 받은 뒤에
     * 거르므로, **한 쪽에 보이는 줄 수가 쪽 크기와 다를 수 있다.** 그 사실을 밝힌다.
     */
    filterNotice: '공급사 LOT 이 붙어 온 자재는 보이지 않습니다.',
    beyondLast: '이 쪽에는 결과가 없습니다. 이전 쪽으로 돌아가세요.',
    loadFailed: '입하 목록을 불러오지 못했습니다.',
    retry: '다시 불러오기',
  },
  printer: {
    label: '프린터',
    /** 목록이 비어 올 수 있다 — 서버가 무엇을 보고 목록을 만드는지가 아직 미결이다. */
    none: '사용할 수 있는 프린터가 없습니다.',
    /**
     * ⛔ 「없다」와 「모른다」를 같은 모양으로 그리지 않는다(공유계약 G-9). 조회가 실패한 것을
     * 「프린터 없음」으로 내면 사용자가 설치 문제로 오해한다.
     */
    unknown: '프린터 상태를 확인할 수 없습니다.',
    retry: '다시 확인',
    /** 서버가 사람이 읽는 설명을 주지 않았다. 상태 값을 화면이 한국어로 옮기지 않는다. */
    noStatusMessage: '상태 설명이 없습니다.',
  },
  lines: {
    paneLabel: '품목',
    caption: '품목',
    columns: {
      select: '선택',
      item: '품목',
      quantity: '수량',
      attachment: '부착',
    },
    select: '선택',
    selected: '선택됨',
    selectRow: (itemName: string) => `${itemName} 선택`,
    deselectRow: (itemName: string) => `${itemName} 선택 해제`,
    /** 공급사가 LOT 을 붙여 온 건과 우리가 발번할 건을 가른다. */
    missing: '미부착',
    attached: '부착됨',
    empty: '이 입하 건에 품목이 없습니다.',
    loadFailed: '품목을 불러오지 못했습니다.',
    retry: '다시 불러오기',
  },
  target: {
    paneLabel: '발번 대상',
    title: '발번 대상',
    empty: '왼쪽에서 자재를 고르세요.',
    lotPreview: {
      label: 'LOT 번호',
      /**
       * 스펙은 발번 결과를 등록 전에 미리 보이지만, 계약에 번호를 채번하거나 예약하는 경로가
       * 없다. 규칙을 지어내면 승인된 적 없는 채번이 화면에 굳는다 — 자리를 두고 왜 비었는지
       * 밝힌다(공유계약 A-11 — 물러난 수준을 명시한다).
       */
      pending: '등록할 때 정해집니다.',
    },
    actions: {
      issue: '등록·인쇄',
      reissue: '재인쇄',
      /** 구현 사정이 아니라 사용자가 지금 무엇을 할 수 있는지로 적는다. */
      unavailable: '아직 사용할 수 없습니다. 준비되면 이 자리에서 바로 하실 수 있습니다.',
    },
    fields: {
      item: '품목',
      quantity: '수량',
      supplier: '공급사',
    },
    /**
     * 이미 공급사 LOT 이 붙어 온 건이다. 이 화면은 미부착 건에 MES 가 발번하는 자리라
     * 대상이 아니다 — 왜 진행할 수 없는지 밝힌다.
     */
    alreadyAttached: '공급사 LOT 이 붙어 있는 품목입니다. 이 화면의 발번 대상이 아닙니다.',
  },
  pageNav: {
    label: '쪽 이동',
    prev: '◀ 이전',
    next: '다음 ▶',
    range: (from: number, to: number, total: number) => `${from}–${to} / 전체 ${total}건`,
    totalOnly: (total: number) => `전체 ${total}건`,
  },
} as const;
