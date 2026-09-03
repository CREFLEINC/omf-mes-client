/**
 * W-06-05 품목 확장속성.
 *
 * 이 화면의 문구는 **원본과 확장을 말로 갈라 놓는 것**이 목적이다 —
 * 한 화면에 「고칠 수 없는 자리」와 「고칠 수 있는 자리」가 붙어 있어,
 * 배치만으로는 어느 쪽이 어느 쪽인지 읽히지 않는다.
 *
 * **원본 구획의 안내는 여기서 만들지 않는다** — 이미 있는 `editability.receivedFromErp`를 그대로 쓴다.
 * 충돌·상태 잠금·권한 문구도 공통 규약 문구(`conflict.*`·`stateLocked.*`·`httpError.*`)를 그대로 쓴다.
 */
export const itemExtendedAttrs = {
  title: '품목 확장속성',
  breadcrumbRoot: '기준정보',
  /** 탭 라벨. **만든 탭만 둔다** — 없는 탭의 라벨을 미리 두면 무엇이 렌더되는지 흐려진다. */
  tabs: {
    label: '품목 확장속성',
    attrs: '확장 속성',
    subsidiary: '부속 정보',
    bom: '자재 명세서',
  },
  /**
   * 부속 정보 안의 하위 탭. 계약이 인용한 화면 스펙의 구획 이름을 그대로 옮긴 것이다 —
   * 여기서 이름을 새로 지으면 설계 문서와 화면이 다른 말을 하게 된다.
   */
  subTabs: {
    label: '부속 정보',
    buMap: '사업부 매핑',
    uomConversion: '단위 환산',
    externalCode: '외부 코드',
  },
  panes: {
    item: '품목',
    itemOrigin: '품목 원본 정보',
    itemAttrs: '확장 속성',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  /** 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  filters: {
    itemSearchLabel: '품목 검색',
    itemSearchPlaceholder: '품목코드 또는 품목명',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
  },
  loading: {
    items: '품목 목록을 불러오는 중',
    itemDetail: '품목 정보를 불러오는 중',
  },
  /*
   * 선택 목록이 잘리거나 실패했다는 사실을 감추지 않는다 —
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    /*
     * 결과는 있는데 **이 쪽에는** 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생긴다 —
     * 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다.
     */
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    /*
     * **여기서 만들 수 없는 자료다.** 품목은 외부 시스템이 소유하므로
     * 「추가하세요」가 아니라 「원본 시스템을 확인하세요」다.
     */
    noneTitle: '표시할 품목이 없습니다',
    noneDescription: '품목은 외부 시스템에서 받아옵니다. 원본 시스템에 자료가 있는지 확인하세요.',
    noMatchTitle: '조건에 맞는 품목이 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    notSelected: '좌측에서 품목을 고르면 여기에 그 품목의 정보가 보입니다',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 좁은 좌 페인에서 「사용 여부」 열을 따로 두면 이름 열이 짓눌린다 — 이름 뒤 접미로 붙인다. */
    inactiveSuffix: ' (미사용)',
    /*
     * 값은 있는데 그 번호를 선택 목록에서 찾지 못했다. **번호를 그대로 내지 않는다** —
     * 내부 식별자라 사용자가 쓸 수 없고, 보이면 자료로 읽힌다.
     */
    unknown: '알 수 없음',
    /*
     * 선택 목록을 아직 받지 못해 이름으로 옮길 수 없다. **「알 수 없음」과 가른다** —
     * 둘을 같은 문구로 내면 잠깐 보이는 「알 수 없음」을 자료가 잘못 담긴 것으로 읽고
     * 사용자가 원본 시스템을 확인하러 간다.
     */
    loading: '불러오는 중…',
  },
  /**
   * 원본 구획 — 외부 시스템이 소유하는 네 열. **여기에 입력칸도 저장도 없다.**
   * 안내 문구는 공통 `editability.receivedFromErp`를 쓴다.
   */
  origin: {
    fields: {
      itemCode: '품목코드',
      itemName: '품목명',
      /** 값 목록이 미정이라 코드 문자열을 그대로 낸다 — 이름을 지어내지 않는다. */
      itemType: '품목유형',
      baseUom: '기준 단위',
    },
  },
  /**
   * 확장 구획 — 이쪽이 소유해 편집하는 값. **원본 구획과 말이 갈려 있어야 한다.**
   *
   * 「유효기한 관리」는 계약 필드가 아니라 유효기한(일)의 널 여부를 사람이 다루는 형태로 옮긴 것이다.
   * 두 항목을 한 줄로 붙여 놓아 무엇이 무엇을 켜는지 보이게 한다.
   */
  attrs: {
    fields: {
      lotControlled: 'LOT 관리',
      serialControlType: '시리얼 관리 유형',
      shelfLifeManaged: '유효기한 관리',
      shelfLifeDays: '유효기한(일)',
      inspectionRequired: '입고검사 대상',
      fifoPolicy: '선출 정책',
      negativeStockAllowed: '마이너스 재고 허용',
      storageCondition: '보관 조건',
      openedShelfLifeHours: '개봉 후 유효시간(시간)',
      isActive: '사용 여부',
    },
    values: {
      active: '사용 중',
      inactive: '미사용',
    },
    /**
     * 사용 여부에 컨트롤을 두지 않는 이유. **감추지 않고 밝힌다** —
     * 값만 있고 바꿀 수단이 없으면 사용자가 화면이 빠뜨린 것으로 읽는다.
     */
    isActiveNote: '사용 여부는 이 화면에서 바꾸지 않습니다. 저장해도 지금 값이 그대로 유지됩니다.',
    validation: {
      required: '필수 입력 항목입니다.',
      codeTooLong: '코드는 50자를 넘을 수 없습니다.',
      /* 계약 A-2 — 「유효기한 관리」가 켜져 있을 때만 필수다. */
      shelfLifeDaysRequired: '유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.',
      /* 계약 minimum: 0 — 0은 허용값이다. 「비었다」로 다루지 않는다. */
      shelfLifeDaysInvalid: '유효기한(일)은 0 이상의 정수로 입력하세요.',
      /* 계약 exclusiveMinimum: 0 — 유효기한(일)과 규칙이 다르다. 0을 받지 않는다. */
      openedShelfLifeHoursInvalid: '개봉 후 유효시간(시간)은 1 이상의 정수로 입력하세요.',
    },
  },
  /**
   * 대상 품목을 **검색해서 고르는** 묶음(결정 8).
   *
   * 품목이 수천 건일 수 있어 선택칸에 다 담을 수 없고, 번호를 입력받으면 사용자가
   * 알 수도 확인할 수도 없는 내부 식별자를 화면이 요구하게 된다.
   */
  itemPicker: {
    keywordLabel: '대상 품목 검색',
    keywordPlaceholder: '품목코드 또는 품목명',
    search: '찾기',
    resultLabel: '대상 품목',
    resultPlaceholder: '검색 결과에서 고르세요',
    /* 검색 전에는 선택칸이 비어 있는 것이 정상이다 — 그 사실을 밝히지 않으면 고장으로 읽힌다. */
    beforeSearch: '품목코드나 품목명을 넣고 찾기를 누르세요.',
    truncated: '검색 결과가 많아 일부만 표시합니다. 검색어를 좁히세요.',
    noResult: '검색어에 맞는 품목이 없습니다. 검색어를 바꿔 다시 찾아 보세요.',
    searchFailed: '품목을 검색하지 못했습니다. 잠시 뒤 다시 찾아 보세요.',
  },
  /**
   * 부속 하위 탭① — 사업부 매핑. 사업부 사이의 품목 대응을 담는다.
   *
   * **중복 안내 문구가 없다.** 계약이 이 표에 유일 제약을 적지 않았고,
   * 화면이 없는 제약을 흉내 내면 서버가 허용하는 값을 막는다(결정 7).
   */
  buMap: {
    paneTitle: '사업부 매핑',
    fields: {
      fromBusinessUnit: '보내는 사업부',
      toBusinessUnit: '받는 사업부',
      toItem: '대상 품목',
      validPeriod: '유효기간',
      effectiveFrom: '유효 시작',
      effectiveTo: '유효 종료',
      edit: '편집',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: '매핑 추가',
      editRow: (name: string): string => `${name} 매핑 수정`,
      removeRow: (name: string): string => `${name} 매핑 삭제`,
    },
    loading: {
      list: '사업부 매핑을 불러오는 중',
    },
    empty: {
      noneTitle: '등록된 사업부 매핑이 없습니다',
      noneDescription: '「매핑 추가」로 줄을 만든 뒤 저장하세요.',
    },
    dialog: {
      addTitle: '사업부 매핑 추가',
      editTitle: '사업부 매핑 수정',
      confirm: '확인',
      /* 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다 — 전체 치환이라 저장이 따로 있다. */
      notSavedNotice: '확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.',
    },
    /* 「대상 품목 이름을 못 받았다」는 저장을 막지 않는다 — 표시만의 문제다. */
    itemNamesLoadFailed: '대상 품목 이름을 불러오지 못했습니다. 저장에는 영향이 없습니다.',
    validation: {
      required: '필수 입력 항목입니다.',
      /* 계약 ck_item_bu_map_distinct */
      sameBusinessUnit: '보내는 사업부와 받는 사업부는 서로 달라야 합니다.',
      /* 계약 ck_item_bu_map_dates — 짝 제약이라 두 칸에 함께 낸다. */
      validRangeReversed: '유효 종료는 유효 시작과 같거나 뒤여야 합니다.',
    },
  },
  /**
   * 부속 하위 탭② — 단위 환산.
   *
   * 사업부 매핑과 달리 **유일 제약이 있다**(`uq_item_uom_conversion` 네 컬럼).
   * 서버가 준 목록에 이미 겹친 줄이 있을 수 있어 저장을 막는 사유 문구가 함께 있다.
   */
  uomConversion: {
    paneTitle: '단위 환산',
    fields: {
      fromUom: '변환 전 단위',
      toUom: '변환 후 단위',
      conversionRate: '환산 비율',
      validPeriod: '유효기간',
      effectiveFrom: '유효 시작',
      effectiveTo: '유효 종료',
      edit: '편집',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: '환산 추가',
      editRow: (name: string): string => `${name} 환산 수정`,
      removeRow: (name: string): string => `${name} 환산 삭제`,
    },
    /* 「무엇이 막혔는지 + 어떻게 풀 수 있는지」를 담고 그 컨트롤의 이름으로 시작한다. */
    actionReasons: {
      saveBlockedByDuplicate:
        '저장할 수 없습니다. 변환 전·변환 후·유효 시작이 같은 줄이 둘 이상 있습니다. 겹친 줄을 고치거나 지운 뒤 저장하세요.',
    },
    loading: {
      list: '단위 환산을 불러오는 중',
    },
    empty: {
      noneTitle: '등록된 단위 환산이 없습니다',
      noneDescription: '「환산 추가」로 줄을 만든 뒤 저장하세요.',
    },
    dialog: {
      addTitle: '단위 환산 추가',
      editTitle: '단위 환산 수정',
      confirm: '확인',
      notSavedNotice: '확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      /* 계약 ck_item_uom_distinct */
      sameUom: '변환 전 단위와 변환 후 단위는 서로 달라야 합니다.',
      /* 계약 exclusiveMinimum: 0 — 0은 허용값이 아니다. */
      conversionRateInvalid: '환산 비율은 0보다 큰 수로 입력하세요.',
      /* 계약 ck_item_uom_dates — 짝 제약이라 두 칸에 함께 낸다. */
      validRangeReversed: '유효 종료는 유효 시작과 같거나 뒤여야 합니다.',
      /* 계약 uq_item_uom_conversion — 유효 종료·환산 비율은 이 키에 들어가지 않는다. */
      duplicateKey: '변환 전·변환 후·유효 시작이 같은 줄이 이미 있습니다.',
      /* 표 위에 낸다 — 어느 줄이 문제인지 저장을 눌러야 알게 하지 않는다. */
      duplicateInList: '변환 전·변환 후·유효 시작이 같은 줄이 있습니다. 겹친 줄을 정리하세요.',
    },
  },
  /**
   * 부속 하위 탭③ — 외부 코드. 고객 바코드 체계의 저장처다.
   *
   * **중복 문구가 접힘을 밝힌다.** 계약의 유일 제약이 `COALESCE(partner_id,0)`으로 접혀
   * 거래처를 비운 두 줄이 서버에게 같은 짝이 되는데(A-7), 그 사실을 적지 않으면
   * 사용자가 「다른 줄인데 왜 막느냐」로 읽는다.
   */
  externalCode: {
    paneTitle: '외부 코드',
    fields: {
      externalSystem: '외부 시스템',
      partner: '거래처',
      externalItemCode: '외부 품목코드',
      edit: '편집',
    },
    values: {
      /* 계약이 「비우면 (전체)」로 정했다(A-7) — 빈 칸으로 두면 빠뜨린 것으로 읽힌다. */
      allPartners: '(전체)',
    },
    actions: {
      add: '외부 코드 추가',
      editRow: (name: string): string => `${name} 외부 코드 수정`,
      removeRow: (name: string): string => `${name} 외부 코드 삭제`,
    },
    actionReasons: {
      saveBlockedByDuplicate:
        '저장할 수 없습니다. 외부 시스템과 거래처가 같은 줄이 둘 이상 있습니다. 겹친 줄을 고치거나 지운 뒤 저장하세요.',
    },
    loading: {
      list: '외부 코드를 불러오는 중',
    },
    empty: {
      noneTitle: '등록된 외부 코드가 없습니다',
      noneDescription: '「외부 코드 추가」로 줄을 만든 뒤 저장하세요.',
    },
    dialog: {
      addTitle: '외부 코드 추가',
      editTitle: '외부 코드 수정',
      confirm: '확인',
      notSavedNotice: '확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.',
    },
    /* 값 목록이 확정되지 않아 자유 입력으로 받는다(결정 4) — 그 사실을 밝힌다. */
    externalSystemNote: '코드 목록이 확정되지 않아 직접 입력합니다. 값은 서버가 확인합니다.',
    validation: {
      required: '필수 입력 항목입니다.',
      externalSystemCodeTooLong: '외부 시스템 코드는 50자를 넘을 수 없습니다.',
      externalItemCodeTooLong: '외부 품목코드는 100자를 넘을 수 없습니다.',
      /* 계약 uq_item_external_code — COALESCE(partner_id,0) 접기를 문구가 밝힌다(A-7). */
      duplicateKey:
        '외부 시스템과 거래처가 같은 줄이 이미 있습니다. 거래처를 비운 줄끼리도 같은 줄로 봅니다.',
      duplicateInList:
        '외부 시스템과 거래처가 같은 줄이 있습니다. 거래처를 비운 줄끼리도 같은 줄로 보므로 겹친 줄을 정리하세요.',
    },
  },
  /**
   * 탭③ — 자재 명세서(BOM). **헤더는 전부 원본이다.**
   *
   * 이 탭에서 바꿀 수 있는 것은 둘뿐이다 — 어느 자재 명세서가 기본인가(`:set-default`)와
   * 구성품의 확장 열 넷. 나머지는 외부 시스템이 소유하므로 원본 구획과 같은 말을 쓴다.
   *
   * **상태 문구를 만들지 않는다.** 상태 코드의 값 목록이 확정되지 않아 화면이 이름을 지어내면
   * 그 이름으로 읽힌 판단이 남는다 — 품목유형과 같은 처리로 코드 문자열을 그대로 낸다.
   */
  bom: {
    paneTitle: '자재 명세서 목록',
    detailPaneTitle: '자재 명세서 정보',
    fields: {
      bomCode: 'BOM 코드',
      bomVersion: 'Rev',
      status: '상태',
      isDefault: '기본',
      validPeriod: '유효기간',
      /* 수량과 단위를 한 칸에 담으므로 단위 라벨을 따로 두지 않는다 — 구성품 표의 소요량과 같다. */
      baseQty: '기준 수량',
      setDefault: '기본 지정',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      /** 기본인 줄에 붙이는 표식. 아닌 줄은 값 없음 표기(`values.empty`)를 쓴다 */
      isDefault: '기본',
      /** 「Rev 3」처럼 사람이 읽는 형태. 표의 숫자 열과 액션 이름이 함께 쓴다 */
      revision: (version: number): string => `Rev ${String(version)}`,
      /** 자재 명세서 하나를 한 줄로. 액션 이름과 확인 창이 같은 형태를 쓴다 */
      name: (code: string, version: number): string => `${code} · Rev ${String(version)}`,
    },
    actions: {
      setDefaultRow: (name: string): string => `${name} 기본으로 지정`,
    },
    actionReasons: {
      /* 「무엇이 막혔는지 + 어떻게 풀 수 있는지」 — 이 컨트롤의 이름으로 시작한다. */
      alreadyDefault:
        '기본 지정은 이 자재 명세서가 이미 기본이라 할 수 없습니다. 기본을 옮기려면 다른 줄에서 지정하세요.',
    },
    loading: {
      list: '자재 명세서를 불러오는 중',
    },
    empty: {
      /* **여기서 만들 수 없는 자료다** — 자재 명세서도 외부 정본이다. */
      noneTitle: '등록된 자재 명세서가 없습니다',
      noneDescription:
        '자재 명세서는 외부 시스템에서 받아옵니다. 원본 시스템에 자료가 있는지 확인하세요.',
      notSelected: '위에서 자재 명세서를 고르면 여기에 그 내용과 구성품이 보입니다',
    },
    dialog: {
      setDefaultTitle: '기본 자재 명세서 지정',
      /*
       * **사용자가 고르지 않은 다른 줄이 함께 바뀐다.** 그 사실을 창이 먼저 밝히지 않으면
       * 어느 줄이 왜 기본에서 내려갔는지 알 수 없다 — 서버 응답은 지정한 줄만 돌려준다.
       */
      setDefaultDescription: '같은 품목의 기존 기본 자재 명세서는 자동으로 해제됩니다.',
      setDefaultConfirm: '기본으로 지정',
    },
    actionsColumn: {
      /** 헤더 목록에서 이 자재 명세서의 내용·구성품을 연다 */
      open: (name: string): string => `${name} 구성품 보기`,
    },
  },
  /**
   * 구성품 — **한 행에 원본 열 여섯과 확장 열 넷이 섞여 있다.**
   *
   * 이 화면 전체가 걸린 함정이 여기서 가장 좁게 나타난다. 문구도 그 경계를 따라 갈라 둔다 —
   * 편집 창에 들어가는 라벨은 **확장 열 넷뿐**이고, 표의 원본 열에는 라벨만 있고 입력이 없다.
   *
   * **스크랩률에 퍼센트 기호를 쓰지 않는다.** 계약이 0~1 비율이라 못 박았다(A-8) —
   * 화면이 100을 곱하면 사용자가 넣지 않은 값이 보인다.
   */
  component: {
    paneTitle: '구성품',
    fields: {
      sequence: '순서',
      componentItem: '구성품',
      /** 수량과 단위를 한 칸에 담는다 — 둘은 따로 읽히지 않는다 */
      requiredQty: '소요량',
      scrapRate: '스크랩률',
      isMandatory: '필수',
      /** 「등록 공정 · 실사용 공정」을 한 칸에. 두 값이 같을 때가 많아 나란히 놓아야 비교된다 */
      process: '공정',
      /** 켜진 확장 표시만 칩으로 */
      extensions: '확장 표시',
      edit: '편집',
      routingOperation: '등록 공정',
      actualUseProcess: '실사용 공정',
      lotTraceRequired: 'LOT 추적 강제',
      backflushAllowed: '백플러시 허용',
    },
    values: {
      mandatory: '필수',
      optional: '선택',
      /** 소요량 한 칸 — 「수량 단위」 */
      quantity: (qty: string, uom: string): string => `${qty} ${uom}`,
      /** 공정 한 칸 — 「등록 · 실사용」 */
      process: (registered: string, actual: string): string => `${registered} · ${actual}`,
      lotTraceRequired: 'LOT 추적',
      backflushAllowed: '백플러시',
      /* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 선택지로 둔다. */
      unassigned: '지정 안 함',
      /** 등록 공정 선택지 라벨. 순서는 **목록 내 위치**이며 서버 채번 값이 아니다 */
      routingOperation: (version: number, position: number, name: string): string =>
        `Rev ${String(version)} · ${String(position)}. ${name}`,
    },
    actions: {
      editRow: (name: string): string => `${name} 확장 열 수정`,
    },
    actionReasons: {
      /* 「무엇이 막혔는지 + 어떻게 풀 수 있는지」 — 이 컨트롤의 이름으로 시작한다. */
      routingOperationEmpty:
        '등록 공정은 이 품목에 등록된 공정 흐름이 없어 고를 수 없습니다. 공정 흐름을 먼저 등록한 뒤 다시 여세요.',
    },
    loading: {
      list: '구성품을 불러오는 중',
      /* 행 상세를 받는 동안. **이 조회가 끝나야 저장을 열 수 있다**(§5.3 6행). */
      detail: '구성품 정보를 불러오는 중',
    },
    dialog: {
      title: (name: string): string => `구성품 확장 열 수정 — ${name}`,
      /*
       * 창에 원본 열이 없다는 사실을 밝힌다 — 없는 것을 찾다가 「화면이 빠뜨렸다」로 읽지 않게 한다.
       * 서버가 이 경계를 막지 않으므로 화면이 지키는 자리라는 것도 이 문구가 대신한다.
       */
      originNotice:
        '원본 열은 외부 시스템이 소유해 여기서 바꿀 수 없습니다. 아래 네 가지만 저장됩니다.',
    },
    empty: {
      /* **여기서 만들 수 없는 자료다** — 계약에 구성품 추가·삭제 경로가 없다. */
      noneTitle: '등록된 구성품이 없습니다',
      noneDescription:
        '구성품은 외부 시스템에서 받아옵니다. 원본 시스템에 자료가 있는지 확인하세요.',
    },
    /* 「구성품 이름을 못 받았다」는 편집을 막지 않는다 — 표시만의 문제다. */
    itemNamesLoadFailed: '구성품 이름을 불러오지 못했습니다. 편집에는 영향이 없습니다.',
  },
} as const;
