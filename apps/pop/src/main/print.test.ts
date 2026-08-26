import { describe, expect, it, vi } from 'vitest';

import {
  EmptyRenditionError,
  type FileWriter,
  FormatMismatchError,
  PrinterUnavailableError,
  type Rendition,
  type RenditionFormat,
  RenditionPrinter,
  type SilentPrinter,
  matchesFormat,
  isRenditionFormat,
  toRenditionFileName,
} from './print';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

const rendition = (
  format: RenditionFormat = 'png',
  bytes: number[] = format === 'png' ? PNG : PDF,
  label = 'LOT-0001',
): Rendition => ({ bytes: Uint8Array.from(bytes), format, label });

function recordingWriter(): FileWriter & { calls: Array<{ filePath: string; bytes: Uint8Array }> } {
  const calls: Array<{ filePath: string; bytes: Uint8Array }> = [];
  return { calls, write: async (filePath, bytes) => void calls.push({ filePath, bytes }) };
}

describe('파일 경로 — 실기 프린터가 없어도 도는 길', () => {
  it('받은 바이트를 변형 없이 쓴다 — 셸은 출력물을 다시 만들지 않는다', async () => {
    const files = recordingWriter();
    const original = [...PNG, 1, 2, 3];
    await new RenditionPrinter(files).print(rendition('png', original), {
      kind: 'file',
      filePath: '/tmp/a.png',
    });
    expect(Array.from(files.calls[0]!.bytes)).toEqual(original);
  });

  it('PDF 출력물도 그대로 쓴다', async () => {
    const files = recordingWriter();
    await new RenditionPrinter(files).print(rendition('pdf'), {
      kind: 'file',
      filePath: '/tmp/a.pdf',
    });
    expect(Array.from(files.calls[0]!.bytes)).toEqual(PDF);
  });
});

// ⛔ 이 묶음이 원래 결함의 재발을 막는다. 이전 판은 서버가 준 PNG를 무조건 `.pdf` 이름으로
//    저장해, PDF 리더가 열지 못하는 파일을 만들었다. 형식을 셸이 단정한 것이 원인이었다.
describe('이름과 내용이 어긋나지 않게 한다', () => {
  it('png를 요청했는데 PDF가 오면 파일을 쓰지 않고 던진다', async () => {
    const files = recordingWriter();
    await expect(
      new RenditionPrinter(files).print(rendition('png', PDF), {
        kind: 'file',
        filePath: '/tmp/x.png',
      }),
    ).rejects.toThrow(FormatMismatchError);
    expect(files.calls).toHaveLength(0);
  });

  it('pdf를 요청했는데 PNG가 오면 파일을 쓰지 않고 던진다 — 원래 결함의 방향이다', async () => {
    const files = recordingWriter();
    await expect(
      new RenditionPrinter(files).print(rendition('pdf', PNG), {
        kind: 'file',
        filePath: '/tmp/x.pdf',
      }),
    ).rejects.toThrow(FormatMismatchError);
    expect(files.calls).toHaveLength(0);
  });

  it('확장자가 형식을 따라간다', () => {
    expect(toRenditionFileName('LOT', '2026-08-26T09:30:00Z', 'png').endsWith('.png')).toBe(true);
    expect(toRenditionFileName('LOT', '2026-08-26T09:30:00Z', 'pdf').endsWith('.pdf')).toBe(true);
  });
});

describe('빈 출력물 방어', () => {
  it('빈 바이트는 파일로 쓰지 않는다 — 빈 라벨이 자재에 붙는다', async () => {
    const files = recordingWriter();
    await expect(
      new RenditionPrinter(files).print(rendition('png', []), {
        kind: 'file',
        filePath: '/tmp/empty.png',
      }),
    ).rejects.toThrow(EmptyRenditionError);
    expect(files.calls).toHaveLength(0);
  });

  it('프린터 경로에서도 막는다', async () => {
    const printer: SilentPrinter = { print: vi.fn() };
    await expect(
      new RenditionPrinter(recordingWriter(), printer).print(rendition('png', []), {
        kind: 'printer',
        deviceName: 'ZD421',
      }),
    ).rejects.toThrow(EmptyRenditionError);
    expect(printer.print).not.toHaveBeenCalled();
  });
});

