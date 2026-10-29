import { AlertBanner, Button, IconButton, Skeleton } from '@crefle/web-ui';
import type { LocationItem } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { ItemSelect } from '../../patterns/item-select';

const t = messages.warehouseLocation.itemsSection;

/** 고치는 중인 보관 품목 — 품목 무관으로 돌려도 목록은 남겨 둔다(다시 지정 품목만을 고르면 그대로 보인다). */
export interface LocationItemsDraft {
  restricted: boolean;
  items: LocationItem[];
}

/** 서버에 보낼 목록 — 품목 무관이면 빈 목록(제한을 푼다). */
export const draftItemIds = (draft: LocationItemsDraft): number[] =>
  draft.restricted ? draft.items.map((item) => item.itemId) : [];

/** 받은 목록과 견줘 바뀌었는가 — 방식이 바뀌었거나, 지정 품목만에서 품목이 달라졌다. */
export const isItemsDraftChanged = (
  draft: LocationItemsDraft,
  stored: readonly LocationItem[],
): boolean => {
  if (draft.restricted !== stored.length > 0) return true;
  const ids = new Set(draftItemIds(draft));
  return ids.size !== stored.length || stored.some((item) => !ids.has(item.itemId));
};

export interface LocationItemsSectionProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** 받기 전 · 실패하면 null. */
  draft: LocationItemsDraft | null;
  onChange: (draft: LocationItemsDraft) => void;
  /** 칸 아래 오류 — 비었을 때의 검증 · 서버의 itemIds 오류. */
  error?: string | undefined;
  disabled: boolean;
  /** 고를 수 있는 품목 유형 — 창고 유형으로 정한다(`item-scope.ts`). 없으면 전체 품목. */
  itemTypeCodes?: readonly string[] | undefined;
}

/**
 * 위치 수정 창 안의 보관 품목(사용자 지시 2026-10-29) — 품목 무관 · 지정 품목만 둘 중 하나. 지정 품목만이면 품목을
 * 골라 더하고 줄마다 뺀다. 저장은 창의 저장 하나가 맡는다(screen).
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
        {/* DS 에 묶음 단추가 없어 누름 상태(aria-pressed) 단추 둘을 붙여 쓴다. */}
        <div className="location-items-mode" role="group" aria-label={t.title}>
          {[
            { restricted: false, label: t.anyItem },
            { restricted: true, label: t.listedOnly },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              className="location-items-mode-option"
              aria-pressed={draft.restricted === option.restricted}
              disabled={disabled}
              onClick={() => onChange({ ...draft, restricted: option.restricted })}
            >
              {option.label}
            </button>
          ))}
        </div>

        {draft.restricted && (
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
                  ...draft,
                  items: [
                    ...draft.items,
                    { itemId: item.itemId, itemCode: item.itemCode, itemName: item.itemName },
                  ],
                });
              }}
            />
            {/* 비어 있어도 같은 크기로 둔다 — 품목을 더하고 빼도 창이 출렁이지 않게(사용자 지시 2026-10-29). */}
            {
              <ul className="location-items-list" aria-label={t.listedOnly}>
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
                        onChange({
                          ...draft,
                          items: draft.items.filter((row) => row.itemId !== item.itemId),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            }
          </>
        )}
        {error !== undefined && <span className="field-error">{error}</span>}
      </>
    );
  };

  const count = draft?.restricted === true ? draft.items.length : null;

  return (
    <section className="location-section location-items-section" aria-label={t.title}>
      <h3 className="location-section-title">
        {t.title}
        {count !== null && <span className="location-items-count">{count}</span>}
      </h3>
      {body()}
    </section>
  );
};
