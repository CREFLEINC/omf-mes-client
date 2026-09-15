import { describe, expect, it } from 'vitest';

import { PANEL_HEIGHT, PANEL_WIDTH, createKioskWindowOptions } from './window-options';

const options = () => createKioskWindowOptions({ preloadPath: '/tmp/preload.cjs' });

describe('키오스크 창 옵션', () => {
  it('작업자가 창을 닫거나 브라우저 UI로 빠져나갈 수 없다', () => {
    const o = options();
    expect(o.kiosk).toBe(true);
    expect(o.frame).toBe(false);
    expect(o.fullscreen).toBe(true);
    expect(o.autoHideMenuBar).toBe(true);
    expect(o.resizable).toBe(false);
  });

  it('가로 고정 — 폭이 높이보다 크다', () => {
    const o = options();
    expect(o.width).toBeGreaterThan(o.height);
    expect(o.width).toBe(PANEL_WIDTH);
    expect(o.height).toBe(PANEL_HEIGHT);
  });

  it('배포본에서는 개발자도구를 열 수 없다', () => {
    expect(options().webPreferences.devTools).toBe(false);
  });

  it('개발 모드에서만 개발자도구가 열린다 — 화면 작업에 필요하다', () => {
    const dev = createKioskWindowOptions({ preloadPath: '/tmp/preload.cjs', isDev: true });
    expect(dev.webPreferences.devTools).toBe(true);
  });

  it('isDev를 주지 않으면 잠긴 쪽이 기본이다 — 실수로 열린 채 배포되지 않게', () => {
    expect(createKioskWindowOptions({ preloadPath: '/p' }).webPreferences.devTools).toBe(false);
  });
});

describe('개발 모드는 창 모드로 뜬다 — 다른 창과 번갈아 조작해야 한다', () => {
  const dev = () => createKioskWindowOptions({ preloadPath: '/tmp/preload.cjs', isDev: true });

  it('키오스크로 화면을 덮지 않는다', () => {
    const o = dev();
    expect(o.kiosk).toBe(false);
    expect(o.fullscreen).toBe(false);
  });

  it('창 테두리가 있어 옮기고 닫을 수 있다', () => {
    const o = dev();
    expect(o.frame).toBe(true);
    expect(o.resizable).toBe(true);
    expect(o.autoHideMenuBar).toBe(false);
  });

  it('패널 해상도는 그대로다 — 화면 배치가 실기와 달라지면 확인이 무의미해진다', () => {
    const o = dev();
    expect(o.width).toBe(PANEL_WIDTH);
    expect(o.height).toBe(PANEL_HEIGHT);
  });

  it('보안 축은 개발 모드에서도 풀리지 않는다 — 창 모양과 같이 열지 않는다', () => {
    const o = dev();
    expect(o.webPreferences.contextIsolation).toBe(true);
    expect(o.webPreferences.nodeIntegration).toBe(false);
    expect(o.webPreferences.sandbox).toBe(true);
    expect(o.webPreferences.webSecurity).toBe(true);
  });
});

describe('렌더러 보안 축 — 되돌리기 어려운 축이라 잠긴 채여야 한다', () => {
  it('contextIsolation이 켜져 있다', () => {
    expect(options().webPreferences.contextIsolation).toBe(true);
  });

  it('nodeIntegration이 꺼져 있다', () => {
    expect(options().webPreferences.nodeIntegration).toBe(false);
  });

  it('샌드박스와 webSecurity가 켜져 있다', () => {
    const wp = options().webPreferences;
    expect(wp.sandbox).toBe(true);
    expect(wp.webSecurity).toBe(true);
  });

  it('preload 경로가 주입한 값 그대로 실린다 — 통로는 contextBridge 하나뿐이다', () => {
    expect(createKioskWindowOptions({ preloadPath: '/a/b/p.cjs' }).webPreferences.preload).toBe(
      '/a/b/p.cjs',
    );
  });
});
