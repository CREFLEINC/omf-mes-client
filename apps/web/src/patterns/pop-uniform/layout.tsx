import { messages } from '@omf-mes/i18n';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { PuIcon, type PuIconName } from './icon';

/**
 * POP 본문 통일 틀(#295) — 화면 본문 · 구획 · 정보 띠 · 안내 줄 · 빈 화면 · 작업 줄.
 * 모양은 `app/pop-uniform.css`, 규칙은 시안 공통 규칙 1~16.
 */
const t = messages.popUniform;

const cx = (...names: (string | false | null | undefined)[]): string =>
  names.filter((name) => typeof name === 'string' && name !== '').join(' ');

/** 화면 본문: [작업 단계 줄] + 본문 + 아래 작업 줄. 셸(맨 위 줄·묶음·탭) 아래를 채운다. */
export const PuScreen = ({
  steps,
  actionBar,
  children,
  className,
  band = false,
  labelledBy,
}: {
  /** 생산 흐름 화면의 작업 단계 줄(셸이 그리면 비운다). */
  steps?: ReactNode;
  /** 아래 작업 줄. 저장하는 일이 없는 화면(홈)은 비운다. */
  actionBar?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 본문 맨 위에 정보 띠가 있는가(띠 높이만큼 먼저 잡는다). */
  band?: boolean;
  labelledBy?: string;
}) => (
  <section className={cx('pu-screen', className)} aria-labelledby={labelledBy}>
    {steps}
    <div className={cx('pu-main', band && 'with-band')}>{children}</div>
    {actionBar}
  </section>
);

export type PuColsVariant = 'c2' | 'c3' | 'list' | 'k2' | 'k3' | 'lk';

/** 열 배치(규칙 1·8): 목록은 왼쪽 380, 키패드는 맨 오른쪽 340. */
export const PuCols = ({
  variant,
  children,
  className,
}: {
  variant: PuColsVariant;
  children: ReactNode;
  className?: string;
}) => <div className={cx('pu-cols', variant, className)}>{children}</div>;

export const PuStack = ({
  children,
  fill = false,
  className,
}: {
  children: ReactNode;
  /** 첫 칸은 내용 높이, 나머지는 남는 높이 전부. */
  fill?: boolean;
  className?: string;
}) => <div className={cx('pu-stack', fill && 'fill', className)}>{children}</div>;

export interface PuFold {
  /** 접기 단추 이름(「작업지시 목록」 등). */
  label: string;
  folded: boolean;
  onChange: (folded: boolean) => void;
}

/**
 * 구획(규칙 4). 모든 구획에 제목, 건수·상태는 제목 줄 오른쪽(`meta`).
 * 제목 없이 탭(`head`)을 둘 수도 있다. `fold` 를 주면 제목 줄 끝 [|<] 로 왼쪽으로 접는다.
 */
export const PuSection = ({
  title,
  head,
  meta,
  fold,
  children,
  grow = true,
  split = false,
  disabled = false,
  className,
  bodyClassName,
  labelId,
  label,
}: {
  title?: ReactNode;
  /** 제목 대신 제목 줄을 채우는 것(탭 등). */
  head?: ReactNode;
  meta?: ReactNode;
  fold?: PuFold;
  children?: ReactNode;
  /** 본문이 남는 높이를 다 갖는가(기본). */
  grow?: boolean;
  /** 본문 마지막 칸(쪽 넘김·키패드 등)을 아래쪽에 붙인다. */
  split?: boolean;
  /** 앞 단계 전이라 흐리게 꺼 둔다. */
  disabled?: boolean;
  className?: string;
  bodyClassName?: string;
  labelId?: string;
  /** 제목이 없는 구획의 읽는 이름(시안이 제목을 지운 구획). */
  label?: string;
}) => {
  if (fold?.folded === true) {
    return (
      <section className={cx('pu-card is-folded', className)} aria-label={fold.label}>
        <button
          type="button"
          className="pu-fold-strip"
          aria-label={t.fold.open(fold.label)}
          title={t.fold.open(fold.label)}
          onClick={() => {
            fold.onChange(false);
          }}
        >
          <i>
            <PuIcon name="chevr" />
          </i>
        </button>
      </section>
    );
  }

  const hasHead =
    title !== undefined || head !== undefined || meta !== undefined || fold !== undefined;

  return (
    <section
      className={cx('pu-card', disabled && 'is-off', className)}
      aria-labelledby={labelId}
      aria-label={labelId === undefined ? label : undefined}
      aria-disabled={disabled || undefined}
    >
      {hasHead && (
        <div className="pu-card-head">
          {title !== undefined && <h2 id={labelId}>{title}</h2>}
          {head}
          {meta !== undefined && <div className="meta">{meta}</div>}
          {fold !== undefined && (
            <button
              type="button"
              className="pu-fold-btn"
              aria-label={t.fold.fold(fold.label)}
              title={t.fold.fold(fold.label)}
              onClick={() => {
                fold.onChange(true);
              }}
            >
              <PuIcon name="foldl" />
            </button>
          )}
        </div>
      )}
      <div className={cx('pu-card-body', grow && 'grow', split && 'split', bodyClassName)}>
        {children}
      </div>
    </section>
  );
};

