import { AlertBanner, Button, Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

/**
 * C-18 일괄 동작 결과 영역과 행 결과 칩.
 *
 * 결과는 목록 행 단위로 세고, 행 아래 항목이 일부만 처리되면 「일부 처리」로 센다. 둘째 줄에 항목 단위 수를 보인다.
 * 사용자가 닫거나 다시 조회할 때까지 남긴다(부르는 쪽 상태). 처리되지 않은 줄에는 고칠 곳 링크를 둔다.
 * 영역 안 버튼은 작은 높이의 테두리 버튼이다(C-19).
 */
const t = messages.screenPatterns.bulkResult;

export type BulkOutcomeStatus = 'processed' | 'partial' | 'skipped' | 'failed';
export type BulkResultFilter = 'partial' | 'skipped' | 'failed' | null;

export interface BulkOutcome {
  id: string;
  label: string;
  status: BulkOutcomeStatus;
  reason: string | null;
  /** 이 행 아래 항목 중 처리한 수와 전체 수(예: W/O 1 / 3) */
  items?: { done: number; total: number };
  /** 고칠 곳. 처리되지 않은 줄에만 쓴다. */
  fixHref?: string;
}

const tone: Record<BulkOutcomeStatus, ChipStatus> = {
  processed: 'success',
  partial: 'warning',
  skipped: 'warning',
  failed: 'error',
};

export const BulkOutcomeChip = ({ outcome }: { outcome: BulkOutcome }) => (
  <Chip
    variant="status"
    size="sm"
    status={tone[outcome.status]}
    title={outcome.reason ?? undefined}
  >
    {t.outcome[outcome.status]}
  </Chip>
);

export interface BulkResultProps {
  title: string;
  outcomes: BulkOutcome[];
  /** 항목 단위 이름(예: W/O). 주면 둘째 줄에 「W/O N건 처리, N건 남음」을 보인다. */
  itemName?: string;
  filter: BulkResultFilter;
  onFilterChange: (filter: BulkResultFilter) => void;
  onClose: () => void;
}

export const countOutcomes = (outcomes: readonly BulkOutcome[]) => ({
  processed: outcomes.filter((item) => item.status === 'processed').length,
  partial: outcomes.filter((item) => item.status === 'partial').length,
  skipped: outcomes.filter((item) => item.status === 'skipped').length,
  failed: outcomes.filter((item) => item.status === 'failed').length,
});

const FILTERS: { key: Exclude<BulkResultFilter, null>; label: string }[] = [
  { key: 'partial', label: t.onlyPartial },
  { key: 'skipped', label: t.onlySkipped },
  { key: 'failed', label: t.onlyFailed },
];

export const BulkResult = ({
  title,
  outcomes,
  itemName,
  filter,
  onFilterChange,
  onClose,
}: BulkResultProps) => {
  const counts = countOutcomes(outcomes);
  const onlyFailed = counts.failed > 0 && counts.processed + counts.partial + counts.skipped === 0;
  const variant = onlyFailed
    ? 'error'
    : counts.failed + counts.partial + counts.skipped > 0
      ? 'warning'
      : 'success';
  const issues = outcomes.filter((item) => item.status !== 'processed');
  const itemDone = outcomes.reduce((sum, item) => sum + (item.items?.done ?? 0), 0);
  const itemTotal = outcomes.reduce((sum, item) => sum + (item.items?.total ?? 0), 0);

  return (
    <section className="bulk-result" aria-label={title}>
      <AlertBanner
        variant={variant}
        title={`${title}: ${t.summary(counts.processed, counts.partial, counts.skipped, counts.failed)}`}
        action={
          <div className="bulk-result-actions">
            {FILTERS.filter(({ key }) => counts[key] > 0).map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant="outlined"
                aria-pressed={filter === key}
                className={filter === key ? 'is-pressed' : undefined}
                onClick={() => onFilterChange(filter === key ? null : key)}
              >
                {label}
              </Button>
            ))}
            <Button size="sm" variant="outlined" onClick={onClose}>
              {t.close}
            </Button>
          </div>
        }
      >
        {itemName !== undefined && itemTotal > 0 && (
          <p className="bulk-result-items">{t.items(itemName, itemDone, itemTotal - itemDone)}</p>
        )}
        {issues.length > 0 && (
          <ul className="bulk-result-lines">
            {issues.map((item) => (
              <li key={item.id}>
                <BulkOutcomeChip outcome={item} />
                <span className="bulk-result-label">{item.label}</span>
                {item.reason !== null && <span className="bulk-result-reason">{item.reason}</span>}
                {item.fixHref !== undefined && (
                  <Link
                    className="bulk-result-fix"
                    to={item.fixHref}
                    aria-label={t.fixFor(item.label)}
                  >
                    {t.fix}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </AlertBanner>
    </section>
  );
};
