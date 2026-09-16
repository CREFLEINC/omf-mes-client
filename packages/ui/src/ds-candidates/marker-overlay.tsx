import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import './marker-overlay.css';

/** 판 위의 점 하나. 자리는 픽셀이 아니라 판에 대한 비율이다. */
export interface OverlayMarker {
  id: string;
  /** 0~1. 판 왼쪽에서의 비율. */
  x: number;
  /** 0~1. 판 위쪽에서의 비율. */
  y: number;
  label: string;
  selected?: boolean;
}

export interface MarkerOverlayProps {
  /** 배경 그림 주소. 없으면 빈 판을 그리고 `placeholder` 를 보인다. */
  src?: string;
  /** 그림을 대신할 말. 화면 낭독기는 배치를 읽을 수 없다. */
  imageLabel: string;
  markers: OverlayMarker[];
  /** 그림이 없을 때 판 가운데 보일 것. */
  placeholder?: ReactNode;
  /** 판 전체를 읽기 전용으로 둔다 — 놓기·옮기기가 막힌다. 고르기는 그대로 된다. */
  readOnly?: boolean;
  /** 화살표 한 번에 움직이는 비율. 기본 0.01 (판의 1%). */
  step?: number;
  /** 빈 자리를 눌렀다 — 비율 좌표를 준다. */
  onPlace?: (x: number, y: number) => void;
  onSelect?: (id: string) => void;
  /** 표식을 옮겼다 — 옮긴 뒤의 비율 좌표를 준다. */
  onMove?: (id: string, x: number, y: number) => void;
  /**
   * 표식 좌표 설명 — 「가로 N%, 세로 N%」. 낭독기 전용. 없으면 숫자만 낸다(`"10% / 20%"`).
   *
   * 받는 두 값은 **0~100 의 정수 백분율**이다(비율 0~1 이 아니다) — 듣는 사람이 셀 수 있게
   * 이미 반올림해 둔 값이다.
   */
  describePosition?: (xPercent: number, yPercent: number) => string;
  /**
   * 옮긴 뒤 알림 — 「<label>: 가로 N%, 세로 N%」. 없으면 `"<label>: 10% / 20%"`.
   *
   * 좌표 두 값은 `describePosition` 과 같은 **0~100 의 정수 백분율**이다.
   */
  describeMove?: (label: string, xPercent: number, yPercent: number) => string;
  /**
   * 잠긴 판이 무엇을 막고 무엇은 허락하는지 듣는 사람에게 전할 말. 낭독기 전용.
   *
   * `readOnly` 일 때만 판의 설명으로 붙는다. 주지 않으면 설명도 붙지 않는다 — 이 부품은
   * 스스로 말을 만들지 않는다.
   */
  describeReadOnly?: string;
}

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** 소수점 넷째 자리까지 — 그보다 잘게 저장해 봐야 화면에서 구분되지 않는다. */
const round = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * 누르고 이 거리를 넘기 전까지는 **누른 것이지 끈 것이 아니다**(px).
 *
 * ⭐ 임계값이 없으면 점을 «고르려고» 누르는 손의 1~2px 떨림이 그대로 이동이 되어, 고를
 * 때마다 점이 조금씩 밀린다. 그 밀림은 저장 전까지 아무도 눈치채지 못한다.
 */
const DRAG_THRESHOLD_PX = 3;

/**
 * 손가락의 임계값(px). 마우스보다 후하다.
 *
 * ⭐ **손가락 탭은 가만히 있지 못한다.** 접점이 넓어 누르는 동안 5~7px 이 예사로 흔들리는데,
 * 그것을 드래그로 치면 뒤따르는 click 을 삼켜 **표식이 아예 골라지지 않는다** — 화면에는
 * 「눌렀는데 아무 일도 없다」로만 보인다.
 */
const DRAG_THRESHOLD_TOUCH_PX = 8;

