import { Chip, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import {
  componentRowName,
  extensionLabels,
  processText,
  requiredQtyText,
  scrapRateText,
} from './bom-component-format';
import { lookupLabel } from './options';
import type { LookupEntry } from './types';

type BomComponent = components['schemas']['BomComponent'];

const t = messages.itemExtendedAttrs.component;
const shared = messages.itemExtendedAttrs;

export interface BomComponentPaneProps {
  components: BomComponent[];
  isLoading: boolean;
  /** 구성품 번호 → 이름. 행마다 상세를 부른 결과다(결정 12) */
  itemNameEntries: LookupEntry[];
  isItemNameLoading: boolean;
  /** 단위 번호 → 이름 */
  uomEntries: LookupEntry[];
  isUomLoading: boolean;
  /** 등록 공정(Rev 평탄화) · 실사용 공정 */
  routingOperationEntries: LookupEntry[];
  isRoutingOperationLoading: boolean;
  processEntries: LookupEntry[];
  isProcessLoading: boolean;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  loadError: ReactNode;
  /** 확장 열 편집 창을 연다. 아직 소비처가 없으면 `undefined` */
  onEdit?: (bomComponentId: number) => void;
}

/**
 * 탭③ 아래 — 구성품 표.
 *
 * **한 행에 원본 열 여섯과 확장 열 넷이 섞여 있고, 그 경계를 서버가 강제하지 않는다.**
 * 이 화면 전체가 걸린 함정이 여기서 가장 좁게 나타난다 —
 * 원본 열(순서·구성품·소요량·단위·스크랩률·필수)은 **값 표기만** 두고,
 * 편집으로 들어가는 길은 확장 열 넷을 담는 창 하나뿐이다.
 *
 * **추가·삭제 액션을 두지 않는다.** 계약에 `POST …/components`도 `DELETE`도 없다 —
 * 구성품 목록은 외부 정본이다. 그래서 편집 열에 아이콘이 하나뿐이다.
 *
 * **스크랩률에 100을 곱하지 않는다**(A-8 · C16). 곱하면 사용자가 넣지 않은 값이 보인다.
 *
 * **확정 상태를 선제 판정하지 않는다**(결정 10). `Bom.statusCode`의 값 목록이 확정되지 않아
 * 화면이 「작성중」을 판정할 문자열을 갖고 있지 않다 — 서버가 400 `STATE_LOCKED`로 막는다.
 */
export const BomComponentPane = ({
  components: rows,
  isLoading,
  itemNameEntries,
  isItemNameLoading,
  uomEntries,
  isUomLoading,
  routingOperationEntries,
  isRoutingOperationLoading,
  processEntries,
  isProcessLoading,
  optionsNotice,
  loadError,
  onEdit,
}: BomComponentPaneProps) => {
  const itemLabel = (itemId: number): string =>
    lookupLabel(itemNameEntries, itemId, isItemNameLoading);

  /*
   * 지정 폭의 합은 **724px**이고 「구성품」이 남는 폭을 흡수한다 — 그 열의 하한을 200px로
   * 잡으면 합이 924px이라 `.wide-table`의 최소 폭(58rem = 928px) 안에 들어간다.
   * 앞선 화면(W-06-01)이 쓴 방법과 같다: 흡수 열에도 예산을 주고 그 합으로 하한을 맞춘다.
   *
   * 계약의 `BomComponent`에는 필드가 열둘이라 그대로 펴면 최소 폭을 넘긴다.
   * **열을 줄이는 것이 먼저다** — 소요량과 단위를 한 칸에, 등록·실사용 공정을 한 칸에,
   * 확장 표시 둘을 한 칸에 담아 여덟 열로 맞췄다.
   */
  const columns: Column<BomComponent>[] = [
    {
      key: 'sequenceNo',
      header: t.fields.sequence,
      width: '64px',
      align: 'end',
      /* ERP 원본 값이다 — 계약이 이 값을 감추라고 하지 않았다(Routing 공정 순서와 다른 자리). */
      render: (row) => String(row.sequenceNo),
    },
    {
      key: 'componentItemId',
      header: t.fields.componentItem,
      render: (row) => itemLabel(row.componentItemId),
    },
    {
      key: 'requiredQty',
      header: t.fields.requiredQty,
      width: '152px',
      align: 'end',
      render: (row) =>
        requiredQtyText(row.requiredQty, lookupLabel(uomEntries, row.uomId, isUomLoading)),
    },
    {
      key: 'scrapRate',
      header: t.fields.scrapRate,
      width: '112px',
      align: 'end',
      /* **비율 그대로다.** 0.05는 「0.05」이지 「5%」가 아니다(A-8). */
      render: (row) => scrapRateText(row.scrapRate),
    },
    {
      key: 'isMandatory',
      header: t.fields.isMandatory,
      width: '72px',
      render: (row) => (row.isMandatory ? t.values.mandatory : t.values.optional),
    },
    {
      key: 'process',
      header: t.fields.process,
      width: '140px',
      render: (row) =>
        processText(
          lookupLabel(routingOperationEntries, row.routingOperationId, isRoutingOperationLoading),
          lookupLabel(processEntries, row.actualUseProcessId, isProcessLoading),
        ),
    },
    {
      key: 'extensions',
      header: t.fields.extensions,
      width: '120px',
      render: (row) => {
        const labels = extensionLabels(row);

        if (labels.length === 0) return shared.values.empty;

        return labels.map((label) => (
          <Chip key={label} variant="status" status="info" size="sm">
            {label}
          </Chip>
        ));
      },
    },
    {
      key: 'edit',
      header: t.fields.edit,
      /* 아이콘 버튼 하나뿐이다 — 계약에 구성품 추가·삭제가 없어 삭제 아이콘을 둘 자리가 없다. */
      width: '64px',
      render: (row) =>
        onEdit === undefined ? null : (
          <IconButton
            icon="edit"
            size="sm"
            aria-label={t.actions.editRow(
              componentRowName(row.sequenceNo, itemLabel(row.componentItemId)),
            )}
            onClick={() => onEdit(row.bomComponentId)}
          />
        ),
    },
  ];

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.list}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.bomComponentId)}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noneTitle}
              description={t.empty.noneDescription}
            />
          }
        />
      </div>
    );
  };

  return (
    <section className="pane" aria-label={t.paneTitle}>
      {optionsNotice}
      {listSlot()}
    </section>
  );
};
