<template>
  <div id="chat-input-area" class="py-2 px-3 bg-base-100 shrink-0 relative">
    <SlashCommandPanel :entries="slashEntries" :active-index="slashIndex" :label="t('chat.slashPanelLabel')" @select="completeSlash" @hover="slashIndex = $event" />
    <div class="bg-base-200 rounded-box border border-base-300">
      <div class="py-2 px-3">
        <div class="min-h-9 max-h-32 overflow-y-auto scrollbar-thin">
          <div
            id="chat-input-editor"
            ref="inputRef"
            data-testid="chat-input"
            contenteditable="true"
            class="w-full py-1.5 px-1 bg-transparent outline-none text-sm text-base-content whitespace-pre-wrap"
            :placeholder="t('chat.inputPlaceholder')"
            role="textbox"
            aria-multiline="true"
            :aria-label="t('chat.inputPlaceholder')"
            @keydown="handleKeydown"
            @input="handleInput"
            @paste="handlePaste"
            @blur="closeSlash"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
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
        <div class="ml-auto flex items-center gap-1">
          <button v-if="micAvailable" id="chat-input-voice-btn" data-testid="chat-voice" class="btn btn-sm btn-square" :class="voiceClass" :title="voiceLabel" :aria-label="voiceLabel" :aria-pressed="voiceOn" @click="toggleVoice">
            <span v-if="voiceConnecting" class="loading loading-spinner loading-xs"></span>
            <WaveformIcon v-else class="h-5 w-5" :class="voiceListening ? 'animate-pulse' : ''" />
          </button>
          <button
            v-if="!streaming && micAvailable && !voiceOn"
            id="chat-input-mic-btn"
            data-testid="chat-mic"
            class="btn btn-sm btn-square"
            :class="isRecording ? 'btn-error' : 'btn-ghost'"
            :disabled="isTranscribing"
            :title="micLabel"
            :aria-label="micLabel"
            :aria-pressed="isRecording"
            @click="toggleRecording"
          >
            <span v-if="isTranscribing" class="loading loading-spinner loading-xs"></span>
            <MicIcon v-else class="h-5 w-5" />
          </button>
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
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ApiProviderSummaryDto } from '@/api';
import { CHAT_STATUS, type ChatStatus } from '@/config/chatStatus';
import { providerDisplayName } from '@/config/providers';
import { slashEntries as buildSlashEntries, type SlashEntry } from '@/config/slashCommands';
import { useSopList } from '@/composables/useSopList';
import { canRecord, useRecorder } from '@/composables/useRecorder';
import { canStream, useVoiceStream } from '@/composables/useVoiceStream';
import { useAlertStore } from '@/stores/alertStore';
import SlashCommandPanel from '@/components/Chat/SlashCommandPanel.vue';
import BoltIcon from '@/components/svg/BoltIcon.vue';
import MicIcon from '@/components/svg/MicIcon.vue';
import SendIcon from '@/components/svg/SendIcon.vue';
import StopIcon from '@/components/svg/StopIcon.vue';
import WaveformIcon from '@/components/svg/WaveformIcon.vue';
import UserIcon from '@/components/svg/UserIcon.vue';

