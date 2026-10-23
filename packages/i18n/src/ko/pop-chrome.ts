/**
 * POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다(공유계약 G-34).
 *
 * ⚠ 화면마다 다른 말을 만들지 않는다. 같은 조작이 화면마다 다르게 읽히면 작업자가 헷갈린다.
 */
import { named } from '../named';
import { common } from './common';

export const popChrome = {
  /** 머리줄의 화면 이동 선택 단추. */
  screenNav: '화면 이동',
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
    workerLabel: (workerNo: string, workerName?: string | null): string =>
      `작업자 ${named(workerName, workerNo)}`,
    workOrderLabel: (workOrderNo: string): string => `W/O ${workOrderNo}`,
    emergency: '긴급',
    connected: common.connection.online,
    disconnected: common.connection.offline,
    unsent: (count: number): string => `미전송 ${String(count)}건`,
  },
  /**
   * 사번을 확인하지 못했을 때 맨 위 경고 띠(`patterns/pop-worker-missing-banner`). 모든 POP 화면이
   * 같은 말을 쓴다(사용자 지시 2026-09-17).
   */
  workerMissing: '사번이 확인되지 않았습니다. 사번 인증을 먼저 진행해주세요.',
  /** 단말 기능 판정(`patterns/pop-process-gate`) — 어느 공정의 무슨 기능이 꺼졌는지와 켜는 곳. */
  processGate: {
    denied: (process: string, feature: string, menuPath: string): string =>
      `이 단말은 ${process} 공정의 「${feature}」 기능이 꺼져 있습니다. 관리자에게 관리웹 ${menuPath}에서 ${process} 공정의 「${feature}」 기능을 켜 달라고 요청하세요.`,
    checkMapping: (menuPath: string): string =>
      `계속되면 관리자에게 관리웹 ${menuPath}에서 이 작업지시의 공정이 이 단말에 매핑돼 있는지 확인해 달라고 하세요.`,
    serverReason: (reason: string): string => `(서버 응답: ${reason})`,
    deniedUnknownProcess: (feature: string, menuPath: string): string =>
      `이 단말은 이 작업지시 공정의 「${feature}」 기능이 꺼져 있습니다. 관리자에게 관리웹 ${menuPath}에서 그 공정의 「${feature}」 기능을 켜 달라고 요청하세요.`,
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
    position: (page: number, totalPages: number, count: number): string =>
      `${String(page)} / ${String(totalPages)} · 전체 ${String(count)}건`,
  },
};
