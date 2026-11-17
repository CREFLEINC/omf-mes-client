/**
 * POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다(공유계약 G-34).
 *
 * ⚠ 화면마다 다른 말을 만들지 않는다. 같은 조작이 화면마다 다르게 읽히면 작업자가 헷갈린다.
 */
import { named } from '../named';
import { common } from './common';

export const popChrome = {
  /**
   * 화면 위 공통 이동 메뉴(#291) — 맨 위 줄 · 업무 묶음 줄 · 화면 탭 줄. 묶음 이름은
   * `patterns/pop-screen-catalog` 의 `POP_SCREEN_GROUPS` 가 정한다.
   */
  nav: {
    brand: 'OMF-MES POP',
    home: '홈',
    groupsLabel: '업무 묶음',
    screensLabel: (group: string): string => `${group} 화면`,
    /** 묶음 이름 뒤 숫자의 숨은 글 — 보이는 것은 배지다. */
    groupCount: (group: string, count: number): string => `${group}, 남은 작업 ${String(count)}건`,
    /** 이동할 화면을 판정하지 못했을 때 묶음 자리에 서는 사유(G-2 — 감추지 않고 사유를 보인다). */
    unknown: '이동할 수 있는 화면을 확인하지 못했습니다',
    empty: '이동할 수 있는 화면이 없습니다',
  },
  /** 묶음 줄 오른쪽 끝 [남은 작업] 과 그 펼침 창(피처 002 의 남은 작업 수). */
  remaining: {
    button: '남은 작업',
    buttonLabel: (count: number): string => `남은 작업 ${String(count)}건`,
    title: (count: number): string => `남은 작업 ${String(count)}건`,
    hint: '누르면 그 화면으로 바로 이동합니다',
    none: '남은 작업이 없습니다',
    move: '이동',
    close: '닫기',
    count: (name: string, count: number): string => `${name}, 남은 작업 ${String(count)}건`,
  },
  /** 홈 화면(#291) — 사번 확인 뒤 처음 서는 화면. */
  home: {
    title: '홈',
    greeting: (name: string): string => `${name} 님, 안녕하세요!`,
    /** 사번을 아직 모를 때 — 이름 자리를 비워 「님,」만 남기지 않는다. */
    greetingAnonymous: '안녕하세요!',
    /** 인사 줄 오른쪽 시계의 요일(일요일부터). */
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
    sub: '오늘도 안전하고 정확한 작업을 진행해 주세요.',
    remainingTitle: '남은 작업',
    remainingCount: (count: number): string => `${String(count)}건`,
    remainingNone: '지금 남은 작업이 없습니다.',
    shortcutsTitle: '바로가기',
    shortcutsHint: '자주 쓰는 화면으로 바로 이동합니다.',
    /** 오늘 작업 현황 — 이 단말 설비의 작업지시 수(작업 지시 목록과 같은 조회). */
    statusTitle: '오늘 작업 현황',
    inProgress: '진행 중',
    waiting: '대기',
    statusCount: (count: number): string => `${String(count)}건`,
    nextTitle: '다음 작업',
    nextNone: '대기 중인 작업이 없습니다',
    nextPlan: (item: string, qty: string): string => `${item} · 계획 ${qty}개`,
    /** 설비가 없는 단말은 전체 설비로 센다(작업 지시 목록의 「전체 설비」). */
    statusAllEquipment: '전체 설비 기준',
    statusFailed: '작업 현황을 불러오지 못했습니다.',
    edit: '편집',
    editDone: '완료',
    editReset: '기본으로',
    editHint: (max: number): string =>
      `화면을 눌러 바로가기에 넣거나 뺍니다(최대 ${String(max)}개).`,
    editPicked: (name: string): string => `${name}, 바로가기에 있음`,
  },
  /** 머리줄의 사번 놓기 단추. */
  userSwitch: '사용자 전환',
  /**
   * 공용 머리줄(`patterns/pop-header`, C-11). 설비와 작업자는 「이름 (코드)」, 단말은 단말 코드.
   * 연결 상태 문구는 공용 어휘를 쓴다(`common.connection`).
   */
  header: {
    terminalUnknown: '단말 확인 전',
    terminalLabel: (code: string): string => `단말 ${code}`,
    /** 머리줄은 1024 폭에 고정 항목이 다 들어가게 설비 이름만 보인다. 코드는 툴팁(`equipmentTitle`). */
    equipmentLabel: (code: string, name: string): string =>
      `설비 ${name.trim() === '' ? code : name}`,
    equipmentTitle: (code: string, name: string): string => `설비 ${named(name, code)}`,
    workerUnset: '사번 미입력',
    /*
     * 머리줄의 작업자는 「이름 (사번)」만 보인다. 이름과 사번이 함께 서면 작업자임이 드러나고, 1024 폭에서
     * 설비 이름이 줄지 않게 「작업자」 라벨 낱말을 뺀다. 라벨은 툴팁과 접근 이름(`workerTitle`)이 말한다.
     */
    workerLabel: (workerNo: string, workerName?: string | null): string =>
      named(workerName, workerNo),
    workerTitle: (workerNo: string, workerName?: string | null): string =>
      `작업자 ${named(workerName, workerNo)}`,
    workOrderLabel: (workOrderNo: string): string => `W/O ${workOrderNo}`,
    /** 이 투입에 지정한 금형(C-21, 있을 때만). */
    moldLabel: (mold: string): string => `금형 ${mold}`,
    /** W/O에 계획 금형이 있는데 아직 스캔하지 않았을 때(예외만 보인다). */
    moldMissing: '금형 스캔 필요',
    emergency: '긴급',
    connected: common.connection.online,
    disconnected: common.connection.offline,
    unsent: (count: number): string => `미전송 ${String(count)}건`,
  },
  /**
   * 사번을 확인하지 못했을 때 맨 위 경고 띠(`patterns/pop-worker-missing-banner`). 모든 POP 화면이
   * 같은 말을 쓴다(사용자 지시 2026-09-17).
   */
  workerMissing: '사번이 확인되지 않았습니다. 사번 인증을 먼저 진행해 주세요.',
  /**
   * 공용 사번 입력 창(`patterns/worker-no-dialog`). 작업 시작과 자재 투입이 같은 창을 쓴다.
   * 칸은 읽기 전용이 아니라 키보드와 스캐너 입력을 받는다.
   */
  workerNoDialog: {
    title: '사번 입력',
    fieldLabel: '사번',
    keypadLabel: '사번 숫자 키패드',
    backspace: '한 자 지움',
    clear: '전체 지움',
    confirm: '확인',
    cancel: '취소',
    checking: '확인 중',
    /** 사번이 없을 때의 빈 상태와 창을 여는 버튼(작업 시작 「작업자」 묶음과 같은 말). */
    groupTitle: '작업자',
    empty: '사번이 입력되지 않았습니다.',
    open: '사번 입력',
    unknown: '이 공장에 등록되지 않은 사번입니다. 사번을 다시 입력해 주세요.',
    inactive: '재직 중이 아닌 사번입니다. 사번을 다시 입력해 주세요.',
    lookupFailed: '사번을 확인하지 못했습니다. 다시 시도해 주세요.',
    retry: '다시 시도',
  },
  /** 단말 기능 판정(`patterns/pop-process-gate`) — 어느 공정의 무슨 기능이 꺼졌는지와 켜는 곳. */
  processGate: {
    denied: (process: string, feature: string, menuPath: string): string =>
      `이 단말은 ${process} 공정의 「${feature}」 기능이 꺼져 있습니다. 관리자에게 관리웹 ${menuPath}에서 ${process} 공정의 「${feature}」 기능을 켜 달라고 요청해 주세요.`,
    checkMapping: (menuPath: string): string =>
      `계속되면 관리자에게 관리웹 ${menuPath}에서 이 작업지시의 공정이 이 단말에 매핑돼 있는지 확인해 달라고 해 주세요.`,
    serverReason: (reason: string): string => `(서버 응답: ${reason})`,
    deniedUnknownProcess: (feature: string, menuPath: string): string =>
      `이 단말은 이 작업지시 공정의 「${feature}」 기능이 꺼져 있습니다. 관리자에게 관리웹 ${menuPath}에서 그 공정의 「${feature}」 기능을 켜 달라고 요청해 주세요.`,
  },
  /** 선택 단추가 따로 이름을 받지 않았을 때의 기본 이름. */
  select: '선택',

  /** 선택 팝업(`patterns/pop-select`). 쪽 넘김 단추는 `popPageNav` 를 쓴다. */
  selectDialog: {
    /** 무엇을 고르는지 이름을 알 수 없을 때. */
    fallbackName: '항목',
    title: (name: string): string => `${name} 선택`,
    searchLabel: '목록 검색',
    searchPlaceholder: '목록에서 검색',
    /**
     * 스캐너로도 고를 수 있는 목록(`scannable`)에서 같은 칸이 쓰는 말.
     *
     * ⭐ **찍는 것과 치는 것을 한 칸이 받는다** — 칸이 둘이면 작업자가 어디에 찍어야 하는지
     *    고르게 된다. 찍은 값이 후보 하나와 정확히 같아지면 스스로 골라 닫힌다.
     */
    scanLabel: '스캔 또는 목록 검색',
    scanPlaceholder: '스캔하거나 목록에서 검색',
    clearSearch: '검색어 지우기',
    empty: '표시할 항목이 없습니다.',
    /** 관리웹 페이지 이동과 같은 꼴: 위치 「1 / 3」, 건수 「총 7건」. */
    position: (page: number, totalPages: number): string =>
      `${String(page)} / ${String(Math.max(totalPages, 1))}`,
    total: (count: number): string => `총 ${String(count)}건`,
  },
};
