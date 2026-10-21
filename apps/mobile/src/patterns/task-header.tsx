import { Icon, IconButton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import './task-header.css';

const t = messages.taskFlow.header;

export interface TaskHeaderField {
  label: string;
  value: string;
  /**
   * 카드의 제목으로 크게 세운다. 대조할 값(품목 코드·위치) 하나에만 준다 - 다 크면 아무것도 앞에
   * 서지 않는다. 둘째부터는 굵게만 선다.
   */
  strong?: boolean;
  /** 제목 바로 아래 작은 글씨로 붙인다. 코드를 풀어 쓴 이름(품목명)처럼 제목에 딸린 값이다. */
  caption?: boolean;
  /** 고정폭 글꼴로 따로 한 줄. 라벨에서 읽은 LOT 처럼 한 자씩 실물과 대조하는 긴 코드다. */
  code?: boolean;
}

export interface TaskHeaderProps {
  /** 늘 보이는 값. 넷을 넘기지 않는다 - 360dp 카드 한 장에서 그 이상은 읽히지 않는다. */
  fields: TaskHeaderField[];
  /** 몇 개 중 몇 개를 했는가. 지시·라인이 여럿인 작업에만 준다. */
  progress?: { done: number; total: number };
  /** 몇 단계 중 몇 번째인가. 계기판 아래 칸 막대로 보인다. 단계 화면에만 준다. */
  step?: { index: number; total: number };
  /** 「자세히」로 펼치는 나머지. 없으면 단추를 두지 않는다. */
  details?: ReactNode;
  /**
   * 카드 머리의 아이콘 단추 하나. 처리 중인 것을 바꾸는 길(다른 라인으로)이라 그것을 보여 주는
   * 카드에 붙인다 - 본문 끝에 단추로 두면 그만큼 화면이 길어진다.
   */
  action?: { icon: string; label: string; onClick: () => void };
  /**
   * 화면이 직접 그리는 카드 내용. 제목 값(`strong`)이 있으면 값 줄 아래에 덧붙고(어디서 어디로
   * 같은 줄), 없으면 카드 본문을 대신한다(값에 이름을 붙여 칸으로 세우는 화면) - 계기판 띠 · 카드 ·
   * 붙어 있는 자리는 같다.
   */
  children?: ReactNode;
}

/** 늘 보이는 값의 한도. 넘친 값은 그리지 않는다 - 「자세히」로 보낸다. */
const MAX_FIELDS = 4;

const kindOf = (field: TaskHeaderField, index: number, fields: TaskHeaderField[]) => {
  if (field.strong === true && fields.findIndex((other) => other.strong === true) === index) {
    return 'title';
  }

  if (field.caption === true) {
    return 'caption';
  }

  return field.code === true ? 'code' : 'value';
};

/**
 * 지금 무엇을 처리 중인지 본문 위에 붙여 둔다.
 *
 * 전에는 지시·LOT·품목 카드가 화면의 첫 구획이라, 수량을 적으러 내려가면 무엇에 적는지가
 * 화면 밖으로 나갔다. 작업자는 실물 라벨과 화면을 대조하며 일하므로, 대조할 값이 늘 같은
 * 자리에 있어야 한다.
 *
 * 어두운 계기판(앱바)이 아래로 이어지고, 흰 작업 카드가 그 끝에 겹쳐 선다(사용자 결정
 * 2026-10-21, 개편 제안 v2). 카드는 맥락이고 그 아래 밝은 바탕이 할 일이다 - 둘이 같은 평면에
 * 있으면 어디부터가 입력인지 갈리지 않는다.
 *
 * 나머지 값은 「자세히」로 연다. 세로 720dp 에서 앱바·이 헤더·하단 확정 바를 빼면 본문이
 * 그리 넓지 않다.
 */
export const TaskHeader = ({
  fields,
  progress,
  step,
  details,
  action,
  children,
}: TaskHeaderProps) => {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const shown = fields.slice(0, MAX_FIELDS);
  const kinds = shown.map((field, index) => kindOf(field, index, shown));
  const pick = (kind: string) => shown.filter((_, index) => kinds[index] === kind);

  /* 이름은 화면에 그리지 않을 때도 낭독기에는 준다 - 「ABC-123」만 읽으면 무엇인지 모른다. */
  const item = (field: TaskHeaderField, className: string, visibleLabel: boolean) => (
    <div key={field.label} className={className}>
      <dt className={visibleLabel ? undefined : 'task-header__hidden'}>{field.label}</dt>
      <dd>{field.value}</dd>
    </div>
  );

  return (
    <div className="task-header" role="group" aria-label={t.label}>
      <div className="task-header__panel" data-theme="dark">
        {step === undefined ? null : (
          /* 몇 번째인지는 단계 머리가 글자로 말한다. 이 막대는 눈으로 훑는 자리다. */
          <div className="task-header__steps" aria-hidden="true">
            {Array.from({ length: step.total }, (_, index) => (
              <span
                key={index}
                className={
                  index + 1 < step.index
                    ? 'task-header__step task-header__step--done'
                    : index + 1 === step.index
                      ? 'task-header__step task-header__step--current'
                      : 'task-header__step'
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="task-header__card">
        <div className="task-header__head">
          {children === undefined || pick('title').length > 0 ? (
            <dl className="task-header__title">
              {pick('title').map((field) => item(field, 'task-header__code', false))}
              {pick('caption').map((field) => item(field, 'task-header__caption', false))}
            </dl>
          ) : (
            <div className="task-header__body">{children}</div>
          )}
          {progress === undefined ? null : (
            <p className="task-header__progress">{t.progress(progress.done, progress.total)}</p>
          )}
          {action === undefined ? null : (
            <IconButton
              className="task-header__toggle"
              icon={action.icon}
              size="md"
              aria-label={action.label}
              onClick={action.onClick}
            />
          )}
          {details === undefined ? null : (
            <IconButton
              className="task-header__toggle"
              icon={open ? 'expand_less' : 'expand_more'}
              size="md"
              aria-label={open ? t.less : t.more}
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => {
                setOpen((current) => !current);
              }}
            />
          )}
        </div>

        {pick('value').length === 0 ? null : (
          <dl className="task-header__values">
            {pick('value').map((field) => item(field, 'task-header__value', true))}
          </dl>
        )}

        {children === undefined || pick('title').length === 0 ? null : (
          <div className="task-header__extra">{children}</div>
        )}

        {pick('code').length === 0 ? null : (
          <dl className="task-header__codes">
            {pick('code').map((field) => (
              <div key={field.label} className="task-header__lot">
                <dt className="task-header__hidden">{field.label}</dt>
                <dd>
                  <Icon name="qr_code_2" size={16} />
                  <span>{field.value}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {details === undefined ? null : (
          <div id={detailsId} className="task-header__details" hidden={!open}>
            {details}
          </div>
        )}
      </div>
    </div>
  );
};
