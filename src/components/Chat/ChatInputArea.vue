<template>
  <div id="chat-input-area" class="py-2 px-3 bg-base-100 shrink-0 relative">
    <div class="bg-base-200 rounded-box border border-base-300">
      <div class="py-2 px-3">
        <div class="min-h-9 max-h-32 overflow-y-auto scrollbar-thin">
          <div
            id="chat-input-editor"
            ref="inputRef"
            data-testid="chat-input"
            contenteditable="true"
            class="w-full py-1.5 px-1 bg-transparent outline-none text-sm text-base-content"
            :placeholder="t('chat.inputPlaceholder')"
            role="textbox"
            aria-multiline="true"
            :aria-label="t('chat.inputPlaceholder')"
            @keydown="handleKeydown"
            @input="handleInput"
            @paste="handlePaste"
          ></div>
        </div>
      </div>

      <div class="flex items-center gap-2 px-3 pb-2 pt-1.5 border-t border-base-300/50 bg-base-300/30 rounded-b-box">
        <div v-if="statusClass" data-testid="chat-status" :class="['status', statusClass]" :aria-label="statusLabel" :title="statusLabel"></div>
        <div class="flex items-center gap-1 text-xs text-base-content/70">
          <BoltIcon class="h-3.5 w-3.5 shrink-0 opacity-60" />
          <select class="select select-bordered select-xs bg-base-100 max-w-36" :value="selectedProvider" :disabled="providers.length === 0" @change="selectedProvider = ($event.target as HTMLSelectElement).value">
            <option v-if="providers.length === 0" value="" disabled>{{ t('chat.noProviders') }}</option>
            <option v-for="(p, i) in providers" :key="providerDisplayName(p) || i" :value="providerDisplayName(p)">{{ providerDisplayName(p) }}</option>
          </select>
        </div>
        <span class="text-base-content/20">|</span>
        <div class="flex items-center gap-1 text-xs text-base-content/70">
          <UserIcon class="h-3.5 w-3.5 shrink-0 opacity-60" />
          <select class="select select-bordered select-xs bg-base-100 max-w-36" :value="selectedAgent" :disabled="agents.length === 0" @change="chooseAgent">
            <option v-if="agents.length === 0" value="" disabled>{{ t('chat.noAgents') }}</option>
            <!-- Keyed by position: two names may repeat, and the wire only carries
            the name, so the two entries are the same choice either way. -->
            <option v-for="(a, i) in agents" :key="i" :value="a">{{ a }}</option>
          </select>
        </div>
        <div class="ml-auto">
          <button v-if="streaming" id="chat-input-stop-btn" data-testid="chat-stop" class="btn btn-error btn-sm btn-square" :title="t('chat.stop')" :aria-label="t('chat.stop')" @click="emit('stop')">
            <StopIcon class="h-5 w-5" />
          </button>
          <button v-else id="chat-input-send-btn" data-testid="chat-send" class="btn btn-primary btn-sm btn-square" :disabled="!hasContent" :title="t('chat.send')" :aria-label="t('chat.send')" @click="submit">
            <SendIcon class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ApiProviderSummaryDto } from '@/api';
import { CHAT_STATUS, type ChatStatus } from '@/config/chatStatus';
import { providerDisplayName } from '@/config/providers';
import BoltIcon from '@/components/svg/BoltIcon.vue';
import SendIcon from '@/components/svg/SendIcon.vue';
import StopIcon from '@/components/svg/StopIcon.vue';
import UserIcon from '@/components/svg/UserIcon.vue';

const props = defineProps<{
  agents: string[];
  /** The agent stored as the default for this app's session source, when one resolves. */
  defaultAgent?: string;
  providers: ApiProviderSummaryDto[];
  status?: ChatStatus;
  streaming?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', payload: { content: string; agent: string; provider: string }): void;
  (e: 'stop'): void;
}>();

const { t } = useI18n();

const statusSpec = computed(() => CHAT_STATUS[props.status ?? 'idle']);
const statusClass = computed(() => statusSpec.value.dot);
const statusLabel = computed(() => (statusSpec.value.label ? t(statusSpec.value.label) : ''));

const inputRef = ref<HTMLDivElement | null>(null);
const hasContent = ref(false);
const selectedAgent = ref('');
const selectedProvider = ref('');
/** Set once the user picks an agent by hand; see the agents watcher below. */
const agentChosen = ref(false);

watch(
  () => [props.agents, props.defaultAgent] as const,
  ([agents, defaultAgent]) => {
    // A hand-made choice outranks the stored default: the two arrive on separate
    // requests, so the default can land after the user has already picked one.
    if (agentChosen.value && agents.includes(selectedAgent.value)) {
      return;
    }
    const preferred = defaultAgent && agents.includes(defaultAgent) ? defaultAgent : agents[0];
    selectedAgent.value = preferred ?? '';
  },
  { immediate: true },
);

function chooseAgent(event: Event) {
  agentChosen.value = true;
  selectedAgent.value = (event.target as HTMLSelectElement).value;
}

watch(
  () => props.providers,
  (providers) => {
    const names = providers.map((p) => providerDisplayName(p));
    if (!names.includes(selectedProvider.value)) {
      selectedProvider.value = names[0] ?? '';
    }
  },
  { immediate: true },
);

function readText(el: HTMLElement | null): string {
  if (!el) {
    return '';
  }
  const editable = el as unknown as { innerText?: string; textContent: string | null };
  return (editable.innerText ?? editable.textContent ?? '').trim();
}

function handleInput() {
  hasContent.value = readText(inputRef.value) !== '';
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}

function handlePaste(e: ClipboardEvent) {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain');
  if (!text || !inputRef.value) {
    return;
  }
  const sel = window.getSelection();
  if (!sel?.rangeCount) {
    document.execCommand('insertText', false, text);
    handleInput();
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) {
      range.insertNode(document.createElement('br'));
      range.collapse(false);
    }
    range.insertNode(document.createTextNode(line));
    range.collapse(false);
  });
  handleInput();
}

function submit() {
  const content = readText(inputRef.value);
  if (!content) {
    return;
  }
  emit('submit', { content, agent: selectedAgent.value, provider: selectedProvider.value });
}

function clear() {
  if (inputRef.value) {
    inputRef.value.innerHTML = '';
  }
  hasContent.value = false;
}

defineExpose({ inputRef, clear });
</script>
