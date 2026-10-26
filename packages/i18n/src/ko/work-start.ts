/**
 * P-02-01 작업 지시 목록(작업지시를 골라 작업을 시작하는 화면).
 *
 * 화면 구성 규범 C-5, C-13을 따른다. 하단 바 「남은 일」 자리의 문장은 머리말 없이 그대로 보인다
 * (사용자 결정 2026-10-23). 안내와 오류는 상황과 할 일을 한두 문장으로 쓴다.
 *
 * 오프라인에서는 시작하지 않는다(큐에 담지 않는다). 그래서 문구도 「나중에 전송됩니다」가 아니다.
 */
import { named } from '../named';

export const workStart = {
  /** 화면 이름. 하단 주 동작 [작업 시작]과 다른 말이다(사용자 결정 2026-10-26). */
  title: '작업 지시 목록',

  /** 머리줄. 설비와 작업자는 「이름 (코드)」로 보인다(C-10). */

  /** 사번 입력. 사번을 받지 못하고 들어온 경우에만 선다. */
  worker: {
    /** 묶음 제목. 칸 라벨 「사번」을 되풀이하지 않는다(사용자 결정 2026-10-23). */
    title: '작업자',
    /** 칸은 읽기 전용이다. 키오스크라 운영체제 키보드가 뜨면 화면을 덮는다. */
    fieldLabel: '사번',
    keypadLabel: '사번 숫자 키패드',
    backspace: '한 자 지움',
    clear: '전체 지움',
    confirm: '확인',
    cancel: '취소',
    checking: '확인 중',
    /** 사번이 없을 때의 빈 상태와 사번 입력 창을 여는 버튼(사용자 결정 2026-10-23). */
    empty: '사번이 입력되지 않았습니다.',
    open: '사번 입력',
    dialogTitle: '사번 입력',

    /** 미등록과 퇴사를 가른다. 사용자가 할 일이 다르다. */
    unknown: '이 공장에 등록되지 않은 사번입니다. 사번을 다시 입력하세요.',
    inactive: '재직 중이 아닌 사번입니다. 사번을 다시 입력하세요.',
    lookupFailed: '사번을 확인하지 못했습니다. 다시 시도하세요.',
    retry: '다시 시도',
  },

  /** 함께 일하는 작업자. 사번을 확인한 사람이 정, 더한 사람은 부다. */
  coWorkers: {
    title: '작업자',
    count: (count: number, max: number): string => `${String(count)}/${String(max)}`,
    main: '정',
    sub: '부',
    name: (workerName: string, workerNo: string): string => named(workerName, workerNo),
    add: '+ 부 작업자',
    remove: (name: string): string => `${name} 빼기`,
    dialogTitle: '부 작업자 추가',
    cancel: '취소',
    confirm: '추가',
    duplicate: '이미 들어간 작업자입니다.',
    otherPlant: '다른 공장 작업자는 넣을 수 없습니다.',
    failed: '작업자를 바꾸지 못했습니다. 다시 시도하세요.',
    loadFailed: '작업자를 불러오지 못했습니다. 작업지시를 다시 고르세요.',
    unknown: '이름 미등록',
  },

  /** 왼쪽 작업지시 구획. */
  list: {
    /**
     * 구획 제목. 어느 설비의 목록인지는 제목 줄 오른쪽 끝 설비 칸이 말하므로 제목은 바뀌지 않는다
     * (사용자 결정 2026-10-26, PG-39).
     */
    title: '작업지시',
    /**
     * 설비 고르기(PopSelect 팝업). 단말 설비가 맨 위 기본값이고 「기본 설비:」를 앞에 붙여 표시한다.
     * 그다음 「전체 설비」, 나머지 설비 순서다. 줄은 「이름 (코드)」(C-10). 닫힌 칸은 이름만 보인다.
     * 이름을 아직 모를 때만 `scopeEquipmentUnknown`을 쓴다(PG-37).
     */
    equipmentLabel: '설비',
    defaultOption: (equipment: string): string => `기본 설비: ${equipment}`,
    allOption: '전체 설비',
    resetToDefault: '기본 설비로',
    scopeEquipmentUnknown: '단말 설비',

    select: (workOrderNo: string): string => `${workOrderNo} 선택`,
    caption: '진행할 수 있는 작업지시',

    /** 상태 이름(T-P-W 상태 텍스트). 코드값은 화면에 보이지 않는다(C-13). */
    status: {
      released: '미착수',
      inProgress: '진행 중',
      suspended: '중단',
    },
    emergencyBadge: '긴급',
    unassignedEquipmentBadge: '설비 미지정',

    /** 수량 쌍(C-21). 라벨 「실적」, 값은 「실적 / 지시」 한 쌍이다. 실적을 못 받으면 라벨 「지시」. */
    goodLabel: '실적',
    orderLabel: '지시',
    progress: (good: string, order: string, uom: string | null): string =>
      `${good} / ${order}${uom === null ? '' : ` ${uom}`}`,
    /** 카드의 계획 설비. 「이름 (코드)」 한 줄이고 라벨 「설비」를 붙인다(C-10). */
    equipment: '설비',

    /** 빈 목록은 오류가 아니다. 다음에 할 일까지 적는다. */
    empty: (equipment: string): string =>
      `${equipment}에 배포된 작업지시가 없습니다. 설비에서 「전체 설비」를 고르면 다른 설비의 작업지시가 보입니다.`,
    /** 다른 설비를 골랐을 때의 빈 목록. */
    emptyOther: (equipment: string): string => `${equipment}에 배포된 작업지시가 없습니다.`,
    emptyAll: '진행할 수 있는 작업지시가 없습니다.',
    /** 받는 중을 무표시로 두지 않는다. 「없다」와 구분되지 않는다. */
    loading: '작업지시를 불러오는 중입니다.',
    loadError: '작업지시를 불러오지 못했습니다. 다시 시도하세요.',
    retry: '다시 시도',

    total: (total: number): string => `전체 ${String(total)}건`,
    /** 쪽이 여럿일 때. 지금 쪽이 전체의 몇 번째부터 몇 번째인지 말한다. */
    range: (total: number, from: number, to: number): string =>
      `전체 ${String(total)}건 중 ${String(from)}~${String(to)}번째`,

    pageNav: '작업지시 목록 페이지 이동',

    /** 설비를 몰라 기본 목록을 세우지 못한 상태. 빈 목록과 다른 사실이다. */
    equipmentUnknown:
      '이 단말의 설비를 확인하지 못했습니다. 설비에서 「전체 설비」를 고르면 진행할 수 있습니다.',
  },

  /** 오른쪽 작업 확인 구획. */
  side: {
    title: '작업 확인',
  },

  /**
   * 선택한 작업지시 묶음과 W/O 카드의 정보 영역. 제목 줄(W/O 번호와 상태 칩) 아래에 「라벨 값」 쌍으로
   * 보인다(C-21).
   */
  selection: {
    title: '선택한 작업지시',
    item: '품목',
    process: '공정',
    plannedStart: '계획 시작',
    equipment: '설비',

    /** 계획 설비가 다른 지시는 막지 않는다. 실제 설비는 세션에 기록된다. */
    otherEquipment: (equipment: string): string =>
      `이 작업지시의 계획 설비는 ${equipment}입니다. 이 설비에서 시작할 수 있습니다.`,

    /** 진행 중인 작업에서 갈 수 있는 다른 작업 화면. */
    otherWork: '다른 작업',
  },

  /** 하단 바 주 동작. */
  actions: {
    start: '작업 시작',
    resume: '재개',
    starting: '시작 중',
    /** 이미 진행 중인 작업으로 자리를 옮긴다(쓰기 없음). */
    continueToSession: '작업 이어하기',
  },

  /** 하단 바 「남은 일」 자리의 문장(C-5). 머리말 없이 보인다. */
  remaining: {
    worker: '사번을 입력하세요',
    select: '작업지시를 고르세요',
    /** 막힘 없음(C-5). 주 동작이 가는 곳을 상태마다 말한다. 세 동작 모두 자재 투입으로 간다. */
    ready: '자재 투입으로 진행할 수 있습니다',
    resume: '재개하면 자재 투입으로 진행할 수 있습니다',
    continue: '자재 투입으로 이어서 진행할 수 있습니다',
  },

  /** 시작과 재개를 막는 사유. 무엇이 막혔는지와 할 일을 함께 쓴다. */
  blocked: {
    /** 단말과 공정을 모른다. 셸이 채우는 값이라 이 화면에서 풀 수 없다. */
    unidentified: '단말을 확인하지 못해 진행할 수 없습니다. 단말 등록을 마친 뒤 다시 여세요',
    processNone:
      '단말에 공정이 등록되지 않아 진행할 수 없습니다. 관리자에게 단말 공정 매핑을 요청하세요',
    processMultiple:
      '단말에 공정이 여러 개라 작업 시작 권한을 확인할 수 없습니다. 관리자에게 문의하세요',
    checking: '단말 권한을 확인하는 중입니다',
    denied:
      '이 공정의 작업 시작 권한이 단말에 등록되지 않아 진행할 수 없습니다. 관리자에게 단말 공정 매핑을 요청하세요',
    deniedProcess: (processName: string): string =>
      `${processName} 작업 시작 권한이 단말에 등록되지 않아 진행할 수 없습니다. 관리자에게 단말 공정 매핑을 요청하세요`,
    /** 조회 실패를 통과로 처리하지 않는다. 「없습니다」와 다른 문장이다. */
    unavailable: '단말 권한을 확인하지 못했습니다. 다시 확인을 누르세요',
    retry: '다시 확인',

    /** 오프라인은 큐가 아니라 거부다. */
    offline: '연결이 끊겨 작업을 시작할 수 없습니다. 연결되면 목록을 다시 불러옵니다',

    /** 이미 진행 중인 세션이 있으면 새로 시작하지 않는다. 주 동작이 [작업 이어하기]로 선다. */
    holdWork: '작업 중단',
    runningChange: '부품 교체',
    pqcInspection: 'PQC 검사',
    /** 의뢰가 여럿이면 의뢰마다 버튼을 세우고 의뢰 번호를 적는다. */
    pqcInspectionOf: (inspectionRequestNo: string): string => `PQC 검사 ${inspectionRequestNo}`,
    packingWork: '포장 작업',
  },

  /**
   * 지시 수량을 채운 작업지시. 막는 말이 아니다. 「웹에서 마감을 진행해주세요」는 사용자가
   * 확정한 표현이다(2026-09-21).
   */
  closing: {
    fulfilled: '해당 작업 지시는 실적 등록이 완료되었습니다. 웹에서 마감을 진행해주세요.',
    fulfilledWithOpenSession:
      '실적 등록이 완료되었지만 진행 중인 작업이 있습니다. 진행 중인 작업을 완료한 후 웹에서 작업지시를 마감해주세요.',
  },

  /** 재개. 새 세션을 열지 않고 같은 세션에 사건을 적재한다. */
  resume: {
    sessionNotFound: '중단한 작업 기록을 찾지 못해 재개할 수 없습니다. 관리자에게 문의하세요',
    sessionLookupFailed: '진행 중인 작업을 확인하지 못했습니다. 작업지시를 다시 고르세요',
    checking: '진행 중인 작업을 확인하는 중입니다',
  },

  /** 결과. */
  result: {
    started: (workOrderNo: string): string => `${workOrderNo} 작업을 시작했습니다.`,
    resumed: (workOrderNo: string): string => `${workOrderNo} 작업을 재개했습니다.`,
    /** 서버가 충돌로 거절했다. 원인을 지어내지 않는다. 화면이 목록을 스스로 다시 부른다. */
    conflict: '작업지시 상태가 바뀌었습니다. 목록을 새로 불러옵니다.',
    /** 점검 판정은 서버에 남았는데 세션이 열리지 않은 경우. 말없이 끝내지 않는다. */
    notOpened: '점검 결과는 기록됐지만 작업이 시작되지 않았습니다. 작업 시작을 다시 누르세요.',
    startFailed: '작업을 시작하지 못했습니다. 연결을 확인하고 다시 누르세요.',
    resumeFailed: '작업을 재개하지 못했습니다. 연결을 확인하고 다시 누르세요.',
  },
} as const;
