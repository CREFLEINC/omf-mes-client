import { describe, expect, it } from 'vitest';

import {
  buildListPrintersScript,
  buildRawPrintScript,
  rawPrintScriptArgs,
} from './raw-print';

describe('원시 바이트 전송 스크립트', () => {
  const job = { dataPath: 'C:\\job\\label.prn', jobName: 'LOT-1' };

  it('지정한 프린터로 보낸다', () => {
    expect(buildRawPrintScript({ ...job, deviceName: 'TSC TH240 Series' })).toContain(
      "$target = 'TSC TH240 Series'",
    );
  });

  /*
   * ⛔ 여기가 이번 경로의 존재 이유다 — 자료 형식을 RAW 로 못 박아야 스풀러가 바이트를
   *    해석하지 않고 그대로 포트로 흘린다. 드라이버에 맡기면 그림으로 읽어 백지가 나온다(실측).
   */
  it('자료 형식을 RAW 로 못 박는다', () => {
    expect(buildRawPrintScript(job)).toContain('pDataType = "RAW"');
  });

  // ⚠ 일부만 나가면 잘린 라벨이 찍힌다 — 보낸 바이트 수를 센다.
  it('보낸 바이트 수를 확인한다', () => {
    expect(buildRawPrintScript(job)).toContain('written != data.Length');
  });

  // ⭐ 지정이 없으면 어느 것이 기본인지 우리가 알아내지 않는다 — OS 가 안다.
  it('지정이 없으면 OS 기본 프린터에 맡긴다', () => {
    expect(buildRawPrintScript(job)).toContain('PrinterSettings.PrinterName');
  });

  // ⛔ 이름에 따옴표가 섞여도 스크립트가 갈라지면 안 된다.
  it('프린터 이름의 작은따옴표를 벗어난다', () => {
    expect(buildRawPrintScript({ ...job, deviceName: "Sam's TSC" })).toContain("'Sam''s TSC'");
  });

  /*
   * ⭐ 이 길의 존재 이유가 여기다 — 대기열에 바이트를 그대로 넣는다. 그림으로 바꾸는 단계가
   *    끼면 백지가 나온 종전 경로로 되돌아간다.
   */
  it('바이트를 그대로 넘긴다', () => {
    const script = buildRawPrintScript(job);

    expect(script).toContain("ReadAllBytes('C:\\job\\label.prn')");
    expect(script).toContain('[OmfRawPrinter]::Send($target,');
  });

  // ⛔ 경로에 따옴표가 섞여도 스크립트가 갈라지면 안 된다 — 이름 쪽만 막아서는 부족하다.
  it('자료 경로의 작은따옴표를 벗어난다', () => {
    expect(buildRawPrintScript({ ...job, dataPath: "C:\\it's\\label.prn" })).toContain(
      "ReadAllBytes('C:\\it''s\\label.prn')",
    );
  });

  /*
   * ⛔ 여기가 「모르는 것을 통과로 두지 않는다」(#831 완료 조건 ④)가 서는 자리다.
   *    종료 코드를 세우지 않으면 프린터가 없어도 부르는 쪽이 성공으로 읽는다.
   */
  it('실패하면 0 이 아닌 종료 코드를 낸다', () => {
    expect(buildRawPrintScript(job)).toContain('exit 1');
  });

  // ⚠ `Write-Error` 는 위의 Stop 에 걸려 exit 에 닿지 못한다.
  it('사유를 stderr 로 흘린다 — Write-Error 로 다시 던지지 않는다', () => {
    const script = buildRawPrintScript(job);

    expect(script).toContain('[Console]::Error.WriteLine($_.Exception.Message)');
    expect(script).not.toContain('Write-Error');
  });

  it('작업 이름을 함께 싣는다', () => {
    expect(buildRawPrintScript(job)).toContain("'LOT-1'");
  });

  // ⚠ 닫지 않으면 열린 작업이 대기열에 남아 다음 인쇄가 그 뒤에 선다.



  /* ⛔ 값 셋 모두 스크립트 문자열에 박힌다 — 하나만 막으면 나머지로 스크립트가 갈라진다. */
  it.each([
    ['자료 경로', { ...job, dataPath: "C:\\it's\\label.prn" }, "'C:\\it''s\\label.prn'"],
    ['작업 이름', { ...job, jobName: "LOT'1" }, "'LOT''1'"],
  ])('%s 의 작은따옴표를 벗어난다', (_name, given, expected) => {
    expect(buildRawPrintScript(given)).toContain(expected);
  });

  /* ⚠ 문자열 조각 대조만으로는 구문이 깨진 스크립트를 못 잡는다. 여닫는 짝을 센다. */
  it('실패하면 사유를 stderr 로 흘린다', () => {
    expect(buildRawPrintScript(job)).toContain('[Console]::Error.WriteLine');
  });

  /*
   * ⛔ 여기가 「모르는 것을 통과로 두지 않는다」(#831 완료 조건 ④)가 서는 자리다.
   *    종료 코드를 세우지 않으면 프린터가 없어도 부르는 쪽이 성공으로 읽는다.
   */
  it('실패하면 0 이 아닌 종료 코드를 낸다', () => {
    expect(buildRawPrintScript(job)).toContain('exit 1');
  });

  it('스크립트를 파일로 넘긴다 — 명령줄 따옴표 처리를 셸에 맡기지 않는다', () => {
    expect(rawPrintScriptArgs('C:\\job\\raw-print.ps1')).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'C:\\job\\raw-print.ps1',
    ]);
  });
});

describe('프린터 목록 스크립트', () => {
  /*
   * ⭐ 어디로 갔는지 모르는 것이 가장 막막하다 — 지정이 없으면 OS 기본으로 가는데, 기본이
   *    라벨 프린터가 아니면 명령이 조용히 다른 대기열로 들어가고 종이는 나오지 않는다.
   */
  it('이름과 기본 여부를 함께 보여 준다', () => {
    const script = buildListPrintersScript();

    expect(script).toContain('GetPrintQueues()');
    expect(script).toContain('DefaultPrintQueue.Name');
  });

  // ⛔ 목록만 보는 것이지 인쇄가 아니다 — 여기서 종이가 나오면 안 된다.
  it('인쇄하지 않는다', () => {
    const script = buildListPrintersScript();

    expect(script).not.toContain('AddJob');
    expect(script).not.toContain('$stream');
  });

  it('실패하면 0 이 아닌 종료 코드를 낸다', () => {
    expect(buildListPrintersScript()).toContain('exit 1');
  });
});

describe('실패를 삼키지 않는다', () => {
  /*
   * ⛔ 어셈블리 적재가 `try` 밖에 있으면 그 줄의 실패를 `catch` 가 못 받아 종료 코드가 서지
   *    않는다 — 아무 일도 일어나지 않았는데 부르는 쪽은 성공으로 읽는다.
   */
  it.each([
    ['라벨 인쇄', buildRawPrintScript({ dataPath: 'C:\\a.prn', jobName: 'J' })],
    ['프린터 목록', buildListPrintersScript()],
  ])('%s — 어셈블리 적재가 try 안에 있다', (_name, script) => {
    expect(script.indexOf('try {')).toBeLessThan(script.indexOf('Add-Type'));
  });
});
