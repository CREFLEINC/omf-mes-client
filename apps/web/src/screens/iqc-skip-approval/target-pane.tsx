import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { DisabledAction } from './disabled-action';
import { describeOpenBlock, type TargetOpenState } from './target';

const t = messages.iqcSkipApproval;

export interface TargetPaneProps {
  /** 서버가 만든 표시명(비어 왔으면 그 사실을 적은 글자). **판정은 `target.ts`가 이미 했다.** */
  name: string;
  openState: TargetOpenState;
  /** 열 수 있을 때만 불린다. 어디로 가는지는 화면이 정한다 — 부품은 주소를 모른다. */
  onOpen: (path: string) => void;
}

/**
 * 대상 구획 — **지금은 표시명과 「열기」뿐이다.**
 *
 * **이 구획은 잠정이다.** 스펙이 여기에 대상 LOT의 수량·현재 상태·입하·공급사를 그리라고
 * 적었으나 그 값을 얻는 길이 계약에 정해지지 않았다(질문 게시 중 · `omf-mes#33`). 없는 값을
 * 그리려면 화면이 대상 유형을 보고 부를 곳을 고르는 매핑표를 만들어야 하는데 그것이 계약이
 * 금지한 일이다. 그래서 지금은 **이름을 내고 원 화면으로 건너가는 자리**로 두고, 그 사실을
 * 안내 한 줄로 밝힌다.
 *
 * **`targetTypeCode`를 받지 않는다.** 유형을 보고 무엇을 그릴지 갈리는 코드가 이 슬라이스에
 * 한 줄도 없어야 한다. 이 부품은 이름 하나와 판정 하나만 받으므로 유형으로 갈릴 수단 자체가 없다.
 *
 * **잠긴 사유는 세 갈래이며 서로 다른 글자다.** 사용자가 할 조치가 다르기 때문이다 —
 * 판정과 문구는 `target.ts`가 갖고 여기는 그리기만 한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const TargetPane = ({ name, openState, onOpen }: TargetPaneProps) => (
  <div role="group" aria-label={t.panes.target}>
    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.fields.target}</dt>
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
      <DisabledAction label={t.target.open} reason={describeOpenBlock(openState)} size="sm" />
    )}

    <p className="field-note">{t.target.note}</p>
  </div>
);
