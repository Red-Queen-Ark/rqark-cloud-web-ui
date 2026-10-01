<template>
    <li>
        <p>Chat</p>
        <ul>
            <li>
                <RouterLink :to="{ name: 'home' }">
                    + New Session
                </RouterLink>
            </li>
            <li v-for="session in sessions" :key="session.id" :class="{ 'menu-active': false }" @click="() => openChat(session)">
                <p>{{ session.title }}</p>
            </li>
        </ul>
    </li>
</template>

<script setup lang="ts"> 
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getSessions, type ApiSessionDto } from '@/api';

const route = useRoute();
const router = useRouter();
const sessions = ref<ApiSessionDto[]>([])

function openChat(session: ApiSessionDto) {
  if (!session.id) {
    return;
  }
  // `lang` is part of the parent route, so it travels with the link.
  void router.push({ name: 'chat', params: { lang: route.params.lang as string, uuid: session.id } });
}

onMounted( async () => {
    const res = await getSessions()
    if ( res.data ) {
        sessions.value = res.data
    }
})
</script>