import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { type SplitOrientation, useSideBySideFits } from '../../patterns/split-orientation';

const t = messages.common.inspectionHub;

const OPTIONS: readonly { value: SplitOrientation; icon: string; label: string }[] = [
  { value: 'row', icon: 'view_column_2', label: t.layoutSideBySide },
  { value: 'column', icon: 'view_agenda', label: t.layoutStacked },
];

/**
 * 좌우 · 상하 배치 단추 둘 — 「⋯」 안에 접지 않고 늘 보인다(사용자 지시 2026-11-20 · omf-all-around#333).
 * 모양은 공용 배치 단추(`.split-orientation-option`)를 그대로 쓴다.
 * 창이 좁으면 실제로 위아래로 쌓이므로 눌린 표시도 상하이고 좌우는 끈다(공용 부품과 같다).
 */
export const LayoutToggle = ({
  orientation,
  onChange,
}: {
  orientation: SplitOrientation;
  onChange: (next: SplitOrientation) => void;
}) => {
  const fits = useSideBySideFits();
  const shown: SplitOrientation = fits ? orientation : 'column';

  return (
    <div
      className="split-orientation-toggle terminal-map-layout-toggle"
      role="group"
      aria-label={t.layoutLabel}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="split-orientation-option"
          aria-pressed={shown === option.value}
          disabled={!fits && option.value === 'row'}
          title={!fits && option.value === 'row' ? t.layoutNarrow : undefined}
          onClick={() => {
            onChange(option.value);
          }}
        >
          <Icon name={option.icon} size={16} />
          {option.label}
        </button>
      ))}
    </div>
  );
};
