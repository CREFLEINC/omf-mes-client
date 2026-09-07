import { describe, expect, it } from 'vitest';

import {
  buildListPrintersScript,
  buildRawPrintScript,
  rawPrintScriptArgs,
} from './raw-print';

describe('원시 바이트 전송 스크립트', () => {
  const job = { dataPath: 'C:\\job\\label.prn', jobName: 'LOT-1' };

  it('지정한 프린터의 대기열을 연다', () => {
    expect(buildRawPrintScript({ ...job, deviceName: 'TSC TTP-247' })).toContain(
      "GetPrintQueue('TSC TTP-247')",
    );
  });

  // ⭐ 지정이 없으면 어느 것이 기본인지 우리가 알아내지 않는다 — OS 가 안다.
  it('지정이 없으면 OS 기본 대기열에 맡긴다', () => {
    const script = buildRawPrintScript(job);

    expect(script).toContain('DefaultPrintQueue');
    expect(script).not.toContain('GetPrintQueue');
  });

  // ⛔ 이름에 따옴표가 섞여도 스크립트가 갈라지면 안 된다.
  it('프린터 이름의 작은따옴표를 벗어난다', () => {
    expect(buildRawPrintScript({ ...job, deviceName: "Sam's TSC" })).toContain(
      "GetPrintQueue('Sam''s TSC')",
    );
  });

  /*
   * ⭐ 이 길의 존재 이유가 여기다 — 대기열에 바이트를 그대로 넣는다. 그림으로 바꾸는 단계가
   *    끼면 백지가 나온 종전 경로로 되돌아간다.
   */
  it('바이트를 그대로 대기열에 넣는다', () => {
    const script = buildRawPrintScript(job);

    expect(script).toContain("ReadAllBytes('C:\\job\\label.prn')");
    expect(script).toContain('$stream.Write($bytes, 0, $bytes.Length)');
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

  it('작업 이름을 대기열에 싣는다', () => {
    expect(buildRawPrintScript(job)).toContain("AddJob('LOT-1')");
  });

  // ⚠ 닫지 않으면 열린 작업이 대기열에 남아 다음 인쇄가 그 뒤에 선다.
  it('실패해도 흐름을 닫는다', () => {
    expect(buildRawPrintScript(job)).toContain('finally { $stream.Close(); $stream.Dispose() }');
  });

  /*
   * ⛔ 흐름을 그냥 닫으면 그때까지 쓴 바이트가 **확정 전송**된다 — 잘린 TSPL 이 나가 반쪽
   *    라벨이 찍히거나 프린터가 뒤 바이트를 기다리며 선다. 그리고 셸은 실패로 표시하니
   *    작업자가 다시 눌러 중복 라벨까지 나온다.
   */
  it('쓰다가 깨지면 작업을 버린다 — 잘린 라벨을 내보내지 않는다', () => {
    const script = buildRawPrintScript(job);

    expect(script).toContain('catch { $stream.Abort(); throw }');
    expect(script.indexOf('$stream.Abort()')).toBeLessThan(script.indexOf('$stream.Close()'));
  });

  /* ⛔ 값 셋 모두 스크립트 문자열에 박힌다 — 하나만 막으면 나머지로 스크립트가 갈라진다. */
  it.each([
    ['자료 경로', { ...job, dataPath: "C:\\it's\\label.prn" }, "'C:\\it''s\\label.prn'"],
    ['작업 이름', { ...job, jobName: "LOT'1" }, "'LOT''1'"],
  ])('%s 의 작은따옴표를 벗어난다', (_name, given, expected) => {
    expect(buildRawPrintScript(given)).toContain(expected);
  });

  /* ⚠ 문자열 조각 대조만으로는 구문이 깨진 스크립트를 못 잡는다. 여닫는 짝을 센다. */
  it('구문 균형이 맞는다 — 여는 만큼 닫는다', () => {
    const script = buildRawPrintScript(job);

    expect(script.split('{').length).toBe(script.split('}').length);
    expect(script).toMatch(/^\$ErrorActionPreference/);
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
    expect(script).toContain('(기본)');
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
