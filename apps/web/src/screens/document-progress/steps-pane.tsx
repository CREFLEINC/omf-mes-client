import { type Column, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { BoardTable } from '../../patterns/board-table';
import { describeLedgerRef, readLedgerRef } from './ledger-ref';
import type { DocumentProgressStepView } from './types';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.documentProgress;

/**
 * 단계 시각 표기(`2026-08-06 09:14`).
 *
 * **공장 시각으로 보인다**(`patterns/plant-time` · omf-all-around#20). 보는 사람(실행 환경)의
 * 시간대로 옮기지 않는다 — 서버가 UTC 로 보내므로 글자만 자르면 7시간 이르게 찍힌다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 — 「—」로 바꾸면
 * 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatStepAt = (value: string): string => {
  return formatPlantDateTime(value) ?? value;
};

/**
 * 처리 경과 표의 열 구성 — **네 열**이다.
 *
 * 원장 칸은 번호와 영업일이 **한 칸에 짝으로** 나와 가장 길다 — 남는 폭을 다 받는다.
 */
export const buildStepColumns = (): Column<DocumentProgressStepView>[] => [
  {
    key: 'stepCode',
    header: t.steps.stepCode,
    width: '136px',
    /* 코드를 **그대로** 낸다 — 값 목록이 공통코드 소관이라 화면이 뜻을 붙이면 조용히 틀린다. */
    render: (step) => step.stepCode,
  },
  {
    key: 'occurredAt',
    header: t.steps.occurredAt,
    width: '152px',
    render: (step) => formatStepAt(step.occurredAt),
  },
  {
    key: 'actorName',
    header: t.steps.actor,
    width: '152px',
    /*
     * **이름이 비면 그 사실을 적는다.** 계약이 「사람이 한 것이 아니면 비어 있다」라고 적었다 —
     * ⛔ 내부 번호를 대신 내지 않는다(omf-mes#44). 애초에 계약이 행위자 번호를 주지 않는다.
     */
    render: (step) => step.actorName ?? t.steps.systemActor,
  },
  {
    key: 'ledger',
    header: t.steps.ledger,
    /*
     * ⭐ **번호와 영업일이 둘 다 있을 때만 짝으로 낸다.** 판정은 `ledger-ref.ts` 한 곳이 한다 —
     * 여기서 다시 판정하면 두 자리가 갈린다.
     */
    render: (step) => describeLedgerRef(readLedgerRef(step)),
  },
];

export interface StepsPaneProps {
  steps: DocumentProgressStepView[];
}

/**
 * 처리 경과 — **응답 차례 그대로** 그린다.
 *
 * 계약이 시간순으로 내린다고 적었고, 화면이 다시 세우면 같은 시각의 두 단계 차례가 서버와
 * 갈린다. **화면 안 정렬을 열지 않는 이유**이기도 하다.
 *
 * ⛔ **원장으로 가는 진입을 만들지 않는다.** 원장 조회 화면이 이 저장소에 없다(라우트 실측).
 * 번호와 영업일을 **함께 보이는 것**이 지금 할 수 있는 전부다. 그 사실을 적던 안내 줄은 걷었다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const StepsPane = ({ steps }: StepsPaneProps) => (
  <section className="board-frame-sub" aria-label={t.steps.caption}>
    <h2 className="pane-title">{t.steps.caption}</h2>
    <BoardTable
      label={t.steps.caption}
      widthKey="omf-mes:document-progress:columns:steps"
      minWidth="40rem"
      columns={buildStepColumns()}
      rows={steps}
      /*
       * **단계 코드만으로는 행을 가릴 수 없다** — 같은 코드가 여러 번 일어날 수 있어 시각을 함께 잇는다.
       * 여기의 문자열은 화면에 나오지 않는다 — React key로만 쓰인다.
       */
      getRowId={(step) => `${step.stepCode}:${step.occurredAt}`}
      empty={<EmptyState size="sm" title={t.steps.emptyTitle} />}
    />
  </section>
);
