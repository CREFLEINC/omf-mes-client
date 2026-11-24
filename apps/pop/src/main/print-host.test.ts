import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  PrintHostDownError,
  buildPrintHostScript,
  createPrintHost,
  encodeJobLine,
} from './print-host';

/** 도우미 흉내 — 받은 줄을 기록하고, 시험이 답할 줄을 흘린다. */
const fakeHost = () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stdout,
    stderr,
    kill: () => {
      child.emit('exit', null);
      return true;
    },
  });
  const received: Record<string, unknown>[] = [];
  stdin.setEncoding('utf8');
  stdin.on('data', (chunk: string) => {
    for (const line of chunk.split('\n').filter(Boolean)) received.push(JSON.parse(line));
  });

  return { child: child as unknown as ChildProcessWithoutNullStreams, stdout, received };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('인쇄 도우미 스크립트', () => {
  it('C# 도우미는 한 번만 컴파일하고 줄마다 작업을 읽는다', () => {
    const script = buildPrintHostScript();

    expect(script.match(/Add-Type -TypeDefinition/gu)).toHaveLength(1);
    expect(script).toContain('[Console]::In.ReadLine()');
    expect(script).toContain('pDataType = "RAW"');
    expect(script).toContain("[Console]::Out.WriteLine('READY')");
  });

  it('넣는 줄은 ASCII 만 — 한글은 \\u 로 적는다', () => {
    const line = encodeJobLine({ name: 'LOT 라벨' });

    expect(line).toBe('{"name":"LOT \\ub77c\\ubca8"}\n');
    expect(JSON.parse(line)).toEqual({ name: 'LOT 라벨' });
  });
});

describe('인쇄 도우미 — 한 번 띄워 여러 장', () => {
  it('준비가 끝나면 작업을 차례로 보내고 결과를 받는다 — 도우미는 한 번만 띄운다', async () => {
    const fake = fakeHost();
    let starts = 0;
    const host = createPrintHost({
      timeoutMs: 1000,
      start: () => {
        starts += 1;
        return fake.child;
      },
    });

    const first = host.print({ path: 'C:\\a.prn', name: 'LOT-1', device: 'TSC' });
    const second = host.probe('TSC');
    fake.stdout.write('READY\r\n');
    await tick();
    expect(fake.received).toEqual([
      { kind: 'print', path: 'C:\\a.prn', name: 'LOT-1', device: 'TSC', id: '1' },
    ]);
    fake.stdout.write('OK 1 \r\n');
    await expect(first).resolves.toBeUndefined();
    await tick();
    expect(fake.received[1]).toEqual({ kind: 'probe', device: 'TSC', id: '2' });
    fake.stdout.write('OK 2 400 300\r\n');
    await expect(second).resolves.toBe('400 300');
    expect(starts).toBe(1);
  });

  it('기본 프린터 이름을 같은 도우미에게 묻는다 — PowerShell 을 새로 띄우지 않는다', async () => {
    const fake = fakeHost();
    const host = createPrintHost({ timeoutMs: 1000, start: () => fake.child });

    const name = host.defaultPrinter();
    fake.stdout.write('READY\n');
    await tick();
    expect(fake.received).toEqual([{ kind: 'default', id: '1' }]);
    fake.stdout.write('OK 1 TSC TH240 Series\n');
    await expect(name).resolves.toBe('TSC TH240 Series');
    expect(buildPrintHostScript()).toContain("$job.kind -eq 'default'");
  });

  it('작업이 실패하면 그 사유로 실패한다 — 길이 막힌 것(PrintHostDownError)이 아니다', async () => {
    const fake = fakeHost();
    const host = createPrintHost({ timeoutMs: 1000, start: () => fake.child });

    const job = host.print({ path: 'C:\\a.prn', name: 'LOT-1' });
    fake.stdout.write('READY\n');
    await tick();
    fake.stdout.write('ERR 1 cannot open printer: TSC (win32 error 1801)\n');

    const error = await job.catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PrintHostDownError);
    expect((error as Error).message).toBe('cannot open printer: TSC (win32 error 1801)');
  });

  it('도우미가 죽으면 PrintHostDownError — 다음 작업은 새로 띄운다', async () => {
    const hosts = [fakeHost(), fakeHost()];
    let starts = 0;
    const host = createPrintHost({
      timeoutMs: 1000,
      start: () => hosts[starts++]!.child,
    });

    const job = host.print({ path: 'C:\\a.prn', name: 'LOT-1' });
    hosts[0]!.child.emit('exit', 1);
    await expect(job).rejects.toBeInstanceOf(PrintHostDownError);

    const next = host.print({ path: 'C:\\b.prn', name: 'LOT-2' });
    hosts[1]!.stdout.write('READY\n');
    await tick();
    hosts[1]!.stdout.write('OK 1 \n');
    await expect(next).resolves.toBeUndefined();
    expect(starts).toBe(2);
  });

  it('상한 안에 답이 없으면 끊고 PrintHostDownError', async () => {
    const fake = fakeHost();
    const host = createPrintHost({ timeoutMs: 20, start: () => fake.child });

    const job = host.print({ path: 'C:\\a.prn', name: 'LOT-1' });
    fake.stdout.write('READY\n');

    await expect(job).rejects.toBeInstanceOf(PrintHostDownError);
  });

  it('띄우지 못하면 PrintHostDownError', async () => {
    const host = createPrintHost({
      timeoutMs: 1000,
      start: () => {
        throw new Error('spawn powershell.exe ENOENT');
      },
    });

    await expect(host.print({ path: 'C:\\a.prn', name: 'LOT-1' })).rejects.toBeInstanceOf(
      PrintHostDownError,
    );
  });
});
