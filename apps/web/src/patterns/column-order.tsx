import type { Column } from '@crefle/web-ui';
import { useState } from 'react';

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

/**
 * 머리칸마다 끌기 자리를 단 열을 낸다. `storageKey` 는 표마다 다르게 — 같은 열 이름이 다른 표에 있어도 섞이지 않게.
 * 마우스 끌기 전용이다 — 키보드·화면 낭독기 사용자는 기본 순서로 읽는다(순서는 보기 편의라 일을 막지 않는다).
 */
export const useColumnOrder = <T,>(storageKey: string, columns: Column<T>[]): Column<T>[] => {
  const [order, setOrder] = useState<ColumnOrder>(() => readOrder(storageKey));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

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
  };

  return ordered.map((column): Column<T> => {
    const dropSide =
      dragKey !== null && overKey === column.key && dragKey !== column.key
        ? keys.indexOf(dragKey) < keys.indexOf(column.key)
          ? ' is-drop-after'
          : ' is-drop-before'
        : '';

    return {
      ...column,
      header: (
        <span
          className={`col-drag${dragKey === column.key ? ' is-dragging' : ''}${dropSide}`}
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
            if (overKey !== column.key) setOverKey(column.key);
          }}
          onDragLeave={() => {
            setOverKey((current) => (current === column.key ? null : current));
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragKey !== null) commit(moveColumn(keys, dragKey, column.key));
            finish();
          }}
          onDragEnd={finish}
        >
          {column.header}
        </span>
      ),
    };
  });
};
