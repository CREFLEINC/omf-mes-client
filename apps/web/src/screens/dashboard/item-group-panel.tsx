import { Button, Dialog, Skeleton, Table, type Column } from '@crefle/web-ui';
import type { DashboardItemGroupProduction, DashboardProduction } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useContext } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { FilterQueryContext, useSingleDay } from './period';
import { useDashboardItemGroupDefects } from './queries';
import { formatFigure } from './types';
import { NoRecords, Panel } from './viz';

const t = messages.dashboard.itemGroup;
const k = messages.dashboard.kpi;

type ItemGroupRow = DashboardItemGroupProduction & { key: string; sum?: boolean };

const groupNameOf = (
  row: Pick<DashboardItemGroupProduction, 'itemGroupCode' | 'itemGroupName'>,
): string =>
  row.itemGroupCode === null ? t.unclassified : (row.itemGroupName ?? row.itemGroupCode);

const rateText = (rate: number | null): string => (rate === null ? k.none : formatFigure(rate));

const COLUMNS: Column<ItemGroupRow>[] = [
  {
    key: 'group',
    header: t.group,
    render: (row) => (row.sum === true ? <strong>{t.sum}</strong> : groupNameOf(row)),
  },
  {
    key: 'totalQty',
    header: t.totalQty,
    align: 'end',
    render: (row) => formatFigure(row.totalQty),
  },
  { key: 'goodQty', header: t.goodQty, align: 'end', render: (row) => formatFigure(row.goodQty) },
  { key: 'ngQty', header: t.ngQty, align: 'end', render: (row) => formatFigure(row.ngQty) },
  {
    key: 'defectRate',
    header: t.defectRate,
    align: 'end',
    render: (row) => rateText(row.defectRate),
  },
];

/**
 * 제품군별 생산 현황(omf-all-around#251) — KPI 띠 아래 한 줄 표. 값은 summary 의 `production.byItemGroup` 그대로이고
 * 맨 끝 「합계」는 공장 합(`production`)이다 — 서버가 같은 규칙이라 제품군 합과 같다. 서버가 칸을 주지 않으면(이전 서버) 그리지 않는다.
 */
export const ItemGroupPanel = ({
  production,
  isLoading,
}: {
  production: DashboardProduction | null;
  isLoading: boolean;
}) => {
  const singleDay = useSingleDay();
  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(표 공통 규칙). */
  const ordered = useColumnOrder('omf-mes:dashboard:item-group:columns:order', COLUMNS);
  const resizable = useColumnWidths('omf-mes:dashboard:item-group:columns', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  const groups = production?.byItemGroup;
  if (!isLoading && groups === undefined) return null;

  const rows: ItemGroupRow[] =
    production === null || groups === undefined || groups.length === 0
      ? []
      : [
          ...groups.map((group) => ({ ...group, key: group.itemGroupCode ?? '' })),
          {
            key: 'sum',
            sum: true,
            itemGroupCode: null,
            itemGroupName: null,
            totalQty: production.totalQty,
            goodQty: production.goodQty,
            ngQty: production.ngQty,
            defectRate: production.defectRate,
          },
        ];

  return (
    <Panel title={t.title} sub={t.sub} tag={singleDay ? k.tagToday : k.tagPeriod}>
      {isLoading ? (
        <Skeleton variant="rect" height="5rem" />
      ) : (
        <div
          ref={fit.ref}
          className="dash-table-wrap dash-item-group-table"
          style={resizable.style}
        >
          <Table
            columns={fit.columns}
            rows={rows}
            getRowId={(row) => row.key}
            density="compact"
            aria-label={t.title}
            empty={<NoRecords description={t.empty} />}
          />
        </div>
      )}
    </Panel>
  );
};

/**
 * 종합 불량률 칸을 눌러 여는 제품군별 불량 현황(omf-all-around#251). 제품군마다 불량률 · 불량 · 생산 한 줄과 불량 유형
 * Worst 5, 유형 없이 들어온 불량은 「유형 미입력」으로 따로 적는다. 열렸을 때만 부른다.
 */
export const ItemGroupDefectsDialog = ({
  open,
  onClose,
  production,
}: {
  open: boolean;
  onClose: () => void;
  /** 머리 줄 — KPI 띠 「종합 불량률」과 같은 값을 그대로 보인다(창이 다시 계산하지 않는다). */
  production: DashboardProduction | null;
}) => {
  const query = useContext(FilterQueryContext);
  const defects = useDashboardItemGroupDefects(open, query);
  const data = defects.data;

  const body = (() => {
    if (defects.isPending) {
      return (
        <div className="dash-lots-state dash-lots-loading" aria-live="polite">
          <span>{t.loading}</span>
          <Skeleton variant="rect" height="6rem" />
        </div>
      );
    }
    if (defects.isError || data === undefined) {
      return (
        <div className="dash-lots-state" role="alert">
          <span>{t.failed}</span>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              void defects.refetch();
            }}
          >
            {messages.common.retry}
          </Button>
        </div>
      );
    }
    if (data.groups.length === 0) return <p className="dash-lots-state">{t.empty}</p>;

    return (
      <div className="dash-group-defects">
        {data.groups.map((group) => (
          <section
            key={group.itemGroupCode ?? ''}
            className="dash-group-defect"
            aria-label={groupNameOf(group)}
          >
            <h3 className="dash-detail-title">{groupNameOf(group)}</h3>
            <p className="dash-detail-sub">
              {t.groupLine(
                group.defectRate === null ? k.none : `${formatFigure(group.defectRate)}%`,
                formatFigure(group.ngQty),
                formatFigure(group.totalQty),
              )}
            </p>
            <p className="dash-group-defect-caption">{t.worst}</p>
            {group.topDefects.length === 0 ? (
              <p className="dash-detail-none">{t.noTypes}</p>
            ) : (
              <ol className="dash-detail-list">
                {group.topDefects.map((defect) => (
                  <li key={defect.defectCodeId}>
                    <span>{defect.defectName}</span>
                    <span className="dash-detail-list-value">{`${formatFigure(defect.qty)} EA`}</span>
                  </li>
                ))}
              </ol>
            )}
            {group.untypedNgQty > 0 && (
              <p className="dash-detail-none">{t.untypedQty(formatFigure(group.untypedNgQty))}</p>
            )}
          </section>
        ))}
      </div>
    );
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <span className="dash-detail-head">
          <span className="dash-detail-head-row">{t.dialogTitle}</span>
          {production !== null && (
            <span className="dash-detail-sub">
              {t.dialogSub(
                production.defectRate === null ? k.none : `${formatFigure(production.defectRate)}%`,
                formatFigure(production.ngQty),
              )}
            </span>
          )}
        </span>
      }
      size="lg"
      className="dash-group-defects-dialog"
    >
      {open && body}
    </Dialog>
  );
};
