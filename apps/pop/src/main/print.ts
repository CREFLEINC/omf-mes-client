/**
 * 라벨 인쇄 경로 — 서버가 렌더링을 끝낸 이미지를 받아 OS로 넘기기만 한다(#441 결정).
 *
 * ⛔ 프린터 제어 언어(TSPL 등)를 앱에서 만들지 않는다. 렌더링은 서버 소관이고
 *    다국어 폰트도 서버에 있다.
 *
 * 실기 프린터가 아직 없으므로 **PDF 파일로 떨어뜨리는 경로를 먼저** 만든다.
 * 실기 도착 후 `PrintTarget`만 무음 인쇄로 바꾼다 — 호출부는 그대로 둔다.
 *
 * ⚠ 서버가 주는 것은 **PNG**이고 우리가 내야 하는 것은 **PDF**다. 바이트를 그대로 쓰면
 *   확장자만 `.pdf`인, PDF 리더가 열지 못하는 파일이 된다(실측). 그래서 `PdfRenderer`가
 *   이미지를 PDF로 감싼다 — 이 변환을 건너뛰지 않는다.
 */

export type PrintTarget =
  { kind: 'pdf'; filePath: string } | { kind: 'printer'; deviceName: string };

/** 서버가 렌더링해 준 라벨 이미지. 앱은 내용을 해석하지 않는다. */
export interface LabelImage {
  /** PNG 바이트. 서버 응답 본문 그대로다. */
  bytes: Uint8Array;
  /** 파일명·인쇄 작업 이름에 쓴다. */
  label: string;
}

/**
 * 이미지를 PDF 바이트로 감싼다. Electron `webContents.printToPDF`가 이 자리를 채운다 —
 * 인터페이스로 둔 것은 Electron 없이 감지기로 재기 위해서다.
 */
export interface PdfRenderer {
  render(image: LabelImage): Promise<Uint8Array>;
}

/** 완성된 바이트를 파일로 쓴다. */
export interface FileWriter {
  write(filePath: string, bytes: Uint8Array): Promise<void>;
}

/** 무음 인쇄. 실기 도착 전까지는 구현이 없다. */
export interface SilentPrinter {
  print(deviceName: string, bytes: Uint8Array, jobName: string): Promise<void>;
}

export class EmptyLabelError extends Error {
  constructor(label: string) {
    super(`라벨 이미지가 비어 있다: ${label}`);
    this.name = 'EmptyLabelError';
  }
}

export class PrinterUnavailableError extends Error {
  constructor() {
    super('무음 인쇄 경로가 아직 없다 — 실기 도착 전까지 PDF 경로를 쓴다');
    this.name = 'PrinterUnavailableError';
  }
}

export class NotPdfError extends Error {
  constructor() {
    super('PDF 변환 결과가 PDF가 아니다 — 확장자만 .pdf인 파일을 남기지 않는다');
    this.name = 'NotPdfError';
  }
}

/** PDF 파일은 `%PDF-`로 시작한다. 이 검사가 「이름만 PDF」를 막는 마지막 그물이다. */
export function isPdfBytes(bytes: Uint8Array): boolean {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return signature.every((byte, index) => bytes[index] === byte);
}

export class LabelPrinter {
  constructor(
    private readonly pdfRenderer: PdfRenderer,
    private readonly files: FileWriter,
    private readonly printer?: SilentPrinter,
  ) {}

  async print(image: LabelImage, target: PrintTarget): Promise<void> {
    // 빈 이미지를 인쇄로 넘기면 빈 라벨이 나와 현장에서 자재에 붙는다. 여기서 막는다.
    if (image.bytes.length === 0) throw new EmptyLabelError(image.label);

    if (target.kind === 'pdf') {
      const pdf = await this.pdfRenderer.render(image);
      if (!isPdfBytes(pdf)) throw new NotPdfError();
      await this.files.write(target.filePath, pdf);
      return;
    }

    if (this.printer === undefined) throw new PrinterUnavailableError();
    await this.printer.print(target.deviceName, image.bytes, image.label);
  }
}

/** 라벨 이름을 파일명으로 쓸 수 있게 다듬는다. 경로 구분자가 섞이면 엉뚱한 자리에 쓴다. */
export function toPdfFileName(label: string, now: string): string {
  const safe = label.replace(/[^\p{L}\p{N}._-]/gu, '_');
  const stamp = now.replace(/[:.]/g, '-');
  return `${safe}_${stamp}.pdf`;
}
