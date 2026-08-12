import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { DisabledAction } from './disabled-action';
import { describeOpenBlock, type TargetOpenState } from './target';

const t = messages.approvalInbox;

export interface TargetPaneProps {
  /** 서버가 만든 표시명(비어 왔으면 그 사실을 적은 글자). **판정은 `target.ts`가 이미 했다.** */
  name: string;
  openState: TargetOpenState;
  /** 열 수 있을 때만 불린다. 어디로 가는지는 화면이 정한다 — 부품은 주소를 모른다. */
  onOpen: (path: string) => void;
}

/**
 * 대상 구획 — **표시명과 「열기」뿐이다.**
 *
 * **대상 문서의 내용을 그리지 않는다.** 계약이 그렇게 적었고 상세 응답에 대상 본문이 아예
 * 없다. 결재함은 「무엇을 결재하는지 알아보고 원 화면으로 건너가는」 자리이지 문서를 읽는
 * 자리가 아니다 — 그 사실을 안내 한 줄로 밝힌다.
 *
 * **`targetTypeCode`를 받지 않는다.** 유형을 보고 무엇을 그릴지 갈리는 코드가 이 슬라이스에
 * 한 줄도 없어야 한다(계약이 금지한 매핑표). 이 부품은 이름 하나와 판정 하나만 받으므로
 * 유형으로 갈릴 수단 자체가 없다.
 *
 * **잠긴 사유는 세 갈래이며 서로 다른 글자다.** 사용자가 할 조치가 다르기 때문이다 —
 * 판정과 문구는 `target.ts`가 갖고 여기는 그리기만 한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const TargetPane = ({ name, openState, onOpen }: TargetPaneProps) => {
  return (
    <div role="group" aria-label={t.panes.target}>
      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.panes.target}</dt>
          <dd>{name}</dd>
        </div>
      </dl>

      {openState.kind === 'open' ? (
        <div className="field-cell">
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              onOpen(openState.path);
            }}
          >
            {t.target.open}
          </Button>
        </div>
      ) : (
        /* 사유는 감추지 않는다 — 비활성 컨트롤은 포커스를 받지 못해 툴팁으로는 닿을 수 없다. */
        <DisabledAction label={t.target.open} reason={describeOpenBlock(openState)} />
      )}

      <p className="field-note">{t.target.note}</p>
    </div>
  );
};
