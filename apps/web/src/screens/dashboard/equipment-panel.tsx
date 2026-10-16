import { Button, Chip, Dialog, Icon, Skeleton, type ChipStatus } from '@crefle/web-ui';
import type { DashboardEquipmentStatusCode } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  ALL_LINES,
  EQUIPMENT_STATUS_ORDER,
  EQUIPMENT_TILE_PREVIEW_COUNT,
  sortForBoard,
  effectiveLine,
  filterByLine,
  toLineOptions,
  toStoppedItems,
  type EquipmentItemView,
  type EquipmentView,
} from './equipment';
import { formatFigure } from './types';
import { useGridColumns } from './use-grid-columns';
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

const StatusChip = ({ statusCode }: { statusCode: DashboardEquipmentStatusCode }) => (
  <Chip size="sm" status={EQUIPMENT_STATUS_TONE[statusCode]}>
    {t.status[statusCode]}
  </Chip>
);

/**
 * 마지막 입력이 포인터(마우스 · 터치)였나. **Esc 는 셈하지 않는다** — 창을 닫는 키라, 마우스로 연 창을 Esc 로
 * 닫았을 때 브라우저가 키보드 입력으로 보고 돌아온 타일에 포커스 링을 그린다(사용자 보고 2026-10-16).
 */
const usePointerInput = (): RefObject<boolean> => {
  const ref = useRef(false);

  useEffect(() => {
    const onPointer = () => {
      ref.current = true;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') ref.current = false;
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);

    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);

  return ref;
};

/**
 * 타일 마우스 올림 글 — 타일 본문은 좁아 「NG 40 · C/T 20초」로 줄여 쓰지만, 여기서는 풀어 쓴 용어로 적는다
 * (사용자 지정 용어 2026-10-16).
 */
const tileTitleOf = (item: EquipmentItemView): string =>
  [
    item.equipmentCode,
    `${t.equipmentType} ${item.tonnage ?? t.none}`,
    `${t.statusColumn} ${t.status[item.statusCode]}`,
    ...(item.statusCode === 'RUNNING'
      ? [
          `${t.ngQty} ${formatFigure(item.todayNgQty)} EA`,
          `${t.defectRate} ${formatDefectRate(item.defectRate)}`,
          `${t.standardCycleTime} ${formatCycleTime(item.standardCycleTimeSec)}`,
        ]
      : [
          `${t.reason} ${describeReason(item)}`,
          `${t.elapsed} ${formatElapsed(item.elapsedMinutes)}`,
        ]),
  ].join('\n');

/**
 * 포인터로 연 창을 닫아 포커스만 돌아온 단추에 `data-pointer-focus` 를 단다 — CSS 가 그때 포커스 링을 숨긴다.
 * 키보드로 열었거나 다른 키를 누르면 링을 보인다. 설비 타일 · 가동 외 설비 줄이 함께 쓴다.
 */
const pointerFocusProps = (pointerInput: RefObject<boolean>) => ({
  onFocus: (event: FocusEvent<HTMLButtonElement>) => {
    event.currentTarget.toggleAttribute('data-pointer-focus', pointerInput.current);
  },
  onBlur: (event: FocusEvent<HTMLButtonElement>) => {
    event.currentTarget.removeAttribute('data-pointer-focus');
  },
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape') event.currentTarget.removeAttribute('data-pointer-focus');
  },
});

interface EquipmentTileProps {
  item: EquipmentItemView;
  onOpen: (item: EquipmentItemView) => void;
  /** `usePointerInput` — 포인터로 연 상세를 닫고 포커스가 돌아올 때 링을 숨긴다. */
  pointerInput: RefObject<boolean>;
}

/**
 * 호기 타일(⭐ 사용자 지시 2026-10-16 — 높이 · 줄 수 통일). 1줄 = 호기(굵게, 넘치면 말줄임 · 전체는 `title`과
 * 상세) + 톤수 · 2줄 = 상태(색 + 글자, 가동도) · 3줄 = 금일 생산(강조) · 4줄 = 가동이면 NG · 불량률 · C/T,
 * 아니면 사유 · 경과. 멈춘 호기는 상태 색 바탕 · 왼쪽 띠로 격자에서 먼저 보인다. 타일 전체가 단추다.
 */
