import { EmptyState, Icon } from '@crefle/web-ui';

export const ShellHome = () => {
  return (
    <EmptyState
      size="lg"
      icon={<Icon name="smartphone" />}
      title="모바일 셸이 실행 중입니다"
      description="화면은 아직 붙지 않았습니다."
    />
  );
};
