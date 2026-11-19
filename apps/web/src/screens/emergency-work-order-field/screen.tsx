import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  PuActionBar,
  PuButton,
  PuCols,
  PuScreen,
  PuSection,
  useFitCount,
} from '../../patterns/pop-uniform';
import { MATERIAL_INPUT_PATH, PRODUCTION_RESULT_PATH, toWorkOrderHref } from './destinations';
import { DetailPane } from './detail-pane';
import { useEmergencyWorkOrders } from './queries';
import type { WorkOrder } from './types';
import { useUomLookup } from './uom-lookup';
import { WorkOrderList } from './work-order-list';
import { EMERGENCY_WORK_ORDER_TYPE_CODE, isEmergencyTypeCodeKnown } from './work-order-type';

import './uniform.css';

export interface EmergencyWorkOrderFieldScreenProps {
  /**
   * 긴급을 뜻하는 유형 코드. 화면은 기본값으로 상수를 쓴다.
   *
   * ⚠ **값이 정해진 뒤에도 밖에서 받는 자리를 남겨 둔다** — 빈 값이 흘러들었을 때 조회가
   * 열리지 않는지를 감지기가 확인할 수 있어야 한다. 상수만 읽으면 그 닫힌 쪽을 확인할 길이 없다.
   */
  typeCode?: string;
}

/**
 * `P-02-12` 긴급 W/O 현장 투입·실적.
 *
 * ⭐ **진입점이다.** 긴급 W/O 목록을 보이고 정상 경로 화면(자재 투입 `P-02-03` · 실적 등록
 * `P-02-04`)으로 보낸다 — 긴급이라고 투입·실적 화면을 따로 두지 않는 것이 설계 확정이다.
 *
 * ⛔ **이 화면에는 저장 액션이 없다.** 발행은 관리웹(`W-02-07`)이고 투입·실적은 넘어간
 * 화면의 일이다.
 */
export const EmergencyWorkOrderFieldScreen = ({
  typeCode = EMERGENCY_WORK_ORDER_TYPE_CODE,
}: EmergencyWorkOrderFieldScreenProps) => {
  const t = messages.emergencyWorkOrderField;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [listFolded, setListFolded] = useState(false);
  const navigate = useNavigate();
  /* 표제는 셸 탭이 보인다 — 본문의 이름으로만 남긴다(이름 없는 랜드마크로 두지 않는다). */
  const titleId = useId();
  /* 한 쪽 건수 = 목록 구획 높이에 들어가는 줄 수(POP 통일 시안). 조건·정렬은 그대로다. */
  const listRef = useRef<HTMLDivElement>(null);
  const fitSize = useFitCount(listRef, { fallback: 4 });

  /*
   * ⛔ **「묻지 않았다」를 「없다」로 흘려보내지 않는다.** 조회를 여는 조건을 화면이 알아야
   *    목록 구획이 빈 값을 무엇으로 말할지 가를 수 있다 — `isPending` 은 «꺼 둔» 조회에
   *    대해 거짓이라 그것만으로는 두 상태가 구별되지 않는다.
   */
  const isAsked = isEmergencyTypeCodeKnown(typeCode);
  const [listPage, setListPage] = useState(1);
  const list = useEmergencyWorkOrders(typeCode, listPage, fitSize);
  /* 한 쪽 건수가 바뀌면 쪽 경계가 달라진다 — 첫 쪽부터 다시 본다. */
  useEffect(() => {
    setListPage(1);
  }, [fitSize]);
  const uoms = useUomLookup(t.detail.unknown);

  const workOrders = list.data?.items;
  /*
   * 고른 것을 «지금 목록에서» 다시 찾는다 — 줄을 복사해 들고 있으면 새로고침 뒤 사라진
   * W/O 의 상세가 화면에 남아, 없는 지시로 현장 화면에 들어가게 된다.
   */
  const selected =
    (workOrders ?? []).find((workOrder) => workOrder.workOrderId === selectedId) ?? null;

  const pageMeta = list.data?.page;
  const pages =
    pageMeta === undefined
      ? 1
      : Math.max(1, Math.ceil(pageMeta.total / Math.max(1, pageMeta.size)));
  const listFold = { label: t.list.title, folded: listFolded, onChange: setListFolded };

  return (
    <PuScreen
      className="ew-screen"
      labelledBy={titleId}
      actionBar={
        <PuActionBar label={t.title}>
          {/* 고른 작업지시를 들고 정상 경로 화면으로 간다 — 긴급이라고 화면을 따로 두지 않는다. */}
          <PuButton
            disabled={selected === null}
            onClick={() => {
              if (selected !== null) {
                void navigate(toWorkOrderHref(MATERIAL_INPUT_PATH, selected.workOrderId));
              }
            }}
          >
            {t.handoff.materialInput}
          </PuButton>
          <PuButton
            variant="primary"
            className="ew-primary"
            disabled={selected === null}
            onClick={() => {
              if (selected !== null) {
                void navigate(toWorkOrderHref(PRODUCTION_RESULT_PATH, selected.workOrderId));
              }
            }}
          >
            {t.handoff.productionResult}
          </PuButton>
        </PuActionBar>
      }
    >
      <h1 id={titleId} className="visually-hidden">
        {t.title}
      </h1>
      <PuCols variant="list">
        {listFolded ? (
          <PuSection fold={listFold} />
        ) : (
          <WorkOrderList
            workOrders={workOrders}
            isAsked={isAsked}
            isLoading={isAsked && list.isPending}
            total={pageMeta?.total}
            page={pageMeta?.page ?? listPage}
            pages={pages}
            onPageChange={(page) => {
              /* 쪽을 넘기면 고른 것을 놓는다 — 다른 쪽의 지시가 상세에 남으면 화면이 어긋난다. */
              setSelectedId(null);
              setListPage(page);
            }}
            isError={list.isError}
            selectedId={selected?.workOrderId ?? null}
            uomLabel={(uomId) => uoms.labelOf(uomId)}
            /* 고른 줄을 다시 누르면 해제한다(`null`) — 정본 목록이 그렇게 동작한다. */
            onSelect={(workOrder: WorkOrder | null) => {
              setSelectedId(workOrder?.workOrderId ?? null);
            }}
            listRef={listRef}
            fold={listFold}
          />
        )}

        <DetailPane workOrder={selected} uomLabel={(uomId) => uoms.labelOf(uomId)} />
      </PuCols>
    </PuScreen>
  );
};
