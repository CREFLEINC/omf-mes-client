import { AlertBanner, SkeletonText, TextField, type Column } from '@crefle/web-ui';
import type { WorkOrderDetailForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { useApiClient } from '../../../patterns/api-context';
import { EffectList } from '../../../patterns/process-page';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { plantToday, toPlantDateTimeParts } from '../../../patterns/plant-time';
import { runRequest } from '../../../patterns/request';
import { SelectableTable } from '../../../patterns/selectable-table';
import {
  currentPolicy,
  previousWorkingDay,
  toWorkingDays,
  WORKING_DAYS_POLICY_CODE,
} from '../../plant-working-days/working-days';
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
}

/**
 * 생산 창고 공장이면 W/O 마다 생산일 · 출고 작업일을 낸다. 아니면(지금 방식, 또는 판정 칸을 못 받음)
 * `undefined` — 배포 단계가 지금 그대로다.
 *
 * 생산 창고 공장 판정은 W/O 상세의 `productionWarehouseMode`(공장 기준, 계약 §2)로 한다.
 * 생산일은 W/O 계획 시작의 공장 날짜, 근무일은 공장의 `WEEKLY_WORKING_DAYS`(없으면 주 5일).
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
      queryFn: async () =>
        (await runRequest(() =>
          client.GET('/production/work-orders/{workOrderId}', {
            params: { path: { workOrderId: workOrder.workOrderId } },
          }),
        )) as WorkOrderDetailForward,
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
  const days = toWorkingDays(currentPolicy(policies.data ?? [], plantId ?? 0, today)?.valueNumeric);
  const map = new Map<number, IssueDates>();
  workOrders.forEach((workOrder, index) => {
    const start = details[index]?.data?.plannedStartAt;
    const productionDate = start === undefined ? null : (toPlantDateTimeParts(start)?.date ?? null);
    map.set(workOrder.workOrderId, {
      productionDate,
      issueWorkDate: productionDate === null ? null : previousWorkingDay(productionDate, days).date,
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
  lines: ReleaseLine[] | undefined;
  uomLabelOf: (uomId: number) => string;
  failures: ReleaseFailure[];
  /** 생산 창고 공장이면 W/O 마다 생산일 · 출고 작업일(피처 003). 없으면 지금 배포 단계 그대로. */
  issueDates?: Map<number, IssueDates>;
  /** 배포를 눌렀으면 손대지 않은 줄의 오류도 보인다. */
  revealErrors: boolean;
  onLotSizeChange: (workOrderId: number, value: string) => void;
}

/**
 * 배포 확인 단계(마지막 확인 단계). 결과를 바꾸는 값(W/O, 수량, LOT 크기)과 반영 사항을 1280×800 첫 화면 안에 보인다.
 */
export const ReleaseStep = ({
  lines,
  uomLabelOf,
  failures,
  issueDates,
  revealErrors,
  onLotSizeChange,
}: ReleaseStepProps) => {
  if (lines === undefined) return <SkeletonText lines={4} />;
  const totalLots = lines.reduce((sum, line) => sum + (line.lotCount ?? 0), 0);
  const monthDay = (iso: string | null | undefined): string =>
    iso === null || iso === undefined ? '' : iso.slice(5);
  const dateColumns: Column<ReleaseLine>[] =
    issueDates === undefined
      ? []
      : [
          {
            key: 'productionDate',
            header: pw.productionDate,
            render: (row) => (
              <span className="nowrap-cell">
                {monthDay(issueDates.get(row.workOrder.workOrderId)?.productionDate)}
              </span>
            ),
          },
          {
            key: 'issueWorkDate',
            header: pw.issueWorkDate,
            render: (row) => (
              <span className="nowrap-cell">
                {monthDay(issueDates.get(row.workOrder.workOrderId)?.issueWorkDate)}
              </span>
            ),
          },
        ];
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
        label: `${pw.materials(pw.dates(monthDay(upcoming[0] ?? first), Math.max(0, upcoming.length - 1)))} ${pw.materialsNote}`,
      },
      { key: 'picking', label: `${pw.picking} ${pw.pickingNote}` },
    ];
  })();
  const hasBlocks = failures.some((failure) => failure.links.length > 0);
  const columns: Column<ReleaseLine>[] = [
    {
      key: 'workOrderNo',
      header: t.columns.workOrderNo,
      render: (row) => <span className="nowrap-cell mono-cell">{row.workOrder.workOrderNo}</span>,
    },
    {
      key: 'operation',
      header: t.columns.operation,
      render: (row) => (
        <span className="ellipsis-cell" title={row.workOrder.operationName}>
          {row.workOrder.operationName}
        </span>
      ),
    },
    {
      key: 'orderQty',
      header: t.columns.orderQty,
      align: 'end',
      render: (row) => (
        <span className="nowrap-cell">{`${formatQty(row.workOrder.orderQty)} ${uomLabelOf(row.workOrder.uomId)}`}</span>
      ),
    },
    {
      key: 'lotSize',
      header: t.columns.lotSize,
      width: '9rem',
      render: (row) => (
        <TextField
          size="sm"
          fullWidth
          inputMode="decimal"
          aria-label={t.lotSizeLabel(row.workOrder.workOrderNo)}
          value={row.lotSizeText}
          error={row.touched || revealErrors ? (row.error ?? undefined) : undefined}
          onChange={(event) => onLotSizeChange(row.workOrder.workOrderId, event.target.value)}
        />
      ),
    },
    {
      key: 'lotCount',
      header: t.columns.lotCount,
      align: 'end',
      render: (row) => (
        <span className="nowrap-cell">{row.lotCount === null ? '' : String(row.lotCount)}</span>
      ),
    },
    ...dateColumns,
  ];

  return (
    <div className="erp-wo-release-layout">
      <section className="pane erp-wo-step-pane" aria-label={t.heading}>
        <h2 className="section-title">{t.heading}</h2>
        <SelectableTable
          columns={columns}
          rows={lines}
          getRowId={(row) => String(row.workOrder.workOrderId)}
        />
      </section>
      <section className="pane erp-wo-release-effects">
        <EffectList
          task={t.task}
          items={[
            { key: 'status', label: t.effects.status(lines.length) },
            { key: 'lots', label: t.effects.lots(totalLots) },
            ...effectItems,
            { key: 'pqc', label: t.effects.pqc },
          ]}
        />
        <AlertBanner variant="info">{t.irreversible}</AlertBanner>
        {failures.length > 0 && (
          <AlertBanner variant="error" title={hasBlocks ? pw.blockedTitle : undefined}>
            <ul className="erp-wo-release-failures">
              {failures.map((failure) => (
                <li key={failure.key}>
                  {failure.text}
                  {/* 바로가기는 새 탭 — 처리 화면을 잃지 않게(screens/W-02-01-release.md). */}
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
  );
};
