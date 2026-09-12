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

/**
 * 실패를 삼키지 않는가(#1102).
 *
 * ⭐ **이 묶음이 실기에서 라벨을 못 나오게 한 «침묵»을 문다.** 종전 스크립트는 `catch` 도
 * `exit` 도 없어, 그림을 못 읽든 프린터가 없든 앱에는 성공으로 돌아왔다 — 화면은
 * 「인쇄했습니다」를 냈고 인쇄 대기열에는 작업조차 없었다(2026-09-12 실기).
 */
describe('그림 인쇄 — 실패를 알린다', () => {
  const script = (): string =>
    buildPrintScript({
      imagePath: 'C:\\job\\label.png',
      deviceName: 'HPRT HT800',
      jobName: 'LOT-1',
    });

  it('⛔ 실패하면 종료 코드를 세운다 — 종료 코드만 보는 부르는 쪽에 실패가 건너간다', () => {
    expect(script()).toContain('exit 1');
  });

  it('사유를 표준 오류로 남긴다 — 기록에 그 문장이 적힌다', () => {
    expect(script()).toContain('[Console]::Error.WriteLine($_.Exception.Message)');
  });

  it('⛔ Write-Error 를 쓰지 않는다 — Stop 이 그것마저 올려 exit 에 닿지 못한다', () => {
    expect(script()).not.toContain('Write-Error');
  });

  it('그림 읽기와 프린터 준비가 모두 try 안에 있다 — 인쇄 직전의 실패도 잡힌다', () => {
    const built = script();
    const tryAt = built.indexOf('try {');
    const catchAt = built.indexOf('} catch');

    expect(tryAt).toBeGreaterThanOrEqual(0);
    expect(built.indexOf('FromFile')).toBeGreaterThan(tryAt);
    expect(built.indexOf('FromFile')).toBeLessThan(catchAt);
    expect(built.indexOf('$doc.Print()')).toBeLessThan(catchAt);
  });

  /**
   * ⛔ `PrinterName` 은 없는 이름을 넣어도 그 자리에서 던지지 않는다 — `Print()` 에 가서야
   *    죽고, 그때의 예외는 「프린터를 찾을 수 없다」로 읽히지 않는다.
   */
  it('프린터 이름을 세운 뒤 유효한지 확인한다', () => {
    const built = script();

    expect(built).toContain('$doc.PrinterSettings.IsValid');
    expect(built.indexOf('IsValid')).toBeLessThan(built.indexOf('$doc.Print()'));
  });

  it('이름을 주지 않으면 유효성 검사도 세우지 않는다 — OS 기본으로 가는 길이다', () => {
    const built = buildPrintScript({ imagePath: 'C:\\a.png', jobName: 'LOT-1' });

    expect(built).not.toContain('IsValid');
    expect(built).toContain('exit 1');
  });

  it('끝나면 그림과 문서를 놓아 준다 — 실패한 회차에도 놓는다', () => {
    const built = script();

    expect(built).toContain('finally {');
    expect(built.indexOf('finally {')).toBeGreaterThan(built.indexOf('} catch'));
    expect(built).toContain('$image.Dispose()');
  });
});
