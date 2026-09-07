/**
 * 원시 바이트 전송 경로 — **드라이버의 그리기를 건너뛰고 프린터로 바이트를 그대로 민다**(#831).
 *
 * ⭐ **왜 필요한가.** 그림을 드라이버에 넘기는 길(`windows-print.ts`)이 TTP-247 에서 서지 않았다
 *   — 급지는 되는데 백지가 나왔다(#798 실측 · 세 회차). 같은 프린터에서 드라이버 테스트 페이지는
 *   정상이므로 프린터·용지·리본·농도가 아니라 **그림을 넘기는 경로**가 이 기종과 맞지 않는다.
 *   그래서 프린터가 직접 알아듣는 제어 언어(TSPL)를 **스풀러의 RAW 자리**로 보낸다.
 *   설계 §3.4 가 열어 둔 「Windows 스풀러 또는 TSPL raw」의 뒤쪽이다.
 *
 * ⛔ **여기서 TSPL 을 만들지 않는다.** 이 파일이 아는 것은 「바이트」와 「어느 프린터」뿐이다.
 *    서식은 서버가 만들어 내려 준다(설계 결정 18) — 내려 주는 것이 그림에서 명령으로 바뀔 뿐,
 *    셸이 해석하지 않고 넘기기만 하는 것은 그대로다. 서식이 단말에 흩어지면 기종·라벨 규격이
 *    바뀔 때마다 앱을 다시 내야 하고, 단말마다 다른 라벨이 나올 길이 열린다.
 *
 * ⭐ **왜 직렬이 아니라 스풀러인가.** TTP-247 을 USB 로 꽂으면 윈도가 「프린터」로 잡고
 *   **COM 포트를 만들지 않는다**(실기 확인 — 장치 관리자에 뜬 LPT1 은 메인보드의 병렬 포트라
 *   프린터와 무관하다). 직렬로 보내려면 단말마다 가상 COM 드라이버를 깔아야 하는데, 스풀러
 *   경로는 지금 연결 그대로 통한다. 설계 §3.4 가 열어 둔 두 갈래 중 앞쪽이다.
 *
 * ⚠ **명령형 출력물은 아직 서버에서 오지 않는다.** 계약 `rendition` 의 `format` 축이
 *   `png|pdf` 뿐이라(#831 완료 조건 ① · 서버 소관) 지금 이 길로 가는 것은 라벨 명령
 *   (`label-command`)뿐이다. 계약이 열리면 `silent-print.ts` 의 명령형 분기가 같은 길을 쓴다.
 *
 * ⚠ **Windows 전용이다.** 현장 단말이 Windows 이고 스풀러의 RAW 자리는 Windows 것이다.
 */

import { psQuote } from './windows-print';

/** 대기열을 다루는 스크립트의 머리. `LocalPrintServer`·`PrintQueue` 가 이 어셈블리에 있다. */
const PRINT_SERVER_HEAD = [
  '$ErrorActionPreference = ' + psQuote('Stop'),
  'Add-Type -AssemblyName System.Printing',
  'try {',
];

/**
 * 대기열로 한 덩이를 보내는 길. 구현은 `index.ts` 가 준다(스크립트를 써서 PowerShell 로).
 */
export interface RawPrinter {
  print(job: { dataPath: string; jobName: string }): Promise<void>;
}

/**
 * 보낼 대기열이 없다. **개발 기계(mac 등)이거나 단말에 프린터가 하나도 없을 때다.**
 *
 * ⛔ 이때 그림 인쇄 경로로 흘려보내지 않는다 — 드라이버가 TSPL 명령을 그림으로 읽어 아무
 *    말이나 찍거나 빈 라벨을 뽑는다. 나온 종이는 자재에 붙어 되돌릴 수 없다(F-6 · 완료 조건 ④).
 */
export class RawPrinterUnavailableError extends Error {
  constructor() {
    super('라벨을 보낼 프린터를 찾을 수 없다 — 이 단말에 등록된 프린터가 없다');
    this.name = 'RawPrinterUnavailableError';
  }
}

export interface RawPrintJob {
  /** 프린터로 밀어 넣을 바이트가 담긴 파일의 절대 경로. */
  dataPath: string;
  /** 보낼 프린터. 주지 않으면 **OS 기본 프린터**로 간다. */
  deviceName?: string;
  /** 인쇄 작업 이름 — 대기열에서 사람이 알아보는 값이다. */
  jobName: string;
}

