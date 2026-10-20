/**
 * POP 화면을 **단말 화면에 맞춰 통째로 줄인다.**
 *
 * ⭐ **왜 필요한가.** 화면 스펙은 전부 `1024 × 768` 로 그려져 있고(각 스펙 §4 「세로 예산
 * 검산」), 코드도 그 예산에 맞춰 서 있다. 그런데 실기(N100 올인원 터치 15형 · Win11 IoT)에서
 * 쓸 수 있는 폭·높이는 그보다 «작을 수 있다» — Windows 표시 배율이 125·150% 면 1366×768
 * 패널의 실제 CSS 크기가 1092×614 로 줄어든다. 그러면 예산대로 세운 구획이 넘쳐 **박스마다
 * 스크롤이 생긴다**(실측 2026-09-08 · 실기).
 *
 * ⛔ **글자 크기를 화면마다 손으로 줄이지 않는다.** 21개 화면에 흩어 놓으면 어디는 줄고
 *    어디는 안 줄어 같은 값이 화면마다 다른 크기로 보인다 — 그리고 다음 단말에서 또 틀린다.
 *    **한 곳에서 배율을 잡으면** 글자·버튼·여백·터치 크기가 «같은 비율로» 줄어 배치가 그대로
 *    유지된다.
 *
 * ⛔ **키우지는 않는다**(상한 1). 화면이 예산보다 크면 남는 자리는 남겨 둔다 — 늘리면 스펙이
 *    정한 글자 크기 관계가 깨지고, 터치 타깃만 쓸데없이 커진다.
 *
 * ⚠ **`zoom` 을 쓴다.** `transform: scale()` 은 자리를 그대로 차지해 빈 공간이 남고 스크롤이
 *   되레 생긴다. `zoom` 은 레이아웃 계산에 함께 들어가므로 예산이 그대로 줄어든다.
 */

/**
 * 화면이 그려진 기준. **두 벌이다** — 작업장 콘솔로 옮긴 화면과 아직 옮기지 않은 화면.
 *
 * - `legacy` 화면 스펙이 잡은 1024×768 예산(공유계약 E-1). 옮기지 않은 화면은 여기 그대로 선다.
 * - `console` 작업장 콘솔(`patterns/pop-console`)의 1920×1080. 현장 패널(1920×1080 가로 터치)을
 *   그대로 기준으로 삼고, 표시 배율 125·150% 단말에서는 같은 비율로 줄어든다.
 *
 * ⚠ 이 값이 바뀌면 스펙이 바뀐 것이다 — `console` 기준은 E-1 개정 제안과 함께 간다
 *   (「POP UX/UI 개편 제안」 이행 계획).
 */
export type PopFitDesign = 'legacy' | 'console';

const DESIGNS: Record<PopFitDesign, { width: number; height: number }> = {
  legacy: { width: 1024, height: 768 },
  console: { width: 1920, height: 1080 },
};

/** 배율 하한 — 이보다 작아지면 글자가 현장에서 읽히지 않는다. 그때는 스크롤을 받아들인다. */
const MIN_SCALE = 0.6;

/**
 * ⛔ **여유를 두지 않는다.** 한때 0.85 를 곱해 한 단 더 줄였는데, 화면이 예산보다 작아지면서
 *    **아래가 남았다**(실기 실측 2026-09-08 — 사용자 지시). 세로 예산은 「헤더 + 본문 +
 *    액션바 = 768」로 «꽉 차게» 짜여 있어(각 스펙 §4), 딱 맞추면 남지도 넘치지도 않는다.
 *
 * 넘치는 것은 배율이 아니라 목록이 길어질 때의 일이고, 그것은 그 구획이 스스로 스크롤한다.
 */
const HEADROOM = 1;

export const fitScale = (
  width: number,
  height: number,
  design: PopFitDesign = 'legacy',
): number => {
  if (width <= 0 || height <= 0) return 1;

  const { width: designWidth, height: designHeight } = DESIGNS[design];
  const scale = Math.min(width / designWidth, height / designHeight) * HEADROOM;

  return Math.min(1, Math.max(MIN_SCALE, scale));
};

/**
 * 지금 화면의 기준. 셸이 화면을 옮길 때마다 바꾼다(`setPopFitDesign`).
 *
 * ⚠ **모듈에 하나만 둔다.** 배율은 문서 전체(`html`)에 걸리는 값이라 화면이 둘 동시에 설 수
 *   없다 — 기준도 하나다.
 */
let currentDesign: PopFitDesign = 'legacy';
let reapply: (() => void) | null = null;

/** 기준을 바꾸고 배율을 다시 건다. 같은 값이면 아무것도 하지 않는다. */
export const setPopFitDesign = (design: PopFitDesign): void => {
  if (design === currentDesign) return;

  currentDesign = design;
  reapply?.();
};

/**
 * 창 크기에 맞춰 배율을 걸고, 크기가 바뀌면 다시 건다.
 *
 * 돌려주는 함수를 부르면 원래대로 돌린다 — 화면을 지웠는데 배율이 남지 않게 한다.
 */
export const applyPopFit = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const root = document.documentElement;

  const apply = (): void => {
    const scale = fitScale(window.innerWidth, window.innerHeight, currentDesign);

    /* 1 이면 손대지 않는다 — 배율이 걸린 흔적을 남기지 않는다. */
    root.style.zoom = scale === 1 ? '' : String(scale);
  };

  apply();
  reapply = apply;
  window.addEventListener('resize', apply);

  return () => {
    window.removeEventListener('resize', apply);
    reapply = null;
    root.style.zoom = '';
  };
};
