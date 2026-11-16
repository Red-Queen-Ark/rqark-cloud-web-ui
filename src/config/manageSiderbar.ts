import AgentIcon from '@/components/svg/AgentIcon.vue';
import CogIcon from '@/components/svg/CogIcon.vue';
import GroupIcon from '@/components/svg/GroupIcon.vue';
import GridIcon from '@/components/svg/GridIcon.vue';
import KeyIcon from '@/components/svg/KeyIcon.vue';
import UsageIcon from '@/components/svg/UsageIcon.vue';
import MemoryIcon from '@/components/svg/MemoryIcon.vue';
import ProviderIcon from '@/components/svg/ProviderIcon.vue';
import SessionIcon from '@/components/svg/SessionIcon.vue';
import SopIcon from '@/components/svg/SopIcon.vue';
import StarIcon from '@/components/svg/StarIcon.vue';
import StateIcon from '@/components/svg/StateIcon.vue';
import UsersIcon from '@/components/svg/UsersIcon.vue';
import type { SiderGroup, SiderItem } from './siderbar';

/** Headings of the console sidebar, in display order. */
export const manageSiderGroups: SiderGroup[] = [
  { key: 'overview', i18nKey: 'nav.group.overview' },
  { key: 'agents', i18nKey: 'nav.group.agents' },
  { key: 'memory', i18nKey: 'nav.group.memory' },
  { key: 'operations', i18nKey: 'nav.group.operations' },
  { key: 'access', i18nKey: 'nav.group.access' },
  { key: 'system', i18nKey: 'nav.group.system' },
];

export const manageSiderItems: SiderItem[] = [
  {
    pageId: 'manage',
    i18nKey: 'dashboard.title',
    subtitleKey: 'dashboard.subtitle',
    icon: GridIcon,
    group: 'overview',
  },
  {
    pageId: 'agents',
    i18nKey: 'agents.title',
    subtitleKey: 'agents.subtitle',
    icon: AgentIcon,
    group: 'agents',
  },
  {
    pageId: 'agentDefaults',
    i18nKey: 'agentDefaults.title',
    subtitleKey: 'agentDefaults.subtitle',
    icon: StarIcon,
    group: 'agents',
  },
  {
    pageId: 'sops',
    i18nKey: 'sops.title',
    subtitleKey: 'sops.subtitle',
    icon: SopIcon,
    group: 'agents',
  },
  {
    pageId: 'memory',
    i18nKey: 'memory.title',
    subtitleKey: 'memory.subtitle',
    icon: MemoryIcon,
    group: 'memory',
    aliases: ['memoryDetail'],
  },
  {
    pageId: 'agentState',
    i18nKey: 'agentState.title',
    subtitleKey: 'agentState.subtitle',
    icon: StateIcon,
    group: 'memory',
  },
  {
    pageId: 'sessions',
    i18nKey: 'sessions.title',
    subtitleKey: 'sessions.subtitle',
    icon: SessionIcon,
    group: 'operations',
    aliases: ['sessionDetail'],
  },
  {
    pageId: 'usage',
    i18nKey: 'usage.title',
    subtitleKey: 'usage.subtitle',
    icon: UsageIcon,
    group: 'operations',
  },
  {
    pageId: 'users',
    i18nKey: 'users.title',
    subtitleKey: 'users.subtitle',
    icon: UsersIcon,
    group: 'access',
    superuserOnly: true,
  },
  {
    pageId: 'groups',
    i18nKey: 'groups.title',
    subtitleKey: 'groups.subtitle',
    icon: GroupIcon,
    group: 'access',
    superuserOnly: true,
  },
  {
    pageId: 'providers',
    i18nKey: 'providers.title',
    subtitleKey: 'providers.subtitle',
    icon: ProviderIcon,
    group: 'system',
  },
  {
    pageId: 'apiKeys',
    i18nKey: 'apiKeys.title',
    subtitleKey: 'apiKeys.subtitle',
    icon: KeyIcon,
    group: 'system',
  },
  {
    pageId: 'manageSettings',
    i18nKey: 'settings.title',
    subtitleKey: 'settings.subtitle',
    icon: CogIcon,
    group: 'system',
  },
];

export function manageSiderItemFor(pageId?: string): SiderItem | undefined {
  return manageSiderItems.find((item) => item.pageId === pageId || (pageId !== undefined && item.aliases?.includes(pageId) === true));
}

/** Groups the given entries under the declared headings, dropping empty headings. */
export function groupManageSiderItems(items: SiderItem[]): { group: SiderGroup; items: SiderItem[] }[] {
  return manageSiderGroups.map((group) => ({ group, items: items.filter((item) => item.group === group.key) })).filter((entry) => entry.items.length > 0);
}