const EquipmentTile = ({ item, onOpen, pointerInput }: EquipmentTileProps) => {
  const running = item.statusCode === 'RUNNING';

  return (
    <li>
      <button
        type="button"
        className={`dash-eq-tile dash-eq-${item.statusCode.toLowerCase()}`}
        onClick={() => {
          onOpen(item);
        }}
        /*
         * 닫힌 창이 포커스를 타일로 돌려준다(DS Dialog · 접근성상 유지). 포인터로 열었으면 그때 링을 숨기고,
         * 키보드로 열었거나 다른 키를 누르면 링을 보인다(`.dash-eq-tile[data-pointer-focus]`).
         */
        {...pointerFocusProps(pointerInput)}
        aria-label={t.openDetail(item.equipmentCode)}
        title={tileTitleOf(item)}
      >
        <span className="dash-eq-head">
          <span className="dash-eq-code">{item.equipmentCode}</span>
          <span className="dash-eq-type">{item.tonnage ?? t.none}</span>
        </span>
        <span className="dash-eq-state">
          <StatusChip statusCode={item.statusCode} />
          {!running && <span className="dash-eq-line">{formatElapsed(item.elapsedMinutes)}</span>}
        </span>
        <span className="dash-eq-qty">
          {formatFigure(item.todayTotalQty)}
          <span className="dash-kpi-unit">EA</span>
        </span>
        <span className="dash-eq-line dash-eq-one-line">
          {running
            ? `${t.ngLine(formatFigure(item.todayNgQty), formatDefectRate(item.defectRate))} · ${t.cycleLine(formatCycleTime(item.standardCycleTimeSec))}`
            : describeReason(item)}
        </span>
      </button>
    </li>
  );
};

interface EquipmentDetailDialogProps {
  item: EquipmentItemView | null;
  onClose: () => void;
}

/** 상세 항목 하나 — 이름 바로 아래 값(시선 이동을 짧게). `wide` 는 줄 전체 폭(긴 값). */
const Fact = ({
  label,
  children,
  wide = false,
  strong = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  strong?: boolean;
}) => (
  <div className={wide ? 'dash-fact dash-fact-wide' : 'dash-fact'}>
    <dt>{label}</dt>
    <dd className={strong ? 'dash-fact-strong' : undefined}>{children}</dd>
  </div>
);

/**
 * 머리 보조 줄 — 생산 라인 · 설비 종류. 설비 이름은 코드 · 라인 이름과 다를 때만 앞에 붙인다(같으면 같은 말의
 * 되풀이다). 값이 없는 항목은 뺀다.
 */
const detailSubOf = (item: EquipmentItemView): string => {
  const name = item.equipmentName.trim();
  const showName = name !== '' && name !== item.equipmentCode && name !== item.productionLineName;

  return [showName ? name : null, item.productionLineName, item.tonnage]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
};

/**
 * 호기 상세(⭐ 사용자 지시 2026-10-16 — 정보 위계 다듬기 · 용어 표).
 *
 * 머리: 설비 코드(큰 제목) + 상태 배지, 그 아래 생산 라인 · 설비 종류 한 줄. 본문 순서 — 상태 시간(상태 사유 ·
 * 상태 지속 시간 강조 · 상태 시작 시각) → 생산 실적(오늘 생산량만 강조 · 불량 수량 · 불량률 · 표준 사이클 타임,
 * 2열) → 현재 작업(작업지시 번호 · 품목, 없으면 한 줄 안내). 라인 · 설비 종류는 머리로 올려 본문에서 되풀이하지
 * 않는다. 상태는 머리 배지 하나로 말한다 — 본문에 다시 적지 않는다. 묶음 구분은 간격으로(구분선 없음).
 * 닫기는 오른쪽 위 X · ESC · 바깥 누르기(DS Dialog 기본 그대로) — 하단 「닫기」는 두지 않는다
 * (DS Dialog 에 `footer` 를 넘기지 않는다 · 공용 부품은 고치지 않는다).
 */
