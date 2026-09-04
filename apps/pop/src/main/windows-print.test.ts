import { describe, expect, it } from 'vitest';

import { buildPrintScript, printScriptArgs, psQuote } from './windows-print';

describe('Windows 인쇄 스크립트', () => {
  // ⛔ 경로에 따옴표가 섞여도 스크립트가 갈라지면 안 된다.
  it('작은따옴표를 벗어난다', () => {
    expect(psQuote("C:\\it's\\a.png")).toBe("'C:\\it''s\\a.png'");
  });

  it('지정한 프린터로 보낸다', () => {
    expect(
      buildPrintScript({ imagePath: 'C:\\a.png', deviceName: 'TSC TH240', jobName: 'LOT-1' }),
    ).toContain("PrinterName = 'TSC TH240'");
  });

  // ⭐ 지정이 없으면 프린터를 정하지 않는다 — 그래야 OS 기본으로 간다.
  it('지정이 없으면 프린터를 정하지 않는다', () => {
    expect(buildPrintScript({ imagePath: 'C:\\a.png', jobName: 'LOT-1' })).not.toContain(
      'PrinterName',
    );
  });

  /*
   * ⛔ 이 셋이 「급지는 되는데 백지」를 막는다 — 대지 전체에 그리고, 대화상자를 띄우지 않으며,
   *    끝나면 파일을 놓아 준다.
   */
  it('대지 전체에 그린다 — 여백 영역에 그리면 라벨이 잘린다', () => {
    const script = buildPrintScript({ imagePath: 'C:\\a.png', jobName: 'LOT-1' });

    expect(script).toContain('$e.PageBounds');
    expect(script).not.toContain('MarginBounds');
  });

  it('대화상자를 띄우지 않는다', () => {
    expect(buildPrintScript({ imagePath: 'C:\\a.png', jobName: 'LOT-1' })).toContain(
      'StandardPrintController',
    );
  });

  it('끝나면 그림과 문서를 놓아 준다', () => {
    expect(buildPrintScript({ imagePath: 'C:\\a.png', jobName: 'LOT-1' })).toContain('Dispose');
  });

  it('스크립트를 파일로 넘긴다 — 명령줄 따옴표 처리를 셸에 맡기지 않는다', () => {
    expect(printScriptArgs('C:\\job\\print.ps1')).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'C:\\job\\print.ps1',
    ]);
  });
});
