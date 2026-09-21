import { SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ItemPickerDialog } from '../../patterns/item-picker';
import type { SelectedItem } from './types';

export interface ItemPickerProps {
  selected: SelectedItem | null;
  onSelect: (item: SelectedItem | null) => void;
}

/**
 * 품목 선택.
 *
 * ⭐ **칸 하나가 곧 고르는 자리다**(사용자 결정 2026-09-21 · `W-01-01`·`W-03-02` 와 같은 모양).
 * 읽기 전용 검색칸을 누르면 공용 창이 열리고, 고른 품목은 그 칸에 값으로 선다 — 「아직 고른
 * 품목이 없습니다」 같은 말을 따로 두지 않는다. 빈 칸과 자리표시 글자가 이미 그 사실이다.
 *
 * ⚠ **Routing 이 있는 품목만 낸다**(`hasRouting` · omf-all-around#43) — 원자재처럼 만들 수
 * 없는 품목을 후보에 세우면 고른 뒤에야 막힌다.
 *
 * ⛔ **가용 재고 열은 끈다.** 이 화면이 묻는 것은 「무엇을 만들까」이지 「지금 얼마나 있나」가
 * 아니다 — 켜 두면 품목마다 재고 요청이 한 번씩 더 나간다.
 */
export const ItemPicker = ({ selected, onSelect }: ItemPickerProps) => {
  const t = messages.emergencyWorkOrder.itemPicker;
  const [isOpen, setOpen] = useState(false);
  const label = selected === null ? '' : `${selected.itemCode} · ${selected.itemName}`;
  const open = (): void => {
    setOpen(true);
  };

  return (
    <section className="pane emergency-work-order-pane" aria-label={t.title}>
      <h2 className="pane-title">
        {t.title}
        <span aria-hidden="true" className="required-mark">
          *
        </span>
      </h2>

      <SearchInput
        label={t.label}
        containerClassName={label === '' ? 'emergency-work-order-required-empty' : undefined}
        value={label}
        readOnly
        title={label === '' ? undefined : label}
        placeholder={t.placeholder}
        aria-haspopup="dialog"
        clearLabel={t.clear}
        onClick={open}
        onSearch={open}
        onChange={() => undefined}
        onClear={() => {
          onSelect(null);
        }}
      />

      {isOpen && (
        <ItemPickerDialog
          multiple={false}
          hasRouting
          showAvailability={false}
          confirmLabel={t.confirm}
          onClose={() => {
            setOpen(false);
          }}
          onConfirm={([item]) => {
            /* 단일 선택이라 한 건이다 — 빈 확인이 들어와도 고른 것을 지우지 않는다. */
            if (item !== undefined) {
              onSelect({
                itemId: item.itemId,
                itemCode: item.itemCode,
                itemName: item.itemName,
                baseUomId: item.baseUomId,
              });
            }

            setOpen(false);
          }}
        />
      )}
    </section>
  );
};