/**
 * 드래그 뒤 click 을 삼켜 주는 시간창(ms).
 *
 * ⭐ **표를 무기한 세워 두지 않는다.** click 이 끝내 오지 않는 드래그가 흔한데(터치·빼앗긴
 * 제스처), 남은 표는 한참 뒤 낭독기·음성 제어가 보내는 click 을 대신 먹는다. 진짜로 뒤따르는
 * click 은 pointerup 과 같은 틱에 가깝게 오므로 이만큼이면 넉넉하다.
 */
const CLICK_SWALLOW_WINDOW_MS = 500;

/** 낭독용 백분율. 사람이 듣는 값이라 정수로 줄인다 — 「가로 10.37%」는 아무도 못 센다. */
const percent = (value: number): number => Math.round(value * 100);

/** 문구를 받지 못했을 때의 자리 — 언어 중립이라 어느 말로 듣든 틀리지 않는다. */
const plainPosition = (x: number, y: number): string =>
  `${String(percent(x))}% / ${String(percent(y))}%`;

interface DragState {
  id: string;
  pointerId: number;
  /** 누를 때의 종류. 임계값이 손가락과 마우스에서 다르다. */
  pointerType: string;
  startX: number;
  startY: number;
  /** 임계값을 넘어 «이동»이 된 적이 있는가. */
  moved: boolean;
  /** 마지막으로 내보낸 비율 — 드래그가 끝날 때 한 번만 읽어 주려고 들고 있는다. */
  last: { x: number; y: number } | null;
}

/**
 * 그림 위에 **비율 좌표**로 표식을 놓고 고르고 옮기는 판.
 *
 * ⭐ **좌표는 픽셀이 아니라 0~1 의 비율이다.** 판이 커지거나 그림이 바뀌어도 표식이 같은
 * 상대 위치를 가리킨다 — 픽셀로 두면 창을 줄이는 것만으로 점이 전부 어긋난다. 그래서 이
 * 부품은 **픽셀을 밖으로 내보내지 않는다**: 받는 것도 주는 것도 비율뿐이다.
 *
 * ⭐ **이 부품은 사람의 말을 갖지 않는다.** `packages/ui` 는 표현 전용이라 한국어를 박아 두면
 * 베트남어 화면이 한국어를 듣게 된다 — 낭독 문구(`describe*`)는 언제나 쓰는 쪽(i18n)에서
 * 오고, 받지 못하면 언어 중립인 숫자만 낸다. 아래 문구 관련 규칙은 모두 이 한 줄에서 나온다.
 *
 * ⭐ **마우스만으로 «옮기는» 판을 만들지 않는다.** 표식 하나하나가 버튼이라 탭으로 옮겨 다닐
 * 수 있고, 화살표로 밀 수 있다. ⚠ 다만 **놓기는 아직 포인터 전용이다** — 판 자체에는 초점이
 * 가지 않아(`tabIndex` 없음) 자판만으로 새 점을 찍는 길은 없다. 필요하면 쓰는 화면이 따로
 * 마련한다.
 *
 * ⛔ **그림을 스스로 고르지 않는다.** 어떤 그림을 어디서 받아 오는지는 쓰는 쪽의 일이다 —
 * 이 부품은 넘겨받은 것을 그릴 뿐이다.
 *
 * ⛔ **DS(`@crefle/web-ui`)의 `ImageMarkerBoard` 로 갈아타지 않는다.** DS 부품이 라벨을
 * 시각적으로 그리지 않는다(조사 시점 0.2.0). 대조 내역과 가져온 것은 `README.md` 에 적었다.
 */
