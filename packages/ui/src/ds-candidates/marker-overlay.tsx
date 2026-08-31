import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

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

  const handleBoardClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (readOnly || onPlace === undefined) return;
    /* 표식을 누른 것은 놓기가 아니다 — 표식이 이벤트를 멈춘다. */

    const ratio = toRatio(event.clientX, event.clientY);

    if (ratio !== null) onPlace(ratio.x, ratio.y);
  };

  const handleMarkerKeyDown = (event: KeyboardEvent<HTMLButtonElement>, marker: OverlayMarker) => {
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
    onMove(marker.id, round(clamp(marker.x + move[0])), round(clamp(marker.y + move[1])));
  };

  const handleMarkerPointerDown = (marker: OverlayMarker): void => {
    if (readOnly || onMove === undefined) return;

    const onPointerMove = (event: PointerEvent): void => {
      const ratio = toRatio(event.clientX, event.clientY);

      if (ratio !== null) onMove(marker.id, ratio.x, ratio.y);
    };
    const onPointerUp = (): void => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="marker-overlay">
      <div
        ref={boardRef}
        className="marker-overlay-board"
        role={readOnly || onPlace === undefined ? undefined : 'application'}
        aria-label={imageLabel}
        onClick={handleBoardClick}
      >
        {src === undefined ? (
          <div className="marker-overlay-placeholder">{placeholder}</div>
        ) : (
          <img className="marker-overlay-image" src={src} alt={imageLabel} draggable={false} />
        )}

        {markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className={
              marker.selected === true
                ? 'marker-overlay-pin marker-overlay-pin-selected'
                : 'marker-overlay-pin'
            }
            style={{ left: `${String(marker.x * 100)}%`, top: `${String(marker.y * 100)}%` }}
            aria-pressed={marker.selected === true}
            onClick={(event) => {
              /* 표식을 누른 것을 판에 흘리지 않는다 — 흘리면 고르는 순간 새 점이 하나 생긴다. */
              event.stopPropagation();
              onSelect?.(marker.id);
            }}
            onPointerDown={() => {
              handleMarkerPointerDown(marker);
            }}
            onKeyDown={(event) => {
              handleMarkerKeyDown(event, marker);
            }}
          >
            <span className="marker-overlay-pin-label">{marker.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
