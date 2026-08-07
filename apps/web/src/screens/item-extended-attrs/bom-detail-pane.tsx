import { AlertBanner } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { requiredQtyText } from './bom-component-format';
import { lookupLabel } from './options';
import type { LookupEntry } from './types';
import { ValueField } from './value-field';

type Bom = components['schemas']['Bom'];

const t = messages.itemExtendedAttrs.bom;
const shared = messages.itemExtendedAttrs;

export interface BomDetailPaneProps {
  bom: Bom;
  /** 단위 번호 → 이름. 번호를 화면에 그대로 내지 않는다 */
  uomEntries: LookupEntry[];
  isUomLoading: boolean;
}

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string): string => (value === '' ? shared.values.empty : value);

/**
 * 탭③ 중단 — 자재 명세서 헤더. **값 표기만 있다**(결정 1 · C03).
 *
 * 품목 원본 구획과 **같은 자리를 두 번째로 되풀이한다.** 계약이 「ERP 정본 — 전 필드 읽기
 * 전용」이라 적었고 `PUT /planning/boms/{bomId}`가 아예 없다 — 잠근 입력칸을 두면
 * 「언젠가 열린다」는 뜻이 되는데 그 경로가 없다.
 *
 * **`isDefault`도 여기서 바꾸지 않는다.** 그것만은 바꿀 수 있으나 `:set-default` 전용이고
 * 그 액션은 위 목록의 줄마다 있다 — 같은 조작을 두 자리에 두면 어느 것이 정본인지 흐려진다.
 *
 * **상태 코드를 이름으로 옮기지 않는다.** 값 목록이 확정되지 않아 이름을 지어내면
 * 그 이름으로 읽힌 판단이 남는다(품목유형과 같은 처리).
 *
 * 안내는 품목 원본 구획과 **같은 공통 문구**를 쓴다 — 이 화면 전용 문구를 만들지 않는다.
 */
export const BomDetailPane = ({ bom, uomEntries, isUomLoading }: BomDetailPaneProps) => (
  <section className="pane" aria-label={t.detailPaneTitle}>
    <div className="banner-slot">
      <AlertBanner variant="info">{messages.editability.receivedFromErp(null)}</AlertBanner>
    </div>

    <div className="form-grid">
      <ValueField label={t.fields.bomCode} value={orEmptyMark(bom.bomCode)} />
      <ValueField label={t.fields.bomVersion} value={t.values.revision(bom.bomVersion)} />
      <ValueField label={t.fields.status} value={orEmptyMark(bom.statusCode)} />
      <ValueField
        label={t.fields.isDefault}
        value={bom.isDefault ? t.values.isDefault : shared.values.empty}
      />
      <ValueField
        label={t.fields.validPeriod}
        value={t.values.period(orEmptyMark(bom.effectiveFrom), orEmptyMark(bom.effectiveTo ?? ''))}
      />
      {/* 수량과 단위는 따로 읽히지 않는다 — 구성품 표의 소요량과 같은 형태로 담는다. */}
      <ValueField
        label={t.fields.baseQty}
        value={requiredQtyText(bom.baseQty, lookupLabel(uomEntries, bom.baseUomId, isUomLoading))}
      />
    </div>
  </section>
);
