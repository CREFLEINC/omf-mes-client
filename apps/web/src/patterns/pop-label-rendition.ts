import type { ApiClient, paths } from '@omf-mes/api-client';

import { runRequest } from './request';

/**
 * POP 출력 형식과 배포 가능 문서 종류를 한 곳에서 고른다.
 *
 * Electron 셸이 있으면 RAW 인쇄용 TSPL, 브라우저이면 PNG를 요청한다. 미리보기는
 * 셸에서도 PNG를 명시한다. 자재 LOT 라벨과 납품 라벨은 서버 rendition을 지원한다.
 * 다른 문서 종류는 기존 준비 전 오류를 유지해 잘못된 재발행을 막는다.
 *
 * TSPL은 현재 설계 사본의 png/pdf enum보다 앞선 서버 구현 항목이다. 계약 cast는
 * 여기 한 곳에만 두고 서버 선행 계약 장부와 함께 추적한다.
 */
type ContractRenditionFormat = NonNullable<
  NonNullable<
    paths['/app/document-issues/{documentIssueLogId}/rendition']['get']['parameters']['query']
  >['format']
>;

/**
 * POP 물리 인쇄가 사용하는 계약 형식. **`tspl` 이 빠져 사실상 `'png'` 하나뿐이다**(위 머리말).
 * PDF는 여전히 문서 출력용이라 이 타입에서 제외한다.
 */
export type LabelRenditionFormat = 'png' | 'tspl';

/**
 * 셸의 RAW 인쇄 통로가 열려 있는가.
 *
 * ⚠ **`window.pop` 은 preload 가 화면보다 «먼저» 세운다** — 설치본에서는 이 판정이 언제
 *   불려도 참이다. 브라우저로 여는 개발 확인에는 통로가 없어 거짓이고, 그때는 그림으로 받는다.
 */
const hasShellPrinter = (): boolean =>
  typeof (globalThis as { pop?: { rendition?: { save?: unknown } } }).pop?.rendition?.save ===
  'function';

/**
 * **셸이 있으면 명령형(`tspl`), 없으면 그림(`png`)** — 한때 있던 정책을 되돌린다(#1104).
 *
 * ⭐ **왜 되돌리는가.** 그림은 Windows 드라이버를 거쳐 프린터로 간다. 실기의 라벨 프린터는
 * TSPL 로 설정돼 있는데 드라이버가 다른 언어를 내보내 **프린터가 작업을 받아들이고 버렸다** —
 * 앱은 스풀러까지 성공이라 그 너머를 알 수 없어 라벨이 한 장도 안 나왔다(실기 2026-09-12).
 * 명령형으로 받으면 셸이 대기열의 RAW 자리로 그대로 보내 **드라이버를 통째로 건너뛴다.**
 * 같은 단말에서 `Ctrl+Alt+P` 진단(RAW·TSPL)은 이미 정상 출력된다.
 *
 * ⛔ **`tspl` 은 고정한 계약에 없는 값이다**(`format: "png" | "pdf"`). 목 서버는 구현해 두었고,
 *    **사용자가 이 방향을 선택했다**(2026-09-12). 계약을 벗어나는 자리는 아래 `fetchLabelRendition`
 *    한 곳뿐이며, 계약에 `tspl` 이 돌아오면 그 우회만 걷어낸다.
 *
 * ⚠ **모듈 최상위에서 부르지 않는다.** 셸 유무에 달린 값이라 부르는 시점이 뜻을 갖는다 —
 *   상수로 굳혀 두면 통로가 선 뒤에도 옛 판정이 남는다.
 */
export const labelRenditionFormat = (): LabelRenditionFormat =>
  hasShellPrinter() ? 'tspl' : 'png';

/**
 * 배포본에서 지원되지 않는 문서 종류의 그림 요청에 쓰는 사유다.
 */
export const LABEL_RENDITION_NOT_READY_REASON =
  '라벨 이미지 생성 기능은 서버가 아직 지원하지 않습니다. 발행 기록은 정상적으로 남았습니다.';

/** 위 사유를 실어 던지는 예외. `instanceof` 로 다른 실패(네트워크·서버 거부)와 구분한다. */
export class LabelRenditionNotReadyError extends Error {
  constructor() {
    super(LABEL_RENDITION_NOT_READY_REASON);
    this.name = 'LabelRenditionNotReadyError';
  }
}

/**
 * 배포 서버가 지원하는 문서 종류만 명시적으로 통과시킨다.
 * 준비되지 않은 종류는 네트워크 요청 전에 거부해 발행 실패와 구분한다.
 */
export const fetchLabelRendition = async (
  client: ApiClient['client'],
  documentIssueLogId: number,
  /**
   * 받을 형식. 기본은 인쇄로 나갈 형식이다.
   *
   * ⛔ **미리보기는 `'png'` 을 명시해 부른다.** 기본값에 기대면 셸이 선 단말에서 명령형
   *    바이트가 `<img>` 로 들어가 미리보기가 통째로 죽는다(#1104 리뷰 지적).
   */
  format: LabelRenditionFormat = labelRenditionFormat(),
  /** 배포 서버가 지원하는 문서 종류만 명시적으로 허용한다. */
  readyDocumentTypeCode?: 'DELIVERY_LABEL' | 'MATERIAL_LOT_LABEL',
): Promise<ArrayBuffer> => {
  if (import.meta.env.MODE !== 'development' && readyDocumentTypeCode !== 'DELIVERY_LABEL' && readyDocumentTypeCode !== 'MATERIAL_LOT_LABEL') {
    throw new LabelRenditionNotReadyError();
  }

  const drawn = await runRequest(() =>
    client.GET('/app/document-issues/{documentIssueLogId}/rendition', {
      params: {
        path: { documentIssueLogId },
        /*
         * ⛔ **계약을 벗어나는 자리는 여기 하나뿐이다**(#1104). 고정한 계약의 `format` 은
         *    `"png" | "pdf"` 라 `tspl` 을 타입이 받지 않는다 — 목은 구현해 두었고 사용자가
         *    이 방향을 선택했다. 계약에 `tspl` 이 돌아오면 이 우회만 걷어낸다.
         */
        query: { format: format as ContractRenditionFormat },
      },
      parseAs: 'arrayBuffer',
    }),
  );

  return drawn as ArrayBuffer;
};
