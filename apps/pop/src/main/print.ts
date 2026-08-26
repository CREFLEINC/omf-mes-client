/**
 * 라벨 인쇄 경로 — 서버가 렌더링을 끝낸 이미지를 받아 OS로 넘기기만 한다(#441 결정).
 *
 * ⛔ 프린터 제어 언어(TSPL 등)를 앱에서 만들지 않는다. 렌더링은 서버 소관이고
 *    다국어 폰트도 서버에 있다.
 *
 * 실기 프린터가 아직 없으므로 **PDF 파일로 떨어뜨리는 경로를 먼저** 만든다.
 * 실기 도착 후 `PrintTarget`만 무음 인쇄로 바꾼다 — 호출부는 그대로 둔다.
 */

export type PrintTarget = { kind: 'pdf'; filePath: string } | { kind: 'printer'; deviceName: string };

/** 서버가 렌더링해 준 라벨 이미지. 앱은 내용을 해석하지 않는다. */
export interface LabelImage {
  /** PNG 바이트. 서버 응답 본문 그대로다. */
  bytes: Uint8Array;
  /** 파일명·인쇄 작업 이름에 쓴다. */
  label: string;
}

/** PDF로 감싸 쓰는 쪽. Electron `webContents.printToPDF`든 파일 쓰기든 이 모양이면 된다. */
export interface PdfWriter {
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

export class LabelPrinter {
  constructor(
    private readonly pdf: PdfWriter,
    private readonly printer?: SilentPrinter,
  ) {}

  async print(image: LabelImage, target: PrintTarget): Promise<void> {
    // 빈 이미지를 인쇄로 넘기면 빈 라벨이 나와 현장에서 자재에 붙는다. 여기서 막는다.
    if (image.bytes.length === 0) throw new EmptyLabelError(image.label);

    if (target.kind === 'pdf') {
      await this.pdf.write(target.filePath, image.bytes);
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
