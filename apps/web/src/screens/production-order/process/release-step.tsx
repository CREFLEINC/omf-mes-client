import {
  ReleaseFactGrid,
  ReleaseInformationTable,
  releaseDateTime,
  useAssignmentValues,
  type ReleaseReviewPlan,
} from './release-review';
import './release-selection.css';
import './release-check.css';
import { CheckMark, CheckRow, SummaryParts } from './release-check-row';
import {
  CHECK_KEYS,
  needsCheck,
  type CheckKey,
  type SectionCheck,
  type SummaryPart,
} from './release-checks';
import { RevisionDetailButton } from './revision-detail';
import { TerminalConnections, terminalCheckOf, useTerminalDirectory } from './terminal-connections';
import { isPastPlanningDate } from './planning-date-policy';
import { AlertBanner, Chip, EmptyState, SkeletonText, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { InfoTip } from '../../../patterns/info-tip';
import { plantToday, toPlantDateTimeParts } from '../../../patterns/plant-time';
import { SelectableTable } from '../../../patterns/selectable-table';
import {
  currentPolicy,
  previousWorkingDay,
  toWorkingDays,
  WORKING_DAYS_POLICY_CODE,
} from '../../plant-working-days/working-days';

import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { useRoutingOperations } from '../../routing/queries';
import { toWorkOrderFact, workOrderKeys, type WorkOrderFact } from '../../work-order/queries';
import { evaluateWorkOrderReleaseDraft } from '../../work-order-release/release-draft';
import type { ReleaseAttempt } from '../release-runner';
import { productionOrderItemKeys } from '../item-lookups';
import { formatQty } from './process-model';
import type { OrderWorkOrder } from './queries';

const t = messages.erpWorkOrderFlow.process.release;

const pw = t.productionWarehouse;

const c = t.checks;

/** W-02-11 부족 보기 — 배포 결과의 「재고 있는 생산 창고 없음」 안내가 가리킨다. */
export const MATERIAL_ISSUE_SHORTAGE_PATH = '/production/material-issue-status?view=shortage';

/** 배포 막힘 사유마다 고칠 자리(screens/W-02-01-release.md 「배포 막힘 사유」, 검토 6 가정 포함). */
export const RELEASE_BLOCK_LINKS: Record<string, string> = {
  PRODUCTION_WAREHOUSE_MISSING: '/master-data/warehouse-location',
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
  /** `null` 은 고른 작업지시를 다시 눌러 푼 것. */
  onSelectedWorkOrderChange?: (id: number | null) => void;
  selectedWorkOrderId?: number | null;
  /** 고른 작업지시를 풀었다 — 첫 작업지시로 되돌리지 않는다. 없으면 이 단계가 스스로 기억한다. */
  workOrderCleared?: boolean;
  readOnly?: boolean;
  materialReview?: (workOrderId: number) => ReactNode;
  /** 작업지시의 자재 확인 결과 — 목록의 「자재」 칸과 상세의 「자재 소요량」 줄이 쓴다. */
  materialCheckOf?: (workOrderId: number) => SectionCheck;
  plantId?: number;
  reviewPlans?: ReleaseReviewPlan[];
  lines: ReleaseLine[] | undefined;
  orderNo?: string;
  /** 품목코드 · 품목명은 두 칸으로 보인다(사용자 지시 2026-11-24). */
  itemCode?: string;
  itemName?: string;
  planDateOf?: (planId: number) => string | null;
  lineNameOf?: (lineId: number | null) => string;
  uomLabelOf: (uomId: number) => string;
  failures: ReleaseFailure[];
  issueDates?: Map<number, IssueDates>;
  /** 배포를 눌렀으면 손대지 않은 줄의 오류도 보인다. */
  revealErrors: boolean;
  onLotSizeChange: (workOrderId: number, value: string) => void;
}

const monthDay = (iso: string | null | undefined): string => (iso == null ? '' : iso.slice(5));

interface EffectCell {
  key: string;
  label: string;
  value: string;
  /** 칸 이름 옆 ⓘ 가 보이는 규칙 문장. */
  info?: string;
}

/**
 * 배포 시 반영 사항 — 이름표 칸 다섯. [배포]가 목록 전체를 내보내므로 고른 작업지시와 상관없이 전체 값이다.
 * 생산 창고 공장은 날짜만 보인다(검토 14). 출고 작업일이 모두 오늘 이하면 「바로 출고」, 날짜가 여럿이면 가장 이른 날 「외 N일」.
 */
const effectCells = (
  lines: readonly ReleaseLine[],
  issueDates: Map<number, IssueDates> | undefined,
): EffectCell[] => {
  const totalLots = lines.reduce((sum, line) => sum + (line.lotCount ?? 0), 0);
  const fixed: EffectCell[] = [
    { key: 'status', label: t.effects.status, value: t.effects.statusValue(lines.length) },
    {
      key: 'lots',
      label: t.effects.lots,
      value: lines.some((line) => line.lotCount === null)
        ? t.effects.lotsPending
        : t.effects.lotsValue(totalLots),
    },
  ];
  const pqc: EffectCell = { key: 'pqc', label: t.effects.pqc, value: t.effects.pqcValue };
  if (issueDates === undefined) {
    return [
      ...fixed,
      { key: 'materials', label: t.effects.materials, value: t.effects.materialsValue },
      { key: 'picking', label: t.effects.picking, value: t.effects.pickingValue },
      pqc,
    ];
  }
  if (lines.some((line) => issueDates.get(line.workOrder.workOrderId)?.undetermined === true)) {
    return [
      ...fixed,
      {
        key: 'materials',
        label: t.effects.materials,
        value: pw.cells.materialsUndetermined,
        info: pw.materialsUndetermined,
      },
      { key: 'picking', label: pw.cells.picking, value: pw.cells.pickingAt, info: pw.pickingLine },
      pqc,
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
      ...fixed,
      {
        key: 'materials',
        label: t.effects.materials,
        value: pw.cells.materialsNow,
        info: pw.materialsNow(monthDay(dates.at(-1))),
      },
      { key: 'picking', label: pw.cells.picking, value: pw.cells.pickingNow, info: pw.pickingNow },
      pqc,
    ];
  }
  const upcoming = dates.filter((date) => date > today);
  const dateText = pw.dates(monthDay(upcoming[0] ?? first), Math.max(0, upcoming.length - 1));
  return [
    ...fixed,
    {
      key: 'materials',
      label: t.effects.materials,
      value: pw.cells.materialsAt(dateText),
      info: pw.materialsLine(dateText),
    },
    { key: 'picking', label: pw.cells.picking, value: pw.cells.pickingAt, info: pw.pickingLine },
    pqc,
  ];
};

const ReleaseEffects = ({ cells }: { cells: EffectCell[] }) => {
  const title = messages.screenPatterns.effectList.title(t.task);
  return (
    <section className="pane release-effects" role="region" aria-label={title}>
      <h3 className="section-title">{title}</h3>
      <dl>
        {cells.map((cell) => (
          <div key={cell.key}>
            <dt>
              {cell.label}
              {cell.info !== undefined && <InfoTip text={cell.info} />}
            </dt>
            <dd>{cell.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

/** 계획 시작 ~ 종료 한 줄(「12-01 13:00 ~ 17:00」). 날짜가 다르면 종료에도 날짜를 적는다. */
const scheduleText = (fact: WorkOrderFact | undefined): string | null => {
  const start = fact?.plannedStartAt ? toPlantDateTimeParts(fact.plannedStartAt) : null;
  const end = fact?.plannedEndAt ? toPlantDateTimeParts(fact.plannedEndAt) : null;
  if (!start || !end) return null;
  return c.schedule(
    `${monthDay(start.date)} ${start.time}`,
    end.date === start.date ? end.time : `${monthDay(end.date)} ${end.time}`,
  );
};

interface RowProps {
  open: boolean;
  onToggle: () => void;
  check: SectionCheck | undefined;
}

/** 「생산계획」 줄 — 계획 번호 · 계획 시작~종료 · 자재 출고일. 펼치면 계획 · BOM · Routing · 일정 표. */
const PlanCheckRow = ({
  open,
  onToggle,
  check,
  workOrder,
  plan,
  fact,
  issue,
  plantId,
  orderNo,
  itemCode,
  itemName,
  planDateOf,
  lineNameOf,
  uomLabelOf,
}: RowProps & {
  workOrder: OrderWorkOrder;
  plan: ReleaseReviewPlan | undefined;
  fact: WorkOrderFact | undefined;
  issue: IssueDates | undefined;
  plantId: number | null;
} & Pick<
    ReleaseStepProps,
    'orderNo' | 'itemCode' | 'itemName' | 'planDateOf' | 'lineNameOf' | 'uomLabelOf'
  >) => {
  const issueDate =
    issue === undefined
      ? null
      : issue.undetermined
        ? pw.decidedAtRelease
        : (issue.issueWorkDate ?? null);
  const planDate = plan?.planDate ?? planDateOf?.(workOrder.productionPlanId) ?? null;
  const summary: SummaryPart[] = [
    ...(plan === undefined ? [] : [plan.planNo]),
    ...[scheduleText(fact) ?? planDate].filter((part): part is string => part !== null),
    ...(issueDate === null
      ? []
      : [
          [
            pw.issueWorkDate,
            issue?.undetermined === true ? issueDate : monthDay(issueDate),
          ] as const,
        ]),
  ];
  const issueLine: ReactNode[][][] =
    issue === undefined
      ? []
      : [
          [
            [pw.issueWorkDate, issueDate ?? '—'],
            [pw.productionDate, issue.productionDate ?? '—'],
          ],
        ];
  const lines: ReactNode[][][] =
    plan === undefined
      ? [
          [[t.orderNo, orderNo ?? '—']],
          [
            [t.itemCode, itemCode ?? '—'],
            [t.itemName, itemName ?? '—'],
          ],
          [
            [t.planDate, planDate ?? '—'],
            [t.line, lineNameOf?.(workOrder.productionLineId ?? null) ?? '—'],
          ],
          ...issueLine,
        ]
      : [
          [
            ['생산계획', plan.planNo],
            ['계획일', plan.planDate],
          ],
          [
            ['생산량', `${formatQty(plan.plannedQty)} ${uomLabelOf(plan.uomId)}`],
            [
              '생산 라인',
              lineNameOf?.(plan.plannedLineId) ??
                (plan.plannedLineId === null ? '미지정' : `ID ${plan.plannedLineId}`),
            ],
          ],
          [
            [
              'BOM',
              <span key="bom" className="erp-wo-final-revision">
                {plan.bomLabel}
                <RevisionDetailButton
                  iconOnly
                  kind="BOM"
                  value={String(plan.bomId)}
                  content={plan.revisionContent?.bom}
                  availabilityContext={{ plantId, quantity: plan.plannedQty }}
                />
              </span>,
            ],
          ],
          [
            [
              'Routing',
              <span key="routing" className="erp-wo-final-revision">
                {plan.routingLabel}
                <RevisionDetailButton
                  iconOnly
                  kind="Routing"
                  content={plan.revisionContent?.routing}
                  value={String(plan.routingId)}
                  label={plan.routingLabel}
                />
              </span>,
            ],
          ],
          [
            ['계획 시작', fact ? releaseDateTime(fact.plannedStartAt) : '조회 중'],
            ['계획 종료', fact ? releaseDateTime(fact.plannedEndAt) : '조회 중'],
          ],
          ...issueLine,
        ];
  return (
    <CheckRow title={c.plan} check={check} summary={summary} open={open} onToggle={onToggle}>
      <ReleaseFactGrid label="생산계획 정보" lines={lines} />
    </CheckRow>
  );
};

/** 「4M 배정」 줄 — 받은 배정 값. 상세를 받은 뒤에만 세운다(훅이 값을 받아야 한다). */
const AssignCheckRowLoaded = ({
  open,
  onToggle,
  check,
  fact,
  routingId,
  plantId,
  lineNameOf,
}: RowProps & {
  fact: WorkOrderFact;
  routingId: number | null;
  plantId: number | null;
  lineNameOf: ReleaseStepProps['lineNameOf'];
}) => {
  const operations = useRoutingOperations(routingId);
  const operation = operations.data?.items.find(
    (row) => row.routingOperationId === fact.routingOperationId,
  );
  const values = useAssignmentValues({
    fact,
    equipmentRequired: operation?.equipmentRequired === true,
    moldRequired: operation?.moldRequired === true,
    plantId,
    lineNameOf,
  });
  /* 첫 값(생산 라인)은 값만, 나머지는 「이름표 값」 — 「조립 2라인」 「생산품 입고 창고 MFG WH (WH20)」. */
  const summary: SummaryPart[] = values.map(([name, value], index) =>
    index === 0 ? (value ?? '') : ([name ?? '', value ?? ''] as const),
  );
  return (
    <CheckRow title={c.assign} check={check} summary={summary} open={open} onToggle={onToggle}>
      {operations.isError && (
        <AlertBanner variant="warning" title="공정별 필수 설정을 조회하지 못했습니다" />
      )}
      <ReleaseInformationTable paired label="4M 배정 정보" rows={values} />
    </CheckRow>
  );
};

interface ListRow {
  line: ReleaseLine;
  checks: Partial<Record<CheckKey, SectionCheck>>;
}

/**
 * 배포 확인 단계(마지막 확인 단계) — 좌우 고정 배치(B안, 2026-11-27).
 *
 * - 맨 위: 배포 시 반영 사항(전체 값).
 * - 왼쪽: 배포 작업지시 목록. 확인 칸(계획 · 4M · 자재 · 단말기)으로 열어 보지 않고도 확인할 작업지시가 보인다.
 * - 오른쪽: 고른 작업지시의 확인 항목 넷. 확인이 필요한 줄만 펼친 채로 열리고 나머지는 한 줄 요약이다.
 */
export const ReleaseStep = ({
  onSelectedWorkOrderChange,
  selectedWorkOrderId,
  workOrderCleared,
  readOnly = false,
  materialReview,
  materialCheckOf,
  plantId,
  reviewPlans,
  lines,
  orderNo,
  itemCode,
  itemName,
  planDateOf,
  lineNameOf,
  uomLabelOf,
  failures,
  issueDates,
}: ReleaseStepProps) => {
  const { client } = useApiClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localCleared, setLocalCleared] = useState(false);
  /* 줄을 손수 펼치거나 접은 것 — 작업지시를 바꿔도 그대로 둔다. 손대지 않은 줄은 확인이 필요할 때만 펼친다. */
  const [opened, setOpened] = useState<Partial<Record<CheckKey, boolean>>>({});
  const cleared = workOrderCleared ?? localCleared;
  const detailRef = useRef<HTMLDivElement>(null);
  const lastSelection = useRef<number | null>(null);
  /* 4M 과 계획 시작 · 종료는 작업지시 상세에서 읽는다. 생산계획을 넘겨받지 않은 자리(시험 등)에서는 묻지 않는다. */
  const withFacts = reviewPlans !== undefined;
  const facts = useQueries({
    queries: (lines ?? []).map((line) => ({
      queryKey: workOrderKeys.detail(line.workOrder.workOrderId),
      enabled: withFacts,
      retry: false,
      queryFn: async () =>
        toWorkOrderFact(
          await runRequest(() =>
            client.GET('/production/work-orders/{workOrderId}', {
              params: { path: { workOrderId: line.workOrder.workOrderId } },
            }),
          ),
        ),
    })),
  });
  const directory = useTerminalDirectory(plantId);
  const selected = cleared
    ? undefined
    : (lines?.find(
        (line) =>
          String(line.workOrder.workOrderId) ===
          (selectedWorkOrderId == null ? selectedId : String(selectedWorkOrderId)),
      ) ?? lines?.[0]);
  const activeWorkOrderId = selected?.workOrder.workOrderId ?? null;
  /* 고른 작업지시를 다시 누르면 푼다(목록 공통). */
  const pick = (workOrderId: number) => {
    if (workOrderId === activeWorkOrderId) {
      setLocalCleared(true);
      onSelectedWorkOrderChange?.(null);
      return;
    }
    setLocalCleared(false);
    setSelectedId(String(workOrderId));
    onSelectedWorkOrderChange?.(workOrderId);
  };
  useLayoutEffect(() => {
    if (activeWorkOrderId === null) return;
    const changed = lastSelection.current !== null && lastSelection.current !== activeWorkOrderId;
    lastSelection.current = activeWorkOrderId;
    if (changed)
      detailRef.current?.scrollIntoView?.({ block: 'start', inline: 'nearest', behavior: 'auto' });
  }, [activeWorkOrderId]);
  if (lines === undefined) return <SkeletonText lines={4} />;
  if (lines.length === 0) return <p className="empty-line">{t.empty}</p>;

  const today = plantToday();
  const planOf = (workOrder: OrderWorkOrder): ReleaseReviewPlan | undefined =>
    reviewPlans?.find((plan) => plan.productionPlanId === workOrder.productionPlanId);
  const checksOf = (line: ReleaseLine, index: number): ListRow['checks'] => {
    const workOrder = line.workOrder;
    const planDate =
      planOf(workOrder)?.planDate ?? planDateOf?.(workOrder.productionPlanId) ?? null;
    const fact = facts[index];
    return {
      /* 계획일이 지난 작업지시는 배포할 수 없다 — 배포한 뒤(읽기 전용)에는 따지지 않는다. */
      plan:
        !readOnly && planDate !== null && isPastPlanningDate(planDate, today)
          ? { state: 'warn', summary: [], alerts: [c.planPast] }
          : { state: 'ok', summary: [] },
      assign: !withFacts
        ? undefined
        : fact?.data !== undefined
          ? fact.data.fgWarehouseDiffersFromErp === true
            ? { state: 'warn', summary: [], alerts: [c.erpWarehouseDiffers] }
            : { state: 'ok', summary: [] }
          : fact?.isError === true
            ? { state: 'warn', summary: [], alerts: [c.failed] }
            : { state: 'pending', summary: [c.pending] },
      material: materialCheckOf?.(workOrder.workOrderId),
      terminal: terminalCheckOf(directory, workOrder),
    };
  };
  const rows: ListRow[] = lines.map((line, index) => ({ line, checks: checksOf(line, index) }));
  const attention = rows.filter((row) => needsCheck(Object.values(row.checks))).length;
  const shownChecks = CHECK_KEYS.filter((key) => rows.some((row) => row.checks[key] !== undefined));
  const hasBlocks = failures.some((failure) => failure.links.length > 0);
  const columns: Column<ListRow>[] = [
    {
      key: 'workOrder',
      header: '작업지시 번호',
      width: '168px',
      /* 번호는 보통 글자(사용자 지시 · #360) — 줄 고르기는 줄 자체가 맡는다. 줄바꿈 · 말줄임 없이. */
      render: ({ line }) => <span className="nowrap-cell">{line.workOrder.workOrderNo}</span>,
    },
    {
      key: 'process',
      header: '공정',
      render: ({ line }) => (
        <span className="release-check-operation">{line.workOrder.operationName}</span>
      ),
    },
    {
      key: 'quantity',
      header: '수량',
      width: '104px',
      align: 'end',
      /* 수량과 단위는 한 줄로 쓴다 — 칸이 좁아도 줄을 바꾸지 않는다(사용자 지시 2026-11-27). */
      render: ({ line }) => (
        <span className="nowrap-cell">
          {`${formatQty(line.workOrder.orderQty)} ${uomLabelOf(line.workOrder.uomId)}`}
        </span>
      ),
    },
    ...shownChecks.map((key): Column<ListRow> => ({
      key,
      header: c.columns[key],
      width: key === 'terminal' ? '64px' : '52px',
      align: 'center',
      render: (row) => <CheckMark check={row.checks[key]} title={c.columns[key]} />,
    })),
  ];

  const wo = selected?.workOrder;
  const selectedRow = rows.find((row) => row.line === selected);
  const selectedIndex = selected === undefined ? -1 : lines.indexOf(selected);
  const selectedFact = selectedIndex < 0 ? undefined : facts[selectedIndex]?.data;
  const isOpen = (key: CheckKey): boolean => {
    const check = selectedRow?.checks[key];
    return opened[key] ?? (check === undefined || check.state === 'warn');
  };
  const rowProps = (key: CheckKey): RowProps => ({
    open: isOpen(key),
    onToggle: () => setOpened((current) => ({ ...current, [key]: !isOpen(key) })),
    check: selectedRow?.checks[key],
  });
  const materialNode = wo === undefined ? null : materialReview?.(wo.workOrderId);

  return (
    <div className="erp-wo-release-workspace release-check">
      {!readOnly && <ReleaseEffects cells={effectCells(lines, issueDates)} />}
      {!readOnly && failures.length > 0 && (
        <AlertBanner variant="error" title={hasBlocks ? pw.blockedTitle : undefined}>
          <ul className="erp-wo-release-failures">
            {failures.map((failure) => (
              <li key={failure.key}>
                {failure.text}
                {failure.links.map((link) => (
                  <Link
                    key={link.to}
                    className="action-link-button"
                    to={link.to}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}
      <div className="release-check-panes">
        <section className="pane erp-wo-release-targets" aria-label="배포 작업지시">
          <div className="section-heading-row release-check-list-head">
            <h3 className="section-title">배포 작업지시</h3>
            <span className="release-check-count">{t.count(lines.length)}</span>
            {attention > 0 && (
              <Chip variant="status" status="warning" size="sm">
                {t.needsCheck(attention)}
              </Chip>
            )}
          </div>
          <div className="erp-wo-release-selection-table">
            <SelectableTable
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.line.workOrder.workOrderId)}
              activeId={wo === undefined ? null : String(wo.workOrderId)}
              onActivate={(row) => pick(row.line.workOrder.workOrderId)}
              rowLabel={(row) => `${row.line.workOrder.workOrderNo} 배포 상세`}
            />
          </div>
        </section>
        <div
          ref={detailRef}
          className="release-check-detail"
          role="region"
          aria-label="선택 작업지시 배포 상세"
        >
          {selected === undefined || wo === undefined ? (
            <>
              <div className="release-check-detail-head">
                <h3 className="section-title">선택 작업지시 상세</h3>
              </div>
              <EmptyState size="sm" title={t.selectPrompt} />
            </>
          ) : (
            <>
              <div className="release-check-detail-head">
                <h3 className="section-title">{wo.workOrderNo}</h3>
                <span className="release-check-detail-facts">
                  <SummaryParts
                    parts={[
                      ...(wo.operationName === '' ? [] : [wo.operationName]),
                      `${formatQty(wo.orderQty)} ${uomLabelOf(wo.uomId)}`,
                      ...(!readOnly && selected.lotCount !== null
                        ? [[t.columns.lotCount, c.lotCount(selected.lotCount)] as const]
                        : []),
                    ]}
                  />
                </span>
              </div>
              <PlanCheckRow
                {...rowProps('plan')}
                workOrder={wo}
                plan={planOf(wo)}
                fact={selectedFact}
                issue={issueDates?.get(wo.workOrderId)}
                plantId={plantId ?? null}
                orderNo={orderNo}
                itemCode={itemCode}
                itemName={itemName}
                planDateOf={planDateOf}
                lineNameOf={lineNameOf}
                uomLabelOf={uomLabelOf}
              />
              {withFacts &&
                (selectedFact === undefined ? (
                  <CheckRow title={c.assign} {...rowProps('assign')}>
                    {selectedRow?.checks.assign?.state === 'warn' ? (
                      <AlertBanner
                        variant="error"
                        title="작업지시 배정 정보를 조회하지 못했습니다"
                      />
                    ) : (
                      <SkeletonText lines={2} />
                    )}
                  </CheckRow>
                ) : (
                  <AssignCheckRowLoaded
                    key={wo.workOrderId}
                    {...rowProps('assign')}
                    fact={selectedFact}
                    routingId={planOf(wo)?.routingId ?? null}
                    plantId={plantId ?? null}
                    lineNameOf={lineNameOf}
                  />
                ))}
              {materialNode ? (
                <CheckRow title={c.material} {...rowProps('material')}>
                  {materialNode}
                </CheckRow>
              ) : null}
              {plantId != null && (
                <CheckRow title={c.terminal} {...rowProps('terminal')}>
                  <TerminalConnections
                    plain
                    key={wo.workOrderId}
                    plantId={plantId}
                    workOrder={wo}
                  />
                </CheckRow>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
