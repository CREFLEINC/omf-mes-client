import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MarkerOverlay, type OverlayMarker } from './marker-overlay';

/*
 * 판의 시험.
 *
 * ⭐ **이 부품이 틀리는 방식은 조용하다.** 점이 한 픽셀 밀리거나, 고르려다 옮겨지거나, 잠긴
 * 판이 눌리는 것은 화면에서 멀쩡해 보인다 — 저장하고 나서야 드러난다. 그래서 「무엇이
 * 보이는가」가 아니라 **「밖으로 어떤 값이 나갔는가」**를 잰다.
 *
 * ⚠ **jsdom 은 배치를 계산하지 않는다.** `getBoundingClientRect` 가 늘 0 이라 비율을 낼 수
 * 없으므로 판의 칸을 손으로 세워 준다(아래 `BOARD_RECT`). 이 스텁이 없으면 좌표를 다루는
 * 시험이 전부 「판이 0 픽셀」이라는 이유로 조용히 통과해 버린다.
 */

const IMAGE_LABEL = '창고 도면';

/**
 * 200×100 짜리 판. 가로 20px = 0.1, 세로 20px = 0.2 로 떨어져 셈이 눈으로 확인된다.
 *
 * ⛔ **판을 원점에 세우지 않는다.** `left`·`top` 이 0 이면 화면 좌표에서 판의 자리를 빼는
 * 계산이 있으나 없으나 같은 값이 나온다 — 점이 **통째로 어긋나는** 결함을 시험이 통과시킨다.
 * 실제 판은 머리줄·구획 아래에 서므로 원점에 있을 일이 없다.
 */
const BOARD_RECT = { left: 40, top: 30, width: 200, height: 100 };

const MARKERS: OverlayMarker[] = [{ id: '7', x: 0.1, y: 0.2, label: 'A-01' }];

/** 표식이 둘일 때만 드러나는 것들 — 남의 드래그 가드, 설명 id 의 섞임. */
const TWO_MARKERS: OverlayMarker[] = [
  { id: '7', x: 0.1, y: 0.2, label: 'A-01' },
  { id: '8', x: 0.3, y: 0.4, label: 'A-02' },
];

/** 잠긴 판의 설명. 부품은 말을 갖지 않으므로 시험이 넘겨 준다. */
const LOCKED_NOTE = '지금은 점을 찍거나 옮길 수 없습니다. 고르기는 됩니다.';

const stubRect = (element: HTMLElement): void => {
  element.getBoundingClientRect = (): DOMRect =>
    ({
      ...BOARD_RECT,
      right: BOARD_RECT.left + BOARD_RECT.width,
      bottom: BOARD_RECT.top + BOARD_RECT.height,
      x: BOARD_RECT.left,
      y: BOARD_RECT.top,
      toJSON: () => ({}),
    }) as DOMRect;
};

type BoardProps = ComponentProps<typeof MarkerOverlay>;

interface Harness {
  board: HTMLElement;
  pin: (label?: string) => HTMLElement;
  live: HTMLElement;
  /** 같은 판을 새 props 로 다시 그린다 — 드래그 도중에 밖이 바뀌는 일을 재려면 필요하다. */
  update: (next: Partial<BoardProps>) => void;
  onPlace: ReturnType<typeof vi.fn>;
  onSelect: ReturnType<typeof vi.fn>;
  onMove: ReturnType<typeof vi.fn>;
}

const setup = (props: Partial<BoardProps> = {}): Harness => {
  const onPlace = vi.fn();
  const onSelect = vi.fn();
  const onMove = vi.fn();

  const view = (extra: Partial<BoardProps> = {}) => (
    <MarkerOverlay
      src="blob:map"
      imageLabel={IMAGE_LABEL}
      markers={MARKERS}
      onPlace={onPlace}
      onSelect={onSelect}
      onMove={onMove}
      {...props}
      {...extra}
    />
  );

  const { container, rerender } = render(view());

  const board = screen.getByRole('group', { name: IMAGE_LABEL });
  const live = container.querySelector<HTMLElement>('[aria-live="polite"]');

  if (live === null) throw new Error('낭독 영역이 서 있지 않습니다.');

  stubRect(board);

  return {
    board,
    live,
    pin: (label = 'A-01') => screen.getByRole('button', { name: label }),
    update: (next) => {
      rerender(view(next));
    },
    onPlace,
    onSelect,
    onMove,
  };
};

