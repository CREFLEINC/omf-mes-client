import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

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

  return { orientation, change };
};

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
