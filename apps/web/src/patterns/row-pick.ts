import type { KeyboardEvent, MouseEvent } from 'react';

/**
 * 목록 줄 고르기(사용자 지시 2026-11-26 · omf-all-around#360 — 「선택」 칸만이 아니라 줄 아무 곳이나 눌러 상세를 연다,
 * 모든 화면 같은 동작 · 고른 줄은 파랑).
 *
 * 줄마다 상세를 여는 단추(번호 칸) 하나에 `ROW_PICK_CLASS` 를 달고, 표를 감싼 상자에 `rowPickHandlers` 를 펼친다.
 * - 줄 아무 곳이나 누르면 그 줄의 고르는 단추를 누른다 — 상세를 여는 함수는 단추의 것 그대로다.
 * - 이미 고른 줄은 다시 눌러도(빈 칸이든 고르는 단추든, Enter 든) 아무 일도 없다 — 적던 입력이 확인 없이
 *   지워지지 않게 한다(omf-all-around#360). 다른 줄을 누르면 그 줄로 바뀐다.
 * - 줄 안의 다른 단추 · 입력 · 체크 · 링크를 누른 것은 그쪽이 받는다.
 * - 고르는 단추에 초점이 있으면 위아래 방향키로 앞뒤 줄의 단추로 옮긴다(Enter 는 단추가 받는다).
 * - 고른 상태는 단추의 `aria-current="true"` 또는 `aria-pressed="true"` 로 읽는다. 고른 줄 칠하기와 단추를 보통
 *   글자처럼 보이게 하는 것은 app.css 의 `.row-pick` 규칙(공용 파랑)이 맡는다.
 */
export const ROW_PICK_CLASS = 'row-pick';

const INTERACTIVE =
  'button, a, input, select, textarea, label, [role="checkbox"], [role="combobox"], [role="button"]';

const pickOf = (row: Element | null | undefined): HTMLButtonElement | null =>
  row?.querySelector<HTMLButtonElement>(`.${ROW_PICK_CLASS}:not(:disabled)`) ?? null;

const isPicked = (pick: Element): boolean =>
  pick.getAttribute('aria-current') === 'true' || pick.getAttribute('aria-pressed') === 'true';

export const rowPickHandlers = {
  /* 고른 줄의 고르는 단추를 직접 눌렀을 때 — 단추의 함수(종전 토글 등)에 닿기 전에 막는다. */
  onClickCapture: (event: MouseEvent<HTMLElement>): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pick = target.closest(`.${ROW_PICK_CLASS}`);
    if (pick !== null && isPicked(pick)) event.stopPropagation();
  },
  onClick: (event: MouseEvent<HTMLElement>): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(INTERACTIVE) !== null) return;
    const pick = pickOf(target.closest('tbody tr'));
    if (pick === null || isPicked(pick)) return;
    pick.click();
  },
  onKeyDown: (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains(ROW_PICK_CLASS)) return;
    const step = (row: Element | null | undefined): Element | null | undefined =>
      event.key === 'ArrowDown' ? row?.nextElementSibling : row?.previousElementSibling;
    let row = step(target.closest('tr'));
    while (row != null && pickOf(row) === null) row = step(row);
    const next = pickOf(row);
    if (next === null) return;
    event.preventDefault();
    next.focus();
  },
};
