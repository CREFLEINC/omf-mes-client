import { Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import type { SectionCheck, SummaryPart } from './release-checks';
import './release-check.css';

const c = messages.erpWorkOrderFlow.process.release.checks;

/**
 * 확인 결과 표시 — 이상 없음(동그라미 체크) · 확인 필요(세모 경고) · 대상 없음(회색 동그라미 빼기) · 받는 중(…).
 * 색만으로 가르지 않게 모양이 다르다. `title` 을 주면 접근 이름이 「자재 확인 필요」처럼 항목을 함께 말한다(목록의 확인 칸).
 */
export const CheckMark = ({
  check,
  title,
}: {
  check: SectionCheck | undefined;
  title?: string;
}) => {
  const label = (text: string): string => (title === undefined ? text : `${title} ${text}`);
  if (check === undefined) return <span className="release-check-mark" aria-hidden="true" />;
  if (check.state === 'ok') {
    return (
      <Icon
        className="release-check-mark is-ok"
        name="check_circle"
        size={20}
        label={label(c.ok)}
      />
    );
  }
  if (check.state === 'warn') {
    return (
      <Icon className="release-check-mark is-warn" name="warning" size={20} label={label(c.warn)} />
    );
  }
  /* 대상 없음은 빈 값(—)처럼 보이지 않게 다른 표시와 같은 크기의 회색 아이콘으로 둔다. */
  if (check.state === 'none') {
    return (
      <Icon
        className="release-check-mark is-none"
        name="do_not_disturb_on"
        size={20}
        label={label(c.none)}
      />
    );
  }
  return (
    <span className="release-check-mark" role="img" aria-label={label(c.pending)}>
      …
    </span>
  );
};

/** 요약 칸들 — 값만이거나 「이름표 값」 쌍. 칸 사이는 간격이다. */
export const SummaryParts = ({ parts }: { parts: readonly SummaryPart[] }) => (
  <>
    {parts.map((part, at) =>
      typeof part === 'string' ? (
        <span key={at}>{part}</span>
      ) : (
        <span key={at}>
          <span className="release-check-summary-label">{part[0]}</span> {part[1]}
        </span>
      ),
    )}
  </>
);

/**
 * 상세의 확인 항목 한 줄. 접어 두어도 요약 한 줄과 확인이 필요한 까닭(칩)은 보인다 —
 * 확인이 필요한 줄만 펼친 채로 열리고, 나머지는 눌러서 펼친다(배포 확인 B안).
 * 대상이 없는 줄(자재가 없는 공정)은 펼칠 것이 없다 — 회색 칩 하나만 두고 누르지 못한다.
 */
export const CheckRow = ({
  title,
  check,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  check: SectionCheck | undefined;
  /** 줄이 따로 지은 요약. 없으면 확인 결과의 요약을 쓴다. */
  summary?: readonly SummaryPart[];
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) =>
  check?.state === 'none' ? (
    <section className="release-check-row" aria-label={title}>
      <h4 className="release-check-row-heading">
        <span className="release-check-row-head is-static">
          <CheckMark check={check} />
          <span className="release-check-row-title">{title}</span>
          {(summary ?? check.summary).map((part, at) => (
            <Chip key={at} variant="status" status="idle" size="sm">
              {typeof part === 'string' ? part : `${part[0]} ${part[1]}`}
            </Chip>
          ))}
        </span>
      </h4>
    </section>
  ) : (
    <section className="release-check-row" aria-label={title}>
      <h4 className="release-check-row-heading">
        <button
          type="button"
          className="release-check-row-head"
          aria-expanded={open}
          onClick={onToggle}
        >
          <CheckMark check={check} />
          <span className="release-check-row-title">{title}</span>
          {(summary ?? check?.summary ?? []).length > 0 && (
            <span className="release-check-row-summary">
              <SummaryParts parts={summary ?? check?.summary ?? []} />
            </span>
          )}
          {(check?.alerts ?? []).map((alert) => (
            <Chip key={alert} variant="status" status="warning" size="sm">
              {alert}
            </Chip>
          ))}
          <Icon
            className="release-check-row-toggle"
            name={open ? 'expand_less' : 'expand_more'}
            size={20}
            aria-hidden
          />
        </button>
      </h4>
      {open && <div className="release-check-row-body">{children}</div>}
    </section>
  );
