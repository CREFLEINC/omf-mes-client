import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, useSyncExternalStore, type CSSProperties } from 'react';

import { HubActions, useHubActionsTarget } from './hub-actions';

const t = messages.common.inspectionHub;

/** 목록 · 상세 배치 — 좌우(`row`) 또는 상하(`column`). */
export type SplitOrientation = 'row' | 'column';

const OPTIONS: readonly { value: SplitOrientation; icon: string; label: string }[] = [
  { value: 'row', icon: 'view_column_2', label: t.layoutSideBySide },
  { value: 'column', icon: 'view_agenda', label: t.layoutStacked },
];

/**
 * 관리웹이 받치는 가장 좁은 창 폭(C-14 1280×800). 이보다 좁으면 좌우로 세울 자리가 없어 늘 위아래로 쌓는다.
 * 그 위로는 고른 배치를 그대로 따른다. 고른 적이 없으면 `WIDE_WIDTH` 이상에서 좌우, 그보다 좁으면 위아래다.
 * app.css 의 `.po-board-split` 좌우 배치 규칙과 같은 값이어야 한다.
 */
export const SIDE_BY_SIDE_MIN_WIDTH = 1280;
export const WIDE_WIDTH = 1440;

const mediaStore = (query: string) => ({
  subscribe: (onChange: () => void): (() => void) => {
    if (typeof window.matchMedia !== 'function') return () => {};
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  },
  read: (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
});
const narrowStore = mediaStore(`(max-width: ${String(SIDE_BY_SIDE_MIN_WIDTH - 1)}px)`);
const wideStore = mediaStore(`(min-width: ${String(WIDE_WIDTH)}px)`);

/** 창이 좁아(1280px 미만) 좌우 배치를 쓸 수 없는가. 시험 환경(matchMedia 없음)에서는 거짓이다. */
export const useNarrowWindow = (): boolean =>
  useSyncExternalStore(narrowStore.subscribe, narrowStore.read, () => false);

/** 고른 배치가 없을 때의 기본 — 창이 넓으면(1440px 이상) 좌우. 시험 환경(matchMedia 없음)에서는 좌우다. */
const useWideWindow = (): boolean =>
  useSyncExternalStore(
    wideStore.subscribe,
    () => typeof window.matchMedia !== 'function' || wideStore.read(),
    () => true,
  );

/**
 * 실제 배치 — 관리웹 최소 폭(1280px)보다 좁으면 늘 위아래, 그 위로는 고른 배치, 고른 적이 없으면 창 폭(1440px 이상 좌우).
 * `usePaneLayout`(po-board)도 같은 규칙을 쓴다.
 */
export const useSplitDefault = (chosen: SplitOrientation | null): SplitOrientation => {
  const narrow = useNarrowWindow();
  const wide = useWideWindow();
  if (narrow) return 'column';
  return chosen ?? (wide ? 'row' : 'column');
};

/**
 * 목록 · 상세 배치를 고르고 브라우저에 남긴다(사용자 지시 2026-10-26 · omf-all-around#185).
 * 다시 들어오거나 다시 로그인해도 같은 배치다. 고른 적이 없으면 창 폭으로 정한다(1440px 이상 좌우).
 */
export const useSplitOrientation = (storageKey: string) => {
  const [chosen, setOrientation] = useState<SplitOrientation | null>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === 'column' || saved === 'row' ? saved : null;
    } catch {
      return null;
    }
  });
  const orientation = useSplitDefault(chosen);

  const change = (next: SplitOrientation): void => {
    setOrientation(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* 저장하지 못해도 이번 화면에서는 그대로 쓴다. */
    }
  };

  /* 상하 배치의 목록 높이(px) — 가운데 막대를 끌어 정한다. 정하지 않았으면 줄 수만큼(CSS 기본)이다. */
  const heightKey = `${storageKey}:list-height`;
  const [listHeight, setListHeight] = useState<number | null>(() => {
    try {
      const saved = Number(window.localStorage.getItem(heightKey));
      return saved > 0 ? saved : null;
    } catch {
      return null;
    }
  });
  const changeListHeight = (next: number): void => {
    const value = Math.round(Math.min(Math.max(next, LIST_MIN), window.innerHeight * 0.8));
    setListHeight(value);
    try {
      window.localStorage.setItem(heightKey, String(value));
    } catch {
      /* 저장하지 못해도 이번 화면에서는 그대로 쓴다. */
    }
  };
  /** 분할 상자에 싣는다 — 상하 배치의 목록 상자가 읽는다(app.css `--stacked-list-height`). */
  const style = (
    listHeight === null ? {} : { '--stacked-list-height': `${String(listHeight)}px` }
  ) as CSSProperties;

  /*
   * 창이 관리웹 최소 폭(1280px)보다 좁으면 고른 배치와 관계없이 위아래로 선다. 화면과 단추가 실제 배치를 말하도록 그때는
   * `column` 을 돌려준다. 고른 값(`preferred`)은 남겨 두어 창을 넓히면 그 배치로 돌아간다.
   */
  const narrow = useNarrowWindow();
  return {
    orientation,
    preferred: chosen,
    narrow,
    change,
    listHeight,
    changeListHeight,
    style,
  };
};

