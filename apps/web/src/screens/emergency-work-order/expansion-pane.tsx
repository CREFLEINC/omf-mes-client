import { AlertBanner, type Column, Select, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ExpansionState } from './expansion';
import type { RoutingOperation } from './types';

export interface ExpansionPaneProps {
  state: ExpansionState;
  /** 지시 수량. 공정마다 같은 수량이 걸린다 — 전개는 나누지 않는다. */
  orderQtyText: string;
  onSelectRouting: (routingId: number) => void;
  selectedRoutingId: number | null;
}

/**
 * 자동 전개 구획.
 *
 * ⛔ **여기 있는 것은 전부 읽는 값이다.** 사람이 고르는 것은 Routing 개정 하나뿐이고, 그것도
 * 계약이 개정을 여럿 내려 주기 때문이지 화면이 만든 선택지가 아니다.
 *
 * ⛔ **막힌 사유를 여기서 말하지 않는다.** 사유는 발행 버튼 옆 한 곳에서만 말한다 — 두 곳에서
 * 말하면 한쪽만 고쳐질 때 화면이 스스로와 어긋난다. 여기서는 **무엇이 펼쳐졌는지**만 보인다.
 */
export const ExpansionPane = ({
  state,
  orderQtyText,
  onSelectRouting,
  selectedRoutingId,
}: ExpansionPaneProps) => {
  const t = messages.emergencyWorkOrder.expansion;

  const columns: Column<RoutingOperation>[] = [
    { key: 'seq', header: t.columns.seq, render: (row) => row.operationSeq },
    { key: 'operation', header: t.columns.operation, render: (row) => row.operationName },
    { key: 'qty', header: t.columns.qty, align: 'end', render: () => orderQtyText },
  ];

  return (
    <section className="pane emergency-work-order-pane" aria-label={t.title}>
      <h2 className="pane-title">{t.title}</h2>

      {state.kind === 'idle' && <p className="emergency-work-order-empty">{t.selectItem}</p>}
      {state.kind === 'loading' && (
        <p className="emergency-work-order-empty" role="status">
          {t.loading}
        </p>
      )}
      {state.kind === 'error' && (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadError}</AlertBanner>
        </div>
      )}

      {state.kind === 'needsRevision' && (
        <>
          {/*
           * ⚠ **여럿일 때만 경고한다.** 하나뿐이면 화면이 골라 주므로 고를 것이 없고, 그때
           * 「직접 고르세요」는 할 일이 없는 사람에게 할 일을 만드는 말이 된다.
           */}
          {state.routings.length > 1 && (
            <div className="banner-slot">
              <AlertBanner variant="warning">
                {t.revisionMultiple(state.routings.length)}
              </AlertBanner>
            </div>
          )}

          <Select
            aria-label={t.revisionLabel}
            placeholder={t.revisionLabel}
            value={selectedRoutingId === null ? null : String(selectedRoutingId)}
            onChange={(value) => {
              onSelectRouting(Number(value));
            }}
            /* 상태를 값 옆에 그대로 보인다 — 지우지 않고 보고 고르게 한다. */
            options={state.routings.map((routing) => ({
              value: String(routing.routingId),
              label: `${routing.routingCode} ${t.revision} ${String(routing.routingVersion)} · ${t.revisionStatus(routing.statusCode)}`,
            }))}
          />

          {/* ⭐ 자재 명세는 자동, 공정 순서는 수동 — 갈리는 이유를 여기서 밝힌다. */}
          <p className="field-note">{t.revisionChoiceReason}</p>
        </>
      )}

      {state.kind === 'ready' && (
        <>
          <dl className="emergency-work-order-expansion-summary">
            <div className="field-cell emergency-work-order-expansion-field">
              <dt className="field-label">{t.bom}</dt>
              <dd>{`${state.bom.bomCode} ${t.revision} ${String(state.bom.bomVersion)}`}</dd>
            </div>
            <div className="field-cell emergency-work-order-expansion-field">
              <dt className="field-label">{t.routing}</dt>
              <dd>{`${state.routing.routingCode} ${t.revision} ${String(state.routing.routingVersion)}`}</dd>
            </div>
          </dl>

          <div className="emergency-work-order-table">
            <Table
              density="compact"
              columns={columns}
              rows={state.operations}
              getRowId={(row) => String(row.routingOperationId)}
              caption={t.operations}
            />
          </div>

          <div className="banner-slot">
            <AlertBanner variant="info">{t.lotNotice}</AlertBanner>
          </div>
        </>
      )}
    </section>
  );
};
