import { Radio, RadioGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { DELIVERY_LABEL, PACKING_LABEL, type LabelKind } from './codes';

const t = messages.shippingPackingLabel.kind;

export interface LabelKindRadioProps {
  /** 아직 고르지 않았으면 `null` — 스펙 §5-7 이 종류 이전의 상태를 인정한다. */
  value: LabelKind | null;
  /** 고른 것을 다시 누르면 `null` 이 온다 — 종류를 무르는 길이다. */
  onChange: (kind: LabelKind | null) => void;
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
    /*
     * ⚠ **고르지 않은 상태를 `undefined` 로 넘기지 않는다.** `RadioGroup` 은 `value`
     *    가 `undefined` 이면 «비제어»로 돌아서 직전에 고른 값을 스스로 들고 있는다 —
     *    해제해도 점이 그대로 남는다. 어느 것과도 맞지 않는 빈 문자열로 넘겨 제어를
     *    유지한다.
     */
    value={value ?? ''}
    disabled={disabled}
    onChange={(next) => {
      onChange(next as LabelKind);
    }}
    className="pop-slabel-kinds"
  >
    {/*
     * ⭐ **이름과 설명을 한 줄로 잇는다**(설계 §3 —「( ) 포장라벨 — 포장하면 바로 발행」).
     *    설명을 아래로 내리면 고르는 것 하나가 두 줄이 되고, 둘이 나란히 서지 못해 세로로
     *    쌓인다 — ① 구획의 몫은 72px 두 줄뿐이다(§3-1).
     */}
    {/*
     * ⭐ **고른 것을 한 번 더 누르면 해제한다.** 라디오는 스스로 풀리지 않아, 잘못 고르면
     *    다른 것을 고르는 수밖에 없다 — 이 화면은 종류를 고르기 «전» 상태를 인정하므로
     *    (§5-7) 그 자리로 돌아갈 길이 있어야 한다.
     *
     * ⚠ `onClick` 으로 잡는다 — 이미 켜진 라디오를 눌러도 `change` 는 일어나지 않는다.
     *    꺼진 것을 누르면 `change` 가 먼저 값을 바꾸지만, 이 자리의 `value` 는 아직 누르기
     *    «전» 값이라 서로 얽히지 않는다.
     */}
    <Radio
      value={PACKING_LABEL}
      onClick={() => {
        if (value === PACKING_LABEL) onChange(null);
      }}
    >
      <span className="pop-slabel-kind-name">{t.packing}</span>
      <span className="pop-slabel-kind-note">{t.packingNote}</span>
    </Radio>
    <Radio
      value={DELIVERY_LABEL}
      onClick={() => {
        if (value === DELIVERY_LABEL) onChange(null);
      }}
    >
      <span className="pop-slabel-kind-name">{t.delivery}</span>
      <span className="pop-slabel-kind-note">{t.deliveryNote}</span>
    </Radio>
  </RadioGroup>
);
