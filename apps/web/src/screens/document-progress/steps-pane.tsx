import { type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { describeLedgerRef, readLedgerRef } from './ledger-ref';
import type { DocumentProgressStepView } from './types';

const t = messages.documentProgress;

/**
 * `.wide-table`이 표에 주는 최소 폭(`58rem`).
 *
 * 열 폭 예산을 재는 감지기가 이 값을 읽는다 — 숫자를 테스트가 따로 적으면 배치 규범이 바뀔 때
 * 둘이 갈린다. 이 표가 자기 상수를 갖는 이유는 열 구성이 바뀌어 최소 폭을 올려야 할 때
 * 다른 표까지 함께 끌려가면 안 되기 때문이다.
 */
export const STEPS_TABLE_MIN_WIDTH_PX = 928;

/** 계약의 date-time 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 단계 시각 표기(`2026-08-06 09:14`).
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 그 일이 실제로 일어난 곳의
 * 시각이고, 보는 사람의 시간대로 옮기면 같은 문서가 사람마다 다른 시각으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 — 「—」로 바꾸면
 * 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatStepAt = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/**
 * 처리 경과 표의 열 구성 — **네 열**이다.
 *
 * **모든 열이 폭을 지정한다.** 디자인 시스템 `Table`은 `table-layout: fixed`이고 폭을
 * `<colgroup>`에 싣는다 — 고정 배치에서 폭을 지정하지 않은 열은 남는 폭의 잔여분을 받아
 * 선언과 실렌더가 어긋난다(전례 `stock-status/balance-table.tsx`가 브라우저 확인으로 실측한 자리).
 *
 * 열 폭의 도출(자폭 약 **7.5px** · 셀 좌우 여백 **32px**):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 단계 | 176px | **서버가 정하는 코드 문자열**이라 상한이 없다. 머리글이 접히지 않는 하한(2자 15px + 32px)에 코드 몫을 더한 값이고 그보다 긴 코드는 접힌다 — 지어낸 상한으로 「보장한다」고 적지 않는다 |
 * | 시각 | 160px | `YYYY-MM-DD HH:mm` 16자 120px + 여백 32px = 152px → 160 |
 * | 처리자 | 176px | 「사람이 하지 않은 단계」 **12자**(공백 포함) 90px + 여백 32px = 122px. 사람 이름 몫의 여유를 더한다 |
 * | **원장** | **416px** | ⭐ 이 표에서 가장 긴 문면이 서는 칸이다 — 번호와 영업일이 **한 칸에 짝으로** 선다. 최장은 「번호 · 영업일을 받지 못해 …」 38자 285px + 여백 32px = 317px |
 * | **합** | **928px** | 표 하한(928px)과 같다 — 하한 아래로 누르지 않는다 |
 *
 * ⛔ 원장 열의 하한을 감지기가 **리터럴로 적지 않는다** — i18n의 실제 문면에서 계산한다.
 * 문면이 길어지거나 열이 좁아지면 그 자리에서 깨진다.
 */
export const buildStepColumns = (): Column<DocumentProgressStepView>[] => [
  {
    key: 'stepCode',
    header: t.steps.stepCode,
    width: '176px',
    /* 코드를 **그대로** 낸다 — 값 목록이 공통코드 소관이라 화면이 뜻을 붙이면 조용히 틀린다. */
    render: (step) => step.stepCode,
  },
  {
    key: 'occurredAt',
    header: t.steps.occurredAt,
    width: '160px',
    render: (step) => formatStepAt(step.occurredAt),
  },
  {
    key: 'actorName',
    header: t.steps.actor,
    width: '176px',
    /*
     * **이름이 비면 그 사실을 적는다.** 계약이 「사람이 한 것이 아니면 비어 있다」라고 적었다 —
     * ⛔ 내부 번호를 대신 내지 않는다(omf-mes#44). 애초에 계약이 행위자 번호를 주지 않는다.
     */
    render: (step) => step.actorName ?? t.steps.systemActor,
  },
  {
    key: 'ledger',
    header: t.steps.ledger,
    width: '416px',
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
 * 번호와 영업일을 **함께 보이는 것**이 지금 할 수 있는 전부이며, 나중에 진입이 붙을 때 필요한
 * 두 값이 이미 화면에 있다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const StepsPane = ({ steps }: StepsPaneProps) => (
  <>
    <div className="wide-table">
      <Table
        density="compact"
        caption={t.steps.caption}
        columns={buildStepColumns()}
        rows={steps}
        /*
         * **단계 코드만으로는 행을 가릴 수 없다** — 같은 코드가 여러 번 일어날 수 있어 시각을
         * 함께 잇는다. 미지정이면 인덱스가 React key가 되어, 앞 줄이 사라질 때 뒷줄의 DOM 노드가
         * 대신 지워진다.
         *
         * **여기의 문자열은 화면에 나오지 않는다** — React key로만 쓰인다.
         */
        getRowId={(step) => `${step.stepCode}:${step.occurredAt}`}
        empty={
          <EmptyState size="sm" title={t.steps.emptyTitle} description={t.steps.emptyDescription} />
        }
      />
    </div>

    {/* 왜 원장으로 갈 수 없는지, 그리고 왜 영업일이 함께 서는지를 한 줄로 밝힌다. */}
    <p className="field-note">{t.steps.ledgerNote}</p>
  </>
);
