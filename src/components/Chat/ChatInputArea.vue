<template>
  <div
    id="chat-input-area"
    class="py-2 px-3 bg-base-100 shrink-0 relative"
    @dragenter.prevent="onDragOver"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <SlashCommandPanel :entries="slashEntries" :active-index="slashIndex" :label="t('chat.slashPanelLabel')" @select="completeSlash" @hover="slashIndex = $event" />
    <FileMentionPanel :entries="fileEntries" :active-index="fileIndex" :label="t('chat.filePanelLabel')" @select="completeMention" @hover="fileIndex = $event" />
    <div v-if="dragging" data-testid="chat-drop-overlay" class="absolute inset-0 z-10 m-2 rounded-box border-2 border-dashed border-primary bg-base-100/85 flex items-center justify-center gap-1.5 text-sm text-primary pointer-events-none">
      <UploadIcon class="h-5 w-5" />
      {{ t('chat.dropImage') }}
    </div>
    <div class="bg-base-200 rounded-box border border-base-300 overflow-hidden">
      <div v-if="images.length > 0" data-testid="chat-images" class="flex flex-wrap gap-2 px-3 pt-2">
        <div v-for="(image, index) in images" :key="image.id" data-testid="chat-image" class="relative">
          <img
            v-if="image.dataUri"
            :src="image.dataUri"
            :alt="image.name"
            class="rounded-box h-16 w-16 p-1 object-cover bg-base-200/40 border"
            :class="image.status === 'error' ? 'border-error opacity-50' : 'border-base-300'"
          />
          <div v-else class="rounded-box h-16 w-16 p-1 flex items-center justify-center bg-base-200/40 border border-base-300">
            <span v-if="image.status === 'reading'" data-testid="chat-image-reading" class="loading loading-spinner loading-xs" :title="t('chat.imageReading')"></span>
            <ImageIcon v-else class="h-6 w-6 opacity-40" />
          </div>
          <button
            v-if="image.status === 'error'"
            type="button"
            data-testid="chat-image-retry"
            class="btn btn-circle btn-xs btn-warning absolute -bottom-1.5 -left-1.5"
            :title="t('chat.imageRetry')"
            :aria-label="t('chat.imageRetry')"
            @click="retryImage(index)"
          >
            <RefreshIcon class="h-3 w-3" />
          </button>
          <button type="button" data-testid="chat-image-remove" class="btn btn-circle btn-xs absolute -top-1.5 -right-1.5" :title="t('chat.removeImage')" :aria-label="t('chat.removeImage')" @click="removeImage(index)">
            <CloseIcon class="h-3 w-3" />
          </button>
        </div>
      </div>
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
            @blur="handleBlur"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
          ></div>
        </div>
      </div>

      <div class="flex items-center gap-2 px-3 pb-2 pt-1.5 border-t border-base-300/50 bg-base-300/30 rounded-b-box">
        <div v-if="statusClass" data-testid="chat-status" :class="['status', statusClass]" :aria-label="statusLabel" :title="statusLabel"></div>
        <div class="flex min-w-0 flex-1 basis-0 items-center gap-1 text-xs text-base-content/70">
          <BoltIcon class="h-3.5 w-3.5 shrink-0 opacity-60" />
          <select class="select select-bordered select-xs bg-base-100 w-full min-w-0 max-w-36" :value="selectedProvider" :disabled="providers.length === 0" @change="selectedProvider = ($event.target as HTMLSelectElement).value">
            <option v-if="providers.length === 0" value="" disabled>{{ t('chat.noProviders') }}</option>
            <option v-for="(p, i) in providers" :key="providerDisplayName(p) || i" :value="providerDisplayName(p)">{{ providerDisplayName(p) }}</option>
          </select>
        </div>
        <span class="shrink-0 text-base-content/20">|</span>
        <div class="flex min-w-0 flex-1 basis-0 items-center gap-1 text-xs text-base-content/70">
          <UserIcon class="h-3.5 w-3.5 shrink-0 opacity-60" />
          <select class="select select-bordered select-xs bg-base-100 w-full min-w-0 max-w-36" :value="selectedAgent" :disabled="agents.length === 0" @change="chooseAgent">
            <option v-if="agents.length === 0" value="" disabled>{{ t('chat.noAgents') }}</option>
            <!-- Keyed by position: two names may repeat, and the wire only carries
            the name, so the two entries are the same choice either way. -->
            <option v-for="(a, i) in agents" :key="i" :value="a">{{ a }}</option>
          </select>
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-1">
          <input ref="imageInputRef" data-testid="chat-image-input" type="file" accept="image/*" multiple class="hidden" @change="pickImages" />
          <input ref="cameraInputRef" data-testid="chat-camera-input" type="file" accept="image/*" capture="environment" class="hidden" @change="pickImages" />
          <button v-if="!streaming" id="chat-input-image-btn" data-testid="chat-image-attach" class="btn btn-ghost btn-sm btn-square" :title="t('chat.attachImage')" :aria-label="t('chat.attachImage')" @click="imageInputRef?.click()">
            <ImageIcon class="h-5 w-5" />
          </button>
          <button v-if="!streaming" id="chat-input-camera-btn" data-testid="chat-camera" class="btn btn-ghost btn-sm btn-square" :title="t('chat.takePhoto')" :aria-label="t('chat.takePhoto')" @click="cameraInputRef?.click()">
            <CameraIcon class="h-5 w-5" />
          </button>
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
          <button v-else id="chat-input-send-btn" data-testid="chat-send" class="btn btn-primary btn-sm btn-square" :disabled="!canSend" :title="t('chat.send')" :aria-label="t('chat.send')" @click="submit">
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
import type { WorkspaceEntry } from '@/config/workspace';
import { completeWorkspace } from '@/api-client/workspace';
import { mentionQuery, type MentionQuery } from '@/components/Chat/fileMention';
import { IMAGE_MAX_BYTES, IMAGE_MAX_PER_MESSAGE, IMAGE_TYPES, clipboardImages, dataUriBytes, droppedImages, shrinkImage } from '@/components/Chat/imageAttachment';
import { useSopList } from '@/composables/useSopList';
import { useSpeechAvailability } from '@/composables/useSpeechAvailability';
import { canRecord, useRecorder } from '@/composables/useRecorder';
import { canStream, useVoiceStream } from '@/composables/useVoiceStream';
import { useAlertStore } from '@/stores/alertStore';
import SlashCommandPanel from '@/components/Chat/SlashCommandPanel.vue';
import FileMentionPanel from '@/components/Chat/FileMentionPanel.vue';
import BoltIcon from '@/components/svg/BoltIcon.vue';
import CameraIcon from '@/components/svg/CameraIcon.vue';
import CloseIcon from '@/components/svg/CloseIcon.vue';
import ImageIcon from '@/components/svg/ImageIcon.vue';
import MicIcon from '@/components/svg/MicIcon.vue';
import RefreshIcon from '@/components/svg/RefreshIcon.vue';
import SendIcon from '@/components/svg/SendIcon.vue';
import StopIcon from '@/components/svg/StopIcon.vue';
import UploadIcon from '@/components/svg/UploadIcon.vue';
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
  (e: 'submit', payload: { content: string; agent: string; provider: string; images: string[] }): void;
  (e: 'stop'): void;
}>();

