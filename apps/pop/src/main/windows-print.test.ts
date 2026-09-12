import { describe, expect, it } from 'vitest';

import {
  buildDefaultPrinterScript,
  buildPrintScript,
  parseDefaultPrinterName,
  printScriptArgs,
  psQuote,
} from './windows-print';

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

/**
 * 기본 프린터를 묻는 자리(#1098).
 *
 * ⭐ **왜 감지기를 두는가.** 이 값이 틀리면 라벨이 «가상 프린터»로 가고, 그 드라이버의 저장
 * 대화상자가 키오스크 창 뒤에 깔려 **단말이 멈춘다** — 실기에서 실제로 났다. 화면에는 아무
 * 오류도 뜨지 않아 시험이 없으면 다음에도 같은 방식으로 되돌아간다.
 */
describe('기본 프린터 조회', () => {
  it('인쇄가 쓰는 것과 같은 출처에 묻는다 — PrinterSettings 의 기본값', () => {
    const script = buildDefaultPrinterScript();

    expect(script).toContain('System.Drawing.Printing.PrinterSettings');
    expect(script).toContain('$s.PrinterName');
  });

  it('⛔ WMI 로 따로 묻지 않는다 — 답이 갈릴 여지를 두지 않는다', () => {
    expect(buildDefaultPrinterScript()).not.toContain('Win32_Printer');
  });

  it('이름을 읽는다 — 앞뒤 공백과 줄바꿈을 털어 낸다', () => {
    expect(parseDefaultPrinterName('  HPRT HT800 \r\n')).toBe('HPRT HT800');
  });

  it('여러 줄이 와도 첫 줄만 쓴다', () => {
    expect(parseDefaultPrinterName('HPRT HT800\n경고: 어쩌고')).toBe('HPRT HT800');
  });

  it('⛔ 빈 줄을 이름으로 쓰지 않는다 — 프린터가 없는 단말에서 빈 문자열이 온다', () => {
    expect(parseDefaultPrinterName('')).toBeNull();
    expect(parseDefaultPrinterName('   \n')).toBeNull();
  });
});