/**
 * 바이트 한 덩이를 대기열에 **RAW 로** 넣는 스크립트.
 *
 * ⭐ `AddJob(작업이름)` 이 여는 흐름에는 **XPS 변환이 끼지 않는다** — 넣은 바이트가 그대로
 *   스풀에 실린다. 그림 인쇄(`System.Drawing.Printing`)와 다른 점이 이것이다.
 *   ⚠ 다만 스풀 자료형을 EMF 로 잡아 둔 대기열에서는 스풀러가 그 바이트를 그림으로 읽으려
 *   든다 — 「어떤 설정에서도 RAW」가 아니라 **대기열이 RAW 로 스풀할 때** 성립한다.
 *   TSC 드라이버는 통상 RAW 로 스풀하므로 대상 기종에서는 통한다(실기 확인 대상).
 *
 * ⛔ **실패를 종료 코드로 내보낸다.** `$ErrorActionPreference` 는 오류를 「멈추는 오류」로
 *    올릴 뿐 종료 코드를 정하지 않는다. 부르는 쪽(`execFile`)은 종료 코드만 보고 성공을
 *    판정하므로, 세우지 않으면 **프린터가 없어도 인쇄 성공으로 보인다** — 이슈 #831 완료
 *    조건 ④ 「모르는 것을 통과로 두지 않는다」와 정면으로 어긋난다.
 *
 * ⚠ **흐름을 반드시 닫는다**(`Dispose`). 닫지 않으면 대기열에 작업이 열린 채 남아 다음 인쇄가
 *   그 뒤에 서고, 며칠씩 도는 단말에서 쌓인다.
 * ⚠ **기본 프린터도 OS 에 맡긴다.** 어느 것이 기본인지는 Windows 가 알고, 우리가 목록에서
 *   알아내려다 있지도 않은 항목을 읽어 전부 막은 적이 있다(`silent-print.ts` 실측).
 */
export function buildRawPrintScript({ dataPath, deviceName, jobName }: RawPrintJob): string {
  const chooseQueue =
    deviceName === undefined
      ? '$queue = $server.DefaultPrintQueue'
      : `$queue = $server.GetPrintQueue(${psQuote(deviceName)})`;

  return [
    ...PRINT_SERVER_HEAD,
    '  $server = New-Object System.Printing.LocalPrintServer',
    '  ' + chooseQueue,
    `  $bytes = [System.IO.File]::ReadAllBytes(${psQuote(dataPath)})`,
    `  $job = $queue.AddJob(${psQuote(jobName)})`,
    '  $stream = $job.JobStream',
    /*
     * ⛔ **깨지면 작업을 버린다.** 대기열 흐름은 닫을 때 그때까지 쓴 바이트를 **확정 전송**
     *    한다 — 그냥 닫으면 잘린 TSPL 이 프린터로 나가 반쪽 라벨이 찍히거나 프린터가 뒤
     *    바이트를 기다리며 선다. 그리고 셸은 실패로 표시하니 작업자가 다시 눌러 **중복 라벨**
     *    까지 나온다. `Abort` 가 그 작업을 취소한다.
     */
    '  try { $stream.Write($bytes, 0, $bytes.Length) }',
    '  catch { $stream.Abort(); throw }',
    '  finally { $stream.Close(); $stream.Dispose() }',
    /*
     * ⛔ `Write-Error` 를 쓰지 않는다 — 위의 `Stop` 이 그것마저 멈추는 오류로 올려 `exit` 에
     *    닿지 못한다. 사유를 그대로 stderr 로 흘리고 종료 코드를 세운다.
     */
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }',
  ].join('\n');
}

/** 스크립트를 파일로 두고 부른다 — 명령줄에 길게 실으면 따옴표 처리가 셸마다 갈린다. */
export const rawPrintScriptArgs = (scriptPath: string): string[] => [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  scriptPath,
];

/**
 * 단말에 등록된 프린터를 훑는 스크립트.
 *
 * ⭐ **어디로 갔는지 모르는 것이 가장 막막하다.** 지정하지 않으면 OS 기본 프린터로 가는데,
 *   기본이 라벨 프린터가 아니면 명령이 조용히 다른 대기열로 들어가고 종이는 나오지 않는다.
 *   그때 현장에서 확인할 수단이 필요하다 — 이름과 기본 여부를 그대로 보여 준다.
 */
export function buildListPrintersScript(): string {
  return [
    ...PRINT_SERVER_HEAD,
    '  $server = New-Object System.Printing.LocalPrintServer',
    '  $default = $server.DefaultPrintQueue.Name',
    '  foreach ($q in $server.GetPrintQueues()) {',
    /* 기본 프린터에 표를 달아 준다 — 목록만으로는 어디로 가는지 알 수 없다. */
    '    $mark = if ($q.Name -eq $default) { " (기본)" } else { "" }',
    '    [Console]::Out.WriteLine($q.Name + $mark)',
    '  }',
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }',
  ].join('\n');
}
