import { Button, Chip, Dialog, Skeleton, type ChipStatus } from '@crefle/web-ui';
import type { DashboardEquipmentStatusCode } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  ALL_LINES,
  EQUIPMENT_STATUS_ORDER,
  effectiveLine,
  filterByLine,
  toLineOptions,
  toStoppedItems,
  type EquipmentItemView,
  type EquipmentView,
} from './equipment';
import { formatFigure } from './types';
import { EmptyLine, Panel } from './viz';

const t = messages.dashboard.equipment;

/**
 * 상태별 표시 톤. **색만으로 말하지 않는다** — 칩 · 타일에는 늘 상태 이름이 함께 선다.
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

/** 「호기(톤수)」 — 톤수가 없으면 호기만. */
export const describeUnit = (item: EquipmentItemView): string =>
  item.tonnage === null ? item.equipmentCode : `${item.equipmentCode} (${item.tonnage})`;

const StatusChip = ({ statusCode }: { statusCode: DashboardEquipmentStatusCode }) => (
  <Chip size="sm" status={EQUIPMENT_STATUS_TONE[statusCode]}>
    {t.status[statusCode]}
  </Chip>
);

interface EquipmentTileProps {
  item: EquipmentItemView;
  onOpen: (item: EquipmentItemView) => void;
}

/**
 * 호기 타일. 가동 중이면 금일 생산 · NG · 불량률 · 표준 C/T, 멈췄으면 **상태가 타일을 차지한다**
 * (시안 — 멈춘 호기가 격자에서 먼저 눈에 들어와야 한다). 타일 전체가 단추이고 누르면 상세가 열린다.
 */
const EquipmentTile = ({ item, onOpen }: EquipmentTileProps) => {
  const running = item.statusCode === 'RUNNING';

  return (
    <li>
      <button
        type="button"
        className={`dash-eq-tile dash-eq-${item.statusCode.toLowerCase()}`}
        onClick={() => {
          onOpen(item);
        }}
        aria-label={t.openDetail(item.equipmentCode)}
      >
        <span className="dash-eq-head">
          <span className="dash-eq-code">{item.equipmentCode}</span>
          <span className="dash-eq-tonnage">{item.tonnage ?? t.none}</span>
        </span>
        {running ? (
          <>
            <span className="dash-eq-qty">
              {formatFigure(item.todayTotalQty)}
              <span className="dash-kpi-unit">EA</span>
            </span>
            <span className="dash-eq-line">
              {t.ngLine(formatFigure(item.todayNgQty), formatDefectRate(item.defectRate))}
            </span>
            <span className="dash-eq-line">
              {t.cycleLine(formatCycleTime(item.standardCycleTimeSec))}
            </span>
          </>
        ) : (
          <>
            <span className="dash-eq-status">{t.status[item.statusCode]}</span>
            <span className="dash-eq-line">{describeReason(item)}</span>
            <span className="dash-eq-line">{formatElapsed(item.elapsedMinutes)}</span>
          </>
        )}
      </button>
    </li>
  );
};

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

export interface EquipmentPanelProps {
  view: EquipmentView | null;
  isLoading: boolean;
  /** 첫 조회가 실패해 보일 값이 없다. 재시도는 화면 위 오류 배너가 맡는다. */
  isFailed: boolean;
}

/** 섹션 없음 · 첫 조회 실패 · 불러오는 중을 가른다. 그리는 것이 있으면 `null`. */
const gate = ({ view, isLoading, isFailed }: EquipmentPanelProps) => {
  if (isLoading) return <Skeleton variant="rect" height="16rem" />;
  if (view === null) {
    return <EmptyLine live text={isFailed ? t.failed : t.absent} />;
  }

  return null;
};

/**
 * 설비 가동 현황(omf-all-around#111 · ⭐ 사용자 지시 2026-10-16, 시안 v1.3 기준 재구성) — 라인 구분 ·
 * 상태 범례 대수 · 호기 타일. 라인 구분은 **화면 안의 거름**이다(조회 조건이 아니다 · 주소에 넣지 않는다).
 * 범례 대수는 고른 라인 기준이다 — 고른 범위의 타일과 숫자가 맞아야 한다.
 */
