import {
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  Skeleton,
  StatCard,
  Table,
  type ChipStatus,
  type Column,
} from '@crefle/web-ui';
import type { DashboardEquipmentStatusCode } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  ALL_LINES,
  effectiveLine,
  filterByLine,
  toLineOptions,
  toStoppedItems,
  type EquipmentItemView,
  type EquipmentView,
} from './equipment';
import { SelectField } from './select-field';
import { formatFigure } from './types';

const t = messages.dashboard.equipment;

/**
 * 상태별 표시 톤. **색만으로 말하지 않는다** — 칩에는 늘 상태 이름이 함께 선다.
 * 비가동(계획정지 · 비근무)은 고장이 아니라 예정된 멈춤이라 경고색을 쓰지 않는다.
 */
export const EQUIPMENT_STATUS_TONE: Record<DashboardEquipmentStatusCode, ChipStatus> = {
  RUNNING: 'success',
  STOPPED: 'error',
  WAITING: 'warning',
  CHANGEOVER: 'info',
  IDLE: 'idle',
};

export const formatElapsed = (minutes: number | null): string =>
  minutes === null ? t.none : t.elapsedText(Math.floor(minutes / 60), minutes % 60);

export const formatDefectRate = (rate: number | null): string =>
  rate === null ? t.none : t.percent(formatFigure(rate));

export const formatCycleTime = (seconds: number | null): string =>
  seconds === null ? t.none : t.seconds(formatFigure(seconds));

/** 사유 — 가동 중인 설비에는 사유가 없다. 멈췄는데 사유가 없으면 「없음」이 아니라 「미등록」이다. */
export const describeReason = (item: EquipmentItemView): string =>
  item.statusCode === 'RUNNING' ? t.none : (item.reasonName ?? t.reasonUnknown);

const StatusChip = ({ statusCode }: { statusCode: DashboardEquipmentStatusCode }) => (
  <Chip size="sm" status={EQUIPMENT_STATUS_TONE[statusCode]}>
    {t.status[statusCode]}
  </Chip>
);

interface EquipmentTileProps {
  item: EquipmentItemView;
  onOpen: (item: EquipmentItemView) => void;
}

/** 호기 타일 하나. 타일 전체가 단추다 — 눌리는 자리가 호기 글자만큼으로 줄지 않게. */
const EquipmentTile = ({ item, onOpen }: EquipmentTileProps) => (
  <li>
    <button
      type="button"
      className="dashboard-equipment-tile"
      onClick={() => {
        onOpen(item);
      }}
      aria-label={t.openDetail(item.equipmentCode)}
    >
      <Card surface="default" bordered>
        <Card.Header>
          <div className="dashboard-equipment-tile-head">
            <span className="dashboard-equipment-code">{item.equipmentCode}</span>
            <StatusChip statusCode={item.statusCode} />
          </div>
        </Card.Header>
        <Card.Body>
          <dl className="dashboard-equipment-facts">
            <dt>{t.tonnage}</dt>
            <dd>{item.tonnage ?? t.none}</dd>
            <dt>{t.todayQty}</dt>
            <dd>{formatFigure(item.todayTotalQty)}</dd>
            <dt>{t.ngQty}</dt>
            <dd>{formatFigure(item.todayNgQty)}</dd>
            <dt>{t.defectRate}</dt>
            <dd>{formatDefectRate(item.defectRate)}</dd>
            <dt>{t.standardCycleTime}</dt>
            <dd>{formatCycleTime(item.standardCycleTimeSec)}</dd>
            {item.statusCode !== 'RUNNING' && (
              <>
                <dt>{t.reason}</dt>
                <dd>{describeReason(item)}</dd>
                <dt>{t.elapsed}</dt>
                <dd>{formatElapsed(item.elapsedMinutes)}</dd>
              </>
            )}
          </dl>
        </Card.Body>
      </Card>
    </button>
  </li>
);

interface EquipmentDetailDialogProps {
  item: EquipmentItemView | null;
  onClose: () => void;
}

/** 호기 상세 — 타일의 항목에 지금 작업(작업지시 · 품목)과 상태 시작 시각을 더해 펼친다. */
const EquipmentDetailDialog = ({ item, onClose }: EquipmentDetailDialogProps) => (
  <Dialog
    open={item !== null}
    onClose={onClose}
    title={item === null ? undefined : t.detailTitle(item.equipmentCode, item.equipmentName)}
    size="md"
    footer={
      <Button variant="outlined" onClick={onClose}>
        {t.close}
      </Button>
    }
  >
    {item !== null && (
      <dl className="dashboard-equipment-facts">
        <dt>{t.statusColumn}</dt>
        <dd>
          <StatusChip statusCode={item.statusCode} />
        </dd>
        <dt>{t.line}</dt>
        <dd>{item.productionLineName ?? t.none}</dd>
        <dt>{t.tonnage}</dt>
        <dd>{item.tonnage ?? t.none}</dd>
        <dt>{t.reason}</dt>
        <dd>{describeReason(item)}</dd>
        <dt>{t.since}</dt>
        <dd>{formatPlantDateTime(item.statusSince) ?? t.none}</dd>
        <dt>{t.elapsed}</dt>
        <dd>{formatElapsed(item.elapsedMinutes)}</dd>
        <dt>{t.todayQty}</dt>
        <dd>{formatFigure(item.todayTotalQty)}</dd>
        <dt>{t.ngQty}</dt>
        <dd>{formatFigure(item.todayNgQty)}</dd>
        <dt>{t.defectRate}</dt>
        <dd>{formatDefectRate(item.defectRate)}</dd>
        <dt>{t.standardCycleTime}</dt>
        <dd>{formatCycleTime(item.standardCycleTimeSec)}</dd>
        <dt>{t.workOrder}</dt>
        <dd>{item.currentWorkOrderNo ?? t.none}</dd>
        <dt>{t.item}</dt>
        <dd>
          {item.currentItemCode === null
            ? t.none
            : `${item.currentItemCode} ${item.currentItemName ?? ''}`.trim()}
        </dd>
      </dl>
    )}
  </Dialog>
);

