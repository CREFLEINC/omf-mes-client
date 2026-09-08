import type { paths } from '@omf-mes/api-client';

/**
 * 라벨을 **무슨 형식으로 받을 것인가**를 한 곳에서 정한다.
 *
 * ⭐ **왜 갈리는가.** 그림(`png`)으로 받으면 단말이 그것을 프린터 드라이버에 넘겨 그린다 —
 * 글자가 픽셀로 찍혀, 프린터가 자기 글꼴로 찍는 명령형 라벨과 **다른 물건으로 보인다**
 * (실측 2026-09-08 · 같은 배치인데 화면 발행분만 뭉툭했다). 셸이 있는 단말에서는 명령형으로
 * 받아 프린터에 그대로 밀어 넣는다.
 *
 * 고정 계약의 `format` 축이 `tspl`을 포함하므로 화면은 생성 타입을 그대로 사용한다. 형식 선택
 * 정책만 이 파일에 모아 화면마다 셸 감지 방식이 갈리지 않게 한다.
 *
 * ⚠ **브라우저에는 셸이 없다.** 그때는 그림으로 받는다 — 없는 것이 오류는 아니다.
 */
type ContractRenditionFormat = NonNullable<
  NonNullable<
    paths['/app/document-issues/{documentIssueLogId}/rendition']['get']['parameters']['query']
  >['format']
>;

/** POP 물리 인쇄가 사용하는 계약 형식. PDF는 문서 출력용이라 이 경로에서 제외한다. */
export type LabelRenditionFormat = Extract<ContractRenditionFormat, 'png' | 'tspl'>;

interface ShellCarrier {
  pop?: { rendition?: unknown };
}

/** 셸이 있으면 명령형, 없으면 그림. */
export const labelRenditionFormat = (): LabelRenditionFormat => {
  if (typeof window === 'undefined') return 'png';

  /*
   * ⛔ **개발 서버(브라우저)에서는 언제나 그림이다.**
   *
   * `pop-main` 이 브라우저에서 `window.pop` 대역을 심는다 — 셸 없이도 흐름을 끝까지 볼 수
   * 있게 하려는 것인데, 그 대역을 셸로 읽으면 브라우저가 RAW 인쇄를 할 수 없으면서도
   * 명령형(`tspl`)을 요청하게 된다. 개발 서버의 미리보기·다운로드 경로는 그림을 유지한다.
   *
   * ⚠ `DEV` 를 쓰는 것이 여기서는 맞다 — 참인 곳이 개발 «서버»뿐이고, 대역을 심는 조건도
   *   같다. 설치본은 `--mode development` 로 구워도 거짓이라 셸의 진짜 통로를 쓴다.
   */
  if (import.meta.env.DEV) return 'png';

  const carrier = window as unknown as ShellCarrier;

  return carrier.pop?.rendition === undefined ? 'png' : 'tspl';
};

/**
 * ⚠ **모듈 최상위에서 한 번만 불러도 된다** — 화면 여섯이 그렇게 쓴다.
 *
 * 셸에서는 `preload` 가 화면 모듈보다 «먼저» 돌아 `window.pop` 이 이미 서 있고, 개발
 * 서버에서는 위 `DEV` 가름이 대역을 심는 시점과 무관하게 그림으로 답한다 — 두 자리 다
 * 부르는 시점에 흔들리지 않는다. (앞서는 대역이 늦게 심겨 화면마다 형식이 갈렸다.)
 */
