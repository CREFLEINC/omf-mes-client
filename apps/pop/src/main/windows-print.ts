/**
 * Windows 인쇄 경로 — **OS 의 그림 인쇄를 그대로 쓴다.**
 *
 * ⭐ **왜 브라우저 엔진으로 찍지 않는가.** 엔진의 무음 인쇄로는 이 라벨 프린터에서 **급지만
 * 되고 백지가 나왔다**(실측 · 세 회차). 같은 프린터에서 드라이버 테스트 페이지와 사진 앱의
 * 그림 인쇄는 정상이므로, 프린터·용지·리본·농도가 아니라 **그 경로**가 맞지 않는 것이다.
 * 그래서 사진 앱이 쓰는 길(GDI)로 바꾼다.
 *
 * ⛔ **프린터 제어 언어(TSPL 등)를 만들지 않는다.** 여기서 하는 일은 서버가 그려 준 그림을
 *    드라이버에 넘기는 것뿐이고, 서식은 여전히 서버 소관이다(설계 결정 18).
 *
 * ⚠ **Windows 전용이다.** 현장 단말이 Windows 이고, 개발 기계(mac)에서는 엔진 경로를 그대로
 *   쓴다 — 두 길을 두는 것이 아니라 «단말의 길»과 «개발 편의»를 가른 것이다.
 */

/** PowerShell 문자열에 넣을 값을 감싼다. 작은따옴표는 두 번 써서 벗어난다. */
export const psQuote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

export interface WindowsPrintJob {
  /** 인쇄할 그림 파일의 절대 경로. */
  imagePath: string;
  /** 보낼 프린터. 주지 않으면 **OS 기본 프린터**로 간다. */
  deviceName?: string;
  /** 인쇄 작업 이름 — 대기열에서 사람이 알아보는 값이다. */
  jobName: string;
}

/**
 * 그림 한 장을 대지에 꽉 채워 인쇄하는 스크립트.
 *
 * ⚠ **`PageBounds` 에 그린다.** `MarginBounds` 는 드라이버가 잡아 둔 여백을 뺀 영역이라 라벨이
 *   가운데로 몰리고 가장자리가 잘린다 — 대지 크기가 곧 인쇄 영역인 라벨에서는 전부를 쓴다.
 * ⚠ 그림과 문서를 반드시 놓아 준다(`Dispose`) — 며칠씩 도는 단말에서 파일이 잠긴 채 쌓인다.
 */
export function buildPrintScript({ imagePath, deviceName, jobName }: WindowsPrintJob): string {
  const chooseDevice =
    deviceName === undefined ? '' : `$doc.PrinterSettings.PrinterName = ${psQuote(deviceName)}\n`;

  return [
    '$ErrorActionPreference = ' + psQuote('Stop'),
    'Add-Type -AssemblyName System.Drawing',
    `$image = [System.Drawing.Image]::FromFile(${psQuote(imagePath)})`,
    '$doc = New-Object System.Drawing.Printing.PrintDocument',
    chooseDevice + `$doc.DocumentName = ${psQuote(jobName)}`,
    /* 대화상자를 띄우지 않는 인쇄 제어기 — 키오스크에는 사람이 누를 창이 없다. */
    '$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController',
    '$doc.add_PrintPage({ param($sender, $e) $e.Graphics.DrawImage($image, $e.PageBounds) })',
    'try { $doc.Print() } finally { $doc.Dispose(); $image.Dispose() }',
  ].join('\n');
}

/** 스크립트를 파일로 두고 부른다 — 명령줄에 길게 실으면 따옴표 처리가 셸마다 갈린다. */
export const printScriptArgs = (scriptPath: string): string[] => [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  scriptPath,
];
