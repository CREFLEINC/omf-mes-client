import { AlertBanner, Button, useToast } from '@crefle/web-ui';
import type { ReplenishmentSettings } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { useSaveRunTimes } from './mutations';

const t = messages.productionWarehouseReplenishment;
const tt = t.runTime;

/** 시각 고르기 — 30분 단위 `HH:MM`(T023). */
export const HALF_HOURS: readonly string[] = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0');
  return `${hour}:${index % 2 === 0 ? '00' : '30'}`;
});

/** 창고 칸의 「공장 기본」 값 — 창고 시각 `null`. */
const PLANT_DEFAULT = '';

const timeOptions = (current: string): { value: string; label: string }[] =>
  (HALF_HOURS.includes(current) || current === '' ? HALF_HOURS : [current, ...HALF_HOURS]).map(
    (time) => ({ value: time, label: time }),
  );

export interface RunTimePanelProps {
  plantId: number;
  settings: ReplenishmentSettings;
}

/**
 * 자동 보충 시각(screens/W-02-12.md 보기 4 맨 위, 시안 검토 4). 공장 기본은 운영 정책, 창고별은 창고 설정이다.
 * 바꾸면 「오늘 이미 실행했으면 내일부터」 안내를 보인다.
 */
export const RunTimePanel = ({ plantId, settings }: RunTimePanelProps) => {
  const toast = useToast();
  const noteId = useId();
  const [plantDefault, setPlantDefault] = useState(settings.plantDefaultRunTime);
  const [byWarehouse, setByWarehouse] = useState<ReadonlyMap<number, string>>(
    () =>
      new Map(settings.warehouses.map((row) => [row.warehouseId, row.runTime ?? PLANT_DEFAULT])),
  );
  const [seeded, setSeeded] = useState(settings);
  /* 저장 뒤 다시 받은 설정으로 입력을 다시 세운다 — 렌더 중 갱신. */
  if (seeded !== settings) {
    setSeeded(settings);
    setPlantDefault(settings.plantDefaultRunTime);
    setByWarehouse(
      new Map(settings.warehouses.map((row) => [row.warehouseId, row.runTime ?? PLANT_DEFAULT])),
    );
  }

  const save = useSaveRunTimes(() => {
    toast.show({ variant: 'success', description: t.toast.runTimeSaved });
  });

  const plantChanged = plantDefault !== settings.plantDefaultRunTime;
  const changedWarehouses = settings.warehouses.filter(
    (row) => (byWarehouse.get(row.warehouseId) ?? PLANT_DEFAULT) !== (row.runTime ?? PLANT_DEFAULT),
  );
  const dirty = plantChanged || changedWarehouses.length > 0;

  return (
    <section className="replenishment-run-time" aria-label={tt.title}>
      <header className="replenishment-section-head">
        <h2 className="subsection-title">{tt.title}</h2>
        <p className="field-note">{tt.lead}</p>
      </header>
      <div className="replenishment-filter-row">
        <span className="replenishment-run-time-field">
          <span className="field-note">{tt.plantDefault}</span>
          <Select
            size="sm"
            aria-label={tt.plantDefault}
            value={plantDefault}
            options={timeOptions(plantDefault)}
            onChange={(value) => {
              save.reset();
              setPlantDefault(value);
            }}
          />
        </span>
        {settings.warehouses.map((row) => (
          <span key={row.warehouseId} className="replenishment-run-time-field">
            <span className="field-note">{row.warehouseName}</span>
            <Select
              size="sm"
              aria-label={tt.warehouseLabel(row.warehouseName)}
              value={byWarehouse.get(row.warehouseId) ?? PLANT_DEFAULT}
              options={[
                { value: PLANT_DEFAULT, label: tt.plantDefaultValue(plantDefault) },
                ...timeOptions(row.runTime ?? ''),
              ]}
              onChange={(value) => {
                save.reset();
                setByWarehouse((prev) => new Map(prev).set(row.warehouseId, value));
              }}
            />
          </span>
        ))}
        {!dirty && (
          <span id={noteId} className="visually-hidden">
            {tt.saveBlocked}
          </span>
        )}
        <Button
          size="sm"
          disabled={!dirty}
          aria-describedby={dirty ? undefined : noteId}
          loading={save.isSaving}
          onClick={() =>
            save.write({
              plantId,
              today: plantToday(),
              plantDefault: plantChanged ? plantDefault : null,
              warehouses: changedWarehouses.map((row) => {
                const value = byWarehouse.get(row.warehouseId) ?? PLANT_DEFAULT;
                return {
                  warehouseId: row.warehouseId,
                  runTime: value === PLANT_DEFAULT ? null : value,
                  versionNo: row.versionNo,
                };
              }),
            })
          }
        >
          {tt.save}
        </Button>
      </div>
      {settings.plantDefaultSource === 'SERVER_DEFAULT' && !plantChanged && (
        <p className="field-note">{tt.serverDefault}</p>
      )}
      {dirty && <AlertBanner variant="info">{tt.changedNote}</AlertBanner>}
      {save.error !== null && <SaveErrorBanner error={save.error} />}
    </section>
  );
};