const { t } = useI18n();
const alertStore = useAlertStore();

const statusSpec = computed(() => CHAT_STATUS[props.status ?? 'idle']);
const statusClass = computed(() => statusSpec.value.dot);
const statusLabel = computed(() => (statusSpec.value.label ? t(statusSpec.value.label) : ''));

const inputRef = ref<HTMLDivElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const hasContent = ref(false);
/** An attachment keeps its tile from the moment it is picked, so a slow read shows progress. */
interface Attachment { id: number; name: string; dataUri: string; status: 'reading' | 'ready' | 'error'; file: File }
let nextAttachmentId = 0;
const images = ref<Attachment[]>([]);
const dragging = ref(false);
const readyImages = computed(() => images.value.filter((image) => image.status === 'ready'));
const canSend = computed(() => hasContent.value || readyImages.value.length > 0);
const selectedAgent = ref('');
const selectedProvider = ref('');
/** Set once the user picks an agent by hand; see the agents watcher below. */
const agentChosen = ref(false);

const { sops, load: loadSops } = useSopList();
watch(sops, () => refreshSlash());

// The streaming path lets the server frame the utterance with its own VAD and hands
// back a transcript per utterance while the mic stays open. Browsers that cannot run an
// audio worklet fall back to recording one clip and uploading it. A server with the
// speech routes switched off offers neither.
const speech = useSpeechAvailability();
void speech.load();
const micStreams = canStream();
const micAvailable = computed(() => speech.available.value && (micStreams || canRecord()));
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

function rawText(el: HTMLElement | null): string {
  if (!el) {
    return '';
  }
  const editable = el as unknown as { innerText?: string; textContent: string | null };
  return editable.innerText ?? editable.textContent ?? '';
}

