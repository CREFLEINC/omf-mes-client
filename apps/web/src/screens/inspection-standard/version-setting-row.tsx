import { Button, Icon } from '@crefle/web-ui';
import { activeLocale, messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import type { VersionFormValues } from './types';
import type { GuideTextField } from './version-summary';

const t = messages.inspectionStandard;

export interface VersionSettingRowProps {
  icon: string;
  title: string;
  /** 제목 아래 한 줄 — 건수 · 지시문 */
  summary: string;
  /** 오른쪽 끝 단추(항목 추가 · 도면 추가 · 지시문 수정). 고칠 수 없는 버전이면 넘기지 않는다. */
  action?: ReactNode;
  /** 펼칠 내용이 있는 줄만 넘긴다 — 없으면 줄을 눌러도 아무 일이 없으니 펼침 단추를 두지 않는다. */
  isOpen?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}

/**
 * 「버전별 설정」의 한 줄(사용자 시안 · omf-all-around#258) — 아이콘 · 제목 · 요약, 오른쪽 끝 단추.
 * 검사 항목 · 도면은 줄을 눌러 그 아래에 종전 탭 내용을 펼친다(한 번에 하나 — 종전 탭과 같다).
 */
export const VersionSettingRow = ({
  icon,
  title,
  summary,
  action,
  isOpen,
  onToggle,
  children,
}: VersionSettingRowProps) => {
  const bodyId = useId();
  const head = (
    <>
      <Icon name={icon} size={22} aria-hidden />
      <span className="inspection-standard-setting-text">
        <span className="inspection-standard-setting-title">{title}</span>
        <span className="inspection-standard-setting-summary">{summary}</span>
      </span>
    </>
  );

  return (
    <div className="inspection-standard-setting-row">
      <div className="inspection-standard-setting-head">
        {onToggle === undefined ? (
          <div className="inspection-standard-setting-toggle">{head}</div>
        ) : (
          <button
            type="button"
            className="inspection-standard-setting-toggle"
            aria-expanded={isOpen === true}
            aria-controls={isOpen === true ? bodyId : undefined}
            onClick={onToggle}
          >
            {head}
            <Icon name={isOpen === true ? 'expand_less' : 'expand_more'} size={20} aria-hidden />
          </button>
        )}
        {action}
      </div>
      {onToggle !== undefined && isOpen === true && (
        <div id={bodyId} className="inspection-standard-setting-body">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * 「검사 지시문」 줄(#252 · 줄 모양은 #258) — 화면 언어의 칸 하나만 보이고 고친다(사용자 지시).
 * 고칠 수 있는 버전(작성중)에서만 「지시문 수정」을 둔다.
 */
export const VersionGuideRow = ({
  values,
  onEditGuide,
}: {
  /** 저장된 값 — 편집 중인 초안이 아니다. */
  values: VersionFormValues;
  onEditGuide?: (field: GuideTextField) => void;
}) => {
  const field: GuideTextField = activeLocale() === 'vi' ? 'guideTextVi' : 'guideTextKo';
  const text = values[field].trim();

  return (
    <VersionSettingRow
      icon="description"
      title={t.versionSection.rowGuide}
      summary={text === '' ? t.versionSection.guideNone : values[field]}
      action={
        onEditGuide === undefined ? undefined : (
          <Button
            variant="outlined"
            leadingIcon={<Icon name="edit" size={18} />}
            aria-label={t.versionSection.editGuide(t.fields[field])}
            onClick={() => onEditGuide(field)}
          >
            {t.versionSection.guideEditAction}
          </Button>
        )
      }
    />
  );
};
