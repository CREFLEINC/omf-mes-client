/**
 * **계속 떠 있는 PowerShell 하나**로 라벨을 보내는 인쇄 도우미(사용자 지시 2026-11-23 「출력 속도가 너무 느려」).
 *
 * ⭐ **왜 필요한가.** 종전에는 라벨 한 장마다 PowerShell 을 두 번 새로 띄웠다 — 용지 크기를 묻는 데 한 번,
 *   RAW 로 보내는 데 한 번. 둘째는 `Add-Type -TypeDefinition` 으로 C# 도우미를 **매번 컴파일**했다.
 *   Windows 에서 이 둘이 장마다 수 초를 먹어 20장이면 1분 가까이 걸렸다.
 *   여기서는 처음 한 번만 띄우고 컴파일한 뒤, 작업을 한 줄(JSON)씩 넣고 결과를 한 줄씩 받는다.
 *
 * ⭐ **약속(한 줄에 하나).** 넣는 줄 `{"id":1,"kind":"print"|"probe"|"default","device":..,"path":..,"name":..}`,
 *   받는 줄 `OK <id> <값>` 또는 `ERR <id> <사유>`. 처음 준비가 끝나면 `READY`.
 *
 * ⚠ **넣는 줄은 ASCII 만.** 한글 작업 이름 · 경로는 `\uXXXX` 로 적는다 — 콘솔 문자표에 따라 한글이 깨지는 것을
 *   피한다(`ConvertFrom-Json` 이 되돌린다).
 * ⛔ **도우미가 죽거나 상한에 걸리면 `PrintHostDownError`** — 부르는 쪽은 종전 길(장마다 스크립트)로 물러선다.
 *   작업 자체가 실패한 것(`ERR`)은 그대로 인쇄 실패다 — 다른 길로 다시 보내면 라벨이 두 장 나올 수 있다.
 */

import type { ChildProcessWithoutNullStreams } from 'node:child_process';

import { RAW_PRINTER_HELPER } from './raw-print';

/** 도우미 PowerShell 스크립트 — 한 번 컴파일하고 줄마다 작업을 처리한다. */
export const buildPrintHostScript = (): string =>
  [
    '$ErrorActionPreference = ' + "'Stop'",
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'try {',
    `  Add-Type -TypeDefinition @'${RAW_PRINTER_HELPER}'@`,
    '  Add-Type -AssemblyName System.Drawing',
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }',
    "[Console]::Out.WriteLine('READY')",
    'while ($true) {',
    '  $line = [Console]::In.ReadLine()',
    '  if ($null -eq $line) { break }',
    '  if ($line.Trim() -eq "") { continue }',
    '  $id = ""',
    '  try {',
    '    $job = $line | ConvertFrom-Json',
    '    $id = [string]$job.id',
    "    if ($job.kind -eq 'default') {",
    '      $out = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName',
    "    } elseif ($job.kind -eq 'probe') {",
    '      $s = New-Object System.Drawing.Printing.PrinterSettings',
    '      if ($job.device) { $s.PrinterName = $job.device }',
    '      $p = $s.DefaultPageSettings.PaperSize',
    '      $out = ("{0} {1}" -f $p.Width, $p.Height)',
    '    } else {',
    '      if ($job.device) { $target = $job.device } else { $target = (New-Object System.Drawing.Printing.PrintDocument).PrinterSettings.PrinterName }',
    '      $bytes = [System.IO.File]::ReadAllBytes($job.path)',
    '      [OmfRawPrinter]::Send($target, $job.name, $bytes)',
    '      $out = ""',
    '    }',
    "    [Console]::Out.WriteLine('OK ' + $id + ' ' + $out)",
    '  } catch {',
    '    $msg = ($_.Exception.Message -replace "[\\r\\n]+", " ")',
    "    [Console]::Out.WriteLine('ERR ' + $id + ' ' + $msg)",
    '  }',
    '}',
  ].join('\n');

/** 넣는 줄 — ASCII 밖의 글자는 `\uXXXX` 로. */
export const encodeJobLine = (job: Record<string, unknown>): string =>
  `${JSON.stringify(job).replace(
    /[\u0080-￿]/gu,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )}\n`;

/** 도우미가 없다 · 죽었다 · 상한에 걸렸다 — 작업이 실패한 것이 아니라 길이 막힌 것이다. */
export class PrintHostDownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrintHostDownError';
  }
}