export const MarkerOverlay = ({
  src,
  imageLabel,
  markers,
  placeholder,
  readOnly = false,
  step = 0.01,
  onPlace,
  onSelect,
  onMove,
  describePosition,
  describeMove,
  describeReadOnly,
}: MarkerOverlayProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  /**
   * 방금 끝난 드래그가 뒤따라 오는 click 을 하나 남긴다 — 그 한 번만, 그것도 곧바로 오는
   * 것만 삼킨다. 세워 둔 시각을 함께 들고 `CLICK_SWALLOW_WINDOW_MS` 를 넘기면 버린다.
   *
   * ⭐ **상태가 아니라 참조다.** 이것으로 다시 그릴 일이 없고, click 은 pointerup 바로 뒤에
   * 오므로 다시 그리기를 기다릴 수도 없다.
   */
  const swallowClickRef = useRef<number | null>(null);
  const domId = useId();
  const readOnlyNoteId = `${domId}locked`;
  /**
   * 낭독기에 전할 말.
   *
   * ⚠ **같은 말은 다시 읽히지 않는다.** 글이 바뀌어야 `aria-live` 가 울리므로, 가장자리에
   * 붙은 점을 같은 방향으로 한 번 더 밀면(값이 그대로다) 아무 말도 나지 않는다 — 의도한 것이다.
   * 자리가 바뀌지 않았는데 같은 말을 되풀이하면 듣는 쪽은 점이 «움직였다»고 여긴다.
   */
  const [notice, setNotice] = useState('');

  /**
   * ⛔ **끌던 표식이 사라지면 드래그도 사라진다.** 지워지거나 걸러져 나간 표식은 pointerup 을
   * 보낼 자리가 없어, 남은 드래그가 슬롯을 차지한 채 **뒤따르는 모든 드래그를 말없이 거절**한다.
   */
  useEffect(() => {
    const drag = dragRef.current;

    if (drag !== null && !markers.some((marker) => marker.id === drag.id)) dragRef.current = null;
  }, [markers]);

  /** 잠긴 판에 붙일 설명. 잠기지 않았거나 문구를 받지 못했으면 설명 자체를 세우지 않는다. */
  const lockedNote = readOnly ? describeReadOnly : undefined;

  /** 표식 하나의 자리를 말로. 문구를 받지 못했으면 숫자만 낸다. */
  const positionText = (x: number, y: number): string =>
    describePosition?.(percent(x), percent(y)) ?? plainPosition(x, y);

  /** 옮긴 결과를 말로. 문구를 받지 못했으면 이름에 숫자를 잇는다. */
  const moveText = (label: string, x: number, y: number): string =>
    describeMove?.(label, percent(x), percent(y)) ?? `${label}: ${plainPosition(x, y)}`;

  /** 화면 좌표를 판 안의 비율로 옮긴다. **밖으로 나가는 값은 늘 0~1 로 묶는다.** */
  const toRatio = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const board = boardRef.current;

    if (board === null) return null;

    const rect = board.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: round(clamp((clientX - rect.left) / rect.width)),
      y: round(clamp((clientY - rect.top) / rect.height)),
    };
  };

  /**
   * 삼킬 click 이었으면 삼키고 그 표를 지운다 — 다음 click 은 평소대로 간다.
   *
   * ⛔ **시간창을 넘긴 표는 삼키지 않고 버린다.** 오래 남은 표를 그대로 쓰면 낭독기·음성
   * 제어가 한참 뒤 보내는 첫 click 을 대신 먹는다.
   */
  const swallowedClick = (): boolean => {
    const markedAt = swallowClickRef.current;

    swallowClickRef.current = null;

    if (markedAt === null) return false;

    return performance.now() - markedAt <= CLICK_SWALLOW_WINDOW_MS;
  };

  const handleBoardClick = (event: MouseEvent<HTMLDivElement>): void => {
    /*
     * ⛔ **끌어다 놓은 자리에 새 점을 찍지 않는다.** 포인터를 표식에 붙들지 못했거나 붙들기가
     * 도중에 끊기면, 표식 위에서 시작해 판 위에서 놓은 드래그의 click 이 «판»으로 온다 —
     * 삼키지 않으면 점을 한 번 옮길 때마다 점이 하나씩 늘어난다.
     */
    if (swallowedClick()) return;
    if (readOnly || onPlace === undefined) return;
    /* 표식을 누른 것은 놓기가 아니다 — 표식이 이벤트를 멈춘다. */

    const ratio = toRatio(event.clientX, event.clientY);

    if (ratio !== null) onPlace(ratio.x, ratio.y);
  };

  const handleMarkerClick = (marker: OverlayMarker): void => {
    if (swallowedClick()) return;

    onSelect?.(marker.id);
  };

  const handleMarkerKeyDown = (event: KeyboardEvent<HTMLButtonElement>, marker: OverlayMarker) => {
    swallowClickRef.current = null;

    if (readOnly || onMove === undefined) return;

    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];

    if (move === undefined) return;

    event.preventDefault();

    const x = round(clamp(marker.x + move[0]));
    const y = round(clamp(marker.y + move[1]));

    onMove(marker.id, x, y);
    /* 키로 미는 사람은 점이 어디까지 갔는지 볼 수 없다 — 한 번 누를 때마다 자리를 읽어 준다. */
    setNotice(moveText(marker.label, x, y));
  };

  /** 포인터를 놓아 준다. 놓을 것이 없어도 탈이 없어야 한다 — 부르는 자리가 여럿이다. */
  const releaseCapture = (target: HTMLButtonElement, pointerId: number): void => {
    /*
     * 브라우저는 그 `pointerId` 가 더는 «활성 포인터»가 아니면 `NotFoundError` 를 던진다
     * (이미 놓았거나 빼앗긴 뒤). 드래그 정리를 그것으로 막지 않는다.
     * ⚠ jsdom 에는 이 함수 자체가 없다(시험 환경).
     */
    try {
      if (typeof target.releasePointerCapture === 'function')
        target.releasePointerCapture(pointerId);
    } catch {
      /* 이미 풀려 있다 — 부르는 쪽이 할 일은 드래그를 끝내는 것이다. */
    }
  };

  const handleMarkerPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    marker: OverlayMarker,
  ): void => {
    swallowClickRef.current = null;

    if (readOnly || onMove === undefined) return;
    /* ⛔ 오른쪽·가운데 버튼으로는 끌지 않는다 — 상황 메뉴를 부르려던 손이 점을 옮기게 된다. */
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const stale = dragRef.current;

    if (stale !== null) {
      /*
       * ⛔ **두 번째 «손가락»만 거절한다.** 슬롯이 하나뿐이라 새 손가락이 덮어쓰면 첫 손가락의
       * pointerup 이 남의 드래그를 끝내고 첫 드래그는 끝나지 않은 채 남는다.
       *
       * ⭐ 그러나 **같은 포인터가 다시 눌렀거나 마우스가 눌렀다면 묵은 쪽이 틀린 것이다** —
       * 놓기를 못 받은 드래그(붙들기가 끊겼거나 창 밖에서 손을 뗐다)가 남아 있는 것이고,
       * 거절만 하면 그 표식은 다시는 끌리지 않는다. 묵은 것을 버리고 새로 시작한다.
       */
      if (stale.pointerId !== event.pointerId && event.pointerType !== 'mouse') return;

      dragRef.current = null;
    }

    dragRef.current = {
      id: marker.id,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      last: null,
    };

    /*
     * ⭐ 포인터를 표식에 붙들어 둔다 — 붙들지 않으면 손이 점보다 빨리 나갔을 때 나머지 이동이
     * 판이나 문서로 새어 드래그가 도중에 멎는다. ⚠ jsdom 에는 이 함수가 없다(시험 환경).
     */
    const target = event.currentTarget;

    /* 활성 포인터가 아니면 브라우저가 `NotFoundError` 를 던진다 — 붙들기 실패로 드래그를 죽이지 않는다. */
    try {
      if (typeof target.setPointerCapture === 'function') target.setPointerCapture(event.pointerId);
    } catch {
      /* 붙들지 못했을 뿐이다 — 드래그는 그대로 간다. */
    }
  };

  const handleMarkerPointerMove = (
    event: PointerEvent<HTMLButtonElement>,
    marker: OverlayMarker,
  ): void => {
    const drag = dragRef.current;

    if (drag === null || drag.id !== marker.id || drag.pointerId !== event.pointerId) return;

    /*
     * ⛔ **끌던 도중에 판이 잠기면 거기서 끝난다.** 잠금은 「지금부터 옮기지 못한다」는
     * 뜻이므로, 이미 잡고 있었다는 이유로 이동이 계속 나가면 저장 중인 초안이 밑에서 바뀐다.
     */
    if (readOnly) {
      releaseCapture(event.currentTarget, event.pointerId);
      dragRef.current = null;

      return;
    }

    /*
     * ⛔ **버튼을 뗀 채 지나가는 마우스는 드래그가 아니다.** 창 밖에서 손을 뗐거나 놓기를
     * 못 받았다면 남은 드래그가 커서를 그대로 따라온다 — 누르지도 않았는데 점이 끌려간다.
     */
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      releaseCapture(event.currentTarget, event.pointerId);
      dragRef.current = null;

      return;
    }

    if (!drag.moved) {
      const threshold = drag.pointerType === 'touch' ? DRAG_THRESHOLD_TOUCH_PX : DRAG_THRESHOLD_PX;

      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < threshold) return;

      drag.moved = true;
    }

    const ratio = toRatio(event.clientX, event.clientY);

    if (ratio === null) return;

    drag.last = ratio;
    onMove?.(marker.id, ratio.x, ratio.y);
  };

  /** 드래그를 끝내고 무엇이 끝났는지 돌려준다. 다른 포인터의 이벤트면 아무것도 하지 않는다. */
  const endDrag = (event: PointerEvent<HTMLButtonElement>): DragState | null => {
    const drag = dragRef.current;

    if (drag === null || drag.pointerId !== event.pointerId) return null;

    releaseCapture(event.currentTarget, event.pointerId);

    dragRef.current = null;

    return drag;
  };

  const handleMarkerPointerUp = (
    event: PointerEvent<HTMLButtonElement>,
    marker: OverlayMarker,
  ): void => {
    const drag = endDrag(event);

    if (drag === null || !drag.moved) return;

    swallowClickRef.current = performance.now();

    /*
     * ⭐ **드래그 중에는 읽지 않고, 끝에서 마지막 자리만 읽는다.** 이동마다 알리면 낭독기가
     * 한 번의 드래그에 수십 번 끼어들어 정작 결과를 못 듣는다.
     */
    if (drag.last !== null) setNotice(moveText(marker.label, drag.last.x, drag.last.y));
  };

  const handleMarkerPointerCancel = (event: PointerEvent<HTMLButtonElement>): void => {
    const drag = endDrag(event);

    /*
     * 빼앗긴 제스처다(화면 넘김·통화 등). 결과를 읽어 주지 않는다 — 사람이 끝낸 이동이
     * 아니다. 브라우저는 `pointercancel` 뒤 click 을 보내지 않으므로 표는 대개 쓰이지 않지만,
     * 세워 두는 것은 방어다 — 시간창이 지나면 스스로 버려진다.
     */
    if (drag !== null && drag.moved) swallowClickRef.current = performance.now();
  };

  /**
   * 붙들기가 끊겼다 — 드래그를 여기서 끝낸다.
   *
   * ⛔ **놓기를 못 받은 드래그를 남기지 않는다.** 창 밖에서 손을 뗐거나 다른 요소가 포인터를
   * 가져가면 pointerup 이 이 표식에 오지 않는다. 남은 드래그는 슬롯을 차지한 채 다음 드래그를
   * 말없이 거절한다. 사람이 끝낸 이동이 아니므로 **읽어 주지는 않는다.**
   */
  const handleMarkerLostPointerCapture = (event: PointerEvent<HTMLButtonElement>): void => {
    endDrag(event);
  };

  return (
    <div className="marker-overlay">
      <div
        ref={boardRef}
        className="marker-overlay-board"
        /*
         * ⛔ **`role="application"` 을 쓰지 않는다.** 그 역할은 낭독기의 탐색 키를 판이 통째로
         * 가로채게 만드는데, 이 판은 가로챌 키가 없다 — 표식이 버튼이라 낭독기의 평소 조작으로
         * 충분하다. 판은 언제나 표식을 담는 «묶음»이다.
         */
        role="group"
        aria-label={imageLabel}
        /*
         * 잠긴 사실을 접근성 트리에도 드러낸다 — 눌러 보고 나서야 알게 두지 않는다.
         *
         * ⛔ **`aria-disabled` 가 아니다.** 그 속성은 「이 묶음은 쓸 수 없다」로 읽혀 안의
         * 표식까지 사용 불가로 들리는데, 잠긴 판에서도 **고르기는 그대로 된다** — 뜻과 동작이
         * 어긋난다. ⛔ **`aria-readonly` 도 아니다** — `group` 에 허용되지 않아 낭독기가
         * 통째로 버린다. 남는 길은 설명 문구이고, 문구는 쓰는 쪽에서 온다.
         */
        aria-describedby={lockedNote === undefined ? undefined : readOnlyNoteId}
        /*
         * ⭐ **판 위의 새 포인터 동작은 삼킬 click 표를 지운다.** 브라우저는 터치 드래그나
         * `pointercancel` 뒤 click 을 보내지 않아, 세워 둔 표가 «다음» 판 누름을 대신 먹는다 —
         * 사용자에게는 「한 번은 그냥 씹히는 판」이 된다. pointerdown 은 언제나 click 보다
         * 앞서므로 여기서 지우면 묵은 표가 남지 않고, 표식 드래그 직후 판으로 새는 click(앞에
         * 새 pointerdown 이 없다)은 그대로 삼켜진다.
         */
        onPointerDownCapture={() => {
          swallowClickRef.current = null;
        }}
        onClick={handleBoardClick}
      >
        {src === undefined ? (
          <div className="marker-overlay-placeholder">{placeholder}</div>
        ) : (
          <img className="marker-overlay-image" src={src} alt={imageLabel} draggable={false} />
        )}

        {markers.map((marker, index) => {
          const positionId = `${domId}pos-${String(index)}`;

          return (
            <button
              key={marker.id}
              type="button"
              className={
                marker.selected === true
                  ? 'marker-overlay-pin marker-overlay-pin-selected'
                  : 'marker-overlay-pin'
              }
              style={{ left: `${String(marker.x * 100)}%`, top: `${String(marker.y * 100)}%` }}
              /*
               * ⭐ 이름을 못 박는다 — 자리를 설명하는 글이 버튼 «안»에 있어, 두지 않으면
               * 표식의 이름이 「A-01 가로 10%, 세로 20%」로 불어난다. 이름은 보이는 말과
               * 같아야 한다.
               */
              aria-label={marker.label}
              aria-pressed={marker.selected === true}
              aria-describedby={positionId}
              onClick={(event) => {
                /* 표식을 누른 것을 판에 흘리지 않는다 — 흘리면 고르는 순간 새 점이 하나 생긴다. */
                event.stopPropagation();
                handleMarkerClick(marker);
              }}
              onPointerDown={(event) => {
                handleMarkerPointerDown(event, marker);
              }}
              onPointerMove={(event) => {
                handleMarkerPointerMove(event, marker);
              }}
              onPointerUp={(event) => {
                handleMarkerPointerUp(event, marker);
              }}
              onPointerCancel={handleMarkerPointerCancel}
              onLostPointerCapture={handleMarkerLostPointerCapture}
              onKeyDown={(event) => {
                handleMarkerKeyDown(event, marker);
              }}
            >
              <span className="marker-overlay-pin-label">{marker.label}</span>
              {/* 눈으로는 자리를 보지만, 듣는 사람에게는 이 글이 자리 그 자체다. */}
              <span className="marker-overlay-sr-only" id={positionId}>
                {positionText(marker.x, marker.y)}
              </span>
            </button>
          );
        })}
      </div>

      {/* 잠긴 사실을 판의 설명으로 붙인다 — 눈으로는 굳이 되풀이하지 않는다. */}
      {lockedNote !== undefined && (
        <div className="marker-overlay-sr-only" id={readOnlyNoteId}>
          {lockedNote}
        </div>
      )}

      {/*
       * 옮긴 결과를 말하는 자리. ⛔ **`role="status"` 를 얹지 않는다** — 쓰는 화면이 제 가림막에
       * 이미 `status` 를 세워 두는 일이 흔해, 판까지 하나 더 세우면 「화면에 하나뿐인 status」로
       * 재던 시험과 낭독 순서가 함께 흔들린다. 알림에는 `aria-live` 만으로 족하다.
       */}
      <div className="marker-overlay-sr-only" aria-live="polite">
        {notice}
      </div>
    </div>
  );
};