export const EquipmentBoard = (props: EquipmentPanelProps) => {
  const [line, setLine] = useState<string>(ALL_LINES);
  const [openedId, setOpenedId] = useState<number | null>(null);
  const blocked = gate(props);
  const { view } = props;

  const body = (() => {
    if (blocked !== null || view === null) return blocked;
    if (view.items.length === 0) {
      return <EmptyLine live text={t.empty} />;
    }

    const lineOptions = toLineOptions(view.items);
    const activeLine = effectiveLine(lineOptions, line);
    const shown = filterByLine(view.items, activeLine);
    /* 자동 갱신으로 목록이 바뀌어도 상세는 그 호기의 새 값을 보인다 — 열 때의 사본을 붙들지 않는다. */
    const opened = view.items.find((item) => item.equipmentId === openedId) ?? null;
    const countOf = (code: DashboardEquipmentStatusCode): number =>
      shown.filter((item) => item.statusCode === code).length;

    return (
      <>
        <div className="dash-eq-toolbar">
          <div className="dash-segment" role="group" aria-label={t.line}>
            {[{ value: ALL_LINES, label: t.allLines }, ...lineOptions].map((option) => (
              <Chip
                key={option.value}
                variant="filter"
                size="sm"
                selected={option.value === activeLine}
                onSelectedChange={() => {
                  setLine(option.value);
                }}
              >
                {`${option.label} ${formatFigure(filterByLine(view.items, option.value).length)}`}
              </Chip>
            ))}
          </div>
          <ul className="dash-eq-legend" aria-label={t.legend}>
            {EQUIPMENT_STATUS_ORDER.map((code) => (
              <li key={code}>
                <span
                  className={`dash-dot dash-dot-${EQUIPMENT_STATUS_TONE[code]}`}
                  aria-hidden="true"
                />
                {t.status[code]} <strong>{formatFigure(countOf(code))}</strong>
              </li>
            ))}
          </ul>
        </div>
        {shown.length === 0 ? (
          <EmptyLine live text={t.lineEmpty} />
        ) : (
          <ul className="dash-eq-grid">
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
        <EquipmentDetailDialog
          item={opened}
          onClose={() => {
            setOpenedId(null);
          }}
        />
      </>
    );
  })();

  return (
    <Panel
      title={t.boardTitle}
      sub={view === null ? undefined : t.boardSub(view.totalCount)}
      tag={t.tagLive}
      className="dash-span-wide"
    >
      {body}
    </Panel>
  );
};

/**
 * 멈춘 설비 — 정지 · 대기 · 교체 · 비가동 그룹, 그룹마다 대수, 줄은 호기(톤수) · 사유 · 경과.
 * 그룹 안에서는 **오래 멈춘 것부터**. 공장 전체 기준이다(라인 구분과 상관없다).
 */
export const StoppedPanel = (props: EquipmentPanelProps) => {
  const blocked = gate(props);
  const { view } = props;

  const body = (() => {
    if (blocked !== null || view === null) return blocked;

    const stopped = toStoppedItems(view.items);
    if (stopped.length === 0) {
      return <EmptyLine text={t.stoppedEmpty} />;
    }

    return (
      <div className="dash-stopped">
        {EQUIPMENT_STATUS_ORDER.filter((code) => code !== 'RUNNING').map((code) => {
          const rows = stopped.filter((item) => item.statusCode === code);
          if (rows.length === 0) return null;

          return (
            <section key={code} className="dash-stopped-group" aria-label={t.status[code]}>
              <div className="dash-stopped-head">
                <StatusChip statusCode={code} />
                <span className="dash-stopped-count">
                  {formatFigure(rows.length)} {t.countUnit}
                </span>
              </div>
              <table className="dash-stopped-table">
                <caption className="dash-sr-only">{t.stoppedGroupCaption(t.status[code])}</caption>
                <thead className="dash-sr-only">
                  <tr>
                    <th scope="col">{t.equipmentColumn}</th>
                    <th scope="col">{t.reason}</th>
                    <th scope="col">{t.elapsed}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.equipmentId}>
                      <th scope="row">{describeUnit(item)}</th>
                      <td>{describeReason(item)}</td>
                      <td>{formatElapsed(item.elapsedMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    );
  })();

  return (
    <Panel title={t.stoppedTitle} sub={t.stoppedSub} tag={t.tagLive}>
      {body}
    </Panel>
  );
};
