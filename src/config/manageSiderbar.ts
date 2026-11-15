import AgentIcon from '@/components/svg/AgentIcon.vue';
import CogIcon from '@/components/svg/CogIcon.vue';
import GroupIcon from '@/components/svg/GroupIcon.vue';
import GridIcon from '@/components/svg/GridIcon.vue';
import KeyIcon from '@/components/svg/KeyIcon.vue';
import MemoryIcon from '@/components/svg/MemoryIcon.vue';
import ProviderIcon from '@/components/svg/ProviderIcon.vue';
import SessionIcon from '@/components/svg/SessionIcon.vue';
import SopIcon from '@/components/svg/SopIcon.vue';
import StarIcon from '@/components/svg/StarIcon.vue';
import StateIcon from '@/components/svg/StateIcon.vue';
import UsersIcon from '@/components/svg/UsersIcon.vue';
import type { SiderItem } from './siderbar';

export const manageSiderItems: SiderItem[] = [
  {
    pageId: 'manage',
    i18nKey: 'dashboard.title',
    subtitleKey: 'dashboard.subtitle',
    icon: GridIcon,
  },
  {
    pageId: 'agents',
    i18nKey: 'agents.title',
    subtitleKey: 'agents.subtitle',
    icon: AgentIcon,
  },
  {
    pageId: 'agentDefaults',
    i18nKey: 'agentDefaults.title',
    subtitleKey: 'agentDefaults.subtitle',
    icon: StarIcon,
  },
  {
    pageId: 'providers',
    i18nKey: 'providers.title',
    subtitleKey: 'providers.subtitle',
    icon: ProviderIcon,
  },
  {
    pageId: 'sessions',
    i18nKey: 'sessions.title',
    subtitleKey: 'sessions.subtitle',
    icon: SessionIcon,
    aliases: ['sessionDetail'],
  },
  {
    pageId: 'memory',
    i18nKey: 'memory.title',
    subtitleKey: 'memory.subtitle',
    icon: MemoryIcon,
    aliases: ['memoryDetail'],
  },
  {
    pageId: 'agentState',
    i18nKey: 'agentState.title',
    subtitleKey: 'agentState.subtitle',
    icon: StateIcon,
  },
  {
    pageId: 'sops',
    i18nKey: 'sops.title',
    subtitleKey: 'sops.subtitle',
    icon: SopIcon,
  },
  {
    pageId: 'apiKeys',
    i18nKey: 'apiKeys.title',
    subtitleKey: 'apiKeys.subtitle',
    icon: KeyIcon,
  },
  {
    pageId: 'users',
    i18nKey: 'users.title',
    subtitleKey: 'users.subtitle',
    icon: UsersIcon,
    superuserOnly: true,
  },
  {
    pageId: 'groups',
    i18nKey: 'groups.title',
    subtitleKey: 'groups.subtitle',
    icon: GroupIcon,
    superuserOnly: true,
  },
  {
    pageId: 'manageSettings',
    i18nKey: 'settings.title',
    subtitleKey: 'settings.subtitle',
    icon: CogIcon,
  },
];

export function manageSiderItemFor(pageId?: string): SiderItem | undefined {
  return manageSiderItems.find((item) => item.pageId === pageId || (pageId !== undefined && item.aliases?.includes(pageId) === true));
}
