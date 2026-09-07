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

/**
 * 스풀러에 **자료 형식을 `RAW` 로 못 박아** 바이트를 넣는 도우미(C#).
 *
 * ⭐ **왜 P/Invoke 인가.** 종전에는 `PrintQueue.AddJob` 을 썼는데, 실기에서 작업은 성공으로
 *   끝나고 대기열도 비었는데 **종이가 나오지 않았다**. 윈도 테스트 페이지는 정상이므로 대기열
 *   에서 프린터까지는 살아 있고, 드라이버가 우리 바이트를 그림으로 해석해 버린 것이다.
 *   `StartDocPrinter` 에 `pDataType = "RAW"` 를 직접 실으면 스풀러가 **해석하지 않고 그대로**
 *   포트로 흘린다 — 드라이버 설정에 좌우되지 않는다.
 *
 * ⛔ **메시지를 영문으로 둔다.** PowerShell 5.1 은 `.ps1` 을 ANSI 로 읽어 한글이 깨지고,
 *    깨진 사유는 사유가 아니다.
 * ⚠ **몇 바이트를 보냈는지 세어 확인한다.** 일부만 나가면 잘린 라벨이 찍힌다.
 */
const RAW_PRINTER_HELPER = String.raw`
using System;
using System.Runtime.InteropServices;
public static class OmfRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DocInfo di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, IntPtr bytes, int count, out int written);

  static void Fail(string what) {
    throw new Exception(what + " (win32 error " + Marshal.GetLastWin32Error() + ")");
  }

  public static void Send(string printer, string job, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) Fail("cannot open printer: " + printer);
    try {
      DocInfo di = new DocInfo();
      di.pDocName = job;
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) Fail("cannot start document");
      try {
        if (!StartPagePrinter(h)) Fail("cannot start page");
        IntPtr buffer = Marshal.AllocCoTaskMem(data.Length);
        try {
          Marshal.Copy(data, 0, buffer, data.Length);
          int written;
          if (!WritePrinter(h, buffer, data.Length, out written)) Fail("cannot write to printer");
          if (written != data.Length) {
            throw new Exception("sent only " + written + " of " + data.Length + " bytes");
          }
        } finally { Marshal.FreeCoTaskMem(buffer); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
`;

/** 대기열 목록을 다루는 스크립트의 머리. `LocalPrintServer` 가 이 어셈블리에 있다. */
const PRINT_SERVER_HEAD = [
  '$ErrorActionPreference = ' + psQuote('Stop'),
  'try {',
  '  Add-Type -AssemblyName System.Printing',
];

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
 * ⭐ **자료 형식을 `RAW` 로 못 박는다.** 스풀러는 형식을 보고 「해석할 것인가 그대로 흘릴
 *   것인가」를 정하는데, 그 판단을 드라이버 설정에 맡기면 우리 명령을 그림으로 읽는다 —
 *   실기에서 작업은 성공으로 끝나고 대기열도 비었는데 **종이가 나오지 않았다**. 형식을
 *   직접 실으면 드라이버 설정과 무관하게 바이트가 그대로 포트로 간다.
 *
 * ⛔ **실패를 종료 코드로 내보낸다.** `$ErrorActionPreference` 는 오류를 「멈추는 오류」로
 *    올릴 뿐 종료 코드를 정하지 않는다. 부르는 쪽(`execFile`)은 종료 코드만 보고 성공을
 *    판정하므로, 세우지 않으면 **프린터가 없어도 인쇄 성공으로 보인다** — 이슈 #831 완료
 *    조건 ④ 「모르는 것을 통과로 두지 않는다」와 정면으로 어긋난다.
 *
 * ⚠ **연 것은 반드시 닫는다**(`Send` 안의 `finally`). 닫지 않으면 대기열에 작업이 열린 채
 *   남아 다음 인쇄가 그 뒤에 서고, 며칠씩 도는 단말에서 쌓인다.
 * ⚠ **기본 프린터도 OS 에 맡긴다.** 어느 것이 기본인지는 Windows 가 알고, 우리가 목록에서
 *   알아내려다 있지도 않은 항목을 읽어 전부 막은 적이 있다(`silent-print.ts` 실측).
 */
export function buildRawPrintScript({ dataPath, deviceName, jobName }: RawPrintJob): string {
  /* 이름을 주지 않으면 OS 기본 프린터를 그 자리에서 물어본다 — 어느 것이 기본인지는 윈도가 안다. */
  const chooseTarget =
    deviceName === undefined
      ? [
          '  Add-Type -AssemblyName System.Drawing',
          '  $target = (New-Object System.Drawing.Printing.PrintDocument).PrinterSettings.PrinterName',
        ]
      : [`  $target = ${psQuote(deviceName)}`];

  return [
    '$ErrorActionPreference = ' + psQuote('Stop'),
    'try {',
    `  Add-Type -TypeDefinition @'${RAW_PRINTER_HELPER}'@`,
    ...chooseTarget,
    `  $bytes = [System.IO.File]::ReadAllBytes(${psQuote(dataPath)})`,
    `  [OmfRawPrinter]::Send($target, ${psQuote(jobName)}, $bytes)`,
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
    /* ⚠ 표시를 영문으로 둔다 — 명령 프롬프트 문자표가 한글을 깨뜨려 이름을 못 읽는다(실측). */
    '    $mark = if ($q.Name -eq $default) { " (default)" } else { "" }',
    '    [Console]::Out.WriteLine($q.Name + $mark)',
    '  }',
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }',
  ].join('\n');
}
