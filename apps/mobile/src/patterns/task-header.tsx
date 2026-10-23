import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import './task-header.css';

const t = messages.taskFlow.header;

export interface TaskHeaderField {
  label: string;
  value: string;
  /** 굵게 세운다. 대조할 값(품목 코드·위치) 한두 개에만 준다 - 다 굵으면 아무것도 앞에 서지 않는다. */
  strong?: boolean;
}

export interface TaskHeaderProps {
  /** 늘 보이는 값. 넷을 넘기지 않는다 - 360dp 한 줄에서 그 이상은 읽히지 않는다. */
  fields: TaskHeaderField[];
  /** 몇 개 중 몇 개를 했는가. 지시·라인이 여럿인 작업에만 준다. */
  progress?: { done: number; total: number };
  /** 「자세히」로 펼치는 나머지. 없으면 단추를 두지 않는다. */
  details?: ReactNode;
}

/** 늘 보이는 값의 한도. 넘친 값은 그리지 않는다 - 「자세히」로 보낸다. */
const MAX_FIELDS = 4;

/**
 * 지금 무엇을 처리 중인지 본문 위에 붙여 둔다.
 *
 * 전에는 지시·LOT·품목 카드가 화면의 첫 구획이라, 수량을 적으러 내려가면 무엇에 적는지가
 * 화면 밖으로 나갔다. 작업자는 실물 라벨과 화면을 대조하며 일하므로, 대조할 값이 늘 같은
 * 자리에 있어야 한다.
 *
 * 기본은 한 묶음으로 접어 둔다 - 세로 720dp 에서 앱바·이 헤더·하단 확정 바를 빼면 본문이
 * 그리 넓지 않다. 나머지 값은 「자세히」로 연다.
 */
export const TaskHeader = ({ fields, progress, details }: TaskHeaderProps) => {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <div className="task-header" role="group" aria-label={t.label}>
      <div className="task-header__row">
        <dl className="task-header__fields">
          {fields.slice(0, MAX_FIELDS).map((field) => (
            <div
              key={field.label}
              className={
                field.strong === true
                  ? 'task-header__field task-header__field--strong'
                  : 'task-header__field'
              }
            >
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
        {progress === undefined ? null : (
          <p className="task-header__progress">{t.progress(progress.done, progress.total)}</p>
        )}
      </div>
      {details === undefined ? null : (
        <>
          <button
            type="button"
            className="task-header__toggle"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => {
              setOpen((current) => !current);
            }}
          >
            {open ? t.less : t.more}
          </button>
          <div id={detailsId} className="task-header__details" hidden={!open}>
            {details}
          </div>
        </>
      )}
    </div>
  );
};
