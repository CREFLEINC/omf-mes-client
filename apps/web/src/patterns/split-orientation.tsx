import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type CSSProperties } from 'react';

import { HubActions, useHubActionsTarget } from './hub-actions';

const t = messages.common.inspectionHub;

/** 목록 · 상세 배치 — 좌우(`row`) 또는 상하(`column`). */
export type SplitOrientation = 'row' | 'column';

const OPTIONS: readonly { value: SplitOrientation; icon: string; label: string }[] = [
  { value: 'row', icon: 'view_column_2', label: t.layoutSideBySide },
  { value: 'column', icon: 'view_agenda', label: t.layoutStacked },
];

/**
 * 목록 · 상세 배치를 고르고 브라우저에 남긴다(사용자 지시 2026-10-26 · omf-all-around#185).
 * 다시 들어오거나 다시 로그인해도 같은 배치다. 저장소가 막혀 있으면 좌우다.
 */
export const useSplitOrientation = (storageKey: string) => {
  const [orientation, setOrientation] = useState<SplitOrientation>(() => {
    try {
      return window.localStorage.getItem(storageKey) === 'column' ? 'column' : 'row';
    } catch {
      return 'row';
    }
  });

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

  return { orientation, change, listHeight, changeListHeight, style };
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
  if (target === null) return null;

  return (
    <HubActions target={target}>
      <div className="split-orientation-toggle" role="group" aria-label={t.layoutLabel}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="split-orientation-option"
            aria-pressed={orientation === option.value}
            onClick={() => onChange(option.value)}
          >
            <Icon name={option.icon} size={16} />
            {option.label}
          </button>
        ))}
      </div>
    </HubActions>
  );
};
