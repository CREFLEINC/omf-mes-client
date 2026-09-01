import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { MATERIAL_INPUT_PATH, PRODUCTION_RESULT_PATH, toWorkOrderHref } from './destinations';
import { dateTimeText, hasNoAssignment, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

export interface DetailPaneProps {
  /** 고른 W/O. 아직 고르지 않았으면 `null`. */
  workOrder: WorkOrder | null;
  uomLabel: (uomId: number | undefined) => string;
}

/**
 * 고른 긴급 W/O 의 상세와 **이탈 버튼 둘**.
 *
 * ⭐ **이 화면은 저장하지 않는다.** 투입과 실적은 정상 경로 화면의 일이고, 여기서 하는 것은
 * 「어느 W/O 로 그 화면에 들어가는가」를 정하는 것뿐이다.
 *
 * ⛔ **고르지 않았을 때 버튼을 감추지 않는다** — 무엇을 하면 열리는지를 사유와 함께 보인다
 * (공유계약 G-2·G-3 의 원리: 「할 수 없다」는 감추지 않고 푸는 방법과 함께 적는다).
 */
export const DetailPane = ({ workOrder, uomLabel }: DetailPaneProps) => {
  const t = messages.emergencyWorkOrderField.detail;
  const handoff = messages.emergencyWorkOrderField.handoff;

  return (
    <section className="pane" aria-label={t.title}>
      <h2>{t.title}</h2>

      {workOrder === null ? (
        <div className="banner-slot">
          <AlertBanner variant="info">{t.notSelected}</AlertBanner>
        </div>
      ) : (
        <Card bordered>
          <Card.Header>
            <Chip status="error" size="sm">
              {messages.emergencyWorkOrderField.list.emergencyBadge}
            </Chip>{' '}
            {workOrder.workOrderNo}
          </Card.Header>

          <Card.Body>
            <dl className="pop-detail-list">
              <dt>{t.item}</dt>
              <dd>{itemText(workOrder)}</dd>
              <dt>{t.orderQty}</dt>
              <dd>{`${qtyText(workOrder.orderQty)} ${uomLabel(workOrder.uomId)}`}</dd>
              <dt>{t.releasedAt}</dt>
              <dd>{dateTimeText(workOrder.releasedAt)}</dd>
            </dl>

            {/*
             * ⚠ 배정이 없는 것이 긴급의 «정상» 상태다 — 오류가 아니라 경고로 말한다.
             * 하나라도 배정돼 있으면 세우지 않는다. 늘 서 있으면 아무도 읽지 않는다.
             */}
            {/*
             * ⭐ 통제 우회는 «긴급이면 언제나»다 — 판정은 서버가 유형을 보고 하고 화면은
             *    그 사실을 알린다. 배정 유무와는 다른 축이라 배너를 따로 세운다.
             */}
            <div className="banner-slot">
              <AlertBanner variant="warning">
                {hasNoAssignment(workOrder)
                  ? `${t.noAssignment} ${t.controlBypass}`
                  : t.controlBypass}
              </AlertBanner>
            </div>

            {/* 자재가 부족할 때 갈 곳. 이 화면은 안내만 하고 요청을 만들지 않는다. */}
            <p>{t.shortageGuide}</p>
          </Card.Body>
        </Card>
      )}

      <p>{workOrder === null ? handoff.locked : handoff.lead}</p>

      {workOrder === null ? (
        <>
          {/*
           * 고르지 않은 동안에도 무엇이 있는지는 보인다 — 잠긴 사유는 바로 위 한 곳에서만
           * 말한다. 구획마다 되풀이하면 한쪽만 고쳐질 때 화면이 스스로와 어긋난다.
           */}
          <Button size="2xl" variant="filled" disabled>
            {handoff.materialInput}
          </Button>
          <Button size="2xl" variant="tonal" disabled>
            {handoff.productionResult}
          </Button>
        </>
      ) : (
        <>
          <Link to={toWorkOrderHref(MATERIAL_INPUT_PATH, workOrder.workOrderId)}>
            <Button size="2xl" variant="filled">
              {handoff.materialInput}
            </Button>
          </Link>
          <Link to={toWorkOrderHref(PRODUCTION_RESULT_PATH, workOrder.workOrderId)}>
            <Button size="2xl" variant="tonal">
              {handoff.productionResult}
            </Button>
          </Link>
        </>
      )}
    </section>
  );
};