/** 상하 배치에서 목록이 이보다 낮아지지 않는다(머리줄 + 두어 줄). */
const LIST_MIN = 140;
const HEIGHT_STEP = 24;

/**
 * 상하 배치의 가운데 가로 막대 — 끌면 목록 높이가 바뀐다(사용자 지시 2026-10-26). 초점을 두고 ↑·↓ 로도 옮긴다.
 * 바로 앞 형제(목록 상자)의 지금 높이에서 출발한다.
 */
export const PaneHeightSplitter = ({
  label,
  height,
  onChange,
}: {
  label: string;
  height: number | null;
  onChange: (height: number) => void;
}) => (
  <div
    className="inspection-height-splitter"
    role="separator"
    aria-orientation="horizontal"
    aria-label={label}
    title={label}
    tabIndex={0}
    onPointerDown={(event) => {
      const list = event.currentTarget.parentElement?.firstElementChild;
      if (!(list instanceof HTMLElement) || event.button !== 0) return;
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = list.getBoundingClientRect().height;
      const move = (moveEvent: PointerEvent): void => {
        onChange(startHeight + moveEvent.clientY - startY);
      };
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('row-resizing');
      };
      document.body.classList.add('row-resizing');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }}
    onKeyDown={(event) => {
      const list = event.currentTarget.parentElement?.firstElementChild;
      const current =
        height ?? (list instanceof HTMLElement ? list.getBoundingClientRect().height : 0);
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onChange(current - HEIGHT_STEP);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onChange(current + HEIGHT_STEP);
      }
    }}
  />
);

/**
 * 탭 줄 오른쪽(상태 칩 옆)의 배치 단추 둘 — 아이콘 + 「좌우 배치」 · 「상하 배치」. 고른 배치는 붉은 톤으로 눌린 상태다.
 * 탭 묶음 밖(탭 막대가 없는 계정 · 화면만 그린 시험)에서는 자리가 없어 그리지 않는다 — 배치는 좌우다.
 */
export const SplitOrientationToggle = ({
  orientation,
  onChange,
}: {
  orientation: SplitOrientation;
  onChange: (next: SplitOrientation) => void;
}) => {
  const target = useHubActionsTarget();
  const narrow = useNarrowWindow();
  const reasonId = useId();
  if (target === null) return null;

  /* 창이 관리웹 최소 폭보다 좁으면 실제 배치(상하)를 눌린 상태로 보이고, 좌우는 사유와 함께 잠근다. */
  const shown: SplitOrientation = narrow ? 'column' : orientation;

  return (
    <HubActions target={target}>
      <div className="split-orientation-toggle" role="group" aria-label={t.layoutLabel}>
        {OPTIONS.map((option) => {
          const locked = narrow && option.value === 'row';
          return (
            <button
              key={option.value}
              type="button"
              className="split-orientation-option"
              aria-pressed={shown === option.value}
              aria-disabled={locked ? true : undefined}
              aria-describedby={locked ? reasonId : undefined}
              title={locked ? t.layoutSideBySideNarrow : undefined}
              onClick={() => {
                if (!locked) onChange(option.value);
              }}
            >
              <Icon name={option.icon} size={16} />
              {option.label}
            </button>
          );
        })}
        {narrow && (
          <span id={reasonId} className="visually-hidden">
            {t.layoutSideBySideNarrow}
          </span>
        )}
      </div>
    </HubActions>
  );
};
