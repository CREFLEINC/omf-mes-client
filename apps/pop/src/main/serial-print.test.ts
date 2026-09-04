import { describe, expect, it } from 'vitest';

import {
  InvalidSerialSettingError,
  buildSerialPrintScript,
  readSerialPortSettings,
  readSerialPortSettingsFile,
  serialPrintScriptArgs,
} from './serial-print';

const job = {
  dataPath: 'C:\\job\\label.prn',
  port: { portName: 'COM3' },
  timeoutMs: 30_000,
};

describe('시리얼 인쇄 스크립트', () => {
  it('지정한 포트를 연다', () => {
    expect(buildSerialPrintScript(job)).toContain("SerialPort 'COM3',9600,'None',8,'One'");
  });

  it('밖에서 준 통신 설정을 그대로 싣는다 — 프린터 설정과 맞춰야 통한다', () => {
    const script = buildSerialPrintScript({
      ...job,
      port: {
        portName: 'COM7',
        baudRate: 115_200,
        parity: 'Even',
        dataBits: 7,
        stopBits: 'Two',
        handshake: 'RequestToSend',
      },
    });

    expect(script).toContain("SerialPort 'COM7',115200,'Even',7,'Two'");
    expect(script).toContain("$port.Handshake = 'RequestToSend'");
  });

  it('바이트를 그대로 흘려보낸다', () => {
    const script = buildSerialPrintScript(job);

    expect(script).toContain("ReadAllBytes('C:\\job\\label.prn')");
    expect(script).toContain('$port.Write($bytes, 0, $bytes.Length)');
  });

  /*
   * ⛔ 값 셋 모두 스크립트 문자열에 박힌다 — 하나만 막으면 나머지로 스크립트가 갈라진다.
   *    종전 회차에서 한 값만 시험이 있어 나머지의 회귀를 못 잡았다.
   */
  it.each([
    ['포트 이름', { ...job, port: { portName: "COM'3" } }, "'COM''3'"],
    ['자료 경로', { ...job, dataPath: "C:\\it's\\label.prn" }, "'C:\\it''s\\label.prn'"],
    ['패리티', { ...job, port: { portName: 'COM3', parity: "O'dd" } }, "'O''dd'"],
  ])('%s 의 작은따옴표를 벗어난다', (_name, given, expected) => {
    expect(buildSerialPrintScript(given)).toContain(expected);
  });

  /*
   * ⛔ 여기가 「모르는 것을 통과로 두지 않는다」(#831 완료 조건 ④)가 서는 자리다.
   *    포트가 없거나 프린터가 받지 않는 것을 성공으로 두면 라벨 없이 다음 단계로 넘어간다.
   */
  it('실패하면 0 이 아닌 종료 코드를 낸다', () => {
    expect(buildSerialPrintScript(job)).toContain('exit 1');
  });

  it('쓰기에 상한을 건다 — 프린터가 받지 않으면 끊는다', () => {
    expect(buildSerialPrintScript({ ...job, timeoutMs: 5_000 })).toContain(
      '$port.WriteTimeout = 5000',
    );
  });

  // ⚠ 열어 둔 채 두면 다음 인쇄가 「사용 중」으로 막힌다.
  it('실패해도 포트를 닫는다', () => {
    expect(buildSerialPrintScript(job)).toContain('finally { $port.Close(); $port.Dispose() }');
  });

  /*
   * ⚠ 문자열 조각 대조만으로는 **구문이 깨진 스크립트**를 못 잡는다(종전 회차 뮤테이션에서
   *   여는 괄호를 지워도 시험이 전부 통과했다). 여닫는 짝을 세어 균형을 본다.
   */
  it('구문 균형이 맞는다 — 여는 만큼 닫는다', () => {
    const script = buildSerialPrintScript(job);

    expect(script.split('{').length).toBe(script.split('}').length);
    expect(script).toMatch(/^\$ErrorActionPreference/);
  });

  it('스크립트를 파일로 넘긴다 — 명령줄 따옴표 처리를 셸에 맡기지 않는다', () => {
    expect(serialPrintScriptArgs('C:\\job\\serial-print.ps1')).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'C:\\job\\serial-print.ps1',
    ]);
  });
});

describe('시리얼 설정 읽기', () => {
  // ⛔ 포트를 모르면 시리얼로 보내지 않는다 — 아무 포트나 고르면 다른 장치로 명령이 들어간다.
  it.each([[{}], [{ POP_PRINTER_PORT: '   ' }]])('포트 이름이 없으면 쓰지 않는다', (env) => {
    expect(readSerialPortSettings(env)).toBeUndefined();
  });

  it('준 값만 싣는다 — 나머지는 기본값에 맡긴다', () => {
    expect(readSerialPortSettings({ POP_PRINTER_PORT: 'COM3', POP_PRINTER_BAUD: '19200' })).toEqual({
      portName: 'COM3',
      baudRate: 19_200,
      parity: undefined,
      dataBits: undefined,
      stopBits: undefined,
      handshake: undefined,
    });
  });

  /*
   * ⛔ 잘못 적힌 통신 속도를 조용히 기본값으로 되돌리지 않는다. 프린터 설정과 어긋난 채로
   *    「인쇄는 됐는데 안 나온다」가 되고, 그때 사람이 볼 단서가 아무 데도 없다.
   */
  it.each([['NINE'], ['0'], ['9.6']])('숫자가 아닌 통신 속도는 던진다 (%s)', (value) => {
    expect(() => readSerialPortSettings({ POP_PRINTER_PORT: 'COM3', POP_PRINTER_BAUD: value })).toThrow(
      InvalidSerialSettingError,
    );
  });
});

describe('설정 파일에서 읽기', () => {
  it('파일 값을 환경값과 같은 규칙으로 읽는다', () => {
    expect(
      readSerialPortSettingsFile({ port: 'COM5', baud: 19200, handshake: 'RequestToSend' }),
    ).toEqual({
      portName: 'COM5',
      baudRate: 19_200,
      parity: undefined,
      dataBits: undefined,
      stopBits: undefined,
      handshake: 'RequestToSend',
    });
  });

  it.each([[null], ['COM3'], [{}], [{ port: '  ' }]])(
    '포트를 알 수 없으면 쓰지 않는다 (%s)',
    (source) => {
      expect(readSerialPortSettingsFile(source)).toBeUndefined();
    },
  );

  // ⛔ 파일 쪽만 검사가 느슨하면 그쪽으로 잘못된 값이 새어 들어온다.
  it('잘못 적힌 값은 파일에서도 던진다', () => {
    expect(() => readSerialPortSettingsFile({ port: 'COM3', baud: 'fast' })).toThrow(
      InvalidSerialSettingError,
    );
  });
});
