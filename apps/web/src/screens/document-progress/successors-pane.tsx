import { Button, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { judgeScreenOpen, type ScreenRouteTable } from './screen-routes';
import type { DocumentSuccessorView } from './types';

const t = messages.documentProgress;

/**
 * `.wide-table`이 표에 주는 최소 폭(`58rem`). 이 표가 자기 상수를 갖는 이유는 `steps-pane`과 같다.
 */
export const SUCCESSORS_TABLE_MIN_WIDTH_PX = 928;

/**
 * 후속 목록의 열 구성 — **네 열**이다(유형 · 문서번호 · 수량 · 열기).
 *
 * ⭐ **이 표가 유형 코드로 분기하지 않는다.** 어느 문서가 후속인지는 **서버가 판정해 내려준
 * 배열**이고, 화면은 그 값을 글자로 그릴 뿐이다 — 화면이 유형↔후속 관계표를 만들면 유형이 늘
 * 때마다 조용히 틀린다(공유계약 A-10 보강 · 착수 이슈 §6의 첫째 금지).
 *
 * 열 폭의 도출(자폭 약 **7.5px** · 셀 좌우 여백 **32px** · `sm` 버튼 88px):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 유형 | 344px | **서버가 정하는 코드 문자열**이라 상한이 없다 — 아래 주 |
 * | 문서번호 | 344px | 16자 120px + 여백 32px = 152px가 하한. 같은 이유로 남는 폭을 얹는다 |
 * | 수량 | 152px | 여섯 자리 45px + 여백 32px = 77px. 자릿수 여유 포함. 우측 정렬 |
 * | 열기 | 88px | `sm` 버튼 하나(전례 `gr-table`·`balance-table`의 선택 열과 같은 값) |
 * | **합** | **928px** | 표 하한과 같다 |
 *
 * ⭐ **남는 폭을 두 문자열 열에 얹는다.** 열이 넷뿐이라 하한을 맞추면 폭이 남는데, 그 남는 폭을
 * **길이에 상한이 없는 열**에 주는 것이 사용자에게 이롭다. ⛔ 합을 하한 아래로 누르지 않는
 * 이유는 고정 배치에서 미지정·부족 폭이 잔여분을 받아 **선언과 실렌더가 어긋나기** 때문이다
 * (전례 `stock-status/balance-table.tsx`가 브라우저 확인으로 실측한 자리).
 */
export const buildSuccessorColumns = (
  routes: ScreenRouteTable,
  onOpen: (path: string) => void,
): Column<DocumentSuccessorView>[] => [
  {
    key: 'successorTypeCode',
    header: t.successors.typeCode,
    width: '344px',
    render: (successor) => successor.successorTypeCode,
  },
  {
    key: 'successorNo',
    header: t.successors.documentNo,
    width: '344px',
    render: (successor) => successor.successorNo,
  },
  {
    key: 'qty',
    header: t.successors.qty,
    width: '152px',
    align: 'end',
    /** **서버가 준 수량 그대로다** — 이 문서에서 넘어간 양이며 화면이 다시 세지 않는다. */
    render: (successor) => String(successor.qty),
  },
  {
    key: 'open',
    header: t.successors.open,
    width: '88px',
    /*
     * ⛔ **열 수 없으면 손잡이를 아예 만들지 않는다.** 잠긴 버튼을 두면 사용자가 눌러 보다
     * 말고, 표의 모든 줄에 같은 잠금 사유가 되풀이된다 — 사유는 표 아래 **한 줄**이 맡는다.
     */
    render: (successor) => {
      const state = judgeScreenOpen(successor.screenId ?? '', routes);

      if (state.kind !== 'open') return t.values.empty;

      return (
        <Button
          variant="outlined"
          size="sm"
          /* 접근 이름에 **문서번호**를 넣는다 — 「열기」가 줄마다 되풀이되면 어느 후속인지 모른다. */
          aria-label={t.actions.openSuccessor(successor.successorNo)}
          onClick={() => {
            onOpen(state.path);
          }}
        >
          {t.successors.open}
        </Button>
      );
    },
  },
];

export interface SuccessorsPaneProps {
  successors: DocumentSuccessorView[];
  /** 화면 ID → 주소 표. **인자로 받는다** — 표를 채우면 열기가 살아나는 것을 잴 수 있어야 한다. */
  routes: ScreenRouteTable;
  /** 열 수 있을 때만 불린다. 어디로 가는지는 화면이 정한다 — 부품은 주소를 모른다. */
  onOpen: (path: string) => void;
}

/**
 * 후속 문서 목록.
 *
 * ⭐ **0건이 정상이고, 이 화면에서는 좋은 소식이다** — 후속이 없어야 이 문서를 취소할 수 있다.
 * ⛔ 그래서 경고 톤을 쓰지 않는다. 배너도 경고 변형도 두지 않고, 「없습니다」를 담담히 말한다.
 *
 * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty` 슬롯이 0건을 맡는다 —
 * 바깥에서 먼저 가르면 그 슬롯이 닿을 수 없는 죽은 가지가 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SuccessorsPane = ({ successors, routes, onOpen }: SuccessorsPaneProps) => {
  /*
   * 열 수 없는 후속이 **하나라도** 있으면 사유를 한 줄로 밝힌다. 전건이 열리면 내지 않는다 —
   * 늘 떠 있는 안내는 읽히지 않는다.
   */
  const hasBlockedOpen = successors.some(
    (successor) => judgeScreenOpen(successor.screenId ?? '', routes).kind !== 'open',
  );

  return (
    <>
      <div className="wide-table">
        <Table
          density="compact"
          caption={t.successors.caption}
          columns={buildSuccessorColumns(routes, onOpen)}
          rows={successors}
          /*
           * **번호만으로는 행을 가릴 수 없다** — 유형이 다르면 같은 번호가 다른 문서다.
           * **여기의 문자열은 화면에 나오지 않는다** — React key로만 쓰인다(omf-mes#44).
           */
          getRowId={(successor) =>
            `${successor.successorTypeCode}:${String(successor.successorId)}`
          }
          empty={
            <EmptyState
              size="sm"
              title={t.successors.emptyTitle}
              description={t.successors.emptyDescription}
            />
          }
        />
      </div>

      {hasBlockedOpen && <p className="field-note">{t.successors.openBlocked}</p>}
    </>
  );
};
