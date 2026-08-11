import type userEvent from '@testing-library/user-event';

/**
 * 디자인 시스템 `DatePicker`를 감지기에서 조작하는 수단.
 *
 * `TextField type="date"`일 때는 값을 글자로 넣으면 그만이었지만, `DatePicker`는 **달력을 열어
 * 날을 누르는** 위젯이다. 그 조작을 감지기마다 손으로 적으면 달 넘김·팝업 범위 같은 잔손질이
 * 화면 슬라이스 곳곳에 복사되고, DS가 마크업을 고칠 때 고칠 자리가 흩어진다.
 * `src/test/api-harness`와 같은 자리에 두어 **한 곳에서 고치면 전 감지기에 반영되게** 한다.
 *
 * 셀을 `data-date`로 집는다. DS가 그 속성을 자기 감지기에서 같은 방법으로 쓰고 있어
 * 우리가 임의로 정한 손잡이가 아니다. 날짜 숫자로 집으면 어느 달의 15일인지 가릴 수 없다.
 */

type User = ReturnType<typeof userEvent.setup>;

/** 달 넘김 상한. 달력이 목표 달에 닿지 못하는 상황을 무한 반복 대신 실패로 드러낸다. */
const MAX_MONTH_STEPS = 36;

/**
 * 트리거에 딸린 달력 팝업. **트리거의 뿌리 안에서만** 찾는다 —
 * 화면에는 폼 대화상자도 `role="dialog"`라 문서 전체에서 찾으면 엉뚱한 것을 집는다.
 */
const calendarOf = (trigger: HTMLElement): HTMLElement => {
  const root = trigger.parentElement;
  const popup = root?.querySelector<HTMLElement>('[role="dialog"]') ?? null;

  if (popup === null) throw new Error('달력이 열려 있지 않다');

  return popup;
};

const cellOf = (calendar: HTMLElement, date: string): HTMLElement | null =>
  calendar.querySelector<HTMLElement>(`td[data-date="${date}"]`);

/** 지금 보이는 달의 아무 날. 목표 날짜가 앞인지 뒤인지 재는 기준으로만 쓴다. */
const visibleDateOf = (calendar: HTMLElement): string => {
  const anyCell = calendar.querySelector<HTMLElement>('td[data-date]');
  const visible = anyCell?.getAttribute('data-date') ?? null;

  if (visible === null) throw new Error('달력에 날짜 셀이 없다');

  return visible;
};

/**
 * 열린 달력을 목표 날짜가 있는 달까지 넘긴다.
 *
 * 값이 빈 칸은 **오늘**이 있는 달에서 열린다. 목표 달을 계산해 넘기지 않고 특정 달이 보인다고
 * 믿으면, 감지기의 결과가 실행하는 날에 따라 달라진다.
 */
const goToMonthOf = async (user: User, calendar: HTMLElement, date: string): Promise<void> => {
  for (let step = 0; step < MAX_MONTH_STEPS; step += 1) {
    if (cellOf(calendar, date) !== null) return;

    const forward = date > visibleDateOf(calendar);
    const nav = calendar.querySelector<HTMLElement>(
      `button[aria-label="${forward ? '다음 달' : '이전 달'}"]`,
    );

    if (nav === null || (nav as HTMLButtonElement).disabled) {
      throw new Error(`달력을 ${date}까지 넘길 수 없다`);
    }

    await user.click(nav);
  }

  throw new Error(`${MAX_MONTH_STEPS}달을 넘겨도 ${date}에 닿지 못했다`);
};

/**
 * 날짜 칸에서 날짜 하나를 고른다. 단일 모드는 이 한 번으로 값이 확정된다.
 *
 * 기간 모드는 **두 번 불러야** 값이 나간다 — 컴포넌트가 완결된 쌍만 방출한다.
 */
export const pickDate = async (user: User, trigger: HTMLElement, date: string): Promise<void> => {
  await user.click(trigger);

  const calendar = calendarOf(trigger);
  await goToMonthOf(user, calendar, date);

  const cell = cellOf(calendar, date);
  if (cell === null) throw new Error(`${date} 셀을 찾지 못했다`);

  await user.click(cell);
};

/**
 * 기간 칸에서 시작과 종료를 잇달아 고른다.
 *
 * 달력이 한 번 열린 채로 두 날을 받으므로 `pickDate`를 두 번 부르는 것과 다르다 —
 * 첫 선택 뒤에는 팝업이 닫히지 않는다.
 */
export const pickRange = async (
  user: User,
  trigger: HTMLElement,
  from: string,
  to: string,
): Promise<void> => {
  await user.click(trigger);

  const calendar = calendarOf(trigger);

  await goToMonthOf(user, calendar, from);
  const fromCell = cellOf(calendar, from);
  if (fromCell === null) throw new Error(`${from} 셀을 찾지 못했다`);
  await user.click(fromCell);

  await goToMonthOf(user, calendar, to);
  const toCell = cellOf(calendar, to);
  if (toCell === null) throw new Error(`${to} 셀을 찾지 못했다`);
  await user.click(toCell);
};
