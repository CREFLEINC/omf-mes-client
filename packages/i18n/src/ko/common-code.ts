/**
 * W-06-06 공통코드·조직·작업자. 마스터 형 화면의 세 번째 벌이라 문구 구조는 `inspectionStandard`와 같다.
 *
 * **`codeValue` 묶음은 통째로 옮겨질 것을 전제로 모아 둔다.** 코드값 편집 부분을 다른 화면이
 * 그대로 다시 쓰게 되어 있어(omf-mes#13), 그 부분의 문구가 다른 자원의 문구와 섞이면
 * 옮길 때 어느 열쇠가 딸려 가야 하는지 가릴 수 없다.
 */
export const commonCode = {
  title: '공통코드·조직·작업자',
  breadcrumbRoot: '기준정보',
  /** 탭 라벨. **만든 탭만 둔다** — 없는 탭의 라벨을 미리 두면 무엇이 렌더되는지 흐려진다. */
  tabs: {
    label: '공통코드·조직·작업자',
    code: '공통코드',
    org: '조직(부서)',
    worker: '작업자',
    /* 탭 이름이 「거래처」가 아니라 「거래처 역할」이다 — 이 탭이 다루는 것은 역할뿐이고 거래처 본체는 읽기만 한다. */
    partner: '거래처 역할',
  },
  panes: {
    codeGroup: '코드그룹',
    codeGroupForm: '코드그룹 정보',
    department: '부서',
    departmentForm: '부서 정보',
    worker: '작업자',
    workerDetail: '작업자 기본 정보',
    partner: '거래처',
    partnerDetail: '거래처 기본 정보',
    partnerRoles: '거래처 역할',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    addCodeGroup: '그룹 추가',
    addDepartment: '부서 추가',
  },
  /** 비활성 사유는 배치 규범 4의 문형을 따른다 — 컨트롤 이름으로 시작한다. */
  actionReasons: {
    /*
     * 세 자원이 같은 문형을 쓰되 대상 이름이 달라 함수로 둔다 —
     * 「사용 중지」가 어느 자원의 것인지 밝히지 않으면 사유가 붙은 대상을 복원할 단서가 없다.
     */
    deactivateAlreadyDone: (target: string): string =>
      `사용 중지는 이미 미사용인 ${target}에 다시 할 수 없습니다.`,
    deactivateNeedsSaved: (target: string): string =>
      `사용 중지는 ${target}을 먼저 등록해야 할 수 있습니다.`,
  },
  /**
   * 사용 중지 확인 창. 세 자원이 제목만 바꿔 쓰고 본문은 공유한다.
   *
   * **참조 건수를 내지 않는다**(결정 10) — 화면이 쓸 수 있는 건수는 「코드 필드를 고칠 수 있는지」의
   * 근거이지 「이 행을 참조하는 자료의 수」가 아니다. 두 뜻을 섞으면 화면이 지어낸다.
   */
  dialog: {
    deactivateCodeGroupTitle: '이 코드그룹을 사용 중지할까요?',
    deactivateDepartmentTitle: '이 부서를 사용 중지할까요?',
    deactivateDescription:
      '사용 중지하면 새 선택지에서 빠지고 이미 쓰인 자료는 그대로 남습니다. 되돌리는 경로가 없습니다.',
  },
  /*
   * 선택 목록이 잘리거나 실패했다는 사실을 감추지 않는다 —
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /**
   * 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다.
   * 좌 목록과 코드값 목록 둘 다 계약에 쪽 나눔이 있다.
   */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  filters: {
    codeGroupSearchLabel: '코드그룹 검색',
    codeGroupSearchPlaceholder: '그룹코드 또는 그룹명',
    departmentSearchLabel: '부서 검색',
    departmentSearchPlaceholder: '부서코드 또는 부서명',
    businessUnit: '사업부',
    /* 선택지에 빈 값을 두어 고른 사업부를 다시 「전체」로 되돌릴 수 있게 한다. */
    businessUnitAll: '전체 사업부',
    /*
     * 공장·사업부 필터를 두지 않는다 — 좌 페인에 필터 컨트롤 넷을 놓으면 표가 짓눌린다.
     * 검색어(사번·성명) + 부서 + 미사용 포함 셋으로 좁힌다.
     */
    workerSearchLabel: '작업자 검색',
    workerSearchPlaceholder: '사번 또는 성명',
    department: '부서',
    departmentAll: '전체 부서',
    /*
     * 거래처 탭에는 선택 축 필터가 없다 — **역할로 좁히지 않는다.**
     * 이 탭은 역할을 붙이는 곳이라 역할이 아직 없는 거래처가 반드시 보여야 한다.
     */
    partnerSearchLabel: '거래처 검색',
    partnerSearchPlaceholder: '거래처코드 또는 거래처명',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipBusinessUnit: (label: string): string => `사업부: ${label}`,
    chipRemoveBusinessUnit: '사업부 조건 제거',
    chipDepartment: (label: string): string => `부서: ${label}`,
    chipRemoveDepartment: '부서 조건 제거',
  },
  loading: {
    codeGroups: '코드그룹 목록을 불러오는 중',
    codeGroupDetail: '코드그룹 정보를 불러오는 중',
    departments: '부서 목록을 불러오는 중',
    departmentDetail: '부서 정보를 불러오는 중',
    workers: '작업자 목록을 불러오는 중',
    workerDetail: '작업자 정보를 불러오는 중',
    partners: '거래처 목록을 불러오는 중',
    partnerDetail: '거래처 정보를 불러오는 중',
    partnerRoles: '거래처 역할을 불러오는 중',
  },
  /** 자원 이름 — 여러 자원이 공유하는 문구에 끼워 넣는다. */
  targets: {
    codeGroup: '코드그룹',
    department: '부서',
  },
  empty: {
    /*
     * 결과는 있는데 **이 쪽에는** 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생긴다 —
     * 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다.
     */
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /*
     * 좁은 좌 페인에서 「사용 여부」 열을 따로 두면 이름 열이 짓눌린다 —
     * 이름 뒤 접미로 붙여 열을 늘리지 않는다.
     */
    inactiveSuffix: ' (미사용)',
    /*
     * 값은 있는데 그 번호를 선택 목록에서 찾지 못했다. **번호를 그대로 내지 않는다** —
     * 내부 식별자라 사용자가 쓸 수 없고, 보이면 자료로 읽힌다.
     */
    unknown: '알 수 없음',
  },
  codeGroup: {
    /*
     * 결정 6 — 코드 체계 정의가 표준화 작업 중이라 기대 목록이 비어 있다.
     * 그 사실을 감추지 않고 목록 위에 한 번 낸다.
     */
    provisionalCatalog:
      '임시 목록입니다. 코드 체계가 확정되면 여기 보이는 코드그룹의 구성이 바뀔 수 있습니다.',
    fields: {
      groupCode: '그룹코드',
      groupName: '그룹명',
      description: '설명',
    },
    empty: {
      noneTitle: '등록된 코드그룹이 없습니다',
      noneDescription: '「그룹 추가」로 첫 코드그룹을 등록하세요.',
      noMatchTitle: '조건에 맞는 코드그룹이 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      /*
       * 코드값 구획도 같은 자리에서 「먼저 고르세요」를 낸다 — 같은 문장을 두 번 쌓으면
       * 무엇을 하라는 안내인지 오히려 흐려진다. 이 구획은 무엇이 채워지는지로 말한다.
       */
      notSelected: '좌측에서 코드그룹을 고르면 여기에 그 그룹의 정보가 보입니다',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      groupCodeBlank: '그룹코드는 공백만으로 지정할 수 없습니다.',
      groupNameBlank: '그룹명은 공백만으로 지정할 수 없습니다.',
      groupCodeTooLong: '그룹코드는 50자를 넘을 수 없습니다.',
      groupNameTooLong: '그룹명은 200자를 넘을 수 없습니다.',
    },
    actionReasons: {
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 코드그룹의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherCodeGroup: '저장은 다른 코드그룹의 저장이 끝난 뒤에 할 수 있습니다.',
      /*
       * **같은 사실을 두 문면으로 두는 이유는 컨트롤 이름이 둘이기 때문이다.** 등록 폼의 주
       * 액션은 「그룹 추가」이고, 비활성 사유는 그 컨트롤의 이름으로 시작해야 한다(배치 규범 4-5) —
       * 사유가 시각적으로 끊겼을 때 어느 버튼의 것인지 복원할 단서가 이름뿐이다.
       */
      addLockedByOtherCodeGroup: '그룹 추가는 다른 코드그룹의 저장이 끝난 뒤에 할 수 있습니다.',
    },
  },
  department: {
    fields: {
      departmentCode: '부서코드',
      departmentName: '부서명',
      parentDepartment: '상위 부서',
      businessUnit: '사업부',
    },
    values: {
      /** 계층 그룹 머리글 — 그 그룹을 대표하는 부서. */
      groupHeader: (code: string, name: string): string => `${code} · ${name}`,
      /** 상위 부서를 비운 상태. 「없음」만으로는 무엇이 없는지 읽히지 않는다. */
      noParent: '없음 (뿌리 부서)',
    },
    /*
     * 상위를 이 쪽 목록에서 찾지 못한 행이 모이는 그룹. 쪽 나눔 때문에 상위가 다른 쪽에
     * 있을 수 있다 — 「없다」를 「뿌리다」로 읽지 않고 그 사실을 그대로 밝힌다.
     */
    groupHeaderOrphan: '상위 부서가 이 쪽에 없음',
    notices: {
      /*
       * 이슈 §6이 예고한 「2단 표시로는 부족한」 상태. 감추지 않는다 —
       * 계층을 다시 계산해 접으면 서버에 있는 관계와 화면이 어긋난다.
       */
      deepHierarchy:
        '3단 이상 계층이 있습니다. 이 목록은 상위–하위 2단까지만 묶어 보이므로 더 깊은 관계는 부서 정보의 상위 부서에서 확인하세요.',
    },
    empty: {
      noneTitle: '등록된 부서가 없습니다',
      noneDescription: '「부서 추가」로 첫 부서를 등록하세요.',
      noMatchTitle: '조건에 맞는 부서가 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 부서를 고르면 여기에 그 부서의 정보가 보입니다',
    },
    actionReasons: {
      /* 목록에 자기 하나뿐이면 상위로 고를 대상이 없다 — 감추지 않고 사유를 밝힌다. */
      parentNeedsOthers:
        '상위 부서는 고를 수 있는 다른 부서가 없어 지정할 수 없습니다. 부서를 하나 더 등록하면 이 칸을 쓸 수 있습니다.',
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 부서의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherDepartment: '저장은 다른 부서의 저장이 끝난 뒤에 할 수 있습니다.',
      /*
       * **같은 사실을 두 문면으로 두는 이유는 컨트롤 이름이 둘이기 때문이다.** 등록 폼의 주
       * 액션은 「부서 추가」이고, 비활성 사유는 그 컨트롤의 이름으로 시작해야 한다(배치 규범 4-5) —
       * 사유가 시각적으로 끊겼을 때 어느 버튼의 것인지 복원할 단서가 이름뿐이다.
       */
      addLockedByOtherDepartment: '부서 추가는 다른 부서의 저장이 끝난 뒤에 할 수 있습니다.',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      departmentCodeBlank: '부서코드는 공백만으로 지정할 수 없습니다.',
      departmentNameBlank: '부서명은 공백만으로 지정할 수 없습니다.',
      departmentCodeTooLong: '부서코드는 50자를 넘을 수 없습니다.',
      departmentNameTooLong: '부서명은 200자를 넘을 수 없습니다.',
    },
  },
  /**
   * 작업자 — **읽기 전용이다.** 계약에 쓰기 경로가 없다(POST·PUT 모두 없음).
   * 그래서 입력칸 라벨이 아니라 **값 표기의 이름**이며, 비활성 사유도 두지 않는다
   * (「언젠가 풀린다」는 뜻이 되는데 계약에 그 경로가 없다).
   */
  worker: {
    /*
     * `editability`가 아니라 **고정 문구**다 — 계약은 「항상 RECEIVED_FROM_ERP」라고 적었으나
     * 목 서버는 `reason:'EDITABLE'`을 준다. 쓰기 경로가 없다는 사실이 `editability`보다 강한 근거다.
     */
    readOnlyNotice:
      '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
    fields: {
      workerNo: '사번',
      workerName: '성명',
      businessUnit: '사업부',
      plant: '공장',
      department: '부서',
      status: '상태',
      appUser: '계정 연결',
      isActive: '사용 여부',
    },
    values: {
      /*
       * 계정 연결은 **연결 여부만** 낸다 — `appUserId`는 내부 식별자이고 이름을 만들려면
       * 다른 화면 소관의 조회가 필요하다. 번호를 그대로 내면 사용자가 쓸 수 없다.
       */
      appUserLinked: '연결됨',
      appUserNotLinked: '연결 안 됨',
      active: '사용 중',
      inactive: '미사용',
    },
    empty: {
      noneTitle: '등록된 작업자가 없습니다',
      noneDescription: '작업자는 외부 시스템에서 받아 옵니다. 원본 시스템을 확인하세요.',
      noMatchTitle: '조건에 맞는 작업자가 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 작업자를 고르면 여기에 그 작업자의 정보가 보입니다',
    },
  },
  /**
   * 자격·인증 — **이 화면에서 편집 가능한 유일한 작업자 관련 자료**다.
   * 저장은 전체 치환이라 표의 최종 상태를 한 번에 보낸다.
   */
  qualification: {
    paneTitle: '자격·인증',
    fields: {
      qualificationType: '자격 유형',
      process: '공정',
      certificateNo: '인증번호',
      validPeriod: '유효기간',
      validFrom: '유효 시작',
      validTo: '유효 종료',
      certifiedBy: '인증자',
      edit: '편집',
    },
    values: {
      /** 공정을 비운 자격은 모든 공정에 걸린다 — 계약이 그 뜻을 널로 표현한다(A-7). */
      allProcesses: '(전체 공정)',
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: '자격 추가',
      /* 행 아이콘 버튼은 보이는 글자가 없다 — 어느 행의 것인지 이름에 담는다. */
      editRow: (label: string): string => `${label} 자격 수정`,
      removeRow: (label: string): string => `${label} 자격 삭제`,
    },
    actionReasons: {
      needsWorker: '자격 추가는 좌측에서 작업자를 고른 뒤에 할 수 있습니다.',
      /*
       * 서버가 준 목록에 이미 중복 짝이 있으면 그대로 보내도 서버가 거부한다 —
       * 사용자가 먼저 그 줄을 고쳐야 한다.
       */
      saveBlockedByInvalid:
        '저장은 자격 유형과 공정 짝이 겹치는 줄이 있어 할 수 없습니다. 그 줄을 고치거나 지우면 저장할 수 있습니다.',
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 작업자의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherWorker: '저장은 다른 작업자의 저장이 끝난 뒤에 할 수 있습니다.',
    },
    /*
     * 창의 확인은 **저장이 아니다.** 표에만 반영되고 서버로는 「저장」에서 한 번에 나간다 —
     * 밝히지 않으면 사용자가 창을 닫는 순간 저장된 줄 안다.
     */
    dialog: {
      addTitle: '자격 추가',
      editTitle: '자격 수정',
      notSavedNotice:
        '이 창의 확인은 저장이 아닙니다. 표에 반영된 뒤 「저장」을 눌러야 서버에 반영됩니다.',
      confirm: '확인',
    },
    empty: {
      notSelected: '좌측에서 작업자를 고르면 그 작업자의 자격·인증이 보입니다',
      noneTitle: '등록된 자격·인증이 없습니다',
      noneDescription: '「자격 추가」로 첫 자격을 등록하세요.',
    },
    loading: {
      list: '자격·인증을 불러오는 중',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      certificateNoTooLong: '인증번호는 100자를 넘을 수 없습니다.',
      /* 계약 ck_worker_qualification_dates — 있으면 유효 시작 이상. 한쪽만 있는 것은 허용된다. */
      validRangeReversed: '유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.',
      /*
       * 계약 uq_worker_qualification이 `COALESCE(process_id,0)`으로 접는다 —
       * 공정을 비운 두 줄은 같은 짝이다.
       */
      duplicatePair:
        '자격 유형과 공정 짝이 이미 있습니다. 공정을 다르게 고르거나 그 줄을 고치세요.',
    },
  },
  /**
   * 거래처 — **본체는 읽기 전용이다.** ERP에서 받은 마스터라 계약에 쓰기 경로가 없고,
   * 이 탭이 고치는 것은 역할뿐이다. 고칠 수 없는 사유는 이미 있는 공통 문구
   * (`editability.receivedFromErp`)를 그대로 쓴다 — 이 화면 전용 문구를 새로 만들지 않는다.
   *
   * **내부 번호(`partnerId`)를 문구에 담지 않는다** — 주소와 조회에만 쓰는 식별자다.
   */
  partner: {
    fields: {
      partnerCode: '거래처코드',
      partnerName: '거래처명',
      country: '국가',
      erpPartnerCode: 'ERP 코드',
      isActive: '사용 여부',
    },
    values: {
      active: '사용 중',
      inactive: '미사용',
    },
    empty: {
      noneTitle: '등록된 거래처가 없습니다',
      /* 「거래처 추가」가 없다 — 없는 조치를 지시하지 않고 어디서 오는 자료인지만 밝힌다. */
      noneDescription: '거래처는 외부 시스템에서 받아 옵니다. 원본 시스템을 확인하세요.',
      noMatchTitle: '조건에 맞는 거래처가 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 거래처를 고르면 여기에 그 거래처의 역할이 보입니다',
      /*
       * 단건 조회가 **없다**고 답한 경우. 다시 시도해도 나타나지 않으므로 재시도를 권하지 않고
       * 다시 고르기로 안내한다 — 못 불러온 것과 없는 것은 할 수 있는 조치가 다르다.
       *
       * 「목록 밖 선택」 안내는 **정의째 없앴다**(#173 — 기본 정보가 목록에서 풀렸다). 조건과
       * 무관하게 그 한 건을 받으므로 그런 상태 자체가 생기지 않는다.
       */
      notFoundTitle: '고른 거래처를 찾을 수 없습니다',
      notFoundDescription:
        '원본 시스템에서 지워졌거나 주소의 번호가 잘못됐습니다. 좌측 목록에서 다시 고르세요.',
    },
  },
  /**
   * 거래처 역할 — **표시명이 사는 자리.**
   *
   * 코드 표기(영문)는 화면 슬라이스의 `partner-role-vocab.ts`가 갖는다. 이름을 코드 파일이
   * 들고 있으면 문구 정본이 둘이 된다. 반대로 **어휘 밖 코드의 이름은 서버가 준다** —
   * 화면이 모르는 값에 이름을 지어내지 않는다.
   */
  partnerRole: {
    names: {
      customer: '고객사',
      supplier: '공급사',
      subcontractor: '외주 제작사',
      disposal: '폐기 업체',
      other: '기타',
    },
    /*
     * 계약이 값 목록을 다섯으로 확정했지만(#173) 서버가 그 밖의 코드를 아직 들고 있을 수 있다 —
     * 계약은 구현보다 앞선다. **감추지 않는다** — 통째 교체 저장에서 목록에 없는 역할은
     * 조용히 해제되기 때문이다.
     */
    unknownBadge: '이 화면이 모르는 역할',
    /*
     * 어휘 밖 코드는 **저장하면 반드시 해제된다**(#173). 근거가 「화면이 모른다」에서
     * **「서버가 거절한다」**로 바뀌었다 — 계약이 다섯 밖의 값을 400으로 되돌리므로 화면이
     * 그것을 실은 요청을 만들 수 없다. 해제되면 이 화면에는 다시 붙일 수단이 없으므로
     * 그 비대칭을 미리 밝힌다.
     */
    unknownNote:
      '이 화면이 모르는 역할은 저장할 때 해제됩니다 — 서버가 정한 다섯 역할 밖의 값은 저장에서 거절되기 때문입니다. 해제되면 여기서는 다시 붙일 수 없습니다.',
    /*
     * 잠금 토큰을 얻지 못해 저장이 멈춘 경우 — **이 자원에서만 공통 문구를 쓰지 않는다.**
     *
     * 공통 문구(`save.staleToken`)는 「잠시 뒤 다시 저장하세요」인데, 그 말은 **다시 시도하면
     * 풀리는** 자원을 전제로 한다. 계약은 이 자원의 토큰 원천을 선언했으나 **서버가 아직 주지
     * 않는 동안**에는 토큰이 오지 않아 다시 눌러도 같은 자리에서 멈춘다 — 공통 문구를 그대로
     * 쓰면 **없는 조치를 지시하는** 안내가 된다.
     *
     * 이 화면에서 할 일을 시키지 않는다. 지금 상태가 무엇인지만 밝히고, 되풀이해도 달라지지
     * 않는다는 사실을 함께 적어 헛된 시도를 막는다. 공통 문구 자체는 고치지 않는다 —
     * 다시 시도가 실제로 통하는 형제 화면에서는 그 말이 참이다.
     *
     * **다만 출구는 남긴다.** 사용자가 이 화면에서 스스로 풀 수 없는 상태이므로 「달라지지
     * 않는다」에서 끝내면 다음에 할 일이 없어진다 — 저장소 선례가 같은 자리에 두는 한 문장을
     * 그대로 쓴다(`httpError.description`·`httpError.forbidden`).
     */
    saveTokenUnavailable:
      '저장에 필요한 정보가 서버에서 아직 제공되지 않아 지금은 저장할 수 없습니다. 다시 눌러도 같은 결과입니다. 반복되면 담당자에게 알려 주세요.',
    actionReasons: {
      saveNoChanges: '저장은 역할을 고친 뒤에 할 수 있습니다.',
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 거래처의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherPartner: '저장은 다른 거래처의 저장이 끝난 뒤에 할 수 있습니다.',
    },
    /*
     * **잃는 것이 있을 때만 서는 확인 창**(결정 10). 추가만 하는 저장에까지 창을 세우면
     * 확인이 습관이 되어 정작 잃는 저장에서도 읽히지 않는다.
     *
     * 버튼 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다.
     */
    dialog: {
      title: '해제되는 역할이 있습니다',
      lead: '저장하면 아래 역할이 해제됩니다.',
      /* 계약이 빈 배열을 「전부 해제」로 정의한다 — 실제로 만들 수 있는 상태라 미리 밝힌다. */
      noneLeft: '저장하면 이 거래처의 역할이 하나도 남지 않습니다.',
      confirm: '해제하고 저장',
      keepEditing: '계속 편집',
    },
    empty: {
      noneTitle: '지정된 역할이 없습니다',
    },
  },
  /**
   * **코드값 편집 한 벌의 문구.** 이 묶음은 통째로 옮겨질 것을 전제로 모아 둔다 —
   * 다른 자원의 문구와 섞으면 옮길 때 어느 열쇠가 딸려 가야 하는지 가릴 수 없다.
   *
   * 구획 이름·액션·쪽 이동 접근 이름까지 여기 둔다. 바깥에서 빌려 쓰는 것은
   * 자원 이름이 없는 공통 문구(`common`·`conflict`·`httpError`)뿐이다.
   */
  codeValue: {
    paneTitle: '코드값',
    formPaneTitle: '코드값 정보',
    pageNavLabel: '코드값 쪽 이동',
    actions: {
      add: '코드값 추가',
    },
    actionReasons: {
      /* 계약이 `codeGroupId`를 필수 쿼리로 두었다 — 그룹 없이는 만들 자리 자체가 없다. */
      addNeedsGroup: '코드값 추가는 좌측에서 코드그룹을 고른 뒤에 할 수 있습니다.',
      /*
       * 바깥 묶음의 같은 문형을 **대상을 코드값으로 고정해** 여기 둔다.
       * 한 벌이 바깥 열쇠를 빌려 쓰면 옮길 때 그 열쇠가 딸려 가지 않는다 —
       * 대상이 늘 코드값이라 매개변수도 필요 없다.
       */
      deactivateAlreadyDone: '사용 중지는 이미 미사용인 코드값에 다시 할 수 없습니다.',
    },
    loading: {
      list: '코드값 목록을 불러오는 중',
      detail: '코드값 정보를 불러오는 중',
    },
    /*
     * 정렬은 화면이 한다(계약이 목록의 정렬을 명시하지 않았다) — 그 한계를 감추지 않는다.
     * 겹친 정렬 순서는 서버가 허용하는 값이라 **막지 않고 알리기만** 한다.
     */
    notices: {
      sortWithinPage: '정렬은 현재 쪽 안에서만 적용됩니다.',
      duplicateDisplayOrder:
        '정렬 순서가 같은 코드값이 있습니다. 같은 값끼리는 코드 순으로 보입니다.',
    },
    fields: {
      code: '코드',
      codeName: '코드명',
      displayOrder: '정렬 순서',
      effectivePeriod: '유효기간',
      effectiveFrom: '유효 시작',
      effectiveTo: '유효 종료',
    },
    empty: {
      groupNotSelected: '좌측에서 코드그룹을 먼저 고르세요',
      noneTitle: '이 코드그룹에 등록된 코드값이 없습니다',
      noneDescription: '「코드값 추가」로 첫 코드값을 등록하세요.',
      noMatchTitle: '조건에 맞는 코드값이 없습니다',
      noMatchDescription: '「미사용 포함」을 켜면 미사용 코드값도 보입니다.',
      notSelected: '위 목록에서 코드값을 먼저 고르세요',
      /*
       * 결과는 있는데 **이 쪽에는** 없다. 바깥 묶음에 같은 문구가 있으나 여기 따로 둔다 —
       * 한 벌은 자기 묶음만 들고 옮겨진다.
       */
      beyondLastTitle: '이 쪽에는 결과가 없습니다',
      beyondLastDescription: '첫 쪽으로 이동하세요.',
    },
    values: {
      /** 유효기간 표기. 한쪽만 있는 것도 계약이 허용한다 — 없는 쪽을 지어내지 않는다. */
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
      empty: '—',
      /** 좁은 칸에서 「사용 여부」 열을 따로 두면 이름 열이 짓눌린다 — 이름 뒤 접미로 붙인다. */
      inactiveSuffix: ' (미사용)',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      codeBlank: '코드는 공백만으로 지정할 수 없습니다.',
      codeNameBlank: '코드명은 공백만으로 지정할 수 없습니다.',
      codeTooLong: '코드는 50자를 넘을 수 없습니다.',
      codeNameTooLong: '코드명은 200자를 넘을 수 없습니다.',
      /* 계약이 정수를 받는다. 하한이 없어 음수는 막지 않는다. */
      displayOrderInvalid: '정렬 순서는 정수로 입력하세요.',
      /* 계약 ck_code_value_dates — 있으면 유효 시작 이상. 한쪽만 있는 것은 허용된다. */
      effectiveRangeReversed: '유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.',
    },
    dialog: {
      deactivateTitle: '이 코드값을 사용 중지할까요?',
    },
  },
} as const;