const STOPPED_COLUMNS: Column<EquipmentItemView>[] = [
  { key: 'equipmentCode', header: t.equipmentColumn, render: (row) => row.equipmentCode },
  {
    key: 'statusCode',
    header: t.statusColumn,
    render: (row) => <StatusChip statusCode={row.statusCode} />,
  },
  { key: 'reason', header: t.reason, render: describeReason },
  {
    key: 'elapsed',
    header: t.elapsed,
    align: 'end',
    render: (row) => formatElapsed(row.elapsedMinutes),
  },
];

export interface EquipmentPanelProps {
  view: EquipmentView | null;
  isLoading: boolean;
  /** 첫 조회가 실패해 보일 값이 없다. 재시도는 화면 위 오류 배너가 맡는다. */
  isFailed: boolean;
}

/**
 * 설비 현황(omf-all-around#111) — 상태별 대수 · 호기 타일 · 라인 필터 · 멈춘 설비 · 호기 상세.
 *
 * ⭐ **집계와 같은 응답에 온다**(summary 의 `equipment` 섹션) — 이 패널을 그리려고 요청을 하나 더
 * 보내지 않는다. 그래서 자동 갱신(#115)도 · 「갱신」도 · 공장 전환도 이 패널에 그대로 걸린다.
 *
 * 라인 필터는 **화면 안의 거름**이다(조회 조건이 아니다) — 서버에 다시 묻지 않고 받은 설비를 거른다.
 * 상태별 대수 줄은 거르지 않는다: 공장 전체의 상태를 말하는 자리다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const EquipmentPanel = ({ view, isLoading, isFailed }: EquipmentPanelProps) => {
  const [line, setLine] = useState<string>(ALL_LINES);
  const [openedId, setOpenedId] = useState<number | null>(null);

  if (isLoading) return <Skeleton variant="rect" height="16rem" />;

  if (view === null) {
    return isFailed ? (
      <EmptyState size="sm" live title={t.absentTitle} description={t.failed} />
    ) : (
      <EmptyState size="sm" live title={t.absentTitle} description={t.absent} />
    );
  }

  if (view.items.length === 0) {
    return <EmptyState size="sm" live title={t.emptyTitle} description={t.empty} />;
  }

  const lineOptions = toLineOptions(view.items);
  const activeLine = effectiveLine(lineOptions, line);
  const shown = filterByLine(view.items, activeLine);
  const stopped = toStoppedItems(shown);
  const running = view.statusCounts.find((entry) => entry.statusCode === 'RUNNING')?.count ?? 0;
  /* 자동 갱신으로 목록이 바뀌어도 상세는 그 호기의 새 값을 보인다 — 열 때의 사본을 붙들지 않는다. */
  const opened = view.items.find((item) => item.equipmentId === openedId) ?? null;

  return (
    <div className="dashboard-equipment">
      <div className="kpi-grid">
        <StatCard
          label={t.runningOfTotal}
          value={`${formatFigure(running)} / ${formatFigure(view.totalCount)}`}
          unit={t.countUnit}
          bordered
        />
        {view.statusCounts
          .filter((entry) => entry.statusCode !== 'RUNNING')
          .map((entry) => (
            <StatCard
              key={entry.statusCode}
              label={t.status[entry.statusCode]}
              value={formatFigure(entry.count)}
              unit={t.countUnit}
              status={entry.count === 0 ? undefined : EQUIPMENT_STATUS_TONE[entry.statusCode]}
              statusLabel={entry.count === 0 ? undefined : t.status[entry.statusCode]}
              bordered
            />
          ))}
      </div>

      <div className="dashboard-equipment-filter">
        <SelectField
          label={t.line}
          options={[{ value: ALL_LINES, label: t.allLines }, ...lineOptions]}
          value={activeLine}
          onChange={setLine}
          note={t.shownCount(shown.length)}
        />
      </div>

      <h3 className="dashboard-subtitle">{t.tilesTitle}</h3>
      {shown.length === 0 ? (
        <EmptyState size="sm" live title={t.emptyTitle} description={t.lineEmpty} />
      ) : (
        <ul className="dashboard-equipment-tiles">
          {shown.map((item) => (
            <EquipmentTile
              key={item.equipmentId}
              item={item}
              onOpen={(target) => {
                setOpenedId(target.equipmentId);
              }}
            />
          ))}
        </ul>
      )}

      <h3 className="dashboard-subtitle">{t.stoppedTitle}</h3>
      <p className="pane-lead">{t.stoppedLead}</p>
      <Table
        columns={STOPPED_COLUMNS}
        rows={stopped}
        getRowId={(row) => String(row.equipmentId)}
        density="compact"
        caption={t.stoppedTitle}
        empty={<EmptyState size="sm" title={t.stoppedEmptyTitle} description={t.stoppedEmpty} />}
      />

      <EquipmentDetailDialog
        item={opened}
        onClose={() => {
          setOpenedId(null);
        }}
      />
    </div>
  );
};
