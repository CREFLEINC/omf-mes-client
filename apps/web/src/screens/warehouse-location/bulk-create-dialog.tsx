import {
  AlertBanner,
  Button,
  Checkbox,
  Dialog,
  Progress,
  Radio,
  RadioGroup,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState } from 'react';

import { isSystemLocation } from '../../patterns/system-location';
import {
  BULK_LIMITS,
  type BulkCreateInput,
  type BulkPlan,
  planBulkCreate,
} from './bulk-create-plan';
import { useZoneStockLocations } from './queries';
import type { Location } from './types';
import { useBulkCreate } from './use-bulk-create';

const t = messages.warehouseLocation;
const b = t.bulkCreate;

export interface BulkCreateDialogProps {
  open: boolean;
  warehouseId: number;
  /** 「창고코드 · 창고명」 — 창 제목에 붙는다. */
  warehouseLabel: string;
  /** 고른 창고의 위치 전체(검색과 무관한 계층). */
  items: readonly Location[];
  onClose: () => void;
}

type Mode = BulkCreateInput['mode'];

/** 칸 글 → 수. 숫자가 아니면 NaN — 계획이 범위 밖(`range`)으로 본다. */
const toCount = (text: string): number => (/^\d+$/.test(text.trim()) ? Number(text) : Number.NaN);

const countError = (value: number, limits: { min: number; max: number }): string | undefined =>
  Number.isInteger(value) && value >= limits.min && value <= limits.max
    ? undefined
    : t.rackLayout.countInvalid(limits.min, limits.max);

/** 구역 하나의 지금 랙 · 셀 수 — 고르는 목록에 보인다. */
const zoneContents = (zone: Location, items: readonly Location[]) => {
  const below = new Map<number, Location[]>();
  for (const item of items) {
    if (item.parentLocationId === null || item.parentLocationId === undefined) continue;
    below.set(item.parentLocationId, [...(below.get(item.parentLocationId) ?? []), item]);
  }
  const racks = below.get(zone.locationId) ?? [];
  const cells = racks
    .flatMap((rack) => below.get(rack.locationId) ?? [])
    .flatMap((level) => below.get(level.locationId) ?? []);
  return { racks: racks.length, cells: cells.length };
};

/**
 * 위치 일괄 생성 창(#267 · 시안 `W-06-07-bulk.html`). 새 구역 만들기 / 기존 구역에 랙 추가 둘 중 하나를 고르고 네 수(또는
 * 세 수)를 넣으면 합계와 첫 · 마지막 코드를 바로 보인다. [만들기]를 누르면 계획을 그 자리에서 굳히고 차례로 만든다 — 일부가
 * 실패하면 같은 계획으로 남은 것만 다시 만든다. 만드는 동안에는 닫히지 않는다.
 *
 * 화면은 열 때만 그린다 — 닫으면 입력 · 계획 · 진행이 함께 사라진다(R-3).
 */