function readText(el: HTMLElement | null): string {
  return rawText(el).trim();
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

/** Rows in the `@` panel; empty while it is closed, which is what hides it. */
const fileEntries = ref<WorkspaceEntry[]>([]);
const fileIndex = ref(0);
/** The live `@` token, kept so completing it knows how much text to replace. */
let mention: MentionQuery | null = null;
let mentionTimer: ReturnType<typeof setTimeout> | undefined;
/** Bumped on every request so a slow answer cannot overwrite a newer one. */
let mentionRequest = 0;
const MENTION_DEBOUNCE_MS = 120;
const MENTION_LIMIT = 50;

/** The editor's text from the start up to the caret, or null when it has no caret. */
function textBeforeCaret(): string | null {
  const el = inputRef.value;
  const selection = window.getSelection();
  if (!el || !selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) {
    return null;
  }
  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  return fragmentText(before.cloneContents());
}

/** Flattens a fragment the way `innerText` would, counting line breaks. */
function fragmentText(fragment: DocumentFragment): string {
  let text = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
      return;
    }
    if (node.nodeName === 'BR') {
      text += '\n';
      return;
    }
    if (node.nodeName === 'DIV' || node.nodeName === 'P') {
      if (text && !text.endsWith('\n')) {
        text += '\n';
      }
    }
    node.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);
  return text;
}

function closeMention() {
  fileEntries.value = [];
  fileIndex.value = 0;
  mention = null;
  mentionRequest += 1;
  if (mentionTimer) {
    clearTimeout(mentionTimer);
    mentionTimer = undefined;
  }
}

async function loadMention(query: string) {
  const request = mentionRequest;
  try {
    const entries = await completeWorkspace(query, MENTION_LIMIT);
    if (request !== mentionRequest) {
      return;
    }
    fileEntries.value = entries;
    fileIndex.value = Math.min(fileIndex.value, Math.max(0, entries.length - 1));
  } catch {
    if (request === mentionRequest) {
      fileEntries.value = [];
    }
  }
}

/** Re-reads the `@` token under the caret and schedules the matching rows. */
function refreshMention() {
  if (composing.value || slashEntries.value.length > 0) {
    closeMention();
    return;
  }
  const before = textBeforeCaret();
  const found = before === null ? null : mentionQuery(before);
  if (!found) {
    closeMention();
    return;
  }
  mention = found;
  mentionRequest += 1;
  if (mentionTimer) {
    clearTimeout(mentionTimer);
  }
  mentionTimer = setTimeout(() => {
    mentionTimer = undefined;
    void loadMention(found.query);
  }, MENTION_DEBOUNCE_MS);
}

/**
 * Replaces the live `@token` with `@<path>` and the caret after it. A directory
 * gets a trailing slash and keeps the panel open, so the next segment can be
 * typed; a file gets a space because the mention is finished.
 */
function completeMention(index: number) {
  const entry = fileEntries.value[index];
  const el = inputRef.value;
  const before = el ? textBeforeCaret() : null;
  if (!entry || !mention || !el || before === null) {
    closeMention();
    return;
  }
  const isDirectory = entry.type === 'dir';
  const replacement = `@${entry.path}${isDirectory ? '/' : ' '}`;
  const text = rawText(el);
  const start = mention.start;
  const end = start + 1 + mention.query.length;
  // The token always sits before the caret, so the caret offset is past `end`.
  const next = text.slice(0, start) + replacement + text.slice(end);
  const caret = start + replacement.length;
  el.textContent = next;
  placeCaret(el, caret);
  hasContent.value = next.trim() !== '';
  if (isDirectory) {
    refreshMention();
  } else {
    closeMention();
  }
}

