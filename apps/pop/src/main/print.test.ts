import { describe, expect, it, vi } from 'vitest';

import {
  EmptyLabelError,
  type FileWriter,
  type LabelImage,
  LabelPrinter,
  NotPdfError,
  type PdfRenderer,
  PrinterUnavailableError,
  type SilentPrinter,
  isPdfBytes,
  toPdfFileName,
} from './print';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

const image = (bytes = PNG_SIGNATURE, label = 'LOT-0001'): LabelImage => ({
  bytes: Uint8Array.from(bytes),
  label,
});

/** 실제 변환기를 흉내 낸다 — 무엇이 들어오든 PDF 시그니처로 시작하는 바이트를 돌려준다. */
const pdfRenderer = (): PdfRenderer => ({
  render: async () => Uint8Array.from([...PDF_SIGNATURE, 0x31, 0x2e, 0x37]),
});

function recordingWriter(): FileWriter & { calls: Array<{ filePath: string; bytes: Uint8Array }> } {
  const calls: Array<{ filePath: string; bytes: Uint8Array }> = [];
  return { calls, write: async (filePath, bytes) => void calls.push({ filePath, bytes }) };
}

describe('PDF 경로 — 실기 프린터가 없어도 도는 길', () => {
  it('지정한 경로에 파일을 쓴다', async () => {
    const files = recordingWriter();
    await new LabelPrinter(pdfRenderer(), files).print(image(), {
      kind: 'pdf',
      filePath: '/tmp/a.pdf',
    });
    expect(files.calls).toHaveLength(1);
    expect(files.calls[0]!.filePath).toBe('/tmp/a.pdf');
  });

  // ⛔ 이 감지기가 M7의 재발을 막는다. 이전 판은 서버 PNG를 그대로 .pdf 이름으로 써서
  //    PDF 리더가 열지 못하는 파일을 만들었고, 감지기는 「바이트가 변형되지 않는가」만
  //    재고 있어 결함을 통과시켰다.
  it('쓰이는 것은 PDF다 — 서버 PNG를 그대로 넘기지 않는다', async () => {
    const files = recordingWriter();
    await new LabelPrinter(pdfRenderer(), files).print(image(), {
      kind: 'pdf',
      filePath: '/tmp/a.pdf',
    });
    const written = files.calls[0]!.bytes;
    expect(isPdfBytes(written)).toBe(true);
    expect(Array.from(written.subarray(0, 4))).not.toEqual(PNG_SIGNATURE);
  });

  it('변환기가 PDF가 아닌 것을 돌려주면 파일을 쓰지 않고 던진다', async () => {
    const files = recordingWriter();
    const bogus: PdfRenderer = { render: async () => Uint8Array.from(PNG_SIGNATURE) };
    await expect(
      new LabelPrinter(bogus, files).print(image(), { kind: 'pdf', filePath: '/tmp/x.pdf' }),
    ).rejects.toThrow(NotPdfError);
    expect(files.calls).toHaveLength(0);
  });

  it('변환기에 원본 이미지를 그대로 넘긴다 — 앱이 이미지를 다시 만들지 않는다', async () => {
    const render = vi.fn(async () => Uint8Array.from(PDF_SIGNATURE));
    const original = image([137, 80, 78, 71, 13, 10, 26, 10], 'LOT-9');
    await new LabelPrinter({ render }, recordingWriter()).print(original, {
      kind: 'pdf',
      filePath: '/tmp/x.pdf',
    });
    expect(render).toHaveBeenCalledWith(original);
  });
});

describe('빈 라벨 방어', () => {
  it('빈 이미지는 변환도 파일 쓰기도 하지 않는다 — 빈 라벨이 자재에 붙는다', async () => {
    const render = vi.fn();
    const files = recordingWriter();
    await expect(
      new LabelPrinter({ render }, files).print(image([]), {
        kind: 'pdf',
        filePath: '/tmp/empty.pdf',
      }),
    ).rejects.toThrow(EmptyLabelError);
    expect(render).not.toHaveBeenCalled();
    expect(files.calls).toHaveLength(0);
  });

  it('프린터 경로에서도 막는다', async () => {
    const printer: SilentPrinter = { print: vi.fn() };
    await expect(
      new LabelPrinter(pdfRenderer(), recordingWriter(), printer).print(image([]), {
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
      new LabelPrinter(pdfRenderer(), recordingWriter()).print(image(), {
        kind: 'printer',
        deviceName: 'ZD421',
      }),
    ).rejects.toThrow(PrinterUnavailableError);
  });

  it('구현이 있으면 원본 이미지·장치명·작업 이름을 넘긴다 — PDF로 감싸지 않는다', async () => {
    const printer: SilentPrinter = { print: vi.fn(async () => undefined) };
    await new LabelPrinter(pdfRenderer(), recordingWriter(), printer).print(image([9], 'LOT-77'), {
      kind: 'printer',
      deviceName: 'ZD421',
    });
    expect(printer.print).toHaveBeenCalledWith('ZD421', Uint8Array.from([9]), 'LOT-77');
  });
});

describe('PDF 시그니처 판별', () => {
  it('%PDF- 로 시작하면 참이다', () => {
    expect(isPdfBytes(Uint8Array.from([...PDF_SIGNATURE, 0x31]))).toBe(true);
  });

  it('PNG 시그니처는 거짓이다', () => {
    expect(isPdfBytes(Uint8Array.from(PNG_SIGNATURE))).toBe(false);
  });

  it('너무 짧은 바이트는 거짓이다', () => {
    expect(isPdfBytes(Uint8Array.from([0x25, 0x50]))).toBe(false);
    expect(isPdfBytes(Uint8Array.from([]))).toBe(false);
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
