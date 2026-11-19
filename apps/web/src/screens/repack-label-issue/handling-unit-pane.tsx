import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toLookupDisplayState, type LookupSource } from '../../patterns/lookup-display';
import { PuBand, PuIcon, PuNote, type PuIconName } from '../../patterns/pop-uniform';
import { localDateTimeText } from './formatting';
import type { PendingRepackRow } from './queries';
import type { HandlingUnit, PackingContentRow } from './types';

const t = messages.repackLabelIssue.handlingUnit;
const tp = messages.repackLabelIssue.pending;

export interface HandlingUnitPaneProps {
  handlingUnit: HandlingUnit;
  /** 고른 발행 대기 줄 — 구분 · 원 포장 · 확정 시각. 발행 뒤 목록에서 빠져도 고를 때의 값을 쓴다. */
  row: PendingRepackRow | null;
  rows: readonly PackingContentRow[];
  /** 이름 조회가 실패했다 — 빈 칸의 사유를 말한다 */
  namesFailed: boolean;
  /** 포장 유형의 표시명. 칸에 코드가 그대로 서지 않게 한다(#1045). */
  types: LookupSource;
}

/**
 * 유형 칸에 세울 글자 — **코드가 아니라 표시명이다**(#1045).
 *
 * ⛔ 이름을 지어내지 않는다. 아직 받는 중인 것과 못 받은 것, 목록에 없는 것을 각각 다르게
 * 말한다 — 셋을 뭉치면 「이름이 없다」로 해 두었다가 이름으로 바뀌는 칸이 된다.
 */
export const typeText = (types: LookupSource, typeCode: string): string => {
  const state = toLookupDisplayState(types, typeCode);

  switch (state.kind) {
    case 'named':
      return state.label;
    case 'loading':
      return t.typeLoading;
    case 'failed':
      return t.typeFailed;
    case 'empty':
      return t.unknownValue;
    case 'unknown':
      return t.typeUnknown(typeCode);
  }
};

const withIcon = (icon: PuIconName, label: string): ReactNode => (
  <>
    <PuIcon name={icon} />
    {label}
  </>
);

/** 내용물 한 줄에 보이는 줄 수 — 넘치면 「외 N건」. */
const SHOWN_CONTENTS = 2;

const contentText = (row: PackingContentRow): string =>
  `${row.lotNo ?? t.unknownValue} · ${row.itemCode ?? t.unknownValue} · ${String(row.qty)} ${row.uomCode ?? t.unknownValue}`;

/**
 * 《대상 포장》 위쪽 — 정보 띠(새 포장 번호 · 구분 · 원 포장 · 유형 · 확정 시각)와 포장 내용물 한 줄.
 *
 * ⭐ **LOT 이 여럿이어도 라벨은 한 장이다**(스펙 §4-B — 대상은 포장 단위이고 `lot_id` 는 비운다).
 *    그래서 혼적을 경고로 세우지 않고 내용물을 사실로만 적는다.
 */
export const HandlingUnitPane = ({
  handlingUnit,
  row,
  rows,
  namesFailed,
  types,
}: HandlingUnitPaneProps) => {
  const shown = rows.slice(0, SHOWN_CONTENTS);
  const more = rows.length - shown.length;

  return (
    <>
      <div className="rpk-band">
        <PuBand
          label={t.bandLabel}
          items={[
            {
              label: withIcon('box', t.newNoLabel),
              value: <span className="pu-mono">{handlingUnit.handlingUnitNo}</span>,
            },
            {
              label: withIcon('swap', t.repackTypeLabel),
              value:
                row?.repackTypeCode === null || row === null
                  ? t.unknownValue
                  : tp.repackType(row.repackTypeCode),
            },
            {
              label: withIcon('list', t.sourceLabel),
              value: (
                <span className="pu-mono">
                  {row === null || row.sourceNos.length === 0
                    ? t.unknownValue
                    : row.sourceNos.join(' + ')}
                </span>
              ),
            },
            {
              label: withIcon('file', t.typeLabel),
              value: typeText(types, handlingUnit.handlingUnitTypeCode),
            },
            {
              label: withIcon('clock', t.occurredLabel),
              value: localDateTimeText(row?.occurredAt ?? null, t.unknownValue),
            },
          ]}
        />
      </div>

      {namesFailed && <PuNote tone="warn">{t.namesFailed}</PuNote>}

      <div className="rpk-contents" title={rows.map(contentText).join('\n')}>
        <span className="rpk-sec">{t.contentsLabel}</span>
        {rows.length === 0 ? (
          <span>{t.empty}</span>
        ) : (
          <>
            {shown.map((content) => (
              <span key={content.handlingUnitContentId}>
                <span className="pu-mono">{content.lotNo ?? t.unknownValue}</span> ·{' '}
                {content.itemCode ?? t.unknownValue} ·{' '}
                <b>
                  {String(content.qty)} {content.uomCode ?? t.unknownValue}
                </b>
              </span>
            ))}
            {more > 0 && <span>{t.moreContents(more)}</span>}
          </>
        )}
      </div>
    </>
  );
};