export interface PrintHostOptions {
  /** 도우미 프로세스를 띄운다(시험은 가짜를 준다). */
  start: () => ChildProcessWithoutNullStreams;
  /** 작업 하나(준비 포함)의 상한. 넘으면 도우미를 끊고 `PrintHostDownError`. */
  timeoutMs: number;
}

export interface PrintHost {
  /** RAW 로 보낸다. 작업 실패면 `Error`, 길이 막히면 `PrintHostDownError`. */
  print(job: { path: string; name: string; device?: string }): Promise<void>;
  /** Windows 기본 프린터 이름 — 없으면 빈 글. */
  defaultPrinter(): Promise<string>;
  /** 드라이버 용지 크기 줄(`"<w> <h>"`, 1/100 인치). */
  probe(device?: string): Promise<string>;
  /** 미리 띄워 둔다 — 첫 장도 빠르게. 실패는 삼킨다(첫 작업에서 다시 띄운다). */
  warm(): void;
  dispose(): void;
}

interface Pending {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

export const createPrintHost = ({ start, timeoutMs }: PrintHostOptions): PrintHost => {
  let child: ChildProcessWithoutNullStreams | null = null;
  let ready: Promise<void> | null = null;
  let nextId = 1;
  const pending = new Map<string, Pending>();
  /** 한 번에 한 작업 — 대기열 순서가 곧 인쇄 순서다. */
  let chain: Promise<unknown> = Promise.resolve();

  const failAll = (error: Error): void => {
    for (const each of pending.values()) each.reject(error);
    pending.clear();
  };

  const stop = (reason: string): void => {
    const current = child;
    child = null;
    ready = null;
    failAll(new PrintHostDownError(reason));
    if (current !== null) current.kill('SIGKILL');
  };

  const launch = (): Promise<void> => {
    if (ready !== null) return ready;
    let proc: ChildProcessWithoutNullStreams;

    try {
      proc = start();
    } catch (cause) {
      return Promise.reject(
        new PrintHostDownError(cause instanceof Error ? cause.message : String(cause)),
      );
    }
    child = proc;
    let buffer = '';
    let stderr = '';

    ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new PrintHostDownError('인쇄 도우미가 준비되지 않았다'));
        stop('인쇄 도우미가 준비되지 않았다');
      }, timeoutMs);

      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (chunk: string) => {
        buffer += chunk;
        let newline = buffer.indexOf('\n');

        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/u, '');
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');

          if (line === 'READY') {
            clearTimeout(timer);
            resolve();
            continue;
          }
          const matched = /^(OK|ERR) (\S+) ?(.*)$/u.exec(line);
          if (matched === null) continue;
          const [, status, id, rest = ''] = matched;
          const waiter = pending.get(id ?? '');
          if (waiter === undefined) continue;
          pending.delete(id ?? '');
          if (status === 'OK') waiter.resolve(rest);
          else waiter.reject(new Error(rest.trim() || '인쇄가 실패했다'));
        }
      });
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      const down = (why: string): void => {
        clearTimeout(timer);
        if (child !== proc) return;
        const reason = stderr.trim() || why;
        reject(new PrintHostDownError(reason));
        stop(reason);
      };
      proc.on('error', (error) => {
        down(error.message);
      });
      proc.on('exit', () => {
        down('인쇄 도우미가 끝났다');
      });
    });

    return ready;
  };

  const run = (job: Record<string, unknown>): Promise<string> => {
    const task = chain.then(async () => {
      await launch();
      const current = child;
      if (current === null) throw new PrintHostDownError('인쇄 도우미가 없다');
      const id = String(nextId);
      nextId += 1;

      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          stop('프린터가 응답하지 않아 인쇄를 끊었다');
        }, timeoutMs);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        current.stdin.write(encodeJobLine({ ...job, id }));
      });
    });
    chain = task.catch(() => undefined);

    return task;
  };

  return {
    print: async ({ path, name, device }) => {
      await run({ kind: 'print', path, name, device: device ?? null });
    },
    probe: (device) => run({ kind: 'probe', device: device ?? null }),
    defaultPrinter: () => run({ kind: 'default' }),
    warm: () => {
      launch().catch(() => undefined);
    },
    dispose: () => {
      const current = child;
      child = null;
      ready = null;
      failAll(new PrintHostDownError('인쇄 도우미를 닫았다'));
      current?.stdin.end();
      current?.kill();
    },
  };
};