export interface PuBandItem {
  label: ReactNode;
  value: ReactNode;
  /** 띠 폭 전체를 쓰는 칸(격자 띠). */
  wide?: boolean;
}

/** 정보 띠: 빨간 아이콘 제목 + 번호 + 「이름 값」. 칸이 많으면 `grid`. */
export const PuBand = ({
  icon = 'file',
  title,
  no,
  items,
  grid,
  label,
}: {
  icon?: PuIconName;
  title?: ReactNode;
  no?: ReactNode;
  items: readonly PuBandItem[];
  /** 격자 열 수(3 · 4). 비우면 한 줄로 흐른다. */
  grid?: 3 | 4;
  label?: string;
}) => (
  <div
    className={cx('pu-band', grid !== undefined && 'grid', grid === 4 && 'c4')}
    role="group"
    aria-label={label}
  >
    {title !== undefined && (
      <span className="t">
        <PuIcon name={icon} />
        {title}
      </span>
    )}
    {no !== undefined && <span className="no">{no}</span>}
    {items.map((item, index) => (
      <span key={index} className={cx('kv', item.wide === true && 'wide')}>
        <span>{item.label}</span>
        <b>{item.value}</b>
      </span>
    ))}
  </div>
);

export type PuTone = 'info' | 'warn' | 'bad' | 'ok';

const TONE_ICON: Record<PuTone, PuIconName> = { info: 'info', warn: 'warn', bad: 'bad', ok: 'ok' };

/** 안내 줄(규칙 9): 정보 파랑 · 주의 노랑 · 오류 빨강 · 완료 초록, 한 줄 모양. */
export const PuNote = ({
  tone = 'info',
  children,
  action,
  id,
  live,
}: {
  tone?: PuTone;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
  /** 바뀌면 읽어 주는가(스캔 결과 등). */
  live?: boolean;
}) => (
  <div
    id={id}
    className={cx('pu-note', tone !== 'info' && tone)}
    role={tone === 'bad' ? 'alert' : live === true ? 'status' : undefined}
  >
    <PuIcon name={TONE_ICON[tone]} />
    <span className="text">{children}</span>
    {action !== undefined && <span className="act">{action}</span>}
  </div>
);

/** 빈 구획(규칙 9): 가운데 아이콘 + 한 줄 + 할 일. */
export const PuEmpty = ({
  icon = 'list',
  title,
  hint,
  children,
}: {
  icon?: PuIconName;
  title: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) => (
  <div className="pu-empty" role="status">
    <PuIcon name={icon} />
    <b>{title}</b>
    {hint !== undefined && <span>{hint}</span>}
    {children}
  </div>
);

export type PuChipTone = 'idle' | 'info' | 'ok' | 'warn' | 'bad';

/** 상태 칩(규칙 10): 진행 중 파랑 · 대기 회색 · 완료/합격 초록 · 보류/주의 노랑 · 불량/불합격 빨강. */
export const PuChip = ({ tone = 'idle', children }: { tone?: PuChipTone; children: ReactNode }) => (
  <span className={cx('pu-chip', tone !== 'idle' && tone)}>{children}</span>
);

export const PuCount = ({ children }: { children: ReactNode }) => (
  <span className="pu-count">{children}</span>
);

export type PuButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';

export interface PuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PuButtonVariant;
  size?: 'md' | 'sm';
  icon?: PuIconName;
}

