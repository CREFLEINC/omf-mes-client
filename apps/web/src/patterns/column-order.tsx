import type { Column } from '@crefle/web-ui';
import { useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * 표 열 순서 바꾸기(사용자 지시 2026-10-26 · omf-all-around#186). 머리칸을 잡아 다른 머리칸 위에 놓으면 그 자리로
 * 옮긴다 — 오른쪽으로 끌면 놓은 열 뒤, 왼쪽으로 끌면 앞이다. 순서는 표마다 브라우저에 남긴다 — 다시 로그인해도
 * 같은 순서다. 저장소가 막혀 있으면 기본 순서다.
 *
 * 저장한 뒤 화면에 새로 생긴 열은 저장된 열들 뒤에 기본 차례대로 붙고, 없어진 열의 이름은 무시한다.
 * 폭 조절(`column-resize.tsx`)과 함께 쓸 때는 이것을 먼저 감싼다 — 폭 손잡이는 끌기 자리 밖(머리칸 오른쪽 끝)에 선다.
 */

export type ColumnOrder = readonly string[];

const readOrder = (storageKey: string): ColumnOrder => {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(raw) ? raw.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
};

/** 저장된 순서(`order`)로 열을 늘어놓는다. 순서에 없는 열은 뒤에 기본 차례대로 붙는다. */
export const orderColumns = <C extends { key: string }>(
  columns: readonly C[],
  order: ColumnOrder,
): C[] => {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const known = [...new Set(order)].flatMap((key) => {
    const column = byKey.get(key);
    return column === undefined ? [] : [column];
  });
  const placed = new Set(known.map(({ key }) => key));

  return [...known, ...columns.filter(({ key }) => !placed.has(key))];
};

/** `from` 열을 `to` 열 자리로 옮긴 순서. 오른쪽으로 옮기면 `to` 뒤, 왼쪽으로 옮기면 `to` 앞에 선다. */
export const moveColumn = (keys: ColumnOrder, from: string, to: string): string[] => {
  const fromIndex = keys.indexOf(from);
  const toIndex = keys.indexOf(to);
  if (fromIndex === -1 || toIndex === -1 || from === to) return [...keys];

  const next = keys.filter((key) => key !== from);
  next.splice(next.indexOf(to) + (fromIndex < toIndex ? 1 : 0), 0, from);
  return next;
};

/** 놓일 자리의 세로선 — 화면 좌표(px). 표 머리부터 마지막 줄까지 긋는다. */
interface DropLine {
  left: number;
  top: number;
  height: number;
}

/** 놓을 머리칸의 앞(왼쪽) 또는 뒤(오른쪽) 경계에 표 높이만큼의 세로선을 잰다. */
const dropLineOf = (event: DragEvent<HTMLElement>, after: boolean): DropLine | null => {
  const cell = event.currentTarget.closest('th');
  const table = cell?.closest('table');
  if (!cell || !table) return null;
  const cellRect = cell.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();

  return {
    left: after ? cellRect.right : cellRect.left,
    top: tableRect.top,
    height: tableRect.height,
  };
};

/** 끌기 손잡이 — 점 여섯 개. 머리칸에 마우스를 올렸을 때만 보인다(app.css `.col-drag-handle`). */
const DragHandle = () => (
  <svg className="col-drag-handle" viewBox="0 0 8 14" width="8" height="14" aria-hidden="true">
    {[2, 7, 12].flatMap((cy) =>
      [2, 6].map((cx) => <circle key={`${String(cx)}-${String(cy)}`} cx={cx} cy={cy} r="1.3" />),
    )}
  </svg>
);

/**
 * 머리칸마다 끌기 자리를 단 열을 낸다. `storageKey` 는 표마다 다르게 — 같은 열 이름이 다른 표에 있어도 섞이지 않게.
 * 마우스 끌기 전용이다 — 키보드·화면 낭독기 사용자는 기본 순서로 읽는다(순서는 보기 편의라 일을 막지 않는다).
 */
export const useColumnOrder = <T,>(storageKey: string, columns: Column<T>[]): Column<T>[] => {
  const [order, setOrder] = useState<ColumnOrder>(() => readOrder(storageKey));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [dropLine, setDropLine] = useState<DropLine | null>(null);

  const ordered = orderColumns(columns, order);
  const keys = ordered.map(({ key }) => key);

  const commit = (next: ColumnOrder): void => {
    setOrder(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* 저장하지 못해도 이번 화면에서는 그대로 쓴다. */
    }
  };
  const finish = (): void => {
    setDragKey(null);
    setOverKey(null);
    setDropLine(null);
  };

  return ordered.map((column): Column<T> => {
    const isDropTarget = dragKey !== null && overKey === column.key && dragKey !== column.key;
    const after = dragKey !== null && keys.indexOf(dragKey) < keys.indexOf(column.key);

    return {
      ...column,
      header: (
        <span
          className={`col-drag${dragKey === column.key ? ' is-dragging' : ''}`}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            /* 파이어폭스는 실린 값이 없으면 끌기를 시작하지 않는다. */
            event.dataTransfer.setData('text/plain', column.key);
            setDragKey(column.key);
          }}
          onDragOver={(event) => {
            if (dragKey === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (overKey !== column.key) {
              setOverKey(column.key);
              setDropLine(
                dragKey === column.key
                  ? null
                  : dropLineOf(event, keys.indexOf(dragKey) < keys.indexOf(column.key)),
              );
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragKey !== null) commit(moveColumn(keys, dragKey, column.key));
            finish();
          }}
          onDragEnd={finish}
        >
          <span className="col-drag-label">{column.header}</span>
          <DragHandle />
          {/* 놓일 자리 — 칸이 글을 자르므로(overflow) 표 밖 맨 위 층에 긋는다. 끄는 동안만 선다. */}
          {isDropTarget &&
            dropLine !== null &&
            createPortal(
              <div
                className={`col-drop-line${after ? ' is-after' : ''}`}
                style={{ left: dropLine.left, top: dropLine.top, height: dropLine.height }}
                aria-hidden="true"
              />,
              document.body,
            )}
        </span>
      ),
    };
  });
};
