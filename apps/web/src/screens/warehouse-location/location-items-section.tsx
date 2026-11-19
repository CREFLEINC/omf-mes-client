import { AlertBanner, Button, Icon, IconButton, Skeleton, Switch } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import type { LocationItem } from './types';

const t = messages.warehouseLocation.itemsSection;

/**
 * 고치는 중인 보관 품목. 피처 009(2026-11-18 결정)부터 품목 지정은 **안내**라 「품목 무관 / 지정 품목만」 갈래가 없다 —
 * 빈 목록은 「지정 품목 없음」일 뿐이다. 막는 것은 위치 옵션 「지정 품목만 받기」(`RestrictionToggle`)다.
 */
export interface LocationItemsDraft {
  items: LocationItem[];
}

/** 서버에 보낼 목록 — 빈 목록이면 지정을 모두 지운다. */
export const draftItemIds = (draft: LocationItemsDraft): number[] =>
  draft.items.map((item) => item.itemId);

/** 받은 목록과 견줘 바뀌었는가. */
export const isItemsDraftChanged = (
  draft: LocationItemsDraft,
  stored: readonly LocationItem[],
): boolean => {
  const ids = new Set(draftItemIds(draft));
  return ids.size !== stored.length || stored.some((item) => !ids.has(item.itemId));
};

export interface RestrictionToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** 켤 수 없는 까닭 — 있으면 스위치가 잠기고 그 까닭이 선다(켠 것을 끄는 것은 늘 된다 — 여는 쪽이 정한다). */
  lockReason?: string | undefined;
  /** 까닭 글 없이 켜기만 잠근다 — 지정 품목이 없을 때(사용자 지시 2026-11-19 — 안내 문장을 걷었다). */
  locked?: boolean;
  /** 저장 때 서버가 켜기를 거절한 까닭(지정 밖 품목 재고 등). */
  error?: string | undefined;
  disabled?: boolean;
}

/**
 * 「지정 품목만 받기」 스위치 줄(피처 009 · FR-017c, 시안 W0607-After). 켜기 조건(지정 1개 이상 · 지정 밖 재고 없음 ·
 * 사람이 만든 위치)은 저장 때 서버가 검사한다 — 지정 품목이 없는 것만 미리 잠근다(시안 결정). 시스템 자리는 잠긴 줄을
 * 까닭과 함께 보인다.
 */
export const RestrictionToggle = ({
  checked,
  onChange,
  lockReason,
  locked = false,
  error,
  disabled = false,
}: RestrictionToggleProps) => {
  const id = useId();

  return (
    <div className="location-restrict">
      <div className="location-restrict-row">
        <Switch
          id={id}
          checked={checked}
          disabled={disabled || locked || lockReason !== undefined}
          onChange={(event) => onChange?.(event.target.checked)}
        />
        <label htmlFor={id} className="location-restrict-label">
          {t.restrict.label}
        </label>
      </div>
      {lockReason !== undefined && (
        <p className="location-restrict-lock">
          <Icon name="block" size={16} aria-hidden="true" />
          <span>{lockReason}</span>
        </p>
      )}
      {error !== undefined && <span className="field-error">{error}</span>}
    </div>
  );
};

export interface LocationItemsSectionProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** 받기 전 · 실패하면 null. */
  draft: LocationItemsDraft | null;
  onChange: (draft: LocationItemsDraft) => void;
  /** 칸 아래 오류 — 서버의 itemIds 오류(켠 위치에 지정 밖 재고가 있음 등). */
  error?: string | undefined;
  disabled: boolean;
  /** 고를 수 있는 품목 유형 — 창고 유형으로 정한다(`item-scope.ts`). 없으면 전체 품목. */
  itemTypeCodes?: readonly string[] | undefined;
  /** 「지정 품목만 받기」 — 없으면(층 없는 랙 창) 스위치를 두지 않는다. */
  restriction?: RestrictionToggleProps | undefined;
}

/**
 * 위치 수정 창 안의 보관 품목(안내) — 품목을 골라 더하고 줄마다 뺀다. 그 아래 「지정 품목만 받기」 스위치. 저장은 창의
 * 저장 하나가 맡는다(screen).
 */
export const LocationItemsSection = ({
  isLoading,
  isError,
  onRetry,
  draft,
  onChange,
  error,
  disabled,
  itemTypeCodes,
  restriction,
}: LocationItemsSectionProps) => {
  const body = () => {
    if (isError) {
      return (
        <AlertBanner
          variant="error"
          title={t.loadFailed}
          action={
            <Button variant="outlined" size="sm" onClick={onRetry}>
              {messages.common.retry}
            </Button>
          }
        />
      );
    }

    if (isLoading || draft === null) {
      return (
        <div role="status" aria-label={t.loading}>
          <Skeleton variant="rect" height={72} />
        </div>
      );
    }

    return (
      <>
        <ItemSelect
          aria-label={t.addItem}
          placeholder={t.addItem}
          value={null}
          disabled={disabled}
          {...(itemTypeCodes === undefined ? {} : { itemTypeCodes })}
          onItemChange={(item) => {
            /* 고른 품목은 목록에 더하고 칸은 비운다 — 이미 있는 품목은 한 번만. */
            if (draft.items.some((row) => row.itemId === item.itemId)) return;
            onChange({
              items: [
                ...draft.items,
                { itemId: item.itemId, itemCode: item.itemCode, itemName: item.itemName },
              ],
            });
          }}
        />
        {/* 비어 있어도 같은 크기로 둔다 — 품목을 더하고 빼도 창이 출렁이지 않게(사용자 지시 2026-10-29). */}
        <ul className="location-items-list" aria-label={t.list}>
          {draft.items.length === 0 && <li className="location-items-empty">{t.none}</li>}
          {draft.items.map((item) => (
            <li key={item.itemId} className="location-items-row">
              <span className="location-items-code">{item.itemCode}</span>
              <span className="location-items-name">{item.itemName}</span>
              <IconButton
                size="sm"
                icon="close"
                aria-label={t.remove(item.itemCode)}
                title={t.remove(item.itemCode)}
                disabled={disabled}
                onClick={() =>
                  onChange({ items: draft.items.filter((row) => row.itemId !== item.itemId) })
                }
              />
            </li>
          ))}
        </ul>
        {error !== undefined && <span className="field-error">{error}</span>}
        {restriction !== undefined && <RestrictionToggle {...restriction} />}
      </>
    );
  };

  return (
    <section className="location-section location-items-section" aria-label={t.title}>
      <h3 className="location-section-title">
        {t.title}
        {draft !== null && <span className="location-items-count">{draft.items.length}</span>}
      </h3>
      {body()}
    </section>
  );
};
