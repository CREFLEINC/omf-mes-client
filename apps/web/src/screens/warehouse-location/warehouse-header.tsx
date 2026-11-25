import { Button, Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { IdentityHeader } from './location-identity';
import type { LookupOptions, WarehouseFormValues } from './types';

const t = messages.warehouseLocation;

export interface WarehouseHeaderProps {
  /** 저장된 값 — 수정 창에서 고치는 중인 값이 아니라 서버에 있는 값을 보인다. */
  values: WarehouseFormValues;
  isActive: boolean;
  lookups: LookupOptions;
  onEdit: () => void;
}

const labelOf = (options: { value: string; label: string }[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value;

/**
 * 오른쪽 창 맨 위 창고 머리(안 B, 사용자 결정 2026-11-24) — 코드 · 창고명 · 유형 · 외부 · 불량 · 상태를 한 줄에, 그 밑에
 * 공장 · 사업부 · 창고 위치 코드(잠김). 고치는 것은 [창고 정보] 창에서 하고, 창 나머지는 Location 표가 쓴다.
 */
export const WarehouseHeader = ({ values, isActive, lookups, onEdit }: WarehouseHeaderProps) => {
  const typeLabel = labelOf(lookups.warehouseTypes, values.warehouseTypeCode);
  const meta = [
    labelOf(lookups.plants, values.plantId),
    labelOf(lookups.businessUnits, values.businessUnitId),
  ].filter((text) => text !== '');

  return (
    <section className="warehouse-header" aria-label={t.fields.warehouse}>
      <div className="warehouse-header-top">
        <IdentityHeader
          icon={{ name: 'warehouse', tone: 'zone' }}
          kind={t.fields.warehouse}
          code={values.warehouseCode}
          codeLabel={t.fields.warehouseCode}
          name={values.warehouseName}
          nameLabel={t.fields.warehouseName}
          chips={
            <>
              {typeLabel !== '' && (
                <Chip size="sm" status="idle">
                  {typeLabel}
                </Chip>
              )}
              {values.isExternal && (
                <Chip size="sm" status="idle">
                  {t.fields.isExternal}
                </Chip>
              )}
              {values.isDefect && (
                <Chip size="sm" status="error">
                  {t.fields.isDefect}
                </Chip>
              )}
            </>
          }
          isActive={isActive}
        />
        {/* 테두리 단추 — 칩 옆에서 글자로 묻히지 않게(사용자 결정 2026-11-24, 버튼 개선 안 2). */}
        <Button
          variant="outlined"
          size="sm"
          leadingIcon={<Icon name="edit" size={18} />}
          onClick={onEdit}
        >
          {t.actions.editWarehouse}
        </Button>
      </div>
      <div className="warehouse-header-meta">
        {meta.map((text) => (
          <span key={text}>{text}</span>
        ))}
        {/* 창고 위치 코드(#292) — 이 창고의 모든 위치 코드 앞에 붙고 바꿀 수 없다. */}
        {values.locationPrefix !== '' && (
          <dl>
            <dt>{t.locationPrefix.label}</dt>
            <dd>
              <span className="warehouse-header-prefix">{values.locationPrefix}</span>
              <Icon name="lock" size={14} aria-hidden="true" />
            </dd>
          </dl>
        )}
      </div>
    </section>
  );
};
