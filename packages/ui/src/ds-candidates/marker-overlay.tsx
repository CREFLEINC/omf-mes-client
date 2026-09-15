import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import './marker-overlay.css';

/**
 * 그림 위에 **비율 좌표**로 표식을 놓고 고르고 옮기는 판.
 *
 * ⭐ **좌표는 픽셀이 아니라 0~1 의 비율이다.** 판이 커지거나 그림이 바뀌어도 표식이 같은
 * 상대 위치를 가리킨다 — 픽셀로 두면 창을 줄이는 것만으로 점이 전부 어긋난다. 그래서 이
 * 부품은 **픽셀을 밖으로 내보내지 않는다**: 받는 것도 주는 것도 비율뿐이다.
 *
 * ⭐ **마우스만으로 쓰는 판을 만들지 않는다.** 표식 하나하나가 버튼이라 탭으로 옮겨 다닐 수
 * 있고, 화살표로 밀 수 있다. 판 자체도 탭으로 잡히며 그 위에서 놓기를 할 수 있다.
 *
 * ⛔ **그림을 스스로 고르지 않는다.** 어떤 그림을 어디서 받아 오는지는 쓰는 쪽의 일이다 —
 * 이 부품은 넘겨받은 것을 그릴 뿐이다.
 *
 * ⛔ **DS(`@crefle/web-ui` 0.2.0)의 `ImageMarkerBoard` 로 갈아타지 않는다**(2026-09-15 · #1277).
 * 대조해 보니 드래그·낭독은 DS 쪽이 앞섰지만, DS 부품은 **표식의 말을 화면에 그리지 않는다** —
 * 24px 짜리 점뿐이고 `label` 은 접근 이름으로만 쓴다. 설계 §5 는 도면 위 점 «옆»에 위치 코드가
 * 보이도록 정했으므로 그 하나로 교체가 막힌다. 그래서 이 부품을 **제품 소유로 확정**하고,
 * 조사에서 드러난 DS 의 나은 점(임계값·포인터 캡처·주 버튼·click 억제·좌표 낭독)만 가져왔다.
 */
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
  /** 판 전체를 읽기 전용으로 둔다 — 놓기·옮기기가 막힌다. */
  readOnly?: boolean;
  /** 화살표 한 번에 움직이는 비율. 기본 0.01 (판의 1%). */
  step?: number;
  /** 빈 자리를 눌렀다 — 비율 좌표를 준다. */
  onPlace?: (x: number, y: number) => void;
  onSelect?: (id: string) => void;
  /** 표식을 옮겼다 — 옮긴 뒤의 비율 좌표를 준다. */
  onMove?: (id: string, x: number, y: number) => void;
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

/** 낭독용 백분율. 사람이 듣는 값이라 정수로 줄인다 — 「가로 10.37%」는 아무도 못 센다. */
const percent = (value: number): number => Math.round(value * 100);

const positionText = (x: number, y: number): string =>
  `가로 ${String(percent(x))}%, 세로 ${String(percent(y))}%`;

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** 임계값을 넘어 «이동»이 된 적이 있는가. */
  moved: boolean;
  /** 마지막으로 내보낸 비율 — 드래그가 끝날 때 한 번만 읽어 주려고 들고 있는다. */
  last: { x: number; y: number } | null;
}

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
}: MarkerOverlayProps) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  /**
   * 방금 끝난 드래그가 뒤따라 오는 click 을 하나 남긴다 — 그 한 번만 삼킨다.
   *
   * ⭐ **상태가 아니라 참조다.** 이것으로 다시 그릴 일이 없고, click 은 pointerup 바로 뒤에
   * 오므로 다시 그리기를 기다릴 수도 없다.
   */
  const swallowClickRef = useRef(false);
  const domId = useId();
  const [notice, setNotice] = useState('');

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

  /** 삼킬 click 이었으면 삼키고 그 표를 지운다 — 다음 click 은 평소대로 간다. */
  const swallowedClick = (): boolean => {
    if (!swallowClickRef.current) return false;

    swallowClickRef.current = false;

    return true;
  };

  const handleBoardClick = (event: MouseEvent<HTMLDivElement>): void => {
    /*
     * ⛔ **끌어다 놓은 자리에 새 점을 찍지 않는다.** 포인터 캡처가 없는 브라우저에서는 표식
     * 위에서 시작해 판 위에서 놓은 드래그의 click 이 «판»으로 온다 — 삼키지 않으면 점을 한 번
     * 옮길 때마다 점이 하나씩 늘어난다.
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
    swallowClickRef.current = false;

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
    setNotice(`${marker.label}: ${positionText(x, y)}`);
  };

  const handleMarkerPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    marker: OverlayMarker,
  ): void => {
    swallowClickRef.current = false;

    if (readOnly || onMove === undefined) return;
    /* ⛔ 오른쪽·가운데 버튼으로는 끌지 않는다 — 상황 메뉴를 부르려던 손이 점을 옮기게 된다. */
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragRef.current = {
      id: marker.id,
      pointerId: event.pointerId,
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

    if (typeof target.setPointerCapture === 'function') target.setPointerCapture(event.pointerId);
  };

  const handleMarkerPointerMove = (
    event: PointerEvent<HTMLButtonElement>,
    marker: OverlayMarker,
  ): void => {
    const drag = dragRef.current;

    if (drag === null || drag.id !== marker.id || drag.pointerId !== event.pointerId) return;

    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX)
        return;

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

    const target = event.currentTarget;

    if (typeof target.releasePointerCapture === 'function')
      target.releasePointerCapture(event.pointerId);

    dragRef.current = null;

    return drag;
  };

  const handleMarkerPointerUp = (
    event: PointerEvent<HTMLButtonElement>,
    marker: OverlayMarker,
  ): void => {
    const drag = endDrag(event);

    if (drag === null || !drag.moved) return;

    swallowClickRef.current = true;

    /*
     * ⭐ **드래그 중에는 읽지 않고, 끝에서 마지막 자리만 읽는다.** 이동마다 알리면 낭독기가
     * 한 번의 드래그에 수십 번 끼어들어 정작 결과를 못 듣는다.
     */
    if (drag.last !== null) setNotice(`${marker.label}: ${positionText(drag.last.x, drag.last.y)}`);
  };

  const handleMarkerPointerCancel = (event: PointerEvent<HTMLButtonElement>): void => {
    const drag = endDrag(event);

    /*
     * 빼앗긴 제스처다(화면 넘김·통화 등). 결과를 읽어 주지 않는다 — 사람이 끝낸 이동이
     * 아니다. 다만 이미 움직였다면 뒤따르는 click 은 그대로 삼킨다.
     */
    if (drag !== null && drag.moved) swallowClickRef.current = true;
  };

  return (
    <div className="marker-overlay">
      <div
        ref={boardRef}
        className="marker-overlay-board"
        /*
         * ⛔ **`role="application"` 을 쓰지 않는다**(2026-09-15 · #1277). 그 역할은 낭독기의
         * 탐색 키를 판이 통째로 가로채게 만드는데, 이 판은 가로챌 키가 없다 — 표식이 버튼이라
         * 낭독기의 평소 조작으로 충분하다. 판은 언제나 표식을 담는 «묶음»이다.
         */
        role="group"
        aria-label={imageLabel}
        /* 잠긴 사실을 접근성 트리에도 드러낸다 — 눌러 보고 나서야 알게 두지 않는다. */
        aria-readonly={readOnly ? true : undefined}
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