/** 마우스 왼쪽 버튼으로 누른다 — 기본값에 기대지 않는다(빈 `pointerType` 은 마우스가 아니다). */
const press = (target: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  });
};

/** ⚠ **`buttons` 를 반드시 준다** — jsdom 의 기본값은 0 이고, 그것은 「버튼을 뗐다」는 뜻이다. */
const moveTo = (target: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent.pointerMove(target, {
    pointerId: 1,
    pointerType: 'mouse',
    buttons: 1,
    clientX,
    clientY,
  });
};

/** 버튼을 뗀 채 지나가는 마우스. 끌고 있던 것이 아니다. */
const hoverTo = (target: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent.pointerMove(target, {
    pointerId: 1,
    pointerType: 'mouse',
    buttons: 0,
    clientX,
    clientY,
  });
};

const release = (target: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: 'mouse', clientX, clientY });
};

/** 손가락으로 누른다 — 터치는 `button` 번호를 따지지 않는다. */
const touchDown = (
  target: HTMLElement,
  pointerId: number,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerDown(target, { pointerId, pointerType: 'touch', button: -1, clientX, clientY });
};

const touchMove = (
  target: HTMLElement,
  pointerId: number,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerMove(target, { pointerId, pointerType: 'touch', clientX, clientY });
};

const touchUp = (
  target: HTMLElement,
  pointerId: number,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerUp(target, { pointerId, pointerType: 'touch', clientX, clientY });
};

describe('MarkerOverlay — 놓기', () => {
  it('⭐ 빈 자리를 누르면 픽셀이 아니라 비율이 나간다', () => {
    const { board, onPlace } = setup();

    fireEvent.click(board, { clientX: 90, clientY: 55 });

    expect(onPlace).toHaveBeenCalledWith(0.25, 0.25);
  });

  it('⭐ 판 밖으로 나간 자리도 0~1 로 묶인다', () => {
    const { board, onPlace } = setup();

    fireEvent.click(board, { clientX: -40, clientY: 400 });

    expect(onPlace).toHaveBeenCalledWith(0, 1);
  });

  it('⛔ 표식을 누른 것은 놓기가 아니다 — 고르는 순간 점이 하나 더 생기면 안 된다', () => {
    const { pin, onPlace, onSelect } = setup();

    fireEvent.click(pin());

    expect(onSelect).toHaveBeenCalledWith('7');
    expect(onPlace).not.toHaveBeenCalled();
  });
});

