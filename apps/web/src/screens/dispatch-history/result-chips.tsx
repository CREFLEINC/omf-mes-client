import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { DispatchResult } from './queries';

const t = messages.dispatchHistory;

/** 칩으로 거르는 결과 — 종전 「결과 선택」 칸의 「전체」 밖 선택지 그대로. */
export const RESULTS: readonly DispatchResult[] = ['NOTIFIED', 'SKIPPED'];

/**
 * 위 줄 오른쪽 결과 칩 — 「알림 N · 건너뜀 N」(다른 화면 상태 칩과 같은 모양 · 자리 · #358).
 * 「전체」 칩은 두지 않는다 — 고른 칩을 다시 누르면 전체로 돌아간다. 0건 칩은 고른 칩이 아니면 감춘다.
 * 아직 세지 못한 칩은 이름만 보인다.
 */
export const ResultChips = ({
  counts,
  value,
  onChange,
}: {
  /** `RESULTS` 와 같은 순서. */
  counts: readonly (number | undefined)[];
  /** 걸린 결과. 없으면 `''`. */
  value: string;
  onChange: (next: string) => void;
}) => (
  <div className="inspection-hub-counts" role="group" aria-label={t.filters.result}>
    {RESULTS.map((result, index) => {
      const count = counts[index];
      const isActive = value === result;
      if (count === 0 && !isActive) return null;
      const label = t.results[result];

      return (
        <Chip
          key={result}
          variant="filter"
          size="sm"
          selected={isActive}
          aria-pressed={isActive}
          onSelectedChange={() => onChange(isActive ? '' : result)}
        >
          {count === undefined ? label : messages.common.inspectionHub.count(label, count)}
        </Chip>
      );
    })}
  </div>
);
