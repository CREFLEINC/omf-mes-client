import { Button, type Column, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { BoardTable } from '../../patterns/board-table';
import { documentTypeName } from './document-types';
import { judgeScreenOpen, type ScreenRouteTable } from './screen-routes';
import type { DocumentSuccessorView } from './types';

const t = messages.documentProgress;

/**
 * 후속 목록의 열 구성 — 유형 · 문서번호 · 수량, 그리고 열 수 있는 후속이 있으면 열기.
 *
 * ⭐ **이 표가 유형 코드로 분기하지 않는다.** 어느 문서가 후속인지는 **서버가 판정해 내려준
 * 배열**이고, 화면은 그 값을 글자로 그릴 뿐이다(공유계약 A-10 보강 · 착수 이슈 §6의 첫째 금지).
 *
 * ⭐ **열기 열은 열 수 있는 후속이 있을 때만 둔다**(사용자 지시 2026-11-19 — 구현되지 않은 기능은 걷는다 ·
 * C-4). 화면 ID → 주소 표가 비어 있어 지금은 열이 없다. 열 수 없는 사유를 적던 줄도 걷었다.
 */
export const buildSuccessorColumns = (
  routes: ScreenRouteTable,
  onOpen: (path: string) => void,
  successors: readonly DocumentSuccessorView[] = [],
): Column<DocumentSuccessorView>[] => {
  const canOpenAny = successors.some(
    (successor) => judgeScreenOpen(successor.screenId ?? '', routes).kind === 'open',
  );
  const columns: Column<DocumentSuccessorView>[] = [
    {
      key: 'successorTypeCode',
      header: t.successors.typeCode,
      width: '144px',
      render: (successor) => documentTypeName(successor.successorTypeCode),
    },
    {
      key: 'successorNo',
      header: t.successors.documentNo,
      render: (successor) => successor.successorNo,
    },
    {
      key: 'qty',
      header: t.successors.qty,
      width: '120px',
      align: 'end',
      /** **서버가 준 수량 그대로다** — 이 문서에서 넘어간 양이며 화면이 다시 세지 않는다. */
      render: (successor) => String(successor.qty),
    },
  ];

  return canOpenAny ? [...columns, openColumn(routes, onOpen)] : columns;
};

/** 열기 열 — 열 수 있는 후속이 하나라도 있을 때만 둔다. 열 수 없는 줄은 칸을 비운다. */
const openColumn = (
  routes: ScreenRouteTable,
  onOpen: (path: string) => void,
): Column<DocumentSuccessorView> => ({
  key: 'open',
  header: t.successors.open,
  width: '96px',
  render: (successor) => {
    const state = judgeScreenOpen(successor.screenId ?? '', routes);

    if (state.kind !== 'open') return null;

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
});

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
 * ⛔ 그래서 경고 톤을 쓰지 않는다. 「없습니다」를 담담히 말한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SuccessorsPane = ({ successors, routes, onOpen }: SuccessorsPaneProps) => (
  <section className="board-frame-sub" aria-label={t.successors.caption}>
    <h2 className="pane-title">{t.successors.caption}</h2>
    <BoardTable
      label={t.successors.caption}
      widthKey="omf-mes:document-progress:columns:successors"
      minWidth="32rem"
      columns={buildSuccessorColumns(routes, onOpen, successors)}
      rows={successors}
      /*
       * **번호만으로는 행을 가릴 수 없다** — 유형이 다르면 같은 번호가 다른 문서다.
       * 여기의 문자열은 화면에 나오지 않는다 — React key로만 쓰인다(omf-mes#44).
       */
      getRowId={(successor) => `${successor.successorTypeCode}:${String(successor.successorId)}`}
      empty={<EmptyState size="sm" title={t.successors.emptyTitle} />}
    />
  </section>
);