export const BulkCreateDialog = ({
  open,
  warehouseId,
  warehouseLabel,
  items,
  onClose,
}: BulkCreateDialogProps) => {
  const [mode, setMode] = useState<Mode>('newZones');
  const [zoneText, setZoneText] = useState('1');
  const [rackText, setRackText] = useState('1');
  const [levelText, setLevelText] = useState('1');
  const [cellText, setCellText] = useState('1');
  const [zoneIds, setZoneIds] = useState<number[]>([]);
  /** [만들기] 뒤의 계획 — 만든 것이 목록에 들어와도 코드가 다시 지어지지 않게 굳힌다. */
  const [frozen, setFrozen] = useState<BulkPlan | null>(null);
  const noteId = useId();

  /* 창을 열 때 한 번 — 권한이 없거나 실패하면 「모름」이고 미리 막지 않는다(research R-1). */
  const stock = useZoneStockLocations(warehouseId, open);
  const blocked = stock.known ? stock.locationIds : new Set<number>();

  const userZones = useMemo(
    () =>
      items.filter(
        (item) =>
          (item.parentLocationId === null || item.parentLocationId === undefined) &&
          !isSystemLocation(item),
      ),
    [items],
  );

  const levels = toCount(levelText);
  const input: BulkCreateInput =
    mode === 'newZones'
      ? {
          mode,
          zoneCount: toCount(zoneText),
          racksPerZone: toCount(rackText),
          levelsPerRack: levels,
          cellsPerLevel: levels === 0 ? 0 : toCount(cellText),
        }
      : {
          mode,
          zoneIds,
          racksPerZone: toCount(rackText),
          levelsPerRack: levels,
          cellsPerLevel: levels === 0 ? 0 : toCount(cellText),
        };
  const live = planBulkCreate(input, items, blocked);
  const plan = frozen ?? live;
  const { state, run } = useBulkCreate(warehouseId);
  const running = state.status === 'running';
  const locked = frozen !== null;

  const close = () => {
    if (running) return;
    onClose();
  };

  const make = () => {
    if (plan.error !== undefined) return;
    if (frozen === null) setFrozen(plan);
    void run(plan.steps);
  };

  const fields = {
    zones: countError(toCount(zoneText), BULK_LIMITS.zones),
    racks: countError(toCount(rackText), BULK_LIMITS.racks),
    levels: countError(levels, BULK_LIMITS.levels),
    cells: levels === 0 ? undefined : countError(toCount(cellText), BULK_LIMITS.cells),
  };
  const overMessage =
    plan.error !== 'overLimit'
      ? null
      : plan.totals.cells > BULK_LIMITS.maxCells
        ? b.overCells(plan.totals.cells)
        : b.overAll(plan.totals.all);
  const blockReason =
    overMessage ??
    (plan.error === 'empty'
      ? b.pickRequired
      : plan.error === 'range' && Object.values(fields).every((error) => error === undefined)
        ? b.rackNoLeft
        : null);

  const numberField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    error: string | undefined,
    hint?: string,
    disabled = false,
  ) => (
    <TextField
      label={label}
      inputMode="numeric"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={locked || disabled}
      error={error}
      helperText={hint}
    />
  );

  const footer =
    state.status === 'done' ? (
      <Button onClick={close}>{messages.common.close}</Button>
    ) : (
      <>
        <Button variant="outlined" disabled={running} onClick={close}>
          {messages.common.cancel}
        </Button>
        {state.status === 'partial' ? (
          <Button onClick={make}>{b.retryRest}</Button>
        ) : (
          <Button
            disabled={running || plan.error !== undefined}
            aria-describedby={blockReason === null ? undefined : noteId}
            loading={running}
            onClick={make}
          >
            {running ? b.making(state.done, state.total) : b.make}
          </Button>
        )}
      </>
    );

  return (
    <Dialog
      className="location-dialog bulk-create-dialog"
      open={open}
      onClose={close}
      title={b.title(warehouseLabel)}
      size="lg"
      showCloseButton={!running}
      closeOnBackdropClick={!running}
      footer={footer}
    >
      <div className="location-dialog-body bulk-create">
        <RadioGroup
          name="bulk-create-mode"
          aria-label={b.modeLabel}
          orientation="horizontal"
          value={mode}
          disabled={locked}
          onChange={(value) => setMode(value as Mode)}
        >
          <Radio value="newZones">{b.modeNew}</Radio>
          <Radio value="existingZones">{b.modeExisting}</Radio>
        </RadioGroup>

        {mode === 'existingZones' && (
          <fieldset className="bulk-create-zones">
            <legend>{b.pickZones}</legend>
            {userZones.length === 0 && <p className="field-note">{b.noZones}</p>}
            {userZones.map((zone) => {
              const isBlocked = blocked.has(zone.locationId);
              const contents = zoneContents(zone, items);
              const alias = zone.aliasName?.trim() ?? '';
              return (
                <div key={zone.locationId} className="bulk-create-zone">
                  <Checkbox
                    checked={!isBlocked && zoneIds.includes(zone.locationId)}
                    disabled={locked || isBlocked}
                    onChange={(event) =>
                      setZoneIds((prev) =>
                        event.target.checked
                          ? [...prev, zone.locationId]
                          : prev.filter((id) => id !== zone.locationId),
                      )
                    }
                  >
                    {alias === '' ? zone.locationCode : b.zoneName(zone.locationCode, alias)}
                  </Checkbox>
                  <small className={isBlocked ? 'field-error' : 'field-note'}>
                    {isBlocked ? b.stockBlocked : b.zoneInfo(contents.racks, contents.cells)}
                  </small>
                </div>
              );
            })}
          </fieldset>
        )}

        <div className={mode === 'newZones' ? 'bulk-create-counts' : 'bulk-create-counts is-three'}>
          {mode === 'newZones' && numberField(b.zoneCount, zoneText, setZoneText, fields.zones)}
          {numberField(b.racksPerZone, rackText, setRackText, fields.racks)}
          {numberField(b.levelsPerRack, levelText, setLevelText, fields.levels, b.levelHint)}
          {numberField(
            b.cellsPerLevel,
            levels === 0 ? '0' : cellText,
            setCellText,
            fields.cells,
            b.cellHint,
            levels === 0,
          )}
        </div>

        <section className="bulk-create-summary" aria-label={b.total}>
          <span className="bulk-create-summary-label">{b.total}</span>
          <div className="bulk-create-summary-total">
            <strong>{b.count(plan.totals.all)}</strong>
            <span>
              {b.parts(
                mode === 'newZones' ? plan.totals.zones : null,
                plan.totals.racks,
                plan.totals.levels,
                plan.totals.cells,
              )}
            </span>
          </div>
          {plan.firstCode !== null && plan.lastCode !== null && (
            <div className="bulk-create-summary-codes">
              <span>
                {b.firstCode} <code>{plan.firstCode}</code>
              </span>
              <span>
                {b.lastCode} <code>{plan.lastCode}</code>
              </span>
            </div>
          )}
        </section>

        {blockReason !== null && !locked && (
          <div id={noteId}>
            <AlertBanner variant={overMessage === null ? 'info' : 'error'} title={blockReason} />
          </div>
        )}

        {running && (
          <div className="bulk-create-progress">
            <Progress
              value={state.done}
              max={state.total}
              label={b.making(state.done, state.total)}
            />
            <span className="field-note">{b.making(state.done, state.total)}</span>
          </div>
        )}

        {state.status === 'partial' && (
          <AlertBanner
            variant="error"
            title={
              state.failedRacks > 0
                ? b.partial(state.created, state.failedRacks)
                : b.partialNames(state.created)
            }
          >
            <ul className="bulk-create-failures">
              {state.failures.map((failure) => (
                <li key={failure.code}>{b.failure(failure.code, failure.reason)}</li>
              ))}
            </ul>
          </AlertBanner>
        )}

        {state.status === 'done' && (
          <AlertBanner variant="success" title={b.done(plan.totals.all)} />
        )}
      </div>
    </Dialog>
  );
};