describe('무음 인쇄 경로 — 실기 도착 후 갈아끼울 자리', () => {
  it('프린터 구현이 없으면 명확히 던진다', async () => {
    await expect(
      new RenditionPrinter(recordingWriter()).print(rendition(), {
        kind: 'printer',
        deviceName: 'ZD421',
      }),
    ).rejects.toThrow(PrinterUnavailableError);
  });

  it('구현이 있으면 원본 바이트·장치명·작업 이름을 넘긴다', async () => {
    const printer: SilentPrinter = { print: vi.fn(async () => undefined) };
    await new RenditionPrinter(recordingWriter(), printer).print(rendition('png', PNG, 'LOT-77'), {
      kind: 'printer',
      deviceName: 'ZD421',
    });
    expect(printer.print).toHaveBeenCalledWith('ZD421', Uint8Array.from(PNG), 'LOT-77');
  });
});

describe('형식 시그니처 판별', () => {
  it('PNG 시그니처를 알아본다', () => {
    expect(matchesFormat(Uint8Array.from(PNG), 'png')).toBe(true);
    expect(matchesFormat(Uint8Array.from(PDF), 'png')).toBe(false);
  });

  it('PDF 시그니처를 알아본다', () => {
    expect(matchesFormat(Uint8Array.from(PDF), 'pdf')).toBe(true);
    expect(matchesFormat(Uint8Array.from(PNG), 'pdf')).toBe(false);
  });

  it('너무 짧은 바이트는 거짓이다', () => {
    expect(matchesFormat(Uint8Array.from([0x89, 0x50]), 'png')).toBe(false);
    expect(matchesFormat(Uint8Array.from([]), 'pdf')).toBe(false);
  });
});

describe('형식 값 판정 — 경로 계산에 들어가는 값이라 경계에서 막는다', () => {
  it('아는 형식만 참이다', () => {
    expect(isRenditionFormat('png')).toBe(true);
    expect(isRenditionFormat('pdf')).toBe(true);
  });

  it('모르는 값·경로 구분자가 섞인 값은 거짓이다', () => {
    for (const bad of ['jpg', '../../../evil.sh', '', 'PNG', null, undefined, 1, {}]) {
      expect(isRenditionFormat(bad)).toBe(false);
    }
  });

  it('프로토타입 키에 속지 않는다', () => {
    expect(isRenditionFormat('constructor')).toBe(false);
    expect(isRenditionFormat('__proto__')).toBe(false);
  });
});

describe('파일명 다듬기', () => {
  it('경로 구분자가 파일명으로 새지 않는다', () => {
    const name = toRenditionFileName('a/b\\c', '2026-08-26T09:30:00Z', 'png');
    expect(name).not.toContain('/');
    expect(name).not.toContain('\\');
  });

  it('한글 라벨은 살린다 — 현장 라벨 이름이 한글이다', () => {
    expect(toRenditionFileName('자재LOT', '2026-08-26T09:30:00Z', 'png')).toContain('자재LOT');
  });

  it('콜론을 없앤다 — Windows 파일명에 쓸 수 없다', () => {
    expect(toRenditionFileName('x', '2026-08-26T09:30:00Z', 'png')).not.toContain(':');
  });

  // 종전에는 `now`가 무검증이라 경로 구분자가 살아남아 저장 폴더 아래 디렉터리를 만들었다.
  it('타임스탬프 자리에도 같은 정제를 태운다', () => {
    const name = toRenditionFileName('LOT', '../../../../evil', 'png');
    expect(name).not.toContain('/');
    expect(name).not.toContain('\\');
    expect(name).not.toContain('..');
  });

  it('두 자리 어디에도 상위 이동이 남지 않는다', () => {
    for (const value of ['..', '../..', 'a/../b']) {
      expect(toRenditionFileName(value, value, 'pdf')).not.toContain('..');
    }
  });
});
