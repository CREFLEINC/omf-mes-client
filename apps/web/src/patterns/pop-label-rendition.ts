import type { ApiClient, paths } from '@omf-mes/api-client';

import { runRequest } from './request';

/**
 * 라벨을 **무슨 형식으로, 부를 것인가 말 것인가**를 한 곳에서 정한다.
 *
 * ⛔⛔ **한때는 셸 유무로 그림(`png`)과 명령형(`tspl`)을 갈랐다** — 그림으로 받으면 단말이
 * 그것을 프린터 드라이버에 넘겨 그리는데, 글자가 픽셀로 찍혀 프린터가 자기 글꼴로 찍는
 * 명령형 라벨과 **다른 물건으로 보였다**(실측 2026-09-08). 그런데 **전달본에서 `tspl` 이
 * 빠졌다** — `getDocumentRendition` 의 `format` 질의는 이제 `"png" | "pdf"` 뿐이다. 셸이
 * 있어도 명령형으로 받을 계약 값이 없으므로, 이 파일은 **셸 유무를 형식 선택 근거로 쓰지
 * 않는다** — 지어내 넓히지 않는다. 서버가 `tspl` 을 다시 지원하면 형식 선택 정책만 되돌린다.
 *
 * ## 부르는가 — **모드가 가른다**(#1083)
 *
 * `GET /app/document-issues/{documentIssueLogId}/rendition` 은 **실서버에 아직 없다**(전달본
 * `manifest.json` · `notImplementedOperations`). 그래서 **배포본은 부르지 않는다** — 없는 경로를
 * 두드려 봐야 계약이 보장하는 응답이 오지 않고, 실패가 「발행이 안 됐다」로 읽히면 사용자가
 * 발행을 다시 눌러 회차만 올린다.
 *
 * ⭐ **개발 모드는 부른다.** 그 환경이 보는 서버는 목이고, 목은 이 경로를 구현해 라벨을 그려
 * 준다. 부르지 않으면 **목으로 도는 시험에서 라벨을 한 장도 볼 수 없다** — 발행·인쇄·재출력
 * 단계가 통째로 확인 불가가 된다(실측 2026-09-11 · 88단계 시험).
 *
 * ⛔ **가름은 `MODE === 'development'` 한 표기뿐이다.** `import.meta.env.DEV` 는 이 저장소의
 * 설치본 빌드(`--mode development`)에서도 거짓이라 근거가 되지 못한다. 빌드 시점에 상수로
 * 접혀 배포 번들에서는 호출 가지째 걷힌다 — 런타임 조회로 바꾸면 현장 단말이 없는 경로를
 * 부르게 된다. 시험 실행(`MODE === 'test'`)도 부르지 않는 쪽이다.
 *
 * ⭐ **발행(`POST /app/document-issues`)은 이 가름과 무관하다** — 막힌 적이 없다. 막히는 것은
 * 발행 «뒤»의 미리보기·인쇄용 그림 취득뿐이라, 호출부는 그 둘을 뭉뚱그리지 않는다.
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
 * ⛔ **배포본에서는 서버가 이 오퍼레이션을 구현하지 않았다** — 위 머리말 참고.
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
 * 발행 기록 한 건의 라벨 그림.
 *
 * **개발 모드에서만 실제로 조회한다**(위 머리말). 그 밖에서는 요청을 만들지 않고 곧바로
 * `LabelRenditionNotReadyError` 로 거부하므로, 호출부의 기존 실패 처리(재발행을 유도하지 않고
 * 미리보기·인쇄만 막힌 것으로 다루는 경로)가 그대로 선다.
 */
export const fetchLabelRendition = async (
  client: ApiClient['client'],
  documentIssueLogId: number,
): Promise<ArrayBuffer> => {
  if (import.meta.env.MODE !== 'development') {
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
        query: { format: labelRenditionFormat() as ContractRenditionFormat },
      },
      parseAs: 'arrayBuffer',
    }),
  );

  return drawn as ArrayBuffer;
};
