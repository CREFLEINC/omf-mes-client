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
 * 목표는 둘이다 — **파일로 떨어뜨리기**(기록)와 **무음 인쇄**(실물). #441 이 파일 경로를
 * 먼저 세웠고 #798 이 인쇄 경로를 채웠다. 예고한 대로 **호출부는 바뀌지 않았다** — 렌더러는
 * 지금도 `rendition.save(bytes, label, now, format)` 하나만 부른다.
 */

/** 서버가 돌려주는 출력물 형식. 계약의 `format` 파라미터와 같은 값이다. */
export type RenditionFormat = 'png' | 'pdf';

export type PrintTarget =
  | { kind: 'file'; filePath: string }
  /** `deviceName` 이 없으면 **OS 기본 프린터**로 간다 — 어느 것이 기본인지는 OS 가 안다. */
  | { kind: 'printer'; deviceName?: string };

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

/**
 * 무음 인쇄. 구현은 `silent-print.ts` 에 있고 Electron 배선은 `index.ts` 가 준다.
 *
 * ⚠ **출력물을 통째로 넘긴다.** 바이트만으로는 임시 파일 확장자를 정할 수 없고, 확장자가
 *   틀리면 브라우저 엔진이 PNG 를 문서로 읽어 빈 종이를 뽑는다.
 */
export interface SilentPrinter {
  print(deviceName: string | undefined, rendition: Rendition): Promise<void>;
}

export class EmptyRenditionError extends Error {
  constructor(label: string) {
    super(`출력물이 비어 있다: ${label}`);
    this.name = 'EmptyRenditionError';
  }
}

export class PrinterUnavailableError extends Error {
  /**
   * ⚠ **단말이 알려 준 프린터 이름을 함께 싣는다.** 현장 단말은 키오스크라 개발자도구가 없어,
   *   이 문장이 사유를 알 수 있는 **유일한 자리**다. 「못 찾았다」만 말하면 프린터가 아예 없는
   *   것인지 여럿인데 기본이 없는 것인지 가릴 수 없다(실측 — 실기 확인이 여기서 한 번 멈췄다).
   */
  constructor(available: readonly string[] = []) {
    super(
      available.length === 0
        ? '인쇄할 프린터를 찾을 수 없다 — 이 단말에 등록된 프린터가 없다. 출력물은 파일로 남았다'
        : `인쇄할 프린터를 찾을 수 없다 — 기본 프린터가 지정돼 있지 않다(등록된 프린터: ${available.join(', ')}). 출력물은 파일로 남았다`,
    );
    this.name = 'PrinterUnavailableError';
  }
}

export class UnknownFormatError extends Error {
  constructor(value: unknown) {
    super(`아는 출력물 형식이 아니다: ${String(value)}`);
    this.name = 'UnknownFormatError';
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

/**
 * 렌더러가 넘긴 값이 아는 형식인지 판정한다.
 *
 * 형식은 **파일 경로 계산에 들어간다**. 모르는 값이 그대로 흘러가면 확장자 자리에
 * 경로 구분자가 실려 저장 폴더 밖에 쓸 수 있다. 지금은 시그니처 조회가 먼저 죽어
 * 막히지만 그것은 가드가 아니라 우연이다 — 조회에 기본값을 넣는 「수선」 하나면 열린다.
 */
export function isRenditionFormat(value: unknown): value is RenditionFormat {
  return value === 'png' || value === 'pdf';
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
    await this.printer.print(target.deviceName, rendition);
  }
}

/**
 * 출력물 파일명. **확장자가 형식을 따라간다** — 셸이 형식을 단정하지 않는다.
 * 경로 구분자가 섞이면 엉뚱한 자리에 쓰므로 함께 다듬는다.
 */
export function toRenditionFileName(label: string, now: string, format: RenditionFormat): string {
  // 두 자리 모두 같은 정제를 태운다. 종전에는 `now`가 무검증이었고, 상위로 못 나간 것은
  // 타임스탬프에서 점을 빼는 처리의 **부작용**이었지 방어가 아니었다 — 경로 구분자는
  // 살아남아 저장 폴더 아래 디렉터리를 만들었다.
  return `${sanitize(label)}_${sanitize(now)}.${format}`;
}

/**
 * 두 단계다. 앞은 **허용 문자만 남기고**, 뒤는 남은 점을 **전부** 지운다.
 *
 * 앞 클래스가 `.`를 살려 두는 것은 뒤 단계가 받기 위해서다 — 읽는 사람이 「점은 허용」으로
 * 오해하기 쉬우나 결과는 반대다. 점을 지우는 이유는 `..`가 상위 이동이 되기 때문이고,
 * 확장자는 이 함수 **밖에서** 형식 값으로 붙으므로 영향받지 않는다.
 */
function sanitize(value: string): string {
  return value.replace(/[^\p{L}\p{N}._-]/gu, '_').replace(/\.+/g, '-');
}
