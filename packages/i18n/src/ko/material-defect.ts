/**
 * 자재 불량 기록(omf-all-around#108) — POP P-02-14 자재 불량 등록과 관리웹 W-03-03 의심자재 등록의 한 구획이
 * 함께 쓴다. 「자재 불량」은 투입 «뒤» 생산·검사 중에 발견한 자재의 불량이다(수입검사 불합격과 다르다).
 */
export const materialDefect = {
  /** POP 화면 이름 — 메뉴(`pop-screen-catalog.ts`)와 같은 말이다. */
  title: '자재 불량 등록',

  lot: {
    label: '자재 LOT',
    placeholder: 'LOT 번호를 스캔하거나 입력하세요',
    find: '조회',
    notFound: '이 번호의 LOT 이 없습니다.',
    loadFailed: 'LOT 을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    item: (itemId: number): string => `품목 ${String(itemId)}`,
    status: (statusCode: string): string => `상태 ${statusCode}`,
  },

  code: {
    major: '불량 대분류',
    minor: '불량 상세',
    none: '등록된 불량 코드가 없습니다. 불량 코드 마스터를 먼저 등록하세요.',
    loadFailed: '불량 코드를 불러오지 못했습니다.',
  },

  qty: {
    label: '불량 수량',
    invalid: '0보다 큰 수를 넣으세요.',
    keypad: '불량 수량 키패드',
    backspace: '한 자 지움',
    clear: '지움',
    decimal: '소수점',
  },

  description: '불량 내용',

  hold: {
    label: '이 LOT 을 보류합니다',
    reason: '보류 사유',
    reasonPlaceholder: '보류 사유를 고르세요',
    releaseCondition: '해제 조건',
    releaseConditionDefault: '품질 판정 후 해제',
    /** 관리웹에는 보류 입력이 같은 화면에 있다. */
    webNote: '보류가 필요하면 이 화면의 보류 입력에서 함께 실행하세요.',
  },

  submit: '자재 불량 기록',
  saving: '기록하는 중…',
  recorded: '자재 불량을 기록했습니다.',
  held: 'LOT 을 보류했습니다.',
  holdFailed: '불량은 기록했지만 LOT 보류에 실패했습니다. 의심자재 등록에서 보류하세요.',

  blocked: {
    lot: 'LOT 을 먼저 조회하세요.',
    code: '불량 코드를 고르세요.',
    qty: '불량 수량을 넣으세요.',
    uom: 'LOT 의 단위를 알 수 없어 기록할 수 없습니다.',
    holdReason: '보류 사유를 고르세요.',
    releaseCondition: '해제 조건을 넣으세요.',
  },

  pane: {
    heading: '자재 불량 기록',
    singleOnly: 'LOT 하나를 고르면 자재 불량을 기록하고 영향 생산 LOT 을 볼 수 있습니다.',
  },

  affected: {
    heading: '영향 생산 LOT',
    caption: '영향 생산 LOT 목록',
    estimate:
      '작업지시 기준 추정 — 이 자재가 투입된 작업지시의 생산 LOT 전부입니다. 실제로 쓰인 LOT 보다 넓을 수 있습니다.',
    none: '이 자재가 투입된 작업지시가 없습니다.',
    loading: '영향 범위를 불러오는 중입니다.',
    loadFailed: '영향 범위를 불러오지 못했습니다.',
    columns: { lotNo: '생산 LOT', workOrderNo: '작업지시', statusCode: '상태' },
  },
};
