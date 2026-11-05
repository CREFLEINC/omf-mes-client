import { AdjustableLayout } from './adjustable-layout';
import { AdjustableNativeTable } from './adjustable-table';
import { TerminalConnections } from './terminal-connections';
import { AlertBanner, Button, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { plantToday, toPlantDateTimeParts } from '../../../patterns/plant-time';
import {
  currentPolicy,
  previousWorkingDay,
  toWorkingDays,
  WORKING_DAYS_POLICY_CODE,
} from '../../plant-working-days/working-days';

import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { evaluateWorkOrderReleaseDraft } from '../../work-order-release/release-draft';
import type { ReleaseAttempt } from '../release-runner';
import { productionOrderItemKeys } from '../item-lookups';
import { formatQty } from './process-model';
import type { OrderWorkOrder } from './queries';

const t = messages.erpWorkOrderFlow.process.release;

const pw = t.productionWarehouse;

/** W-02-11 부족 보기 — 배포 결과의 「재고 있는 생산 창고 없음」 안내가 가리킨다. */
export const MATERIAL_ISSUE_SHORTAGE_PATH = '/production/material-issue-status?view=shortage';

/** 배포 막힘 사유마다 고칠 자리(screens/W-02-01-release.md 「배포 막힘 사유」, 검토 6 가정 포함). */
export const RELEASE_BLOCK_LINKS: Record<string, string> = {
  LINE_DEPARTMENT_MISSING: '/equipment/master',
  PRODUCTION_WAREHOUSE_MISSING: '/master-data/common-code?tab=org',
  PRODUCTION_FLOOR_LOCATION_MISSING: '/production/work-order-assignments',
};

/** 배포 실패 한 건 — 출고 요청 기준정보 사유면 고칠 자리 바로가기를 함께 낸다. */
export interface ReleaseFailure {
  key: string;
  text: string;
  links: { label: string; to: string }[];
}

export const toReleaseFailures = (
  problems: readonly ReleaseAttempt[],
  failedText: (workOrderNo: string, reason: string) => string,
): ReleaseFailure[] =>
  problems.flatMap((attempt): ReleaseFailure[] => {
    const blocks = attempt.blocks ?? [];
    if (blocks.length === 0) {
      return [
        {
          key: `${String(attempt.workOrderId)}`,
          text: failedText(attempt.workOrderNo, attempt.reason ?? ''),
          links: [],
        },
      ];
    }
    return blocks.map((code) => ({
      key: `${String(attempt.workOrderId)}-${code}`,
      text: failedText(attempt.workOrderNo, pw.blocks[code] ?? code),
      links:
        RELEASE_BLOCK_LINKS[code] === undefined
          ? []
          : [{ label: pw.blockLinks[code] ?? code, to: RELEASE_BLOCK_LINKS[code] }],
    }));
  });

/** 배포 결과의 미배정 자재 안내(US2-9) — W/O 마다 한 줄. */
export const unsourcedNotices = (attempts: readonly ReleaseAttempt[]): string[] =>
  attempts
    .filter((attempt) => (attempt.unsourced?.length ?? 0) > 0)
    .map((attempt) => {
      const items = attempt.unsourced ?? [];
      return pw.unsourced(
        attempt.workOrderNo,
        items.length,
        items
          .map((item) =>
            pw.unsourcedItem(
              item.itemCode,
              item.itemName,
              formatQty(item.shortageQty),
              item.uomCode,
            ),
          )
          .join(', '),
      );
    });

/** 생산 창고 공장의 W/O 마다 생산일 · 출고 작업일(생산일의 1근무일 전, 공장 주간 근무일). */
export interface IssueDates {
  productionDate: string | null;
  issueWorkDate: string | null;
  /** 공장 근무일 정책을 못 읽어(권한 · 오류) 출고 작업일을 미리 셀 수 없다 — 「배포 때 정함」. */
  undetermined: boolean;
}

/**
 * 생산 창고 공장이면 W/O 마다 생산일 · 출고 작업일을 낸다. 아니면(지금 방식, 또는 판정 칸을 못 받음)
 * `undefined` — 배포 단계가 지금 그대로다.
 *
 * 생산 창고 공장 판정은 W/O 상세의 `productionWarehouseMode`(공장 기준, 계약 §2)로 한다.
 * 생산일은 W/O 계획 시작의 공장 날짜, 근무일은 공장의 `WEEKLY_WORKING_DAYS`(행이 없으면 주 5일).
 * 계획 시작이 없으면 서버처럼 오늘로 보고 바로 배포한다. 정책 조회가 막히면(권한 · 오류 · 받는 중) 주 5일로
 * 지어내지 않고 「배포 때 정함」으로 둔다 — 주 6일 공장에서 틀린 날짜를 보이지 않게(G2).
 */
export const useReleaseIssueDates = (
  workOrders: readonly OrderWorkOrder[],
  plantId: number | null,
): Map<number, IssueDates> | undefined => {
  const { client } = useApiClient();
  const details = useQueries({
    queries: workOrders.map((workOrder) => ({
      queryKey: ['work-orders', 'release-issue-dates', workOrder.workOrderId] as const,
      retry: false,
      queryFn: () =>
        runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}', {
            params: { path: { workOrderId: workOrder.workOrderId } },
          }),
        ),
    })),
  });
  const usesProductionWarehouses = details.some(
    (result) => result.data?.productionWarehouseMode === true,
  );
  const policies = useQuery({
    queryKey: ['work-orders', 'release-working-days', plantId ?? 0] as const,
    enabled: usesProductionWarehouses && plantId !== null,
    retry: false,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/app/operation-policies', {
              params: {
                query: { policyCode: WORKING_DAYS_POLICY_CODE, plantId: plantId ?? 0, page, size },
              },
            }),
          ),
        )
      ).items,
  });
  if (!usesProductionWarehouses) return undefined;

  const today = plantToday();
  const policyKnown = policies.isSuccess;
  const days = toWorkingDays(currentPolicy(policies.data ?? [], plantId ?? 0, today)?.valueNumeric);
  const map = new Map<number, IssueDates>();
  workOrders.forEach((workOrder, index) => {
    const start = details[index]?.data?.plannedStartAt;
    const productionDate = start === undefined ? null : (toPlantDateTimeParts(start)?.date ?? null);
    if (productionDate === null) {
      map.set(workOrder.workOrderId, { productionDate, issueWorkDate: today, undetermined: false });
      return;
    }
    map.set(workOrder.workOrderId, {
      productionDate,
      issueWorkDate: policyKnown ? previousWorkingDay(productionDate, days).date : null,
      undetermined: !policyKnown,
    });
  });
  return map;
};