const props = defineProps<{
  agents: string[];
  /** The agent this chat was last sent to, when it is still on offer. */
  initialAgent?: string;
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
const alertStore = useAlertStore();

const statusSpec = computed(() => CHAT_STATUS[props.status ?? 'idle']);
const statusClass = computed(() => statusSpec.value.dot);
const statusLabel = computed(() => (statusSpec.value.label ? t(statusSpec.value.label) : ''));

const inputRef = ref<HTMLDivElement | null>(null);
const hasContent = ref(false);
const selectedAgent = ref('');
const selectedProvider = ref('');
/** Set once the user picks an agent by hand; see the agents watcher below. */
const agentChosen = ref(false);

const { sops, load: loadSops } = useSopList();
watch(sops, () => refreshSlash());

// The streaming path lets the server frame the utterance with its own VAD and hands
// back a transcript per utterance while the mic stays open. Browsers that cannot run an
// audio worklet fall back to recording one clip and uploading it.
const micStreams = canStream();
const micAvailable = micStreams || canRecord();
const voice = useVoiceStream((text, _truncated, mode) => (mode === 'wake' ? submitTranscript(text) : insertTranscript(text)));
const recorder = useRecorder(insertTranscript);
const micErrorKey = computed(() => (micStreams ? voice.errorKey.value : recorder.errorKey.value));
const isRecording = computed(() => (micStreams ? voice.isListening.value : recorder.isRecording.value));
const isTranscribing = computed(() => (micStreams ? voice.isBusy.value : recorder.isTranscribing.value));

/**
 * Microphone trouble is reported where every other failure is reported: the alert stack
 * in the app shell. The key is cleared once it has been shown so the same message can be
 * raised again on a later attempt.
 */
const WARNING_MIC_KEYS = new Set(['chat.micEmpty', 'chat.voiceNoWakeWord', 'chat.voiceWakeTimeout']);
watch(
  micErrorKey,
  (key) => {
    if (!key) {
      return;
    }
    const level = WARNING_MIC_KEYS.has(key) ? 'warning' : 'error';
    alertStore.addItem({ level, message: t(key) });
    if (micStreams) {
      voice.clearError();
    } else {
      recorder.clearError();
    }
  },
  { flush: 'post' },
);
const micLabel = computed(() => {
  if (isRecording.value) {
    return t('chat.micStop');
  }
  if (isTranscribing.value) {
    return t(micStreams && voice.state.value === 'stopping' ? 'chat.micTranscribing' : 'chat.micConnecting');
  }
  return t('chat.micStart');
});

const voiceOn = computed(() => voice.mode.value === 'wake' && voice.isOn.value);
const voiceConnecting = computed(() => voiceOn.value && voice.state.value === 'connecting');
const voiceListening = computed(() => voice.isListening.value);
const voiceClass = computed(() => {
  if (voiceListening.value) {
    return 'btn-error';
  }
  return voiceOn.value ? 'btn-secondary' : 'btn-ghost';
});
const voiceLabel = computed(() => {
  if (!voiceOn.value) {
    return t('chat.voiceStart');
  }
  return t(voiceListening.value ? 'chat.voiceListening' : 'chat.voiceArmed');
});

function toggleVoice() {
  void voice.toggleWake();
}

function toggleRecording() {
  void (micStreams ? voice.toggle() : recorder.toggle());
}
/** The panel's rows; empty while it is closed, which is what hides it. */
const slashEntries = ref<SlashEntry[]>([]);
const slashIndex = ref(0);
/** True between compositionstart and compositionend, i.e. while an IME is composing. */
const composing = ref(false);

watch(
  () => [props.agents, props.defaultAgent, props.initialAgent] as const,
  ([agents, defaultAgent, initialAgent]) => {
    // A hand-made choice outranks the stored default: the two arrive on separate
    // requests, so the default can land after the user has already picked one.
    if (agentChosen.value && agents.includes(selectedAgent.value)) {
      return;
    }
    const preferred = firstOnOffer(agents, initialAgent) ?? firstOnOffer(agents, defaultAgent) ?? agents[0];
    selectedAgent.value = preferred ?? '';
  },
  { immediate: true },
);

/** The first of `names` that the picker can actually offer, or undefined. */
function firstOnOffer(agents: string[], name?: string): string | undefined {
  return name && agents.includes(name) ? name : undefined;
}

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

/**
 * The text a slash panel would look at, or null when the editor cannot name a
 * command: only a single line that opens with `/` and carries no whitespace
 * qualifies, so `/clear` opens the panel and `/clear the log` does not.
 */
function slashQuery(): string | null {
  const el = inputRef.value;
  if (!el) {
    return null;
  }
  const editable = el as unknown as { innerText?: string; textContent: string | null };
  const raw = editable.innerText ?? editable.textContent ?? '';
  if (!raw.startsWith('/') || /\s/.test(raw)) {
    return null;
  }
  return raw;
}

function refreshSlash() {
  const query = composing.value ? null : slashQuery();
  if (query === null) {
    closeSlash();
    return;
  }

  const entries = buildSlashEntries(query, sops.value, (key) => t(key));
  slashEntries.value = entries;
  // The highlight stays where it is while the list still has that row, so a
  // character that narrows the list does not also move the choice.
  slashIndex.value = Math.min(slashIndex.value, Math.max(0, entries.length - 1));
}

function closeSlash() {
  slashEntries.value = [];
  slashIndex.value = 0;
}

/**
 * Completes the highlighted row: the editor is replaced with `/<name> ` and the
 * caret put after it. The turn is not sent — a SOP takes arguments, so the user
 * is given the space to type them.
 */
function completeSlash(index: number) {
  const entry = slashEntries.value[index];
  if (!entry || !inputRef.value) {
    closeSlash();
    return;
  }

  const text = `${entry.name} `;
  inputRef.value.textContent = text;
  const range = document.createRange();
  range.selectNodeContents(inputRef.value);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  hasContent.value = true;
  closeSlash();
}

function moveSlash(delta: number) {
  const count = slashEntries.value.length;
  if (count === 0) {
    return;
  }
  slashIndex.value = (slashIndex.value + delta + count) % count;
}

function handleCompositionStart() {
  composing.value = true;
  closeSlash();
}

function handleCompositionEnd() {
  composing.value = false;
  refreshSlash();
}

function handleInput() {
  hasContent.value = readText(inputRef.value) !== '';
  refreshSlash();
}

function handleKeydown(e: KeyboardEvent) {
  if (slashEntries.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSlash(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSlash(-1);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      completeSlash(slashIndex.value);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSlash();
      return;
    }
  }

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

function insertTranscript(text: string) {
  const el = inputRef.value;
  if (!el) {
    return;
  }
  const existing = readText(el);
  el.textContent = existing ? `${existing} ${text}` : text;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  hasContent.value = true;
  refreshSlash();
  el.focus();
}

function submitTranscript(text: string) {
  if (!inputRef.value) {
    return;
  }
  inputRef.value.textContent = text;
  hasContent.value = true;
  closeSlash();
  submit();
  clear();
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
  closeSlash();
}

onMounted(() => {
  // Read once, in the background: a deployment without the data cloud answers
  // nothing and the panel keeps offering only the built-in commands.
  void loadSops();
});

defineExpose({ inputRef, clear });
</script>
