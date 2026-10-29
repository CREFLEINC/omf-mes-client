/**
 * 가상 라벨 프린터 — **개발 기계에서 라벨 발행을 끝까지 돌려 보는 자리**(사용자 지시 2026-10-27).
 *
 * ⭐ **왜 있는가.** 라벨은 대기열의 RAW 자리로만 나가는데 그 길은 Windows 전용이라(`raw-print`), 맥에서
 *    셸을 띄우면 발행이 늘 「인쇄 안 됨」으로 끝났다. 그래서 등록 → 발행 기록 → 인쇄 → 결과 보고 가운데
 *    뒤의 둘과 화면의 단위 멈춤 · 결과 표를 실제 서버에 붙여 볼 수 없었다.
 *    `POP_MOCK_PRINTER=1` 로 띄우면 셸이 **이 프린터 한 대만** 보이고, 보낸 바이트를 파일로 받는다.
 *
 * ⛔ **배포본에서는 켜지지 않는다**(`isMockPrinterEnabled`). 현장 단말에서 켜지면 라벨이 종이 대신 파일로
 *    가는데 화면은 「인쇄됨」이라 말하고 발행 기록이 남는다 — 자재에 붙을 라벨이 없는 채로.
 * ⛔ **진짜 장치로 보내지 않는다.** 켜 두면 OS 의 프린터 목록을 읽지 않고, 고른 이름이 무엇이든 파일로만 받는다.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { RawPrinter } from './raw-print';
import type { AvailablePrinter } from './silent-print';

export const MOCK_PRINTER_NAME = 'OMF-MOCK-LABEL';

export const MOCK_PRINTER_DISPLAY_NAME = '가상 라벨 프린터';

/** 켜는 값 — 비었거나 `0` 이면 끈 것이다. **개발본에서만** 켠다. */
export const isMockPrinterEnabled = ({
  isDev,
  flag,
}: {
  isDev: boolean;
  flag: string | undefined;
}): boolean => {
  const value = flag?.trim() ?? '';

  return isDev && value !== '' && value !== '0';
};

/** 가상 프린터가 켜졌을 때 셸이 보이는 목록 — 이 한 대뿐이다. */
export const mockPrinters = (): AvailablePrinter[] => [
  { name: MOCK_PRINTER_NAME, displayName: MOCK_PRINTER_DISPLAY_NAME },
];

export interface MockRawPrinterOptions {
  /** 받은 바이트를 남길 폴더. 사람이 열어 무엇이 나갔는지 본다. */
  spoolDir: string;
  /** 한 장에 걸리는 시간(ms) — 실제 프린터처럼 진행 막대가 보이게 한다. */
  delayMs?: number;
  now?: () => Date;
}

/** 파일 이름에 쓸 수 없는 글자를 걷는다 — 작업 이름은 라벨(LOT 번호)이라 `|` 가 든다. */
const safeName = (value: string): string => value.replace(/[^\w.-]+/gu, '_').slice(0, 80);

/**
 * 받은 라벨 바이트를 `spoolDir` 에 `.prn` 으로 남기는 RAW 프린터.
 *
 * ⭐ 바이트는 고치지 않고 그대로 옮긴다 — 현장 프린터가 받았을 것과 같은 것을 열어 보게.
 */
export const createMockRawPrinter = ({
  spoolDir,
  delayMs = 400,
  now = () => new Date(),
}: MockRawPrinterOptions): RawPrinter => ({
  print: async ({ dataPath, jobName }) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    mkdirSync(spoolDir, { recursive: true });
    const stamp = now().toISOString().replace(/[:.]/gu, '-');

    copyFileSync(dataPath, join(spoolDir, `${stamp}-${safeName(jobName)}.prn`));
  },
});