export interface ReleaseLine {
  workOrder: OrderWorkOrder;
  lotSizeText: string;
  lotSize: number | null;
  lotCount: number | null;
  error: string | null;
  /** 사용자가 고친 줄. 처음 연 화면에는 오류를 보이지 않는다(C-7). */
  touched: boolean;
}

/** 품목 기본 LOT 크기(단위가 같을 때만). 같은 품목 상세 캐시를 쓴다. */
export const useDefaultLotSizes = (workOrders: readonly OrderWorkOrder[]): Map<number, number> => {
  const { client } = useApiClient();
  const itemIds = [...new Set(workOrders.map((item) => item.itemId))];
  const results = useQueries({
    queries: itemIds.map((itemId) => ({
      queryKey: productionOrderItemKeys.detail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });
  const map = new Map<number, number>();
  workOrders.forEach((workOrder) => {
    const detail = results[itemIds.indexOf(workOrder.itemId)]?.data?.item;
    const size = detail?.defaultProductionLotSize ?? null;
    if (detail !== undefined && detail.baseUomId === workOrder.uomId && size !== null && size > 0) {
      map.set(workOrder.workOrderId, size);
    }
  });
  return map;
};

export const toReleaseLines = (
  workOrders: readonly OrderWorkOrder[],
  lotSizeTexts: Record<number, string>,
  defaults: Map<number, number>,
): ReleaseLine[] =>
  workOrders.map((workOrder) => {
    const text =
      lotSizeTexts[workOrder.workOrderId] ?? String(defaults.get(workOrder.workOrderId) ?? '');
    const evaluation = evaluateWorkOrderReleaseDraft(
      { lotSizeText: text, handoverNote: '' },
      workOrder.orderQty,
    );
    return {
      workOrder,
      lotSizeText: text,
      lotSize: evaluation.body?.lotSize ?? null,
      lotCount: evaluation.preview?.slotCount ?? null,
      error: evaluation.lotSizeError,
      touched: lotSizeTexts[workOrder.workOrderId] !== undefined,
    };
  });

export interface ReleaseStepProps {
  plantId?: number;
  lines: ReleaseLine[] | undefined;
  orderNo?: string;
  itemLabel?: string;
  planDateOf?: (planId: number) => string | null;
  lineNameOf?: (lineId: number | null) => string;
  uomLabelOf: (uomId: number) => string;
  failures: ReleaseFailure[];
  issueDates?: Map<number, IssueDates>;
  /** 배포를 눌렀으면 손대지 않은 줄의 오류도 보인다. */
  revealErrors: boolean;
  onLotSizeChange: (workOrderId: number, value: string) => void;
}

/**
 * 배포 확인 단계(마지막 확인 단계). 결과를 바꾸는 값(W/O, 수량, LOT 크기)과 반영 사항을 1280×800 첫 화면 안에 보인다.
 */
export const ReleaseStep = ({
  plantId,
  lines,
  orderNo,
  itemLabel,
  planDateOf,
  lineNameOf,
  uomLabelOf,
  failures,
  issueDates,
  revealErrors,
  onLotSizeChange,
}: ReleaseStepProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (lines === undefined) return <SkeletonText lines={4} />;
  const totalLots = lines.reduce((sum, line) => sum + (line.lotCount ?? 0), 0);
  const selected =
    lines.find((line) => String(line.workOrder.workOrderId) === selectedId) ?? lines[0];
  if (selected === undefined) return <p className="empty-line">{t.empty}</p>;
  const wo = selected.workOrder;
  const monthDay = (iso: string | null | undefined): string => (iso == null ? '' : iso.slice(5));
  /*
   * 생산 창고 공장의 효과 문구 — 날짜만(검토 14). 출고 작업일이 오늘 이하면 「바로 출고」.
   * 날짜가 여럿이면 가장 이른 날 「외 N일」.
   */
  const effectItems = (() => {
    if (issueDates === undefined) {
      return [
        { key: 'materials', label: t.effects.materials },
        { key: 'picking', label: t.effects.picking },
      ];
    }
    if (lines.some((line) => issueDates.get(line.workOrder.workOrderId)?.undetermined === true)) {
      return [
        { key: 'materials', label: pw.materialsUndetermined },
        { key: 'picking', label: pw.pickingLine },
      ];
    }
    const dates = [
      ...new Set(
        lines
          .map((line) => issueDates.get(line.workOrder.workOrderId)?.issueWorkDate ?? null)
          .filter((date): date is string => date !== null),
      ),
    ].sort();
    const today = plantToday();
    const first = dates[0];
    if (first !== undefined && dates.every((date) => date <= today)) {
      return [
        { key: 'materials', label: pw.materialsNow(monthDay(dates.at(-1))) },
        { key: 'picking', label: pw.pickingNow },
      ];
    }
    const upcoming = dates.filter((date) => date > today);
    return [
      {
        key: 'materials',
        label: pw.materialsLine(
          pw.dates(monthDay(upcoming[0] ?? first), Math.max(0, upcoming.length - 1)),
        ),
      },
      { key: 'picking', label: pw.pickingLine },
    ];
  })();
  const hasBlocks = failures.some((failure) => failure.links.length > 0);

  return (
    <div className="erp-wo-release-workspace">
      <div className="section-heading-row">
        <h2 className="section-title">{t.heading}</h2>
        <span className="field-note">{t.scope(lines.length)}</span>
      </div>
      <p className="erp-wo-release-scope">{t.scopeHelp}</p>
      <AdjustableLayout
        storageKey="omf-mes:work-planning:release-layout"
        label="배포 확인"
        initial="stack"
        ratio={0.6}
      >
        <section className="pane erp-wo-release-targets" aria-label="배포 대상 및 LOT 설정">
          <h3 className="section-title">배포 대상 및 LOT 설정</h3>
          <div className="erp-wo-release-target-table">
            <AdjustableNativeTable
              storageKey="omf-mes:work-planning:release-columns"
              widths={
                issueDates === undefined
                  ? [220, 220, 120, 160, 120]
                  : [220, 220, 120, 160, 120, 120, 120]
              }
              labels={[
                '작업지시 · 공정',
                '계획일 · 생산 라인',
                t.columns.orderQty,
                t.columns.lotSize,
                t.columns.lotCount,
                ...(issueDates === undefined ? [] : [pw.productionDate, pw.issueWorkDate]),
              ]}
            >
              <tbody>
                {lines.map((line) => {
                  const target = line.workOrder;
                  return (
                    <tr
                      key={target.workOrderId}
                      data-selected={target.workOrderId === wo.workOrderId}
                    >
                      <td data-label="작업지시 · 공정">
                        <Button
                          variant="text"
                          size="sm"
                          aria-label={`${target.workOrderNo} 상세 확인`}
                          aria-pressed={target.workOrderId === wo.workOrderId}
                          onClick={() => setSelectedId(String(target.workOrderId))}
                        >
                          {target.workOrderNo}
                        </Button>
                        <p>{target.operationName}</p>
                      </td>
                      <td data-label="계획일 · 생산 라인">
                        {planDateOf?.(target.productionPlanId) ?? '—'}
                        <p>{lineNameOf?.(target.productionLineId ?? null) ?? '—'}</p>
                      </td>
                      <td data-label={t.columns.orderQty}>
                        {formatQty(target.orderQty)} {uomLabelOf(target.uomId)}
                      </td>
                      <td data-label={t.columns.lotSize}>
                        <TextField
                          size="sm"
                          inputMode="decimal"
                          aria-label={t.lotSizeLabel(target.workOrderNo)}
                          value={line.lotSizeText}
                          error={
                            line.touched || revealErrors ? (line.error ?? undefined) : undefined
                          }
                          onChange={(event) =>
                            onLotSizeChange(target.workOrderId, event.target.value)
                          }
                        />
                        <span className="field-note">{uomLabelOf(target.uomId)}</span>
                      </td>
                      <td data-label={t.columns.lotCount}>
                        {line.lotCount == null ? '—' : `${line.lotCount}개`}
                      </td>
                      {issueDates !== undefined && (
                        <>
                          <td data-label={pw.productionDate}>
                            {monthDay(issueDates.get(target.workOrderId)?.productionDate)}
                          </td>
                          <td data-label={pw.issueWorkDate}>
                            {issueDates.get(target.workOrderId)?.undetermined === true
                              ? pw.decidedAtRelease
                              : monthDay(issueDates.get(target.workOrderId)?.issueWorkDate)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </AdjustableNativeTable>
          </div>
        </section>
        <div className="erp-wo-release-layout">
          <details className="pane erp-wo-release-detail" aria-label={t.selectedTarget}>
            <summary>
              선택 작업지시 상세 · {wo.workOrderNo} · {wo.operationName}
            </summary>
            <dl className="erp-wo-release-summary">
              <div>
                <dt>{t.orderNo}</dt>
                <dd>{orderNo ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.item}</dt>
                <dd>{itemLabel ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.columns.operation}</dt>
                <dd>{wo.operationName}</dd>
              </div>
              <div>
                <dt>{t.columns.orderQty}</dt>
                <dd>
                  {formatQty(wo.orderQty)} {uomLabelOf(wo.uomId)}
                </dd>
              </div>
              <div>
                <dt>{t.planDate}</dt>
                <dd>{planDateOf?.(wo.productionPlanId) ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.line}</dt>
                <dd>{lineNameOf?.(wo.productionLineId ?? null) ?? '—'}</dd>
              </div>
            </dl>
          </details>
          {plantId != null && (
            <details className="pane erp-wo-release-terminals">
              <summary>연결 단말기 확인</summary>
              <TerminalConnections key={wo.workOrderId} plantId={plantId} workOrder={wo} />
            </details>
          )}
          <section className="erp-wo-release-effects">
            <div className="pane">
              <div
                className="erp-wo-release-notice"
                role="region"
                aria-label={messages.screenPatterns.effectList.title(t.task)}
              >
                <h3 className="section-title">배포 시 반영 사항</h3>
                <ul>
                  <li>{t.effects.status(lines.length)}</li>
                  <li>
                    {lines.some((line) => line.lotCount === null)
                      ? t.lotsPending
                      : t.effects.lots(totalLots)}
                  </li>
                  {effectItems.map((effect) => (
                    <li key={effect.key}>{effect.label}</li>
                  ))}
                  <li>{t.effects.pqc}</li>
                </ul>
                <p>{t.irreversible}</p>
              </div>
            </div>
            {failures.length > 0 && (
              <AlertBanner variant="error" title={hasBlocks ? pw.blockedTitle : undefined}>
                <ul className="erp-wo-release-failures">
                  {failures.map((failure) => (
                    <li key={failure.key}>
                      {failure.text}
                      {failure.links.map((link) => (
                        <Link key={link.to} to={link.to} target="_blank" rel="noreferrer">
                          {link.label}
                        </Link>
                      ))}
                    </li>
                  ))}
                </ul>
              </AlertBanner>
            )}
          </section>
        </div>
      </AdjustableLayout>
    </div>
  );
};
