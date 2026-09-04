/**
 * 시리얼 인쇄 경로 — **프린터의 직렬 포트로 제어 명령(TSPL)을 그대로 흘려보낸다**(#831).
 *
 * ⭐ **왜 드라이버를 거치지 않는가.** 서버가 그린 그림을 드라이버에 넘기는 길이 TTP-247 에서
 *   서지 않았다 — 급지는 되는데 백지가 나왔다(#798 실측 · 세 회차). 같은 프린터에서 드라이버
 *   테스트 페이지는 정상이므로 프린터·용지·리본·농도가 아니라 **그림을 넘기는 경로**가 이
 *   기종과 맞지 않는다. 그래서 프린터가 직접 알아듣는 언어로, 드라이버가 없는 길로 보낸다.
 *
 * ⛔ **여기서 TSPL 을 만들지 않는다.** 이 파일이 아는 것은 「바이트」와 「어느 포트」뿐이다.
 *    서식은 서버가 만들어 내려 준다(설계 결정 18) — 내려 주는 것이 그림에서 명령으로 바뀔 뿐,
 *    셸이 해석하지 않고 넘기기만 하는 것은 그대로다. 서식이 단말에 흩어지면 기종·라벨 규격이
 *    바뀔 때마다 앱을 다시 내야 하고, 단말마다 다른 라벨이 나올 길이 열린다.
 *
 * ⚠ **아직 배선하지 않는다.** 서버가 명령을 내려 줄 자리(계약 `rendition` 의 `format` 축)가
 *   `png|pdf` 뿐이라 명령형 출력물이 셸에 도착할 길이 없다. 그 자리는 서버·계약 소관이며
 *   (#831 완료 조건 ①), 열리면 `silent-print.ts` 가 이 길을 고르게 된다.
 *
 * ⚠ **Windows 전용이다.** 현장 단말이 Windows 이고, 개발 기계(mac)에는 이 포트가 없다.
 */

import { psQuote } from './windows-print';

/**
 * 직렬 포트 설정. **전부 밖에서 준다** — 포트 이름은 단말마다 다르고, 통신 속도·흐름 제어는
 * 프린터 쪽 설정과 **양쪽이 같아야** 통한다. 한쪽만 달라도 글자가 깨지거나 아무것도 안 나온다.
 *
 * ⚠ 기본값은 TSC 출하 기본(9600-8-N-1)이나 **실기에서 확인해야 확정이다** — 프린터 설정
 *   메뉴에서 바뀌어 있을 수 있고, 그때는 여기 값이 아니라 **프린터에 맞춰야** 한다.
 */
export interface SerialPortSettings {
  /** `COM3` 같은 포트 이름. 단말에서 프린터가 잡힌 자리다. */
  portName: string;
  /** 통신 속도. 기본 9600. */
  baudRate?: number;
  /** 패리티 — `None` · `Odd` · `Even` · `Mark` · `Space`. 기본 `None`. */
  parity?: string;
  /** 자료 비트. 기본 8. */
  dataBits?: number;
  /** 정지 비트 — `One` · `Two` · `OnePointFive`. 기본 `One`. */
  stopBits?: string;
  /** 흐름 제어 — `None` · `RequestToSend` · `XOnXOff` 등. 기본 `None`. */
  handshake?: string;
}

export interface SerialPrintJob {
  /** 프린터로 흘려보낼 바이트가 담긴 파일의 절대 경로. */
  dataPath: string;
  /** 어느 포트로 보내는가. */
  port: SerialPortSettings;
  /** 한 걸음의 시간 상한(ms). 프린터가 받지 않으면 여기서 끊는다. */
  timeoutMs: number;
}

const DEFAULTS = {
  baudRate: 9600,
  parity: 'None',
  dataBits: 8,
  stopBits: 'One',
  handshake: 'None',
} as const;