describe('MarkerOverlay — 화살표로 밀기', () => {
  it('⭐ 한 번에 `step` 만큼 민다 — 마우스 없이도 옮길 수 있어야 한다', () => {
    const { pin, onMove } = setup();

    fireEvent.keyDown(pin(), { key: 'ArrowRight' });
    expect(onMove).toHaveBeenCalledWith('7', 0.11, 0.2);

    fireEvent.keyDown(pin(), { key: 'ArrowUp' });
    expect(onMove).toHaveBeenLastCalledWith('7', 0.1, 0.19);
  });

  it('⭐ `step` 은 밖에서 정한다', () => {
    const { pin, onMove } = setup({ step: 0.05 });

    fireEvent.keyDown(pin(), { key: 'ArrowDown' });

    expect(onMove).toHaveBeenCalledWith('7', 0.1, 0.25);
  });

  it('⛔ 판 밖으로는 못 민다 — 가장자리에서는 0·1 에 머문다', () => {
    const { pin, onMove } = setup({ markers: [{ id: '7', x: 0, y: 1, label: 'A-01' }] });

    fireEvent.keyDown(pin(), { key: 'ArrowLeft' });
    expect(onMove).toHaveBeenCalledWith('7', 0, 1);

    fireEvent.keyDown(pin(), { key: 'ArrowDown' });
    expect(onMove).toHaveBeenLastCalledWith('7', 0, 1);
  });

  it('화살표가 아닌 키는 건드리지 않는다', () => {
    const { pin, onMove } = setup();

    fireEvent.keyDown(pin(), { key: 'a' });

    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('MarkerOverlay — 끌어 옮기기', () => {
  it('⛔ 2px 떨림은 이동이 아니다 — 고르려는 손이 점을 밀면 안 된다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 62, 50);
    release(marker, 62, 50);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('⭐ 임계값을 넘으면 그때부터 매 이동이 나간다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 64, 50);
    expect(onMove).toHaveBeenCalledWith('7', 0.12, 0.2);

    moveTo(marker, 80, 80);
    expect(onMove).toHaveBeenLastCalledWith('7', 0.2, 0.5);
    expect(onMove).toHaveBeenCalledTimes(2);

    release(marker, 80, 80);
  });

  /*
   * ⭐ **임계값은 «넘으면»이 아니라 «닿으면»이다.** 경계를 어느 쪽으로 두었는지 재 두지 않으면
   * 나중에 부등호가 뒤집혀도 아무 시험도 깨지지 않는다. 대각선까지 재는 것은 거리가 축별
   * 차이가 아니라 빗변이기 때문이다 — 축마다 따로 재는 구현으로 바뀌면 여기서 걸린다.
   */
  it('⭐ 마우스 임계값의 경계 — 딱 3px 은 드래그, 2.9px 과 대각선 2·2 는 아니다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 62.9, 50);
    expect(onMove).not.toHaveBeenCalled();

    /* 빗변 2.83px — 축으로는 각각 2px 이지만 거리로는 임계값 아래다. */
    moveTo(marker, 62, 52);
    expect(onMove).not.toHaveBeenCalled();

    /* 다시 눌러 시작점을 되세우고, 이번에는 정확히 3px 을 움직인다. */
    press(marker, 60, 50);
    moveTo(marker, 63, 50);

    expect(onMove).toHaveBeenCalledWith('7', 0.115, 0.2);
  });

  /*
   * ⭐ **손가락에는 더 후한 임계값을 준다.** 접점이 넓어 탭 한 번에도 5~7px 이 흔들리는데,
   * 그것을 드래그로 치면 뒤따르는 click 이 삼켜져 **표식이 아예 골라지지 않는다.**
   */
  it('⭐ 손가락의 6px 떨림은 드래그가 아니다 — 탭이 고르기로 남는다', () => {
    const { pin, onMove, onSelect } = setup();
    const marker = pin();

    touchDown(marker, 5, 60, 50);
    touchMove(marker, 5, 66, 50);
    touchUp(marker, 5, 66, 50);
    fireEvent.click(marker);

    expect(onMove).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('7');
  });

  it('⭐ 손가락도 임계값을 넘으면 끌린다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    touchDown(marker, 5, 60, 50);
    touchMove(marker, 5, 70, 50);

    expect(onMove).toHaveBeenCalledWith('7', 0.15, 0.2);
  });

  it('⛔ 옮기고 손을 뗀 직후의 click 은 고르기가 아니다', () => {
    const { pin, onSelect } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    release(marker, 80, 80);
    fireEvent.click(marker);

    expect(onSelect).not.toHaveBeenCalled();

    /* 삼키는 것은 그 한 번뿐이다 — 다음 누름은 평소대로 고른다. */
    press(marker, 80, 80);
    release(marker, 80, 80);
    fireEvent.click(marker);

    expect(onSelect).toHaveBeenCalledWith('7');
  });

  it('⛔ 옮기다 놓은 자리가 판에 새어 새 점이 되지 않는다', () => {
    const { board, pin, onPlace } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    release(marker, 80, 80);
    /* 붙들기가 끊겼다면 이 click 이 «판»으로 온다. */
    fireEvent.click(board, { clientX: 80, clientY: 80 });

    expect(onPlace).not.toHaveBeenCalled();
  });

  /*
   * ⭐ **click 이 오지 않는 드래그가 흔하다.** 브라우저는 터치 드래그 뒤에도 `pointercancel`
   * 뒤에도 click 을 보내지 않는다. 그러면 세워 둔 「삼킬 click」 표가 쓰이지 못한 채 남아
   * **다음 판 누름**을 대신 먹는다 — 사용자에게는 한 번 씹히는 판이 된다. 아래 둘은 그 묵은
   * 표가 지워지는지를 잰다.
   */
  it('⛔ 터치 드래그 뒤 click 이 없어도 다음 판 누름이 씹히지 않는다', () => {
    const { board, pin, onPlace } = setup();
    const marker = pin();

    touchDown(marker, 5, 60, 50);
    touchMove(marker, 5, 80, 80);
    touchUp(marker, 5, 80, 80);
    /* 여기서 click 이 오지 않는다 — 삼킬 표만 남는다. */

    touchDown(board, 6, 140, 80);
    touchUp(board, 6, 140, 80);
    fireEvent.click(board, { clientX: 140, clientY: 80 });

    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(0.5, 0.5);
  });

  it('⛔ `pointercancel` 로 끝난 드래그도 다음 판 누름을 먹지 않는다', () => {
    const { board, pin, onPlace } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    fireEvent.pointerCancel(marker, { pointerId: 1, pointerType: 'mouse' });

    press(board, 140, 80);
    release(board, 140, 80);
    fireEvent.click(board, { clientX: 140, clientY: 80 });

    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(0.5, 0.5);
  });

  it('움직이지 않은 누름 뒤의 click 은 그대로 고르기다', () => {
    const { pin, onSelect } = setup();
    const marker = pin();

    press(marker, 60, 50);
    release(marker, 60, 50);
    fireEvent.click(marker);

    expect(onSelect).toHaveBeenCalledWith('7');
  });

  it('⛔ 오른쪽 버튼으로는 끌지 않는다 — 상황 메뉴를 부르다 점이 옮겨지면 안 된다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    fireEvent.pointerDown(marker, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 2,
      buttons: 2,
      clientX: 60,
      clientY: 50,
    });
    moveTo(marker, 80, 80);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('⭐ 손가락은 버튼 번호를 따지지 않는다 — 터치는 `button: 0` 이 아니어도 끌린다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    touchDown(marker, 5, 60, 50);
    touchMove(marker, 5, 80, 80);

    expect(onMove).toHaveBeenCalledWith('7', 0.2, 0.5);
  });

  it('⛔ 이미 끌고 있으면 두 번째 손가락이 드래그를 빼앗지 않는다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    touchDown(marker, 5, 60, 50);
    /* 두 번째 손가락. 슬롯을 덮으면 첫 손가락의 이동이 「남의 드래그」가 되어 사라진다. */
    touchDown(marker, 6, 100, 90);

    touchMove(marker, 5, 80, 80);
    expect(onMove).toHaveBeenCalledWith('7', 0.2, 0.5);

    /* 받아 주지 않은 손가락의 이동은 드래그가 아니다. */
    touchMove(marker, 6, 140, 110);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('⭐ 제스처를 빼앗기면(`pointercancel`) 드래그가 끝난다 — 유령 이동이 남지 않는다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    fireEvent.pointerCancel(marker, { pointerId: 1, pointerType: 'mouse' });
    moveTo(marker, 80, 80);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('다른 포인터의 이동은 남의 드래그가 아니다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    fireEvent.pointerMove(marker, { pointerId: 9, pointerType: 'touch', clientX: 80, clientY: 80 });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('⛔ 끌던 표식이 아닌 이웃의 이동은 나가지 않는다', () => {
    const { pin, onMove } = setup({ markers: TWO_MARKERS });

    press(pin('A-01'), 60, 50);
    /* 손이 이웃 표식 위를 지난다 — 잡은 것은 A-01 이다. */
    moveTo(pin('A-02'), 80, 80);

    expect(onMove).not.toHaveBeenCalled();
  });
});

/*
 * ⭐ **놓기를 못 받은 드래그는 끝나지 않고 남는다.** 붙들기가 끊기거나, 창 밖에서 손을 뗐거나,
 * 끌던 표식이 사라지면 pointerup 이 오지 않는다. 남은 드래그는 슬롯을 차지한 채 **그 뒤의
 * 모든 드래그를 말없이 거절한다** — 화면에는 「점이 안 끌린다」로만 보인다. 아래는 그 빠져나갈
 * 길들이다.
 */
describe('MarkerOverlay — 끝나지 못한 드래그', () => {
  it('⭐ 붙들기가 끊기면(`lostpointercapture`) 거기서 끝나고, 다음 드래그가 된다', () => {
    const { pin, live, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    expect(onMove).toHaveBeenCalledTimes(1);

    fireEvent.lostPointerCapture(marker, { pointerId: 1, pointerType: 'mouse' });

    /* 끊긴 뒤의 이동은 남의 것이다. */
    moveTo(marker, 100, 90);
    expect(onMove).toHaveBeenCalledTimes(1);
    /* 사람이 끝낸 이동이 아니므로 읽어 주지 않는다. */
    expect(live.textContent).toBe('');

    /* ⭐ 여기가 본론 — 슬롯이 비어 새 드래그가 선다. */
    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('⭐ 버튼을 뗀 채 지나가는 마우스는 드래그를 버린다 — 커서를 따라오지 않는다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    hoverTo(marker, 80, 80);

    expect(onMove).not.toHaveBeenCalled();

    /* 버린 뒤에도 슬롯은 비어 있어야 한다 — 다음 드래그가 그대로 선다. */
    press(marker, 60, 50);
    moveTo(marker, 80, 80);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('7', 0.2, 0.5);
  });

  it('⭐ 마우스가 다시 누르면 묵은 드래그를 대신한다 — 임계값이 새 누름에서 다시 센다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    /* 놓기를 못 받은 드래그가 남아 있다. */
    press(marker, 60, 50);
    /* 같은 마우스가 다른 자리에서 다시 누른다. */
    press(marker, 100, 90);

    /* 새 누름에서 1px — 묵은 시작점(60,50)을 그대로 쓰면 여기서 이미 이동이 나간다. */
    moveTo(marker, 101, 90);
    expect(onMove).not.toHaveBeenCalled();

    moveTo(marker, 105, 90);
    expect(onMove).toHaveBeenCalledWith('7', 0.325, 0.6);
  });

  it('⭐ 끌던 표식이 사라지면 다른 표식을 끌 수 있다', () => {
    const { pin, update, onMove } = setup({ markers: TWO_MARKERS });

    /* 첫 손가락이 A-01 을 잡은 채 A-01 이 목록에서 빠진다 — pointerup 이 올 자리가 없다. */
    touchDown(pin('A-01'), 5, 60, 50);
    update({ markers: TWO_MARKERS.slice(1) });

    /* 다른 손가락(다른 `pointerId`)으로 남은 표식을 끈다. */
    touchDown(pin('A-02'), 6, 100, 90);
    touchMove(pin('A-02'), 6, 120, 110);

    expect(onMove).toHaveBeenCalledWith('8', 0.4, 0.8);
  });

  it('⛔ 끌던 도중에 판이 잠기면 이동이 더 나가지 않는다', () => {
    const { pin, update, onMove } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    expect(onMove).toHaveBeenCalledTimes(1);

    update({ readOnly: true });

    moveTo(marker, 100, 90);
    moveTo(marker, 120, 100);

    expect(onMove).toHaveBeenCalledTimes(1);
  });
});

describe('MarkerOverlay — 삼킬 click 의 시간창', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * ⛔ **표를 무기한 세워 두지 않는다.** click 이 끝내 오지 않는 드래그가 흔한데, 남은 표는
   * 한참 뒤 낭독기·음성 제어가 보내는 첫 click 을 대신 먹는다 — 그 사람에게는 표식이 한 번
   * 골라지지 않는다.
   */
  it('⭐ 한참 뒤에 온 click 은 삼키지 않는다 — 늦게 오는 조작이 있다', () => {
    vi.useFakeTimers({ toFake: ['performance'] });

    const { pin, onSelect } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    release(marker, 80, 80);

    vi.advanceTimersByTime(600);
    fireEvent.click(marker);

    expect(onSelect).toHaveBeenCalledWith('7');
  });
});

describe('MarkerOverlay — 잠긴 판', () => {
  /*
   * ⛔ **`aria-disabled` 로 재지 않는다** — 그 속성은 안의 표식까지 「사용 불가」로 들리게 하는데
   * 잠긴 판에서도 고르기는 된다. ⛔ **`aria-readonly` 도 아니다** — `group` 이 받지 않는
   * 속성이라 낭독기가 통째로 버린다. 남는 길은 설명 문구이고, 문구는 밖에서 온다.
   */
  it('⭐ 잠긴 사실이 판의 설명으로 전해진다', () => {
    const { board } = setup({ readOnly: true, describeReadOnly: LOCKED_NOTE });

    expect(board).toHaveAccessibleDescription(LOCKED_NOTE);
    expect(board).not.toHaveAttribute('aria-disabled');
    expect(board).not.toHaveAttribute('aria-readonly');
  });

  it('⛔ 문구를 받지 못하면 설명도 없다 — 부품이 제 말을 지어내지 않는다', () => {
    const { board } = setup({ readOnly: true });

    expect(board).not.toHaveAccessibleDescription();
  });

  it('잠기지 않은 판에는 잠금 설명이 붙지 않는다', () => {
    const { board } = setup({ describeReadOnly: LOCKED_NOTE });

    expect(board).not.toHaveAccessibleDescription();
  });

  it('⛔ 잠긴 동안에는 눌러도 점이 생기지 않고 끌어도 옮겨지지 않는다', () => {
    const { board, pin, onPlace, onMove } = setup({ readOnly: true });
    const marker = pin();

    fireEvent.click(board, { clientX: 90, clientY: 55 });
    fireEvent.keyDown(marker, { key: 'ArrowRight' });
    press(marker, 60, 50);
    moveTo(marker, 80, 80);
    release(marker, 80, 80);

    expect(onPlace).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('⭐ 잠겨도 고르기는 된다 — 읽기 전용이지 못 보는 것이 아니다', () => {
    const { pin, onSelect } = setup({ readOnly: true });

    fireEvent.click(pin());

    expect(onSelect).toHaveBeenCalledWith('7');
  });
});

describe('MarkerOverlay — 듣는 사람에게 보이는 판', () => {
  it('⭐ 판은 이름을 가진 묶음이다 — `application` 이 아니다', () => {
    const { board } = setup();

    expect(board).toHaveAttribute('role', 'group');
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('⭐ 표식의 이름은 보이는 말과 같고, 자리는 설명으로 딸린다 — 기본값은 숫자뿐이다', () => {
    const { pin, live } = setup();

    expect(pin()).toHaveAccessibleName('A-01');
    expect(pin()).toHaveAccessibleDescription('10% / 20%');

    fireEvent.keyDown(pin(), { key: 'ArrowRight' });

    expect(live).toHaveTextContent('A-01: 11% / 20%');
  });

  /* ⛔ 표식이 여럿이면 설명이 섞이기 쉽다 — 각자 제 자리를 말해야 한다. */
  it('⭐ 표식마다 제 자리 설명을 갖는다', () => {
    const { pin } = setup({ markers: TWO_MARKERS });

    expect(pin('A-01')).toHaveAccessibleDescription('10% / 20%');
    expect(pin('A-02')).toHaveAccessibleDescription('30% / 40%');
  });

  it('⭐ 문구는 밖에서 받는다 — 판이 한 나라 말을 품지 않는다', () => {
    const { pin, live } = setup({
      describePosition: (xPercent, yPercent) =>
        `Ngang ${String(xPercent)}%, dọc ${String(yPercent)}%`,
      describeMove: (label, xPercent, yPercent) =>
        `${label}: Ngang ${String(xPercent)}%, dọc ${String(yPercent)}%`,
    });

    expect(pin()).toHaveAccessibleDescription('Ngang 10%, dọc 20%');

    fireEvent.keyDown(pin(), { key: 'ArrowRight' });

    expect(live).toHaveTextContent('A-01: Ngang 11%, dọc 20%');
  });

  it('⭐ 드래그는 **끝에서 한 번만** 읽는다 — 이동마다 읽으면 낭독기가 폭주한다', () => {
    const { pin, live } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 64, 50);
    moveTo(marker, 80, 80);

    /* 끄는 동안에는 말이 없다. */
    expect(live.textContent).toBe('');

    release(marker, 80, 80);

    expect(live).toHaveTextContent('A-01: 20% / 50%');
  });

  it('⛔ 임계값 안에서 끝난 누름은 아무 말도 하지 않는다', () => {
    const { pin, live } = setup();
    const marker = pin();

    press(marker, 60, 50);
    moveTo(marker, 62, 50);
    release(marker, 62, 50);

    expect(live.textContent).toBe('');
  });
});

describe('MarkerOverlay — 그림이 없을 때', () => {
  it('⭐ 안내와 표식이 «함께» 선다 — 도면을 받는 동안 편집 중인 점이 사라지면 안 된다', () => {
    const { pin } = setup({ src: undefined, placeholder: '도면을 올려 주세요.' });

    expect(screen.getByText('도면을 올려 주세요.')).toBeInTheDocument();
    expect(pin()).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('그림이 없어도 빈 자리를 눌러 점을 놓을 수 있다', () => {
    const { board, onPlace } = setup({ src: undefined, placeholder: '도면을 올려 주세요.' });

    fireEvent.click(board, { clientX: 140, clientY: 80 });

    expect(onPlace).toHaveBeenCalledWith(0.5, 0.5);
  });
});