/** 버튼: 높이 48(작게 36). 주 버튼은 빨강, 한 화면에 하나. */
export const PuButton = ({
  variant = 'default',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: PuButtonProps) => (
  <button
    // eslint-disable-next-line react/button-has-type -- 기본은 button, 부르는 쪽이 submit 을 줄 수 있다.
    type={type}
    className={cx('pu-btn', variant !== 'default' && variant, size === 'sm' && 'sm', className)}
    {...rest}
  >
    {icon !== undefined && <PuIcon name={icon} />}
    {children}
  </button>
);

/** 목록에서 한 줄 빼기: X 아이콘 단추. */
export const PuRemoveButton = ({
  label,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label?: string }) => (
  <button
    type="button"
    className="pu-btn x"
    aria-label={label ?? t.remove}
    title={label ?? t.remove}
    {...rest}
  >
    <PuIcon name="x" />
  </button>
);

/**
 * 아래 작업 줄(규칙 2·3): 버튼만. 일을 끝내는 버튼은 오른쪽, 빨간 주 버튼은 맨 오른쪽 하나.
 * ⛔ 왼쪽에 이유·안내 글을 띄우지 않는다 — 꺼진 버튼은 흐리게만 보인다.
 * `lead` 는 왼쪽에 둘 보조 버튼(입력 초기화 등)이다.
 */
export const PuActionBar = ({
  lead,
  children,
  label,
}: {
  lead?: ReactNode;
  children?: ReactNode;
  label?: string;
}) => (
  <div className="pu-actionbar" role="region" aria-label={label}>
    {lead !== undefined && <div className="lead">{lead}</div>}
    {children}
  </div>
);

export interface PuFlowStep {
  label: ReactNode;
  /** 끝난 단계 — 초록 ✓, `onGo` 가 있으면 눌러 돌아간다. */
  done?: boolean;
  /** 눌러 갈 수 있으면 준다(끝난 단계, 또는 조건이 맞은 다음 단계). */
  onGo?: () => void;
  /** 아직 넘어갈 수 없는 단계 — 흐리게, 눌리지 않는다(사용자 지시 2026-11-19). */
  disabled?: boolean;
}

/** 구획 안 단계 줄(규칙 4): ① › ② › ③, 지금 빨강 · 끝남 초록 ✓. */
export const PuFlow = ({
  steps,
  current,
  label,
}: {
  steps: readonly PuFlowStep[];
  /** 지금 단계(0부터). */
  current: number;
  label: string;
}) => (
  <div className="pu-flow" role="list" aria-label={label}>
    {steps.map((step, index) => {
      const isNow = index === current;
      const isDone = step.done === true && !isNow;
      const cls = cx('st', isNow && 'is-now', isDone && 'is-done');
      const mark = isDone ? '✓' : String(index + 1);

      return (
        <span key={index} role="listitem" style={{ display: 'contents' }}>
          {index > 0 && (
            <span className="sep" aria-hidden>
              ›
            </span>
          )}
          {step.onGo !== undefined && !isNow ? (
            <button type="button" className={cls} disabled={step.disabled} onClick={step.onGo}>
              <i>{mark}</i>
              {step.label}
            </button>
          ) : (
            <span className={cls} aria-current={isNow ? 'step' : undefined}>
              <i>{mark}</i>
              {step.label}
            </span>
          )}
        </span>
      );
    })}
  </div>
);

/** 이름: 값 묶음. */
export const PuKv = ({
  items,
  cols2 = false,
}: {
  items: readonly { label: ReactNode; value: ReactNode }[];
  cols2?: boolean;
}) => (
  <dl className={cx('pu-kv', cols2 && 'cols2')}>
    {items.map((item, index) => (
      <span key={index} style={{ display: 'contents' }}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </span>
    ))}
  </dl>
);

export { cx as puCx };
