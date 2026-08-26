/**
 * 라벨·문서 출력 경로 — 서버가 그린 결과를 받아 OS로 넘기기만 한다(#441 결정).
 *
 * ⛔ 프린터 제어 언어(TSPL 등)를 앱에서 만들지 않는다. 렌더링은 서버 소관이고
 *    다국어 폰트도 서버에 있다.
 *
 * ⛔ **형식을 셸이 정하지 않는다.** 서버가 `rendition?format=png|pdf`로 형식을 정하고
 *    (라벨은 이미지, 성적서·보고서는 문서), 회차도 서버가 인쇄면에 넣어 그린다.
 *    셸이 형식을 단정하면 이름과 내용이 어긋난다 — 이전 판이 받은 PNG를 무조건 `.pdf`로
 *    저장해 PDF 리더가 열지 못하는 파일을 만들었다(실측).
 *
 * 실기 프린터가 아직 없으므로 **파일로 떨어뜨리는 경로를 먼저** 만든다.
 * 실기 도착 후 `PrintTarget`만 무음 인쇄로 바꾼다 — 호출부는 그대로 둔다.
 */

/** 서버가 돌려주는 출력물 형식. 계약의 `format` 파라미터와 같은 값이다. */
export type RenditionFormat = 'png' | 'pdf';

export type PrintTarget =
  { kind: 'file'; filePath: string } | { kind: 'printer'; deviceName: string };

/** 서버가 그려 준 출력물. 앱은 내용을 해석하지 않는다. */
export interface Rendition {
  /** 응답 본문 그대로. */
  bytes: Uint8Array;
  /** 서버에 요청한 형식. 확장자와 시그니처 검사가 이 값을 따른다. */
  format: RenditionFormat;
  /** 파일명·인쇄 작업 이름에 쓴다. */
  label: string;
}

export interface FileWriter {
  write(filePath: string, bytes: Uint8Array): Promise<void>;
}

/** 무음 인쇄. 실기 도착 전까지는 구현이 없다. */
export interface SilentPrinter {
  print(deviceName: string, bytes: Uint8Array, jobName: string): Promise<void>;
}

export class EmptyRenditionError extends Error {
  constructor(label: string) {
    super(`출력물이 비어 있다: ${label}`);
    this.name = 'EmptyRenditionError';
  }
}

export class PrinterUnavailableError extends Error {
  constructor() {
    super('무음 인쇄 경로가 아직 없다 — 실기 도착 전까지 파일 경로를 쓴다');
    this.name = 'PrinterUnavailableError';
  }
}

export class FormatMismatchError extends Error {
  constructor(format: RenditionFormat) {
    super(`받은 내용이 ${format}가 아니다 — 이름과 내용이 어긋난 파일을 남기지 않는다`);
    this.name = 'FormatMismatchError';
  }
}

const SIGNATURES: Record<RenditionFormat, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
};

/**
 * 받은 바이트가 그 형식이 맞는지 시그니처로 확인한다.
 *
 * 이 검사가 「이름과 내용이 어긋난 파일」을 막는 그물이다 — 어느 방향이든 잡는다.
 * PNG를 요청했는데 PDF가 와도, 그 반대여도 걸린다.
 */
export function matchesFormat(bytes: Uint8Array, format: RenditionFormat): boolean {
  return SIGNATURES[format].every((byte, index) => bytes[index] === byte);
}

export class RenditionPrinter {
  constructor(
    private readonly files: FileWriter,
    private readonly printer?: SilentPrinter,
  ) {}

  async print(rendition: Rendition, target: PrintTarget): Promise<void> {
    // 빈 출력물을 인쇄로 넘기면 빈 라벨이 나와 현장에서 자재에 붙는다. 여기서 막는다.
    if (rendition.bytes.length === 0) throw new EmptyRenditionError(rendition.label);
    if (!matchesFormat(rendition.bytes, rendition.format)) {
      throw new FormatMismatchError(rendition.format);
    }

    if (target.kind === 'file') {
      await this.files.write(target.filePath, rendition.bytes);
      return;
    }

    if (this.printer === undefined) throw new PrinterUnavailableError();
    await this.printer.print(target.deviceName, rendition.bytes, rendition.label);
  }
}

/**
 * 출력물 파일명. **확장자가 형식을 따라간다** — 셸이 형식을 단정하지 않는다.
 * 경로 구분자가 섞이면 엉뚱한 자리에 쓰므로 함께 다듬는다.
 */
export function toRenditionFileName(label: string, now: string, format: RenditionFormat): string {
  const safe = label.replace(/[^\p{L}\p{N}._-]/gu, '_');
  const stamp = now.replace(/[:.]/g, '-');
  return `${safe}_${stamp}.${format}`;
}
