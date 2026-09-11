import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { localDateTimeText } from './formatting';
import type { PendingRepackRow } from './queries';

const t = messages.repackLabelIssue.pending;

export interface PendingPaneProps {
  rows: readonly PendingRepackRow[];
  selectedId: number | null;
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  onSelect: (handlingUnitId: number) => void;
  onRetry: () => void;
}

/**
 * ① 발행 대기 — **재구성 사건 목록이다**(스펙 §3 ① 도면 · 사용자 지적 2026-09-11).
 *
 * ⛔ **[ 선택 ] 단추 열을 두지 않는다.** 도면에 그 열이 없고, POP 목록의 정본은 「줄을 눌러
 *    고른다」다(`P-02-01`·`P-02-12`가 같은 형태다). 단추 열을 두면 장갑 낀 손이 겨냥할 자리가
 *    줄 전체가 아니라 오른쪽 끝 한 칸으로 좁아진다.
 */
export const PendingPane = ({
  rows,
  selectedId,
  isLoading,
  isError,
  disabled,
  onSelect,
  onRetry,
}: PendingPaneProps) => {
  const columns: Column<PendingRepackRow>[] = [
    {
      key: 'source',
      header: t.sourceColumn,
      /* 값은 열 가운데에 선다 — 다른 POP 목록과 같다(사용자 지시 2026-09-07 · 2026-09-11). */
      align: 'center',
      /*
       * ⚠ **폭을 비율로 나눈다**(사용자 지시 2026-09-11). 폭을 글자에 맡기면 첫 열이 남는
       *   자리를 통째로 먹어(실측 751px) 나머지 넷이 오른쪽 끝에 몰려 붙는다. 합병은 번호
       *   둘이 이어 붙으므로 첫 열이 가장 넓되, 혼자 절반을 넘기지는 않는다.
       */
      width: '34%',
      /*
       * ⭐ **조작은 첫 칸의 단추 하나가 갖는다**(POP 목록 정본 · `P-02-12` 와 같은 형태).
       *    칸마다 단추를 두면 한 줄에 탭 정지가 여럿 생기고 읽어 주는 이름도 여럿이 된다.
       *
       * 합병은 원 포장이 여럿이다 — 도면이 한 칸 안에서 잇는다(`CTN-…-0088+89`).
       */
      render: (row) => {
        const selected = row.handlingUnitId === selectedId;
        const sourceText =
          row.sourceNos.length === 0 ? t.unknown : row.sourceNos.join(t.sourceJoin);

        return (
          <button
            type="button"
            className={`pop-row-select${selected ? ' pop-row-select-on' : ''}`}
            disabled={disabled}
            aria-pressed={selected}
            /*
             * ⚠ **읽어 주는 이름은 «보이는 글자»로 시작한다**(리뷰 지적 2026-09-11 · WCAG
             *   2.5.3). 새 포장 번호만 읽어 주면 화면에는 원 포장이 서 있는데 귀에는 다른
             *   번호가 들려, 목소리로 조작하는 사용자가 누를 것을 가리킬 수 없다.
             */
            aria-label={t.selectRow(sourceText, row.handlingUnitNo)}
            onClick={() => onSelect(row.handlingUnitId)}
          >
            <span>{sourceText}</span>
          </button>
        );
      },
    },
    {
      key: 'repackType',
      header: t.typeColumn,
      align: 'center',
      width: '12%',
      /*
       * ⛔ **포장 유형(박스·팔레트)이 아니다.** 도면의 이 열은 «재구성» 유형(분할·합병)이고,
       *    한때 포장 유형 코드(`BOX`)가 그대로 서 있었다 — 다른 축의 값이었다.
       */
      render: (row) => (row.repackTypeCode === null ? t.unknown : t.repackType(row.repackTypeCode)),
    },
    {
      key: 'newCount',
      header: t.newColumn,
      align: 'center',
      width: '12%',
      render: (row) => t.newCount(row.newCount),
    },
    {
      key: 'remainder',
      header: t.remainderColumn,
      align: 'center',
      /* 잔량은 포장 번호 한 개가 통째로 들어간다 — 접히지 않을 만큼 준다. */
      width: '24%',
      /* 분할은 원 번호가 잔량으로 남고, 합병은 남지 않는다 — 둘을 가르는 칸이다. */
      render: (row) => row.remainderNo ?? t.noRemainder,
    },
    {
      key: 'occurredAt',
      header: t.occurredColumn,
      align: 'center',
      width: '18%',
      render: (row) => localDateTimeText(row.occurredAt, t.unknown),
    },
  ];

  if (isError) {
    return (
      <div className="pop-repack-pending-state" role="alert">
        <p>{t.loadFailed}</p>
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      </div>
    );
  }

  return (
    /*
     * 줄의 어느 칸을 눌러도 그 줄을 고른다 — POP 목록 정본이다.
     *
     * 디자인 시스템의 `Table` 은 줄 클릭을 받지 않으므로, 눌린 자리에서 «위로» 줄을 찾아
     * 그 줄이 들고 있는 식별자를 읽는다.
     */
    <div
      role="presentation"
      className="pop-repack-pending-table pop-row-target"
      onClick={(event) => {
        const from = event.target as HTMLElement;

        // 단추를 직접 눌렀으면 그쪽이 이미 처리한다 — 여기서 또 누르면 두 번 뒤집힌다.
        if (from.closest('.pop-row-select') !== null) return;

        from.closest('tr')?.querySelector<HTMLButtonElement>('.pop-row-select')?.click();
      }}
    >
      <Table
        rows={[...rows]}
        columns={columns}
        getRowId={(row) => String(row.handlingUnitId)}
        density="compact"
        /*
         * ⛔ **보이는 이름표를 달지 않는다**(사용자 지시 2026-09-11). 표 위 가운데에 서던
         *    「라벨을 아직 발행하지 않은 신규 포장」이 구획 표제 「발행 대기」와 같은 말을
         *    두 번 하고, 가운데 정렬이라 표의 머리글처럼 읽혔다.
         *
         * ⚠ 읽어 주는 이름은 남긴다 — 표가 이름 없이 서면 화면을 듣는 사용자에게는 무엇을
         *   담은 표인지 알 길이 없다.
         */
        aria-label={t.caption}
        empty={<p className="pop-empty-note">{isLoading ? t.loading : t.empty}</p>}
      />
    </div>
  );
};
