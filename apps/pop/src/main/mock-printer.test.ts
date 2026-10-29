import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  MOCK_PRINTER_NAME,
  createMockRawPrinter,
  isMockPrinterEnabled,
  mockPrinters,
} from './mock-printer';

const dirs: string[] = [];

const scratch = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'omf-mock-printer-'));
  dirs.push(dir);

  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});

describe('가상 라벨 프린터 — 켜는 조건', () => {
  it('개발본에서 값을 줄 때만 켠다', () => {
    expect(isMockPrinterEnabled({ isDev: true, flag: '1' })).toBe(true);
    expect(isMockPrinterEnabled({ isDev: true, flag: undefined })).toBe(false);
    expect(isMockPrinterEnabled({ isDev: true, flag: ' ' })).toBe(false);
    expect(isMockPrinterEnabled({ isDev: true, flag: '0' })).toBe(false);
  });

  it('⛔ 배포본에서는 값을 줘도 켜지지 않는다 — 현장 라벨이 파일로 새면 안 된다', () => {
    expect(isMockPrinterEnabled({ isDev: false, flag: '1' })).toBe(false);
  });

  it('켜지면 이 한 대만 보인다', () => {
    expect(mockPrinters().map((printer) => printer.name)).toEqual([MOCK_PRINTER_NAME]);
  });
});

describe('가상 라벨 프린터 — 받은 것', () => {
  it('보낸 바이트를 고치지 않고 받는 폴더에 .prn 으로 남긴다', async () => {
    const work = scratch();
    const spoolDir = join(work, 'spool');
    const dataPath = join(work, 'label.prn');
    const bytes = Buffer.from([0x53, 0x49, 0x5a, 0x45, 0x20, 0xb0, 0xa1, 0x0d, 0x0a]);
    writeFileSync(dataPath, bytes);

    await createMockRawPrinter({
      spoolDir,
      delayMs: 0,
      now: () => new Date('2026-10-27T05:06:07.890Z'),
    }).print({ dataPath, jobName: 'SYN|LOT|0001', deviceName: 'ANY-REAL-PRINTER' });

    const [file] = readdirSync(spoolDir);

    expect(file).toBe('2026-10-27T05-06-07-890Z-SYN_LOT_0001.prn');
    expect(readFileSync(join(spoolDir, file ?? ''))).toEqual(bytes);
  });
});
