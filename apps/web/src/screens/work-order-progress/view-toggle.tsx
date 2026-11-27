import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ProgressView } from './filters';

const t = messages.workOrderProgress.view;

export interface ViewToggleProps {
  view: ProgressView;
  onChange: (view: ProgressView) => void;
}

const VIEWS: readonly ProgressView[] = ['table', 'timeline'];

/** 보기 전환 — 같은 조회 결과를 표나 일정으로 본다. 통합 대시보드의 라인 고르기와 같은 칩 묶음이다. */
export const ViewToggle = ({ view, onChange }: ViewToggleProps) => (
  <div aria-label={t.label} className="dash-segment" role="group">
    {VIEWS.map((option) => (
      <Chip
        key={option}
        selected={option === view}
        size="sm"
        variant="filter"
        onSelectedChange={() => {
          onChange(option);
        }}
      >
        {t[option]}
      </Chip>
    ))}
  </div>
);