/**
 * 바이트 한 덩이를 직렬 포트로 흘려보내는 스크립트.
 *
 * ⛔ **실패를 종료 코드로 내보낸다.** `$ErrorActionPreference` 는 오류를 「멈추는 오류」로
 *    올릴 뿐 종료 코드를 정하지 않는다. 부르는 쪽은 종료 코드만 보고 성공을 판정하므로,
 *    세우지 않으면 **포트가 없어도 인쇄 성공으로 보인다** — 이슈 #831 완료 조건 ④ 「모르는
 *    것을 통과로 두지 않는다」와 정면으로 어긋난다.
 *
 * ⚠ **쓰기 상한을 건다.** 상한이 없으면 프린터가 받지 않을 때 쓰기가 영영 돌아오지 않아
 *   화면이 「인쇄 중」에 갇힌다 — 성공도 실패도 보이지 않는 자리가 현장에서 가장 먼저 온다.
 *
 * ⚠ **포트를 반드시 닫는다.** 열어 둔 채로 두면 다음 인쇄가 「사용 중」으로 막힌다. 며칠씩
 *   재시작 없이 도는 단말에서 한 번만 새도 그 단말은 그날 인쇄를 못 한다.
 *
 * ⚠ **흐름 제어가 `None` 이면 프린터가 꺼져 있어도 쓰기가 성공한다.** 직렬은 받는 쪽이
 *   대답하지 않는 길이라 이것까지는 여기서 가릴 수 없다 — 실물이 나왔는지는 사람이 본다.
 */
export function buildSerialPrintScript({ dataPath, port, timeoutMs }: SerialPrintJob): string {
  const settings = { ...DEFAULTS, ...port };

  return [
    '$ErrorActionPreference = ' + psQuote('Stop'),
    'try {',
    `  $port = New-Object System.IO.Ports.SerialPort ${psQuote(settings.portName)},${String(settings.baudRate)},${psQuote(settings.parity)},${String(settings.dataBits)},${psQuote(settings.stopBits)}`,
    `  $port.Handshake = ${psQuote(settings.handshake)}`,
    `  $port.WriteTimeout = ${String(timeoutMs)}`,
    `  $bytes = [System.IO.File]::ReadAllBytes(${psQuote(dataPath)})`,
    '  $port.Open()',
    '  try { $port.Write($bytes, 0, $bytes.Length) } finally { $port.Close(); $port.Dispose() }',
    /*
     * ⛔ `Write-Error` 를 쓰지 않는다 — 위의 `Stop` 이 그것마저 멈추는 오류로 올려 `exit` 에
     *    닿지 못한다. 사유를 그대로 stderr 로 흘리고 종료 코드를 세운다.
     */
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }',
  ].join('\n');
}

/** 스크립트를 파일로 두고 부른다 — 명령줄에 길게 실으면 따옴표 처리가 셸마다 갈린다. */
export const serialPrintScriptArgs = (scriptPath: string): string[] => [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  scriptPath,
];

/**
 * 밖에서 준 설정값을 읽는다. **포트 이름이 없으면 시리얼 경로를 쓰지 않는다** — 아무 포트나
 * 골라 보내면 프린터가 아닌 장치에 명령이 들어간다.
 *
 * ⚠ 숫자 자리에 숫자가 아닌 값이 오면 **기본값으로 슬쩍 넘어가지 않고 던진다.** 통신 속도가
 *   조용히 9600 으로 되돌아가면 프린터 설정과 어긋난 채로 「인쇄는 됐는데 안 나온다」가 된다.
 */
export function readSerialPortSettings(
  env: Record<string, string | undefined>,
): SerialPortSettings | undefined {
  const portName = env.POP_PRINTER_PORT?.trim();

  if (portName === undefined || portName === '') return undefined;

  return {
    portName,
    baudRate: numberOf(env.POP_PRINTER_BAUD, 'POP_PRINTER_BAUD'),
    parity: blankToUndefined(env.POP_PRINTER_PARITY),
    dataBits: numberOf(env.POP_PRINTER_DATA_BITS, 'POP_PRINTER_DATA_BITS'),
    stopBits: blankToUndefined(env.POP_PRINTER_STOP_BITS),
    handshake: blankToUndefined(env.POP_PRINTER_HANDSHAKE),
  };
}

export class InvalidSerialSettingError extends Error {
  constructor(name: string, value: string) {
    super(`${name} 는 숫자여야 한다: ${value}`);
    this.name = 'InvalidSerialSettingError';
  }
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

function numberOf(value: string | undefined, name: string): number | undefined {
  const trimmed = blankToUndefined(value);

  if (trimmed === undefined) return undefined;

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed <= 0) throw new InvalidSerialSettingError(name, trimmed);

  return parsed;
}
