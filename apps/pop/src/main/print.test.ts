import { describe, expect, it, vi } from 'vitest';

import {
  EmptyLabelError,
  type LabelImage,
  LabelPrinter,
  type PdfWriter,
  PrinterUnavailableError,
  type SilentPrinter,
  toPdfFileName,
} from './print';

const image = (bytes = [1, 2, 3], label = 'LOT-0001'): LabelImage => ({
  bytes: Uint8Array.from(bytes),
  label,
});

function recordingPdf(): PdfWriter & { calls: Array<{ filePath: string; bytes: Uint8Array }> } {
  const calls: Array<{ filePath: string; bytes: Uint8Array }> = [];
  return {
    calls,
    write: async (filePath, bytes) => void calls.push({ filePath, bytes }),
  };
}

describe('PDF 경로 — 실기 프린터가 없어도 도는 길', () => {
  it('받은 바이트를 그대로 지정한 경로에 쓴다', async () => {
    const pdf = recordingPdf();
    await new LabelPrinter(pdf).print(image(), { kind: 'pdf', filePath: '/tmp/a.pdf' });
    expect(pdf.calls).toHaveLength(1);
    expect(pdf.calls[0]!.filePath).toBe('/tmp/a.pdf');
    expect(Array.from(pdf.calls[0]!.bytes)).toEqual([1, 2, 3]);
  });

  it('서버 이미지를 해석하거나 다시 만들지 않는다 — 바이트가 변형 없이 넘어간다', async () => {
    const pdf = recordingPdf();
    const original = Uint8Array.from([137, 80, 78, 71]); // PNG 시그니처
    await new LabelPrinter(pdf).print(
      { bytes: original, label: 'x' },
      { kind: 'pdf', filePath: '/tmp/x.pdf' },
    );
    expect(pdf.calls[0]!.bytes).toEqual(original);
  });
});

describe('빈 라벨 방어', () => {
  it('빈 이미지는 인쇄로 넘어가지 않는다 — 빈 라벨이 자재에 붙는다', async () => {
    const pdf = recordingPdf();
    await expect(
      new LabelPrinter(pdf).print(image([]), { kind: 'pdf', filePath: '/tmp/empty.pdf' }),
    ).rejects.toThrow(EmptyLabelError);
    expect(pdf.calls).toHaveLength(0);
  });

  it('프린터 경로에서도 막는다', async () => {
    const printer: SilentPrinter = { print: vi.fn() };
    await expect(
      new LabelPrinter(recordingPdf(), printer).print(image([]), {
        kind: 'printer',
        deviceName: 'ZD421',
      }),
    ).rejects.toThrow(EmptyLabelError);
    expect(printer.print).not.toHaveBeenCalled();
  });
});

describe('무음 인쇄 경로 — 실기 도착 후 갈아끼울 자리', () => {
  it('프린터 구현이 없으면 명확히 던진다', async () => {
    await expect(
      new LabelPrinter(recordingPdf()).print(image(), { kind: 'printer', deviceName: 'ZD421' }),
    ).rejects.toThrow(PrinterUnavailableError);
  });

  it('구현이 있으면 장치명과 작업 이름을 함께 넘긴다', async () => {
    const printer: SilentPrinter = { print: vi.fn(async () => undefined) };
    await new LabelPrinter(recordingPdf(), printer).print(image([9], 'LOT-77'), {
      kind: 'printer',
      deviceName: 'ZD421',
    });
    expect(printer.print).toHaveBeenCalledWith('ZD421', Uint8Array.from([9]), 'LOT-77');
  });
});

describe('PDF 파일명', () => {
  it('경로 구분자가 파일명으로 새지 않는다', () => {
    const name = toPdfFileName('a/b\\c', '2026-08-26T09:30:00Z');
    expect(name).not.toContain('/');
    expect(name).not.toContain('\\');
  });

  it('한글 라벨은 살린다 — 현장 라벨 이름이 한글이다', () => {
    expect(toPdfFileName('자재LOT', '2026-08-26T09:30:00Z')).toContain('자재LOT');
  });

  it('콜론을 없앤다 — Windows 파일명에 쓸 수 없다', () => {
    expect(toPdfFileName('x', '2026-08-26T09:30:00Z')).not.toContain(':');
  });

  it('.pdf로 끝난다', () => {
    expect(toPdfFileName('x', '2026-08-26T09:30:00Z').endsWith('.pdf')).toBe(true);
  });
});
