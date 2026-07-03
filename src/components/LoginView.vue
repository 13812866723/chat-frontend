<!-- src/components/LoginView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import request from '@/api/request';
import type { AuthResponse } from '@/types/user';

const emit = defineEmits<{ login: [userId: number, username: string] }>()

const username = ref('')
const password = ref('')
const isLoginMode = ref(true)
const loading = ref(false)
const errorMsg = ref('')

const submit = async () => {
  errorMsg.value = ''
  
  if (!username.value.trim() || !password.value.trim()) {
    errorMsg.value = '请填写用户名和密码'
    return
  }

  loading.value = true
  
  try {
    if (isLoginMode.value) {
      const response = await request.post<AuthResponse>('/user/login', {
        username: username.value.trim(),
        password: password.value.trim()
      })
      
      // 保存 JWT token 到 localStorage
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('userId', String(response.data.user.id))
      
      emit('login', response.data.user.id, response.data.user.username)
    } else {
      const response = await request.post<AuthResponse>('/user/register', {
        username: username.value.trim(),
        password: password.value.trim()
      })
      
      // 保存 JWT token 到 localStorage
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('userId', String(response.data.user.id))
      
      emit('login', response.data.user.id, response.data.user.username)
    }
  } catch (error: any) {
    errorMsg.value = error.response?.data?.detail || '请求失败，请重试'
  } finally {
    loading.value = false
  }
}

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  errorMsg.value = ''
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h2>💬 AI Chat</h2>
      <p class="hint">{{ isLoginMode ? '登录以继续' : '注册新账号' }}</p>
      
      <input v-model="username" placeholder="用户名" autofocus />
      <input v-model="password" type="password" placeholder="密码" @keyup.enter="submit" />
      
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      
      <button @click="submit" :disabled="loading">
        {{ loading ? '处理中...' : (isLoginMode ? '登录' : '注册') }}
      </button>
      
      <p class="toggle-text" @click="toggleMode">
        {{ isLoginMode ? '还没有账号？立即注册' : '已有账号？去登录' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-container { display: flex; align-items: center; justify-content: center; height: 100%; background: var(--bg-primary); }
.login-card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; width: 360px; }
.login-card h2 { margin-bottom: 8px; color: var(--text-main); }
.hint { color: var(--text-sub); font-size: 14px; margin-bottom: 24px; }
input { width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 16px; outline: none; margin-bottom: 12px; }
input:focus { border-color: var(--primary-color); }
.error { color: #e55; font-size: 13px; margin-bottom: 12px; }
button { width: 100%; padding: 12px; background: var(--primary-color); color: #fff; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.toggle-text { color: var(--text-sub); font-size: 13px; margin-top: 16px; cursor: pointer; }
.toggle-text:hover { color: var(--primary-color); }
</style>
