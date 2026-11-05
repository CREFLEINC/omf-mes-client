import { AlertBanner, Button, Chip, Dialog, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ReplenishmentRun } from './api-types';
import { formatDay, formatQty, plantMinute } from './types';

const t = messages.productionWarehouseReplenishment;
const tl = t.runLog;

/** 실행 시각 한 줄 — 끝난 시각이 있으면 그것, 없으면 날짜. */
export const runWhen = (run: ReplenishmentRun): string =>
  run.finishedAt === null ? formatDay(run.runDate) : plantMinute(run.finishedAt);

export interface RunLogDialogProps {
  warehouseName: string;
  /** 그 창고의 실행 기록(최근 것부터). */
  runs: readonly ReplenishmentRun[];
  onClose: () => void;
}

/**
 * [기록 보기] — 날짜별 결과 표(screens/W-02-12.md 보기 2, 시안 States ③). 줄은 보충 시점 아래 품목뿐이고 기준 이상은
 * 「관리 품목 N 중 기준 아래 M」 수로만 보인다(R-10). 실패면 오류 글과 「오늘은 다시 실행하지 않습니다」.
 */
export const RunLogDialog = ({ warehouseName, runs, onClose }: RunLogDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    title={tl.title(warehouseName)}
    size="lg"
    footer={<Button onClick={onClose}>{tl.close}</Button>}
  >
    <div className="replenishment-detail">
      {runs.length === 0 ? <EmptyState size="sm" title={tl.empty} /> : null}
      {runs.map((run) => {
        const when = runWhen(run);
        const failed = run.status === 'FAILED';
        return (
          <section key={run.replenishmentRunId} aria-label={tl.linesLabel(when)}>
            <h3 className="subsection-title replenishment-chips">
              <span>{when}</span>
              <Chip size="sm" status={failed ? 'error' : 'success'}>
                {failed ? tl.statusFailed : tl.statusDone}
              </Chip>
              {failed ? null : (
                <span className="field-note">
                  {tl.checked(run.checkedItemCount, run.lines.length)}
                </span>
              )}
            </h3>
            {failed ? (
              <AlertBanner variant="error">
                <span className="replenishment-banner-line">
                  {tl.failedText(run.errorText ?? '')}
                </span>
                <span className="replenishment-banner-line">{tl.noRerun}</span>
              </AlertBanner>
            ) : null}
            {run.lines.length === 0 ? null : (
              <div className="replenishment-table-scroll">
                <table className="replenishment-table" aria-label={tl.linesLabel(when)}>
                  <thead>
                    <tr>
                      <th scope="col">{tl.columns.item}</th>
                      <th scope="col">{tl.columns.result}</th>
                      <th scope="col" className="is-number">
                        {tl.columns.usable}
                      </th>
                      <th scope="col" className="is-number">
                        {tl.columns.requested}
                      </th>
                      <th scope="col" className="is-number">
                        {tl.columns.shortage}
                      </th>
                      <th scope="col">{tl.columns.requestNo}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.lines.map((line) => (
                      <tr key={line.itemId}>
                        <td className="is-wrap">
                          <span className="replenishment-code">{line.itemCode}</span>{' '}
                          {line.itemName}
                        </td>
                        <td>{tl.results[line.resultCode]}</td>
                        <td className="is-number">{formatQty(line.usableQty)}</td>
                        <td className="is-number">
                          {line.requestedQty === 0 ? t.common.none : formatQty(line.requestedQty)}
                        </td>
                        <td className="is-number">
                          {line.shortageQty === 0 ? t.common.none : formatQty(line.shortageQty)}
                        </td>
                        <td className="replenishment-code">
                          {line.issueRequestNo ?? t.common.none}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  </Dialog>
);