const EquipmentDetailDialog = ({ item, onClose }: EquipmentDetailDialogProps) => {
  const sub = item === null ? '' : detailSubOf(item);

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      title={
        item === null ? undefined : (
          <span className="dash-detail-head">
            <span className="dash-detail-head-row">
              <span className="dash-detail-code">{item.equipmentCode}</span>
              <StatusChip statusCode={item.statusCode} />
            </span>
            {sub !== '' && <span className="dash-detail-sub">{sub}</span>}
          </span>
        )
      }
      size="md"
      className="dash-detail-dialog"
    >
      {item !== null && (
        <div className="dash-detail">
          <section aria-label={t.groupRun}>
            <h3 className="dash-detail-title">{t.groupRun}</h3>
            <dl className="dash-facts">
              {item.statusCode !== 'RUNNING' && (
                <Fact label={t.reason} wide>
                  {describeReason(item)}
                </Fact>
              )}
              <Fact label={t.elapsed} strong>
                {formatElapsed(item.elapsedMinutes)}
              </Fact>
              <Fact label={t.since}>{formatPlantDateTime(item.statusSince) ?? t.none}</Fact>
            </dl>
          </section>
          <section aria-label={t.groupOutput}>
            <h3 className="dash-detail-title">{t.groupOutput}</h3>
            <dl className="dash-facts">
              <Fact label={t.todayQty} strong>
                {formatFigure(item.todayTotalQty)}
                <span className="dash-kpi-unit">EA</span>
              </Fact>
              <Fact label={t.ngQty}>
                {formatFigure(item.todayNgQty)}
                <span className="dash-kpi-unit">EA</span>
              </Fact>
              <Fact label={t.defectRate}>{formatDefectRate(item.defectRate)}</Fact>
              <Fact label={t.standardCycleTime}>{formatCycleTime(item.standardCycleTimeSec)}</Fact>
            </dl>
          </section>
          <section aria-label={t.groupWork}>
            <h3 className="dash-detail-title">{t.groupWork}</h3>
            {item.currentWorkOrderNo === null ? (
              <p className="dash-detail-none">{t.noWork}</p>
            ) : (
              <dl className="dash-facts">
                <Fact label={t.workOrder} wide>
                  <span className="dash-nowrap">{item.currentWorkOrderNo}</span>
                </Fact>
                <Fact label={t.item} wide>
                  {item.currentItemCode === null
                    ? t.none
                    : `${item.currentItemCode} ${item.currentItemName ?? ''}`.trim()}
                </Fact>
              </dl>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
};

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
  const [isAllOpen, setIsAllOpen] = useState(false);
  const gridRef = useRef<HTMLUListElement>(null);
  const pointerInput = usePointerInput();
  const blocked = gate(props);
  const { view } = props;
  const columns = useGridColumns(gridRef, 6, view !== null && view.items.length > 0);

  const body = (() => {
    if (blocked !== null || view === null) return blocked;
    if (view.items.length === 0) {
      return <EmptyLine live text={t.empty} />;
    }

    const lineOptions = toLineOptions(view.items);
    const activeLine = effectiveLine(lineOptions, line);
    const shown = sortForBoard(filterByLine(view.items, activeLine));
    /*
     * 기본 12대, 좁아서 열이 줄면 「2행 수준」으로 끊는다(6열 → 12 · 4열 → 8 · 3열 → 6 · 2열 → 4). 본문 안
     * 스크롤을 만들지 않는다 — 나머지는 「전체 설비 보기」 창에서.
     */
    const previewCount = Math.min(EQUIPMENT_TILE_PREVIEW_COUNT, Math.max(columns, 1) * 2);
    const preview = shown.slice(0, previewCount);
    /* 자동 갱신으로 목록이 바뀌어도 상세는 그 호기의 새 값을 보인다 — 열 때의 사본을 붙들지 않는다. */
    const opened = view.items.find((item) => item.equipmentId === openedId) ?? null;
    const openTile = (target: EquipmentItemView): void => {
      setOpenedId(target.equipmentId);
    };

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
          <StatusLegend items={shown} />
        </div>
        {shown.length === 0 ? (
          <EmptyLine live text={t.lineEmpty} />
        ) : (
          <>
            <ul ref={gridRef} className="dash-eq-grid">
              {preview.map((item) => (
                <EquipmentTile
                  key={item.equipmentId}
                  item={item}
                  onOpen={openTile}
                  pointerInput={pointerInput}
                />
              ))}
            </ul>
            <div className="dash-eq-footer">
              <span className="dash-eq-shown">
                {t.shownOf(formatFigure(shown.length), formatFigure(preview.length))}
              </span>
              {shown.length > preview.length && (
                <Button
                  variant="text"
                  size="sm"
                  className="dash-panel-action"
                  trailingIcon={<Icon name="arrow_forward" size={16} />}
                  onClick={() => {
                    setIsAllOpen(true);
                  }}
                >
                  {t.showAll}
                </Button>
              )}
            </div>
          </>
        )}
        {/*
         * 전체 설비 보기 — 대시보드 본문에 펼치지 않고 창으로 연다. 지금 고른 라인 · 같은 정렬 그대로이고,
         * 타일을 누르면 같은 상세 창이 그 위에 열린다. 닫아도 대시보드의 라인 선택은 그대로다.
         */}
        <AllEquipmentDialog
          open={isAllOpen}
          items={shown}
          onClose={() => {
            setIsAllOpen(false);
          }}
          onOpenTile={openTile}
          pointerInput={pointerInput}
        />
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

/** 「전체 설비 보기」 창 — 설비 가동 현황과 가동 외 설비 현황(「외 n대」)이 같은 창을 쓴다. */
const AllEquipmentDialog = ({
  open,
  items,
  onClose,
  onOpenTile,
  pointerInput,
}: {
  open: boolean;
  items: readonly EquipmentItemView[];
  onClose: () => void;
  onOpenTile: (item: EquipmentItemView) => void;
  pointerInput: RefObject<boolean>;
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={t.allTitle(formatFigure(items.length))}
    size="lg"
    className="dash-eq-all-dialog"
  >
    {/* 열 때만 그린다 — 닫힌 창이 120대 타일을 미리 들고 있지 않게. */}
    {open && (
      <>
        <StatusLegend items={items} />
        <ul className="dash-eq-grid dash-eq-grid-all">
          {items.map((item) => (
            <EquipmentTile
              key={item.equipmentId}
              item={item}
              onOpen={onOpenTile}
              pointerInput={pointerInput}
            />
          ))}
        </ul>
      </>
    )}
  </Dialog>
);

/** 가동 외 설비 현황 — 그룹마다 이만큼만 보이고 나머지는 「외 n대」로 전체 설비 보기 창(사용자 결정 2026-10-16). */
export const STOPPED_GROUP_PREVIEW_COUNT = 3;

/** 상태별 대수 — 고른 범위(라인) 기준. 필터와 떨어진 오른쪽에 선다. */
const StatusLegend = ({ items }: { items: readonly EquipmentItemView[] }) => (
  <ul className="dash-eq-legend" aria-label={t.legend}>
    {EQUIPMENT_STATUS_ORDER.map((code) => (
      <li key={code}>
        <span className={`dash-dot dash-dot-${EQUIPMENT_STATUS_TONE[code]}`} aria-hidden="true" />
        {t.status[code]}{' '}
        <strong>{formatFigure(items.filter((item) => item.statusCode === code).length)}</strong>
      </li>
    ))}
  </ul>
);

/**
 * 가동 외 설비 현황(⭐ 사용자 결정 2026-10-16 — 이름 · 행 구성 · 그룹당 3행) — 정지 · 대기 · 교체 · 비가동 그룹,
 * 그룹 머리는 배지 + 대수 한 줄. 줄 = 설비 코드(굵게, 설비 종류는 옆에 작게) · 상태 사유(최대 2줄) · 경과 시간
 * (오른쪽 같은 폭). 그룹 안에서는 **오래 멈춘 것부터**, 3행을 넘으면 「외 n대」로 전체 설비 보기 창을 연다.
 * 줄을 누르면 설비 가동 현황과 같은 상세 창. 공장 전체 기준이다(라인 구분과 상관없다).
 */
export const StoppedPanel = (props: EquipmentPanelProps) => {
  const [openedId, setOpenedId] = useState<number | null>(null);
  const [isAllOpen, setIsAllOpen] = useState(false);
  const pointerInput = usePointerInput();
  const blocked = gate(props);
  const { view } = props;

  const body = (() => {
    if (blocked !== null || view === null) return blocked;

    const stopped = toStoppedItems(view.items);
    if (stopped.length === 0) {
      return <EmptyLine text={t.stoppedEmpty} />;
    }

    const opened = view.items.find((item) => item.equipmentId === openedId) ?? null;
    const openTile = (target: EquipmentItemView): void => {
      setOpenedId(target.equipmentId);
    };

    return (
      <>
        {/*
         * 모든 그룹이 한 격자의 열(설비 · 사유 · 경과 시간)을 나눠 쓴다(subgrid) — 그룹마다 표를 따로 두면 열 폭이
         * 그룹마다 달라 줄이 들쭉날쭉했다. ⚠ 대시보드 표의 「가운데 정렬」 규칙에서 뺀다 — 사유는 긴 문장이라
         * 왼쪽에서 읽어야 하고, 경과 시간은 오른쪽 끝에 맞춰야 위아래로 견준다.
         */}
        <div className="dash-stopped">
          <div className="dash-stopped-colhead" aria-hidden="true">
            <span>{t.stoppedElapsedColumn}</span>
          </div>
          {EQUIPMENT_STATUS_ORDER.filter((code) => code !== 'RUNNING').map((code) => {
            const rows = stopped.filter((item) => item.statusCode === code);
            if (rows.length === 0) return null;
            const hidden = rows.length - STOPPED_GROUP_PREVIEW_COUNT;

            return (
              <section key={code} className="dash-stopped-group" aria-label={t.status[code]}>
                <div className="dash-stopped-head">
                  <StatusChip statusCode={code} />
                  <span className="dash-stopped-count">
                    {formatFigure(rows.length)}
                    {t.countUnit}
                  </span>
                </div>
                <ul
                  className="dash-stopped-list"
                  aria-label={t.stoppedGroupCaption(t.status[code])}
                >
                  {rows.slice(0, STOPPED_GROUP_PREVIEW_COUNT).map((item) => (
                    <li key={item.equipmentId} className="dash-stopped-row">
                      <button
                        type="button"
                        className="dash-stopped-button"
                        {...pointerFocusProps(pointerInput)}
                        aria-label={`${t.openDetail(item.equipmentCode)} · ${describeReason(item)} · ${formatElapsed(item.elapsedMinutes)}`}
                        onClick={() => {
                          openTile(item);
                        }}
                      >
                        <span className="dash-stopped-unit">
                          <span className="dash-stopped-code">{item.equipmentCode}</span>
                          {item.tonnage !== null && (
                            <span className="dash-stopped-type">{item.tonnage}</span>
                          )}
                        </span>
                        <span
                          className={
                            item.reasonName === null
                              ? 'dash-stopped-reason dash-stopped-reason-none'
                              : 'dash-stopped-reason'
                          }
                          title={describeReason(item)}
                        >
                          {describeReason(item)}
                        </span>
                        <span className="dash-stopped-elapsed">
                          {formatElapsed(item.elapsedMinutes)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {hidden > 0 && (
                  <Button
                    variant="text"
                    size="sm"
                    className="dash-stopped-more"
                    onClick={() => {
                      setIsAllOpen(true);
                    }}
                  >
                    {t.stoppedMore(formatFigure(hidden))}
                  </Button>
                )}
              </section>
            );
          })}
        </div>
        <AllEquipmentDialog
          open={isAllOpen}
          items={sortForBoard(view.items)}
          onClose={() => {
            setIsAllOpen(false);
          }}
          onOpenTile={openTile}
          pointerInput={pointerInput}
        />
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
    <Panel title={t.stoppedTitle} sub={t.stoppedSub} tag={t.tagLive}>
      {body}
    </Panel>
  );
};
