import { AlertBanner, Button, Chip, Skeleton } from '@crefle/web-ui';
import type {
  ReplenishmentLastRun,
  ReplenishmentRun,
  ReplenishmentRunResultCode,
  ReplenishmentSettings,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { plantToday } from '../../patterns/plant-time';
import { useRuns } from './queries';
import { RunLogDialog, runWhen } from './run-log-dialog';
import { formatDay, plantMinute } from './types';

const t = messages.productionWarehouseReplenishment;
const tu = t.runs;

/** 건너뛴 결과(요청을 만들지 않은 줄) — 일부만 요청(`SHORTAGE`)은 요청을 만들었으니 건너뜀이 아니다. */
const SKIPPED: readonly ReplenishmentRunResultCode[] = [
  'IN_PROGRESS',
  'NO_SOURCE_STOCK',
  'SOURCE_INACTIVE',
];

/**
 * 마지막 실행 결과 한 줄(시안 「요청 1장, 건너뜀 2(진행 중 요청 있음 1, 자재 창고 재고 없음 1)」).
 * 기준 아래 품목이 없으면 「모든 관리 품목이 보충 시점 이상」.
 */
export const runSummary = (run: ReplenishmentRun): string => {
  if (run.status === 'FAILED') return tu.failed;
  if (run.lines.length === 0) return `${tu.created(0)}, ${tu.allAbove}`;
  const parts = SKIPPED.map((code) => ({
    code,
    count: run.lines.filter((line) => line.resultCode === code).length,
  })).filter((part) => part.count > 0);
  const skipped = parts.reduce((sum, part) => sum + part.count, 0);
  const created = tu.created(run.createdRequestCount);
  return skipped === 0
    ? created
    : `${created}, ${tu.skipped(
        skipped,
        parts.map((part) => tu.skippedPart(t.runLog.results[part.code], part.count)).join(', '),
      )}`;
};

/** 실행 기록을 받지 못했을 때 설정 응답의 `lastRun` 으로 한 줄. */
export const lastRunSummary = (last: ReplenishmentLastRun): string =>
  last.status === 'FAILED' ? tu.failed : tu.created(last.createdRequestCount);

const lastRunWhen = (last: ReplenishmentLastRun): string =>
  last.finishedAt === null ? formatDay(last.runDate) : plantMinute(last.finishedAt);

export interface RunTableProps {
  plantId: number;
  settings: ReplenishmentSettings;
}

/**
 * 진행 보기 아래 「자동 보충 실행」 표(screens/W-02-12.md 보기 2, US5-10). 창고마다 실행 시각 · 마지막 실행 · 결과와
 * [기록 보기]. 「지금 실행」은 두지 않는다(FR-034) — 앞당기려면 요청 보기의 「기준 아래 불러오기」를 쓴다.
 */
export const RunTable = ({ plantId, settings }: RunTableProps) => {
  const runs = useRuns(plantId, plantToday());
  const [open, setOpen] = useState<number | null>(null);

  const runsOf = (warehouseId: number): ReplenishmentRun[] =>
    (runs.data ?? [])
      .filter((run) => run.warehouseId === warehouseId)
      .sort((left, right) => right.runDate.localeCompare(left.runDate));

  const openWarehouse = settings.warehouses.find((row) => row.warehouseId === open);

  return (
    <section className="replenishment-run-table" aria-label={tu.title}>
      <h2 className="subsection-title">{tu.title}</h2>
      {runs.isError ? (
        <AlertBanner
          variant="error"
          action={
            <Button variant="outlined" size="sm" onClick={() => void runs.refetch()}>
              {messages.common.retry}
            </Button>
          }
        >
          {tu.loadFailed}
        </AlertBanner>
      ) : null}
      {runs.isPending ? (
        <Skeleton variant="rect" height="4rem" />
      ) : (
        <div className="replenishment-table-scroll">
          <table className="replenishment-table" aria-label={tu.listLabel}>
            <thead>
              <tr>
                <th scope="col">{tu.columns.warehouse}</th>
                <th scope="col">{tu.columns.runTime}</th>
                <th scope="col">{tu.columns.lastRun}</th>
                <th scope="col">{tu.columns.result}</th>
                <th scope="col">
                  <span className="visually-hidden">{tu.columns.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {settings.warehouses.map((row) => {
                const [latest] = runsOf(row.warehouseId);
                const last = row.lastRun;
                const failed =
                  latest !== undefined ? latest.status === 'FAILED' : last?.status === 'FAILED';
                const when =
                  latest !== undefined
                    ? runWhen(latest)
                    : last === null
                      ? tu.never
                      : lastRunWhen(last);
                const result =
                  latest !== undefined
                    ? runSummary(latest)
                    : last === null
                      ? t.common.none
                      : lastRunSummary(last);
                return (
                  <tr key={row.warehouseId}>
                    <td>{row.warehouseName}</td>
                    <td>
                      {row.runTime === null
                        ? tu.runTimePlant(row.effectiveRunTime)
                        : tu.runTimeWarehouse(row.runTime)}
                    </td>
                    <td>{when}</td>
                    <td className="is-wrap">
                      {failed ? (
                        <Chip size="sm" status="error">
                          {result}
                        </Chip>
                      ) : (
                        result
                      )}
                    </td>
                    <td>
                      <Button
                        variant="outlined"
                        size="sm"
                        aria-label={tu.showLogLabel(row.warehouseName)}
                        onClick={() => setOpen(row.warehouseId)}
                      >
                        {tu.showLog}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {openWarehouse !== undefined && (
        <RunLogDialog
          warehouseName={openWarehouse.warehouseName}
          runs={runsOf(openWarehouse.warehouseId)}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
};
