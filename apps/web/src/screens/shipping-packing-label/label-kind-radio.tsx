import { Radio, RadioGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { DELIVERY_LABEL, PACKING_LABEL, type LabelKind } from './codes';

const t = messages.shippingPackingLabel.kind;

export interface LabelKindRadioProps {
  /** 아직 고르지 않았으면 `null` — 스펙 §5-7 이 종류 이전의 상태를 인정한다. */
  value: LabelKind | null;
  onChange: (kind: LabelKind) => void;
  /** 발행이 진행 중이면 바꾸지 못한다 — 종류가 바뀌면 만들던 기록의 대상이 달라진다. */
  disabled: boolean;
}

/**
 * ① 라벨 종류 — **화면이 하나인 이유가 여기 있다.**
 *
 * 발행 시점이 갈리는 두 라벨(포장은 포장 즉시 · 납품은 OQC 합격 후)을 한 화면에서 다루되,
 * **종류를 먼저 고르고** 대상 목록이 그에 따라 갈린다(스펙 §5-1).
 *
 * ⛔ **대상 유형으로 가르지 않는다.** 2026-09-02 에 「유형 값으로 가른다」로 뒤집혔다 —
 * 대상 유형으로 가르면 `GET /app/printers?documentTypeCode=` 가 거를 값이 하나뿐이라
 * **전 프린터가 후보로 나오고, 납품 라벨이 창고 포장 프린터로 간다**(스펙 §5-2).
 *
 * 가로로 편다 — 세로 예산이 72px 한 줄이라 두 줄로 쌓을 자리가 없다(스펙 §3-1).
 */
export const LabelKindRadio = ({ value, onChange, disabled }: LabelKindRadioProps) => (
  <RadioGroup
    name="shipping-label-kind"
    orientation="horizontal"
    aria-label={t.legend}
    value={value ?? undefined}
    disabled={disabled}
    onChange={(next) => {
      onChange(next as LabelKind);
    }}
    className="pop-slabel-kinds"
  >
    <Radio value={PACKING_LABEL}>
      <span className="pop-slabel-kind-name">{t.packing}</span>
      <span className="pop-slabel-kind-note">{t.packingNote}</span>
    </Radio>
    <Radio value={DELIVERY_LABEL}>
      <span className="pop-slabel-kind-name">{t.delivery}</span>
      <span className="pop-slabel-kind-note">{t.deliveryNote}</span>
    </Radio>
  </RadioGroup>
);
