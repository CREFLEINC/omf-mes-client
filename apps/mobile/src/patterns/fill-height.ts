/** 화면이 아주 작아도 이만큼은 보인다. 그보다 작으면 화면 자체가 스크롤한다. */
const MIN_HEIGHT = 160;

/** 화면 바닥과 맨 아래 단추 사이. 좌우 가장자리 여백과 같다 - 단추가 화면 끝에 붙지 않는다. */
const BOTTOM_GAP = 16;

const scrollerOf = (box: HTMLElement): HTMLElement | null => {
  for (let node = box.parentElement; node !== null; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }

  return null;
};

/**
 * 상자 아래에 붙어 오는 것의 높이 - 뒤따르는 형제(단추 · 바닥 바)의 높이와 그 사이 틈, 조상마다의
 * 바닥 여백을 스크롤 상자까지 더한다. 바닥에 떠 있는 것(fixed · absolute)과 숨은 것은 자리를
 * 차지하지 않는다.
 *
 * 위치가 아니라 높이를 더한다 - 바닥 바는 `margin-top: auto` 로 밀려 내려가 있어, 위치로 재면
 * 남는 빈자리까지 「아래에 붙은 것」으로 세어 상자가 자라지 않는다.
 */
const spaceBelow = (box: HTMLElement, scroller: HTMLElement): number => {
  let below = 0;

  for (let node: HTMLElement = box; node !== scroller;) {
    const parent = node.parentElement;
    if (parent === null) break;

    const style = getComputedStyle(parent);
    const gap = parseFloat(style.rowGap) || 0;
    for (
      let sibling = node.nextElementSibling;
      sibling !== null;
      sibling = sibling.nextElementSibling
    ) {
      const own = getComputedStyle(sibling);
      if (own.display === 'none' || own.position === 'fixed' || own.position === 'absolute') {
        continue;
      }
      below += gap + sibling.getBoundingClientRect().height;
    }

    below += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    node = parent;
  }

  return below;
};

/**
 * 스크롤하는 상자(표 등)를 화면 바닥까지 키운다 - 화면 밖으로 넘치지 않고, 밑에 빈자리도 남기지
 * 않는다(사용자 지시 2026-10-22). 위의 것이 펼쳐지거나(필터) 화면 크기가 바뀌면 다시 잰다.
 *
 * 붙일 상자에 ref 로 건다. 상자가 나중에 그려져도(목록을 받은 뒤) 그때 잰다.
 */
const fitTo =
  (gap: number) =>
  (box: HTMLElement | null): (() => void) | undefined => {
    if (box === null) return undefined;
    const scroller = scrollerOf(box);
    if (scroller === null) return undefined;

    const fit = () => {
      const top =
        box.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const height = Math.max(
        MIN_HEIGHT,
        Math.floor(scroller.clientHeight - top - spaceBelow(box, scroller) - gap),
      );
      const value = `${String(height)}px`;
      // 같은 값을 다시 걸지 않는다 - 높이가 바뀌면 지켜보던 부모가 다시 불러 맴돈다.
      if (box.style.maxHeight !== value) box.style.maxHeight = value;
    };

    fit();
    window.addEventListener('resize', fit);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(scroller);
    if (box.parentElement !== null) observer?.observe(box.parentElement);

    return () => {
      window.removeEventListener('resize', fit);
      observer?.disconnect();
    };
  };

export const fillHeightRef = fitTo(BOTTOM_GAP);

/**
 * 바로 아래가 바닥 바일 때 - 바가 제 테두리로 갈라지므로 따로 띄우지 않고 바에 바로 닿는다. 목록이
 * 한 줄이라도 더 보인다(사용자 지시 2026-10-22).
 */
// 12px 은 다른 칸들 사이 간격과 같은 틈(사용자 지시 2026-10-22), 2px 는 소수점 높이를 내려 잴 때의 몫이다.
export const fillAboveBarRef = fitTo(12 + 2);