/** Puts a collapsed caret at `offset` in an editor holding a single text node. */
function placeCaret(el: HTMLElement, offset: number) {
  const range = document.createRange();
  const node = el.firstChild;
  if (node && node.nodeType === Node.TEXT_NODE) {
    range.setStart(node, Math.min(offset, node.textContent?.length ?? 0));
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function moveMention(delta: number) {
  const count = fileEntries.value.length;
  if (count === 0) {
    return;
  }
  fileIndex.value = (fileIndex.value + delta + count) % count;
}

function handleBlur() {
  closeSlash();
  closeMention();
}

function handleCompositionStart() {
  composing.value = true;
  closeSlash();
  closeMention();
}

function handleCompositionEnd() {
  composing.value = false;
  refreshSlash();
  refreshMention();
}

function handleInput() {
  hasContent.value = readText(inputRef.value) !== '';
  refreshSlash();
  refreshMention();
}

function handleKeydown(e: KeyboardEvent) {
  if (fileEntries.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveMention(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveMention(-1);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      completeMention(fileIndex.value);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMention();
      return;
    }
  }

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
  const pasted = clipboardImages(e.clipboardData ?? null);
  if (pasted.length > 0) {
    e.preventDefault();
    void addFiles(pasted);
    return;
  }
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
  closeMention();
  submit();
  clear();
}

// The wire format is the same base64 data URI the terminal client sends, so the
// server only has to check the declared type and the size before forwarding it.
// The limits themselves live beside the helpers that enforce them.

/**
 * Takes files into the strip. Each one gets a tile straight away, so a photo
 * that is still decoding shows a spinner where it will appear. The in-flight
 * loads are returned so a caller can wait for them.
 */
function addFiles(files: File[]): Promise<void>[] {
  const loads: Promise<void>[] = [];
  for (const file of files) {
    if (images.value.length >= IMAGE_MAX_PER_MESSAGE) {
      break;
    }
    if (!IMAGE_TYPES.has(file.type)) {
      alertStore.addItem({ level: 'error', message: t('chat.imageUnsupported') });
      continue;
    }
    const attachment: Attachment = { id: (nextAttachmentId += 1), name: file.name || 'image', dataUri: '', status: 'reading', file };
    images.value.push(attachment);
    loads.push(loadAttachment(attachment.id));
  }
  return loads;
}

/** The live proxy behind a tile: writing to the object we pushed would not notify the view. */
function tileOf(id: number): Attachment | undefined {
  return images.value.find((image) => image.id === id);
}

/**
 * Shrinks the photo, then fills in its tile. A failure leaves the tile in place
 * behind a retry button: re-reading the same file is what a user would do next,
 * and the file is still held.
 */
async function loadAttachment(id: number) {
  const tile = tileOf(id);
  if (!tile) {
    return;
  }
  tile.status = 'reading';
  tile.dataUri = '';
  try {
    const dataUri = await shrinkImage(tile.file);
    const current = tileOf(id);
    if (!current) {
      return;
    }
    if (dataUriBytes(dataUri) > IMAGE_MAX_BYTES) {
      current.status = 'error';
      alertStore.addItem({ level: 'error', message: t('chat.imageTooLarge') });
      return;
    }
    current.dataUri = dataUri;
    current.status = 'ready';
  } catch (error) {
    const current = tileOf(id);
    if (!current) {
      return;
    }
    current.status = 'error';
    const name = (error as { name?: string } | null)?.name;
    alertStore.addItem({ level: 'error', message: t(name === 'NotReadableError' ? 'chat.imageUnreadable' : 'chat.imageReadError') });
  }
}

function retryImage(index: number) {
  const attachment = images.value[index];
  if (attachment) {
    void loadAttachment(attachment.id);
  }
}

async function pickImages(event: Event) {
  const input = event.target as HTMLInputElement;
  // Every read is kicked off here, synchronously: iOS revokes a File reference
  // as soon as the change handler yields, so waiting between two of them fails.
  const loads = addFiles(Array.from(input.files ?? []));
  try {
    await Promise.allSettled(loads);
  } finally {
    // Only now: clearing the input releases the File objects, and Safari revokes
    // them on the spot, so doing it up front makes every read fail.
    input.value = '';
  }
}

function onDragOver(event: DragEvent) {
  if (!event.dataTransfer) {
    return;
  }
  event.dataTransfer.dropEffect = 'copy';
  dragging.value = true;
}

function onDragLeave(event: DragEvent) {
  // dragleave also fires when the pointer crosses onto a child, so only a
  // pointer that has left the whole area counts.
  const container = event.currentTarget as HTMLElement | null;
  if (container && event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) {
    return;
  }
  dragging.value = false;
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  const files = droppedImages(event.dataTransfer);
  if (files.length > 0) {
    void addFiles(files);
  }
}

function removeImage(index: number) {
  images.value.splice(index, 1);
}

function submit() {
  const content = readText(inputRef.value);
  if (!content && readyImages.value.length === 0) {
    return;
  }
  emit('submit', { content, agent: selectedAgent.value, provider: selectedProvider.value, images: readyImages.value.map((image) => image.dataUri) });
}

function clear() {
  if (inputRef.value) {
    inputRef.value.innerHTML = '';
  }
  hasContent.value = false;
  images.value = [];
  closeSlash();
  closeMention();
}

onMounted(() => {
  // Read once, in the background: a deployment without the data cloud answers
  // nothing and the panel keeps offering only the built-in commands.
  void loadSops();
});

defineExpose({ inputRef, clear });
</script>
