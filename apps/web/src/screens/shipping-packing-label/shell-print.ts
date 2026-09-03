/**
 * 그린 라벨을 **셸에게 넘기는 자리.**
 *
 * 화면은 라벨을 그리지도 않고 프린터로 보내지도 않는다 — 서버가 그리고(`rendition`) 셸이
 * 보낸다(공유계약 K-5 · 설계 결정 18). 이 모듈이 하는 일은 그 사이를 잇는 것뿐이다.
 *
 * ⛔ **여기서 출력물을 다시 만들지 않는다.** 클라이언트가 레이아웃을 그리면 단말마다
 * 출력물이 달라진다 — 고객에게 나가는 납품 라벨이라 더 그렇다.
 *
 * ⚠ **셸 밖에서는 통로가 없다.** 개발 서버·브라우저에서는 `window.pop` 이 없고, 그것은
 * 오류가 아니라 「이 폼팩터에는 프린터가 없다」는 뜻이다 — 화면은 그 사실을 사유로 보인다.
 * ⛔ 통로가 없는 것을 인쇄 성공으로 처리하지 않는다(공유계약 F-6).
 *
 * ⚠ **`declare global` 을 여기서 다시 쓰지 않는다.** 앞선 슬라이스가 이미 `Window.pop` 을
 * 전역으로 선언해 두었고, 같은 자리를 두 곳에서 선언하면 모양이 갈렸을 때 타입 검사가
 * 그것을 알려 주지 못한다. **읽는 쪽에서 필요한 부분만 좁혀 본다**(전례 `P-02-05`).
 */

/** 셸이 열어 둔 통로 중 **이 화면이 쓰는 것만** 적는다(POP 셸 `preload` 의 `rendition`). */
export interface RenditionShell {
  /** 서버가 그려 준 출력물을 셸이 저장·인쇄하고 만들어진 경로를 돌려준다. */
  save: (bytes: Uint8Array, label: string, now: string, format: 'png') => Promise<string>;
}

interface ShellCarrier {
  pop?: { rendition?: RenditionShell };
}

/** 셸 안인가. **없는 것이 정상인 폼팩터가 있다** — 오류로 다루지 않는다. */
export const renditionShell = (): RenditionShell | null => {
  if (typeof window === 'undefined') return null;

  const shell = (window as unknown as ShellCarrier).pop?.rendition;

  return typeof shell?.save === 'function' ? shell : null;
};
