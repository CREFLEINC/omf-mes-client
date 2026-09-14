import { useLayoutEffect, type RefObject } from 'react';

/**
 * 머리줄 오른쪽에 **떠 있는 버튼의 실제 폭**을 CSS 변수로 알린다.
 *
 * ⭐ **왜 재는가.** [화면 이동]·[사용자 전환]은 `fixed` 로 떠 있어 자리를 만들지 않고, 머리줄이
 *   그 폭만큼 오른쪽을 비워 준다(`app/pop.css` 「로그아웃 자리」·「화면 이동 자리」). 그 폭을
 *   한국어 문구 길이에 맞춘 고정값(95·111px)으로 두었더니, 베트남어 문구가 더 길어 버튼이 비운
 *   칸을 넘어 옆의 단말·연결 상태 표시를 덮었다(실측 2026-09-14). 언어마다 값을 따로 적으면
 *   문구를 고칠 때마다 또 어긋난다 — 그려진 폭을 그대로 쓴다.
 *
 * ⚠ CSS 의 고정값은 **재기 전 첫 그림과 버튼이 사라진 뒤의 되돌림**으로만 남는다.
 *
 * ⚠ `offsetWidth` 로 잰다 — 레이아웃 폭이라 단말 크기 맞춤(`pop-fit` 의 `zoom`)이 걸려도
 *   머리줄 여백과 같은 단위다.
 */
export const useHeaderReservedWidth = (
  ref: RefObject<HTMLElement | null>,
  variable: string,
  /** 버튼이 그려지는가. 거짓이면 변수를 거둬 CSS 되돌림 값으로 돌아간다. */
  visible: boolean,
  /** 재는 폭에 더할 값(px). 옆 항목과의 간격을 자리 폭에 넣는 변수에 쓴다. */
  extra = 0,
): void => {
  useLayoutEffect(() => {
    const element = ref.current;
    const root = document.documentElement;

    if (!visible || element === null) return;

    const apply = () => {
      root.style.setProperty(variable, `${String(element.offsetWidth + extra)}px`);
    };

    apply();

    /* 문구·글꼴이 늦게 풀려 폭이 바뀌어도 따라간다 — 글꼴이 늦게 들어오는 첫 기동이 그렇다. */
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(element);

    return () => {
      observer?.disconnect();
      root.style.removeProperty(variable);
    };
  }, [ref, variable, visible, extra]);
};
