import { Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { LotHoldTable } from './lot-hold-table';
import type { BalanceView, LotDetailView } from './types';

const t = messages.productStockStatus;

/** Lot Status 전이 화면의 주소. 그 화면은 주소로 특정 LOT을 받지 않는다 — 목록에서 다시 고른다. */
const LOT_STATUS_TRANSITION_PATH = '/quality/lot-status-transition';

export interface LotDetailPaneProps {
  /** 고른 **잔액 줄**. 이 구획이 보여야 할 대상(어느 LOT인지)이 여기서 온다. */
  row: BalanceView;
  detail: LotDetailView;
  lotLookup: LookupSource;
}

/**
 * 고른 LOT의 상세 — **아래 구획**이며 `Card` 조합이다(드로어도 창도 아니다).
 *
 * 디자인 시스템에 `Drawer`가 없다(`apps/web/node_modules/@crefle/web-ui/dist/components/`
 * 실측). 창(`Dialog`)으로 대체하면 목록이 가려져 「고르고 다시 목록으로 돌아가는」 이 화면의
 * 반복 조회가 매번 열고 닫는 일이 된다 — W-01-07이 같은 이유로 아래 구획을 골랐다.
 *
 * **`holds[]`만 쓴다.** LOT 속성·수량은 이 구획의 몫이 아니다 — 속성은 고른 잔액 줄에서
 * 이미 이름으로 보이고, 수량은 위 잔액 표에 있다.
 *
 * **조회만 한다.** 등록·수정·보류 해제 수단이 하나도 없다 — 그것은 Lot Status 화면(품질
 * 도메인)의 소관이라 링크로 안내한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LotDetailPane = ({ row, detail, lotLookup }: LotDetailPaneProps) => {
  const lotLabel = row.lotId === null ? t.values.empty : lookupDisplayLabel(lotLookup, row.lotId);

  return (
    <Card bordered>
      <Card.Header>
        <h3>{t.detail.heading(lotLabel)}</h3>
      </Card.Header>
      <Card.Body>
        <LotHoldTable holds={detail.holds} />

        <div className="field-cell">
          <Link to={LOT_STATUS_TRANSITION_PATH}>{t.actions.lotStatusLink}</Link>
        </div>
      </Card.Body>
    </Card>
  );
};
