import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toLocationOptions } from './location-options';
import type { OptionListResult } from './queries';
import { SelectField } from './select-field';
import type { LocationView, SelectOption, WarehouseView } from './types';

const t = messages.goodsReceipt;

export interface WarehouseLocationFieldsProps {
  warehouses: OptionListResult<WarehouseView>;
  locations: OptionListResult<LocationView>;
  warehouseValue: string;
  locationValue: string;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것 */
  fieldErrors: Record<string, string>;
  isLocked: boolean;
  /** 고른 창고의 공장 이름. 아직 고르지 않았으면 `null`이다 */
  warehousePlantName: string | null;
  /** 고른 창고의 공장이 입하 전표의 공장과 다른가. **막지 않고 보이기만 한다** */
  isPlantMismatch: boolean;
  onChangeWarehouse: (value: string) => void;
  onChangeLocation: (value: string) => void;
  onRetryOptions: () => void;
}

const toWarehouseOptions = (warehouses: readonly WarehouseView[]): SelectOption[] =>
  warehouses.map((warehouse) => ({
    value: String(warehouse.warehouseId),
    label: `${warehouse.warehouseCode} · ${warehouse.warehouseName}`,
  }));

/**
 * 목록의 한계를 밝히는 안내.
 *
 * **차례가 뜻을 정한다** — 실패 → 아직 안 옴 → 잘림.
 *
 * - **실패가 앞선다**: 둘이 겹치는 자리가 실제로 있다(첫 조회가 잘린 목록을 주고 다시 부르기가
 *   실패하면 낡은 자료와 실패가 함께 참이 된다).
 * - **「아직 안 옴」을 반드시 말한다**: 목록이 오는 동안 선택칸은 선택지 0건으로 그려지는데,
 *   그 모습은 「이 창고에는 위치가 없다」와 글자가 같다. 이 화면이 참조 표기에서 지키는 규칙
 *   (미도착을 「알 수 없음」으로 내지 않는다)이 선택지 목록에서도 같아야 한다.
 */
const listNote = (list: OptionListResult<unknown>): string | undefined => {
  if (list.isError) return t.filters.lookupFailed;
  if (list.isLoading) return t.filters.lookupLoading;
  if (list.truncated) return t.filters.lookupTruncated;

  return undefined;
};

/**
 * 입고 창고와 적치 위치.
 *
 * **선택칸이 다른 선택칸에 의존하는 이 화면의 첫 자리다.** 계약이 위치 조회에 `warehouseId`를
 * 필수로 요구하므로(실측) 창고를 고르기 전에는 위치를 부를 수도, 고를 수도 없다 —
 * 잠그고 **왜 잠겼는지**를 항상 보이는 문구로 밝힌다.
 *
 * **위치는 상위 위치 기준 1단 그룹으로 접는다**(`location-options.ts`). 착수 이슈는 「창고 아래
 * 위치를 그룹으로」라고 적었으나, 한 창고의 위치만 담기는 선택칸에서 창고로 묶으면 그룹이 늘
 * 하나뿐이라 뜻이 없다.
 *
 * **고른 창고의 공장을 함께 보인다**(계획 결정 8). 요청에 싣는 공장은 **입하 전표의 값**인데
 * 창고에도 공장이 있어 두 값이 다를 수 있다 — 다르면 눈에 보이게 하되 **막지는 않는다.**
 * 어떤 조합이 성립하는지 정한 규칙이 데이터에 없어 화면이 판정하면 그것도 지어내는 것이다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const WarehouseLocationFields = ({
  warehouses,
  locations,
  warehouseValue,
  locationValue,
  fieldErrors,
  isLocked,
  warehousePlantName,
  isPlantMismatch,
  onChangeWarehouse,
  onChangeLocation,
  onRetryOptions,
}: WarehouseLocationFieldsProps) => {
  const hasWarehouse = warehouseValue !== '';

  return (
    <>
      <div className="form-grid">
        <SelectField
          wide
          label={t.fields.warehouse}
          options={toWarehouseOptions(warehouses.items)}
          value={warehouseValue}
          note={listNote(warehouses)}
          error={fieldErrors.warehouseId}
          placeholder={t.values.selectPlaceholder}
          disabled={isLocked}
          onChange={onChangeWarehouse}
        />

        <SelectField
          wide
          label={t.fields.location}
          options={hasWarehouse ? toLocationOptions(locations.items) : []}
          value={locationValue}
          /* 잠긴 이유가 먼저다 — 창고를 고르기 전에는 잘림도 실패도 있을 수 없다. */
          note={hasWarehouse ? listNote(locations) : t.actionReasons.locationNeedsWarehouse}
          error={fieldErrors.destinationLocationId}
          placeholder={t.values.selectPlaceholder}
          disabled={isLocked || !hasWarehouse}
          onChange={onChangeLocation}
        />
      </div>

      {/* 공장은 사용자가 고르지 않는다 — 어디서 오는지 밝히지 않으면 화면에서 읽을 수 없다. */}
      <p className="field-note">{t.notes.plantFromInboundReceipt}</p>

      {warehousePlantName !== null && (
        <p className="field-note">{t.notes.warehousePlant(warehousePlantName)}</p>
      )}

      {isPlantMismatch && <p className="field-note">{t.notes.warehousePlantDiffers}</p>}

      {(warehouses.isError || locations.isError) && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.postOptionsFailed}</span>
          <Button variant="outlined" size="sm" disabled={isLocked} onClick={onRetryOptions}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
