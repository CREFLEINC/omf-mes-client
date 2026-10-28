import { Icon, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

/**
 * 표 열 순서 바꾸기(omf-all-around#185 · 사용자 지시 2026-10-26). 머리칸 이름을 잡고 옆 머리칸으로 끌어 놓으면
 * 그 자리로 옮겨진다. 순서는 표마다 브라우저에 남긴다 — 다시 들어오거나 다시 로그인해도 같은 순서다.
 * 저장소가 막혀 있으면 기본 순서다.
 *
 * ⭐ 끌기는 포인터로 직접 잡는다(HTML 끌어 놓기가 아니다) — 정렬되는 머리칸은 이름이 DS 단추 안에 있어
 *    단추 안의 끌어 놓기가 브라우저마다 다르게 동작한다. 조금(4px)이라도 움직이기 전에는 그냥 누름이라
 *    정렬 단추가 그대로 동작하고, 끌고 난 뒤의 누름 한 번은 삼킨다(놓자마자 정렬이 바뀌지 않게).
 * ⭐ 저장된 순서에 없는 열(새로 생긴 열)은 기본 순서의 자리 뒤에 붙고, 사라진 열은 버린다.
 * ⭐ 머리칸 전체를 끄는 판본은 `column-order.tsx`(#186 · 품질 승인 화면)다 — 이 파일은 손잡이(⠿)로 끄는 검사 화면용이다.
 */

const DRAG_THRESHOLD = 4;

const readOrder = (storageKey: string): string[] => {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(raw) ? raw.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
};

/** 저장된 순서를 지금 열에 맞춘다 — 저장된 열은 그 순서로, 나머지는 기본 순서대로 뒤에. */
export const orderColumns = <T extends { key: string }>(
  columns: readonly T[],
  saved: readonly string[],
): T[] => {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordered = saved.flatMap((key) => {
    const column = byKey.get(key);
    return column === undefined ? [] : [column];
  });
  const placed = new Set(ordered.map(({ key }) => key));

  return [...ordered, ...columns.filter(({ key }) => !placed.has(key))];
};

/** `from` 열을 `to` 열 자리로 옮긴 순서. */
export const moveKey = (keys: readonly string[], from: string, to: string): string[] => {
  const next = keys.filter((key) => key !== from);
  const index = next.indexOf(to);
  if (index < 0 || from === to) return [...keys];
  /* 오른쪽으로 끌면 놓은 열의 뒤, 왼쪽으로 끌면 앞에 선다. */
  next.splice(keys.indexOf(from) < keys.indexOf(to) ? index + 1 : index, 0, from);
  return next;
};

const headerAt = (x: number, y: number, table: Element): HTMLTableCellElement | null => {
  const cell = document.elementFromPoint(x, y)?.closest<HTMLTableCellElement>('th[data-col-key]');
  return cell !== null && cell !== undefined && table.contains(cell) ? cell : null;
};

/**
 * 머리칸 이름과 그 오른쪽 끌기 손잡이(⠿). 손잡이는 마우스를 올린 머리칸에만 보이고(app.css `.col-grip`),
 * 손잡이를 잡아 끌면 칸 이름이 반투명하게 따라오고 놓일 자리의 경계선이 파랗게 선다(사용자 지시 2026-10-26).
 * 손잡이를 그냥 누르는 것은 아무 일도 하지 않는다 — 정렬 단추 안에 있어도 정렬이 바뀌지 않는다.
 */
const ColumnGrip = ({
  columnKey,
  label,
  onMove,
  children,
}: {
  columnKey: string;
  label: string;
  onMove: (from: string, to: string) => void;
  children: React.ReactNode;
}) => (
  <span className="col-head" data-col-grip={columnKey}>
    <span className="col-head-label">{children}</span>
    <span
      className="col-grip"
      aria-hidden="true"
      title={label}
      onClick={(event) => {
        /* 정렬 단추 안이어도 손잡이 누름은 정렬로 번지지 않는다. */
        event.stopPropagation();
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        const source = event.currentTarget.closest('th');
        const table = source?.closest('table');
        if (source === null || source === undefined || table === null || table === undefined)
          return;
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startY = event.clientY;
        let ghost: HTMLElement | null = null;
        let target: HTMLTableCellElement | null = null;

        /* 놓일 자리 — 오른쪽으로 끌면 놓은 칸의 뒤(오른쪽 경계), 왼쪽이면 앞(왼쪽 경계). `moveKey` 와 같은 규칙. */
        const mark = (next: HTMLTableCellElement | null): void => {
          target?.classList.remove('col-drop-before', 'col-drop-after');
          target = next !== source ? next : null;
          if (target === null) return;
          target.classList.add(
            source.cellIndex < target.cellIndex ? 'col-drop-after' : 'col-drop-before',
          );
        };
        const move = (moveEvent: PointerEvent): void => {
          if (ghost === null) {
            if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD)
              return;
            /* 모든 머리칸에 열 이름을 달아 둔다 — 놓은 자리가 어느 열인지 안다. */
            table.querySelectorAll<HTMLElement>('[data-col-grip]').forEach((grip) => {
              const cell = grip.closest('th');
              if (cell !== null) cell.dataset.colKey = grip.dataset.colGrip;
            });
            const rect = source.getBoundingClientRect();
            ghost = document.createElement('div');
            ghost.className = 'col-drag-ghost';
            ghost.textContent = source.querySelector('.col-head-label')?.textContent ?? '';
            ghost.style.width = `${String(rect.width)}px`;
            ghost.style.height = `${String(rect.height)}px`;
            document.body.append(ghost);
            source.classList.add('col-dragging');
            document.body.classList.add('col-reordering');
          }
          ghost.style.transform = `translate(${String(moveEvent.clientX - 16)}px, ${String(moveEvent.clientY - 16)}px)`;
          mark(headerAt(moveEvent.clientX, moveEvent.clientY, table));
        };
        const up = (): void => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          if (ghost === null) return;
          const to = target?.dataset.colKey;
          mark(null);
          ghost.remove();
          source.classList.remove('col-dragging');
          document.body.classList.remove('col-reordering');
          /* 끈 뒤 따라오는 누름 한 번(정렬 단추)을 삼킨다. */
          const swallow = (clickEvent: MouseEvent): void => {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
          };
          window.addEventListener('click', swallow, { capture: true, once: true });
          window.setTimeout(
            () => window.removeEventListener('click', swallow, { capture: true }),
            0,
          );
          if (to !== undefined) onMove(columnKey, to);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      }}
    >
      <Icon name="drag_indicator" size={16} />
    </span>
  </span>
);

/**
 * 저장된 순서로 늘어놓은 열과, 머리칸마다 끌기 손잡이를 단 머리를 낸다.
 * `storageKey` 는 표마다 다르게 — 같은 열 이름이 다른 표에서 섞이지 않게.
 */
export const useColumnOrder = <T,>(storageKey: string, columns: Column<T>[]): Column<T>[] => {
  const [saved, setSaved] = useState<string[]>(() => readOrder(storageKey));
  const ordered = orderColumns(columns, saved);

  const commit = (from: string, to: string): void => {
    const next = moveKey(
      ordered.map(({ key }) => key),
      from,
      to,
    );
    setSaved(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* 저장하지 못해도 이번 화면에서는 그대로 쓴다. */
    }
  };

  return ordered.map((column): Column<T> => ({
    ...column,
    header: (
      <ColumnGrip columnKey={column.key} label={messages.common.columnOrderHandle} onMove={commit}>
        {column.header}
      </ColumnGrip>
    ),
  }));
};
