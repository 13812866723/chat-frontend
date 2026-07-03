<!-- src/App.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import LoginView from './components/LoginView.vue'
import ChatLayout from './components/ChatLayout.vue'

const currentUser = ref<{ id: number; username: string } | null>(null)

const handleLogin = (userId: number, username: string) => {
  currentUser.value = { id: userId, username: username }
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userId')
  currentUser.value = null
}
</script>

<template>
  <!-- 未登录显示登录页，已登录显示聊天页 -->
  <LoginView v-if="!currentUser" @login="handleLogin" />
  <ChatLayout v-else :username="currentUser.username" :userId="currentUser.id" @logout="handleLogout" />
</template>