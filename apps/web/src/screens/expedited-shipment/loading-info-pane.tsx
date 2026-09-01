import { AlertBanner, Select, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { WarehouseResolution } from './lookups';
import type { LoadingInfoDraft } from './submission';

const t = messages.expeditedShipment.loading;

export interface LoadingInfoPaneProps {
  draft: LoadingInfoDraft;
  warehouse: WarehouseResolution;
  chosenWarehouseId: string;
  onChange: (patch: Partial<LoadingInfoDraft>) => void;
  onChangeWarehouse: (warehouseId: string) => void;
}

interface TextCellProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const TextCell = ({ label, value, onChange }: TextCellProps) => {
  const id = useId();

  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <TextField id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
};

/**
 * ③ 상차 정보 — 전부 **선택 입력**이다(§5-7). 필수처럼 보이면 급한 출하를 붙잡는다.
 *
 * ⚠ **출하 창고는 스펙에 없는 칸이다.** 계약이 `warehouseId`를 필수로 두는데 그 값의 출처가
 * 스펙에 없어, 활성 창고가 하나면 자동으로 채우고 여럿이면 고르게 한다. 화면이 몰래 첫 번째를
 * 집으면 **장부상 입고가 엉뚱한 창고에 남고**, 물건은 거기 없으므로 아무도 알아채지 못한다.
 */
export const LoadingInfoPane = ({
  draft,
  warehouse,
  chosenWarehouseId,
  onChange,
  onChangeWarehouse,
}: LoadingInfoPaneProps) => {
  const warehouseId = useId();
  const warehouseNoteId = `${warehouseId}-note`;

  return (
    <section className="pane" aria-label={messages.expeditedShipment.panes.loading}>
      <h2>{messages.expeditedShipment.panes.loading}</h2>

      <div className="filter-bar">
        <TextCell
          label={t.vehicleNo}
          value={draft.vehicleNo}
          onChange={(value) => onChange({ vehicleNo: value })}
        />
        <TextCell
          label={t.driverName}
          value={draft.driverName}
          onChange={(value) => onChange({ driverName: value })}
        />
        <TextCell
          label={t.sealNo}
          value={draft.sealNo}
          onChange={(value) => onChange({ sealNo: value })}
        />
      </div>
      <p className="field-note">{t.optional}</p>

      {warehouse.kind === 'PENDING' && (
        <div role="status" aria-label={t.warehouseLoading}>
          <SkeletonText lines={1} />
        </div>
      )}
      {warehouse.kind === 'ERROR' && (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.warehouseFailed}</AlertBanner>
        </div>
      )}
      {warehouse.kind === 'NONE' && (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.warehouseNone}</AlertBanner>
        </div>
      )}
      {warehouse.kind === 'AUTO' && (
        <dl className="filter-bar">
          <div className="field-cell">
            <dt className="field-label">{t.warehouse}</dt>
            <dd>{warehouse.label}</dd>
            {/* ⭐ 「장부상」을 여기서도 적는다 — 안 적으면 창고 담당이 물건을 찾으러 간다(§5-4). */}
            <span className="field-note">{t.warehouseNote}</span>
          </div>
        </dl>
      )}
      {warehouse.kind === 'AMBIGUOUS' && (
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={warehouseId}>
            {t.warehouse}
          </label>
          <Select
            id={warehouseId}
            options={warehouse.options.map((option) => ({
              value: String(option.warehouseId),
              label: option.label,
            }))}
            value={chosenWarehouseId === '' ? null : chosenWarehouseId}
            placeholder={t.warehouse}
            aria-describedby={warehouseNoteId}
            onChange={onChangeWarehouse}
          />
          <span id={warehouseNoteId} className="field-note">
            {t.warehouseAmbiguous} {t.warehouseNote}
          </span>
        </div>
      )}
    </section>
  );
};
