/**
 * 키오스크 창 옵션 — #441의 확정 결정을 코드로 옮긴 것.
 *
 * 이 모듈은 Electron 런타임 없이 값만 만든다. 그래야 보안 축이 실제로 걸려 있는지를
 * 앱을 띄우지 않고 감지기로 잴 수 있다. 창 생성은 index.ts가 한다.
 */

/** preload 스크립트의 절대 경로. 호출부가 주입한다(런타임 경로를 이 모듈이 알 필요가 없다). */
export interface WindowOptionsInput {
  preloadPath: string;
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
  /** 개발자도구를 아예 열 수 없게 한다 — 현장 작업자가 셸 밖으로 빠져나가지 못하게. */
  devTools: false;
}

export interface KioskWindowOptions {
  kiosk: true;
  frame: false;
  fullscreen: true;
  autoHideMenuBar: true;
  /** 실기가 가로 고정 터치 패널이다. 최소 폭을 세로보다 크게 둬 세로 배치를 막는다. */
  width: number;
  height: number;
  resizable: false;
  webPreferences: WebPreferences;
}

/** 산업용 패널 PC 기준 해상도. 창이 못 뜨는 환경에서도 이 값으로 뜬다. */
export const PANEL_WIDTH = 1920;
export const PANEL_HEIGHT = 1080;

export function createKioskWindowOptions({ preloadPath }: WindowOptionsInput): KioskWindowOptions {
  return {
    kiosk: true,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    resizable: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: false,
    },
  };
}
