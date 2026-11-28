import { messages } from '@omf-mes/i18n';

import { Segmented, type SegmentedOption } from '../../patterns/segmented';
import type { ProgressView } from './filters';

const t = messages.workOrderProgress.view;

export interface ViewToggleProps {
  view: ProgressView;
  onChange: (view: ProgressView) => void;
}

const VIEWS: readonly SegmentedOption<ProgressView>[] = [
  { value: 'table', label: t.table, icon: 'table_rows' },
  { value: 'timeline', label: t.timeline, icon: 'view_timeline' },
];

/**
 * 보기 전환 — 같은 조회 결과를 표나 일정으로 본다. 상태 조건 칩 줄의 오른쪽 끝에 놓인다.
 *
 * 붙임 단추(`Segmented`)를 쓴다(보기 전환 개선안 1 · 사용자 결정 2026-11-28) — 왼쪽의 조건 칩과 모양이 달라
 * 「조건」과 「보기」가 갈리고, 아이콘으로 표와 일정을 글자보다 먼저 알아본다.
 */
export const ViewToggle = ({ view, onChange }: ViewToggleProps) => (
  <Segmented label={t.label} options={VIEWS} value={view} onChange={onChange} />
);
