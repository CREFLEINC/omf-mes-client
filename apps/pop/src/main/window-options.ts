/**
 * 키오스크 창 옵션 — #441의 확정 결정을 코드로 옮긴 것.
 *
 * 이 모듈은 Electron 런타임 없이 값만 만든다. 그래야 보안 축이 실제로 걸려 있는지를
 * 앱을 띄우지 않고 감지기로 잴 수 있다. 창 생성은 index.ts가 한다.
 *
 * 창 모양 축(kiosk·frame·fullscreen·resizable)은 `isDev`로 갈린다. 배포본은 잠그고
 * 개발 모드는 창 모드다. 보안 축(contextIsolation·nodeIntegration·sandbox·webSecurity)은
 * 되돌리기 어려워 개발 모드에서도 잠근 채 둔다 — 두 축을 같이 풀지 않는다.
 */

export interface WindowOptionsInput {
  /** preload 스크립트의 절대 경로. 호출부가 주입한다(런타임 경로를 이 모듈이 알 필요가 없다). */
  preloadPath: string;
  /**
   * 개발 모드인가. 개발 중에만 개발자도구를 연다 — POP 화면 20건이 이 셸 위에 얹히는데
   * 렌더러를 들여다볼 수단이 아예 없으면 그 작업이 막힌다. 배포본에서는 잠긴다.
   */
  isDev?: boolean;
}

/**
 * 렌더러 보안 축. 되돌리기 어려운 축이라 처음부터 잠근다(#441 결정).
 * `contextBridge` 하나만 통로로 남긴다.
 */
export interface WebPreferences {
  preload: string;
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
  webSecurity: true;
  /** 배포본에서는 개발자도구를 아예 열 수 없게 한다 — 작업자가 셸 밖으로 빠져나가지 못하게. */
  devTools: boolean;
}

export interface KioskWindowOptions {
  /**
   * 배포본은 키오스크로 잠근다. 개발 모드는 창 모드다 — 키오스크가 화면 전체를 덮으면
   * 다른 창(관리자 웹·에뮬레이터)과 번갈아 조작할 수 없고, macOS가 가려진 창을 절전시켜
   * 붙어 있던 기기가 멎는다. 잠금 축(보안 축)은 개발 모드에서도 풀지 않는다.
   */
  kiosk: boolean;
  frame: boolean;
  fullscreen: boolean;
  autoHideMenuBar: boolean;
  /** 실기가 가로 고정 터치 패널이다. 최소 폭을 세로보다 크게 둬 세로 배치를 막는다. */
  width: number;
  height: number;
  resizable: boolean;
  webPreferences: WebPreferences;
}

/** 산업용 패널 PC 기준 해상도. 창이 못 뜨는 환경에서도 이 값으로 뜬다. */
export const PANEL_WIDTH = 1920;
export const PANEL_HEIGHT = 1080;

export function createKioskWindowOptions({
  preloadPath,
  isDev = false,
}: WindowOptionsInput): KioskWindowOptions {
  return {
    kiosk: !isDev,
    frame: isDev,
    fullscreen: !isDev,
    autoHideMenuBar: !isDev,
    // 개발 모드에서도 패널 해상도를 유지한다 — 화면 배치가 실기와 달라지면 확인이 무의미해진다.
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    resizable: isDev,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  };
}
