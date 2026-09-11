import type { paths } from '@omf-mes/api-client';

/**
 * 라벨을 **무슨 형식으로 받을 것인가**를 한 곳에서 정한다.
 *
 * ⛔⛔ **한때는 셸 유무로 그림(`png`)과 명령형(`tspl`)을 갈랐다** — 그림으로 받으면 단말이
 * 그것을 프린터 드라이버에 넘겨 그리는데, 글자가 픽셀로 찍혀 프린터가 자기 글꼴로 찍는
 * 명령형 라벨과 **다른 물건으로 보였다**(실측 2026-09-08). 그런데 **전달본에서 `tspl` 이
 * 빠졌다** — `getDocumentRendition` 의 `format` 질의는 이제 `"png" | "pdf"` 뿐이다(생성
 * 타입 `operations['getDocumentRendition']['parameters']['query']` · 2026-09-11 전달본).
 * 셸이 있어도 명령형으로 받을 계약 값이 없으므로, 이 파일은 이제 **셸 유무를 형식 선택
 * 근거로 쓰지 않는다** — 지어내 넓히지 않는다(추측 금지). 서버가 `tspl` 을 다시 지원하면
 * 이 파일의 형식 선택 정책만 되돌리면 된다.
 *
 * ⛔ **`GET /app/document-issues/{documentIssueLogId}/rendition` 은 서버에 경로 자체가
 * 없다**(전달본 `manifest.json` · `notImplementedOperations` · 대응표 P1 「미구현 5건」 ·
 * 커버리지 마감 보고 §1: 「렌더링 산출물 저장·수명 규약이 없다」). **부르지 않는다** — 경로가
 * 없으니 호출해도 계약이 보장하는 응답이 오지 않는다.
 *
 * ⭐ **발행(`POST /app/document-issues`)은 막힌 게 아니다.** 막힌 것은 발행 «뒤»의 미리보기·
 * 인쇄용 이미지 취득뿐이다 — 이 둘을 뭉뚱그리면 사용자가 «발행»을 다시 눌러 회차만 올린다
 * (`screens/repack-label-issue/use-issue-print.ts` 머리말 참고).
 *
 * 제품 코드 호출부 일곱 곳이 실제 `client.GET(...)` 대신 `fetchLabelRendition` 을 부른다 —
 * 네트워크 요청을 아예 만들지 않고 곧바로 거부해, 호출부의 기존 실패 처리(재발행 유도 없이
 * 미리보기·인쇄만 막힌 것으로 다루는 경로)를 그대로 태운다. 서버가 구현하면 이 파일 하나만
 * 원래 `client.GET` 호출로 되돌리면 화면들이 다시 산다 — 무엇이 왜 막혔는지는 이 주석에
 * 남아 있다.
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
export type LabelRenditionFormat = Extract<ContractRenditionFormat, 'png' | 'tspl'>;

/**
 * 그림 형식 하나뿐이다 — 계약에 `tspl` 이 없어 셸 유무로 더는 가르지 않는다(위 머리말).
 *
 * ⚠ **모듈 최상위에서 한 번만 불러도 된다** — 화면 여섯이 그렇게 쓴다. 값이 상수이므로
 * 부르는 시점이 흔들려도 결과가 달라지지 않는다.
 */
export const labelRenditionFormat = (): LabelRenditionFormat => 'png';

/**
 * ⛔ **서버가 이 오퍼레이션을 구현하지 않았다** — 위 머리말 참고. 부르면 안 된다.
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
 * `client.GET('/app/document-issues/{id}/rendition', ...)` 자리에 대신 부른다.
 *
 * ⛔ **`client`·`fetch` 를 인자로도 받지 않는다** — 받으면 언젠가 안에서 실제로 부르고 싶은
 * 유혹이 생긴다. 이 함수의 존재 이유가 「그 호출을 만들지 않는 것」이다.
 */
export const fetchLabelRendition = (): Promise<ArrayBuffer> =>
  Promise.reject(new LabelRenditionNotReadyError());
