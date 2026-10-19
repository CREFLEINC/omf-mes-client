import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.common.processPage;

export interface EffectItem {
  key: string;
  /** 명사형 한 줄(예: 입고 전표 생성) */
  label: string;
  /** 같은 줄 뒤의 짧은 보충(예: 즉시 전송 아님) */
  note?: string;
  /** 조건에 따라 빠지는 반영 사항. 지운 줄과 경고 문장으로 보인다 */
  excludedReason?: string;
}

export interface EffectListProps {
  /** 「〈업무〉 시 반영 사항」 */
  title: string;
  items: readonly EffectItem[];
  /** 되돌릴 수 없으면 그 문장(「확정 후에는 수정할 수 없습니다」) */
  irreversibleNote?: string;
}

/**
 * 「〈업무〉 시 반영 사항」 목록 — 화면 구성 규범 T-W-C 확인 단계, C-9.
 *
 * 조건에 따라 빠지는 반영 사항은 지운 줄과 경고로 표시한다.
 */
export const EffectList = ({ title, items, irreversibleNote }: EffectListProps) => (
  <section className="effect-list" aria-label={title}>
    <h3 className="effect-list-title">{title}</h3>
    <ol className="effect-list-items">
      {items.map((item) => (
        <li
          key={item.key}
          className={item.excludedReason === undefined ? undefined : 'effect-list-excluded'}
        >
          {item.excludedReason === undefined ? (
            item.label
          ) : (
            <>
              <del>{item.label}</del> <span className="effect-list-tag">{t.effectExcluded}</span>
            </>
          )}
          {item.note !== undefined && <span className="effect-list-note">{item.note}</span>}
          {item.excludedReason !== undefined && (
            <span className="effect-list-warning">
              <Icon name="warning" size={16} /> {item.excludedReason}
            </span>
          )}
        </li>
      ))}
    </ol>
    {irreversibleNote !== undefined && (
      <p className="effect-list-irreversible">
        <Icon name="warning" size={18} />
        <strong>{irreversibleNote}</strong>
      </p>
    )}
  </section>
);
