import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';

type Bom = components['schemas']['Bom'];

const t = messages.itemExtendedAttrs.bom;
const shared = messages.itemExtendedAttrs;

export interface BomListPaneProps {
  boms: Bom[];
  isLoading: boolean;
  loadError: ReactNode;
  /** 확인 창을 연다. **여기서 서버로 보내지 않는다** */
  onRequestSetDefault: (bom: Bom) => void;
}

/**
 * **저장 실패 배너 슬롯이 없다.**
 *
 * 이 페인의 유일한 쓰기는 기본 지정이고 그것은 확인 창 안에서 일어난다 — 실패한 이유는
 * 그 창에 낸다. 여기에 슬롯을 하나 더 두면 창이 열린 채 같은 문구가 둘로 보이고
 * (F1과 같은 실패 모드), 창을 닫으면 늘 비어 있는 자리가 남는다.
 */

/** 값이 없는 칸을 비워 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string): string => (value === '' ? shared.values.empty : value);

/** 자재 명세서 하나를 사람이 읽는 한 줄로. 액션 이름과 확인 창이 같은 형태를 쓴다. */
export const bomName = (bom: Bom): string => t.values.name(bom.bomCode, bom.bomVersion);

/**
 * 탭③ 위 — 자재 명세서 헤더 목록.
 *
 * **이 표에서 바꿀 수 있는 것은 「어느 것이 기본인가」뿐이다.** 헤더 전 필드가 ERP 정본이고
 * 계약에 `PUT /planning/boms/{bomId}`가 아예 없다 — 수정 액션을 둘 자리가 아니다.
 * 추가·삭제도 같다.
 *
 * **기본 지정은 서버 한 번 호출이다**(결정 9). 기존 기본을 화면이 따로 해제하면
 * 그 사이에 **기본이 하나도 없는 순간**이 생긴다 — 계약이 한 트랜잭션으로 처리한다.
 * 그래서 이 페인은 요청을 보내지 않고 확인 창을 열기만 한다.
 *
 * **이미 기본인 줄의 지정 액션을 감추지 않는다.** 감추면 그 줄에만 액션이 없는 이유를
 * 알 수 없다 — 사유가 붙은 비활성으로 둔다(배치 규범 4).
 *
 * **상태 코드를 이름으로 옮기지 않는다.** 값 목록이 확정되지 않아 이름을 지어내면
 * 그 이름으로 읽힌 판단이 남는다(품목유형과 같은 처리).
 */
export const BomListPane = ({
  boms,
  isLoading,
  loadError,
  onRequestSetDefault,
}: BomListPaneProps) => {
  /*
   * 지정 폭의 합은 **672px**(72+112+88+200+200)이라 `.wide-table`의 최소 폭(58rem = 928px)
   * 안에 들어간다 — 「BOM 코드」만 폭을 지정하지 않고 남는 폭을 흡수한다.
   * 값이 길고 접혀도 읽히는 칸이며, 앞선 다섯 화면이 모은 형태와 같다.
   *
   * 「기본 지정」이 200px인 이유는 **사유가 붙는 비활성 액션이 들어가기 때문**이다 —
   * 배치 규범 4-3이 요구하는 「사유 텍스트 폭의 상한」을 이 칸이 준다.
   */
  const columns: Column<Bom>[] = [
    {
      key: 'bomCode',
      header: t.fields.bomCode,
      render: (row) => orEmptyMark(row.bomCode),
    },
    {
      key: 'bomVersion',
      header: t.fields.bomVersion,
      width: '72px',
      align: 'end',
      render: (row) => String(row.bomVersion),
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      width: '112px',
      render: (row) => orEmptyMark(row.statusCode),
    },
    {
      key: 'isDefault',
      header: t.fields.isDefault,
      width: '88px',
      render: (row) =>
        row.isDefault ? (
          <Chip variant="status" status="success" size="sm">
            {t.values.isDefault}
          </Chip>
        ) : (
          shared.values.empty
        ),
    },
    {
      key: 'validPeriod',
      header: t.fields.validPeriod,
      width: '200px',
      render: (row) =>
        t.values.period(orEmptyMark(row.effectiveFrom), orEmptyMark(row.effectiveTo ?? '')),
    },
    {
      key: 'setDefault',
      header: t.fields.setDefault,
      width: '200px',
      render: (row) =>
        row.isDefault ? (
          <DisabledAction
            label={t.dialog.setDefaultConfirm}
            reason={t.actionReasons.alreadyDefault}
          />
        ) : (
          <Button
            variant="outlined"
            size="sm"
            aria-label={t.actions.setDefaultRow(bomName(row))}
            onClick={() => onRequestSetDefault(row)}
          >
            {t.dialog.setDefaultConfirm}
          </Button>
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
          rows={boms}
          getRowId={(row) => String(row.bomId)}
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
      {listSlot()}
    </section>
  );
};
