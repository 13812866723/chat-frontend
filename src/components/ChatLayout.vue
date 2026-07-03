<!-- src/components/ChatLayout.vue -->
<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import request from '@/api/request'
import { marked } from 'marked'

// 配置 marked
marked.setOptions({
  breaks: true,  // 允许 GitHub 风格的换行
  gfm: true      // 启用 GitHub 风格 Markdown
})

const props = defineProps<{ 
  username: string
  userId: number
}>()
const emit = defineEmits<{ logout: [] }>()

// --- 类型定义 ---
// interface Message { role: 'user' | 'assistant'; content: string; intent?: string; sources?: Source[] }
// interface Source { source: string; similarity: number; content_preview: string }
interface Message { role: 'user' | 'assistant'; content: string; intent?: string[]; sources?: string }

interface Session { id: string; title: string; messages: Message[]; createdAt: number }

// 后端返回的会话类型
interface BackendSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

// --- Session 管理 ---
const sessions = ref<Session[]>([])
const activeSessionId = ref<string | null>(null)
const loading = ref(false)

// 从后端获取会话列表
const fetchSessions = async () => {
  loading.value = true
  try {
    const response = await request.get<BackendSession[]>('/chat/conversation/list')
    // 转换后端数据为前端格式
    sessions.value = response.data.map(session => ({
      id: session.id,
      title: session.title,
      messages: [],  // 消息列表后续单独获取
      createdAt: new Date(session.updated_at).getTime()
    }))
    // 默认选中第一个会话
    if (sessions.value.length > 0) {
      activeSessionId.value = sessions.value[0].id
      // 获取第一个会话的消息
      // fetchMessages(sessions.value[0].id)
    } else {
      // 没有会话时自动创建第一个会话
      await createSession()
    }
  } catch (error) {
    console.error('获取会话列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取会话的消息列表
const fetchMessages = async (sessionId: string) => {
  try {
    const response = await request.get<{ id: string; role: 'user' | 'assistant'; content: string; created_at: string }[]>(
      `/chat/conversation/${sessionId}/history`
    )
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      session.messages = response.data.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    }
  } catch (error) {
    console.error('获取消息列表失败:', error)
  }
}

// 创建新会话
const createSession = async () => {
  try {
    const response = await request.post('/chat/conversation/create', {
      user_id: props.userId
    })
    const newSession: Session = {
      id: response.data.id,
      title: response.data.title || '新对话',
      messages: [],
      createdAt: new Date(response.data.created_at).getTime()
    }
    sessions.value.unshift(newSession)
    activeSessionId.value = newSession.id
  } catch (error) {
    console.error('创建会话失败:', error)
  }
}

// 按时间分组 (今天 / 昨天 / 更早)
const groupedSessions = computed(() => {
  const now = new Date(); 
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  
  const groups: Record<string, Session[]> = { '今天': [], '昨天': [], '更早': [] }
  sessions.value.forEach(s => {
    if (s.createdAt >= today) groups['今天'].push(s)
    else if (s.createdAt >= yesterday) groups['昨天'].push(s)
    else groups['更早'].push(s)
  })
  return Object.entries(groups).filter(([_, list]) => list.length > 0)
})

const activeSession = computed(() => sessions.value.find(s => s.id === activeSessionId.value))

// --- 常量 ---
const HINT_TEXT = '支持上传 Word、TXT格式'

// --- 消息发送 ---
const inputText = ref('')
const chatContainer = ref<HTMLElement>()
const sending = ref(false)
const errorMsg = ref('')
const currentIntent = ref<string | null>(null)  // 当前识别的意图
interface UploadedFile { filename: string; file_id: string }
const uploadedFiles = ref<UploadedFile[]>([])  // 已上传的文件列表

// 意图配置
const intentConfig: Record<string, { label: string; icon: string; color: string }> = {
  'rag_chat_tool': { label: 'RAG 检索', icon: '📚', color: '#4CAF50' },
  'chat': { label: '智能对话', icon: '💬', color: '#2196F3' },
  'file_analysis': { label: '文件分析', icon: '📄', color: '#FF9800' },
  'tavily_search_tool': { label: '在线搜索', icon: '🔍', color: '#9C27B0' },
}

// 截断文本
const truncateText = (text: string, maxLength: number = 60): string => {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// 渲染 Markdown
const renderMarkdown = (content: string): string => {
  return marked.parse(content) as string
}

// 删除已上传文件
const removeFile = async (index: number) => {
  const file = uploadedFiles.value[index]
  if (!file) return
  
  try {
    await request.delete(`/upload/${file.file_id}`)
    uploadedFiles.value.splice(index, 1)
    console.log('文件删除成功:', file.filename)
  } catch (error) {
    console.error('文件删除失败:', error)
    errorMsg.value = '文件删除失败，请重试'
  }
}

// 文件上传
const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  
  const file = input.files[0]
  const formData = new FormData()
  formData.append('file', file)
  formData.append('conversation_id', activeSession.value?.id || '')
  
  try {
    const response = await request.post('/upload/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    uploadedFiles.value.push({
      filename: response.data.filename || file.name,
      file_id: response.data.file_id
    })
    console.log('文件上传成功:', response.data)
  } catch (error) {
    console.error('文件上传失败:', error)
    errorMsg.value = '文件上传失败，请重试'
  }
  
  // 清空 input 以允许重复上传同一文件
  input.value = ''
}

// 友好的错误提示
const getErrorMessage = (error: any): string => {
  const status = error?.response?.status || error?.status
  const detail = error?.response?.data?.detail || error?.detail
  
  // 根据不同错误类型返回友好提示
  if (!status) {
    // 网络错误
    return '网络连接失败，请检查网络后重试'
  }
  
  switch (status) {
    case 400:
      return detail || '请求参数错误'
    case 401:
      return '登录已过期，请重新登录'
    case 403:
      return '没有权限访问，请联系管理员'
    case 404:
      return '请求的资源不存在'
    case 429:
      return '请求过于频繁，请稍后再试'
    case 500:
      return '服务器开小差了，请稍后再试'
    case 502:
    case 503:
    case 504:
      return '服务暂时不可用，请稍后重试'
    default:
      return detail || '发生了未知错误，请重试'
  }
}

const sendMessage = async () => {
  if (!inputText.value.trim() || !activeSession.value || sending.value) return
  const content = inputText.value.trim()
  inputText.value = ''
  sending.value = true
  errorMsg.value = '' // 清除之前的错误提示
  
  // 添加用户消息到列表
  activeSession.value.messages.push({ role: 'user', content })
  
  await nextTick()
  chatContainer.value?.scrollTo({ top: chatContainer.value.scrollHeight, behavior: 'smooth' })
  
  // 创建 AI 消息占位符
  const aiMessageIndex = activeSession.value.messages.length
  activeSession.value.messages.push({ role: 'assistant', content: '' })

  try {
    let response
    
    if (uploadedFiles.value.length > 0) {
      // 有文件时，调用文件分析接口
      const fileIds = uploadedFiles.value.map(f => f.file_id)
      response = await fetch('/api/upload/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
        },
        body: JSON.stringify({
          conversation_id: activeSession.value.id,
          content: content,
          file_ids: fileIds
        })
      })
    } else {
      // 无文件时，调用普通对话接口
      response = await fetch('/api/chat/agent/stream', {
      // response = await fetch('/api/chat/task-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
        },
        body: JSON.stringify({
          conversation_id: activeSession.value.id,
          content: content
        })
      })
    }

    // 检查 HTTP 状态码，防止后端报错（如 500）时前端依然尝试解析流
    if (!response.ok) {
      throw new Error(`服务器错误: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法获取响应流')
    }

    let buffer = '' // 缓冲区，防止 SSE 消息被网络截断导致 JSON 解析失败

    while (true) {
      const { done, value } = await reader.read()
      // console.log('done:', done)

      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // 按双换行符 \n\n 分割完整的 SSE 消息
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || '' // 将最后一段不完整的数据留在缓冲区

      console.log('lines:', lines)

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        
        const dataStr = line.substring(5).trimStart()
        
        // 检查结束标志
        if (dataStr === '[DONE]') break 

        try {
          const parsed = JSON.parse(dataStr)

          // 意图识别（支持单个或多个意图）
          if (parsed.intent) {
            const intents = Array.isArray(parsed.intent) ? parsed.intent : [parsed.intent]
            currentIntent.value = intents[intents.length - 1]
            // 合并去重后保存
            const existing = activeSession.value.messages[aiMessageIndex].intent || []
            const merged = [...new Set([...existing, ...intents])]
            activeSession.value.messages[aiMessageIndex].intent = merged
          }

          if (parsed.content) {
            // 只将解析出的 content 拼接到消息中
            activeSession.value.messages[aiMessageIndex].content += parsed.content
          }
          // 如果后端返回了标题，更新会话标题
          if (parsed.title) {
            const targetSession = sessions.value.find(s => s.id === activeSession.value?.id)
            if (targetSession && parsed.title !== '新对话') {
              targetSession.title = parsed.title
            }
          }
          // 如果后端返回了引用来源
          if (parsed.type === 'sources' && parsed.sources) {
            activeSession.value.messages[aiMessageIndex].sources = parsed.sources
          }
        } catch (e) {
          console.warn('JSON 解析失败:', dataStr)
        }
      }
      
      // 将滚动逻辑移出内层循环，减少 DOM 操作频率
      await nextTick()
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }
    }
  } catch (error: any) {
    console.error('流式请求失败:', error)
    // 使用友好的错误提示
    const friendlyError = getErrorMessage(error)
    errorMsg.value = friendlyError
    activeSession.value.messages[aiMessageIndex].content = `⚠️ ${friendlyError}`
  } finally {
    sending.value = false
    if (currentIntent.value === null){
      if (!activeSession.value.messages[aiMessageIndex].intent) {
        activeSession.value.messages[aiMessageIndex].intent = ['chat']
      }
    }
    currentIntent.value = null  // 清除当前意图
    
    // 将会话移动到列表第一位
    if (activeSession.value) {
      const index = sessions.value.findIndex(s => s.id === activeSession.value?.id)
      if (index > 0) {
        const session = sessions.value.splice(index, 1)[0]
        sessions.value.unshift(session)
      }
    }
  }
}


// 监听会话切换，加载历史消息
watch(activeSessionId, async (newSessionId) => {
  if (newSessionId) {
    const session = sessions.value.find(s => s.id === newSessionId)
    if (session && session.messages.length === 0) {
      await fetchMessages(newSessionId)
      // 加载完成后滚动到底部
      await nextTick()
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }
    }
  }
})

// 组件挂载时获取会话列表
onMounted(() => {
  fetchSessions()
})
</script>

<template>
  <div class="chat-layout">
    <!-- 侧栏 -->
    <aside class="sidebar">
      <button class="new-chat-btn" @click="createSession">➕ 新建对话</button>
      <nav class="session-list">
        <div v-if="loading" class="loading">加载中...</div>
        <template v-else>
          <div v-for="[label, list] in groupedSessions" :key="label" class="group">
            <span class="group-label">{{ label }}</span>
            <div 
              v-for="session in list" :key="session.id"
              class="session-item"
              :class="{ active: session.id === activeSessionId }"
              @click="activeSessionId = session.id"
            >
              {{ session.title }}
            </div>
          </div>
        </template>
      </nav>
    </aside>

    <!-- 主区域 -->
    <main class="main-area">
      <!-- 顶栏 -->
      <header class="topbar">
        <span class="user-info">👤 {{ username }}</span>
        <button class="logout-btn" @click="emit('logout')">登出</button>
      </header>

      <!-- 聊天内容区 -->
      <div class="chat-content" ref="chatContainer">
        <!-- 错误提示 -->
        <div v-if="errorMsg" class="error-banner">
          <span>⚠️ {{ errorMsg }}</span>
          <button class="error-dismiss" @click="errorMsg = ''">×</button>
        </div>
        
        <!-- 空白欢迎页 -->
        <div v-if="!activeSession || activeSession.messages.length === 0" class="welcome">
          <h1>👋 你好，{{ username }}</h1>
          <p>有什么我可以帮你的吗？你可以问我任何问题或上传文件让我分析。</p>
        </div>
        
        <!-- 消息列表 -->
        <div v-else class="messages">
          <div v-for="(msg, i) in activeSession.messages" :key="i" class="message" :class="msg.role">
            <!-- 意图标签（支持多个） -->
            <div v-if="msg.intent && msg.intent.length > 0" class="intent-badges">
              <div v-for="intent in msg.intent" :key="intent" v-show="intentConfig[intent]" class="intent-badge" :style="{ backgroundColor: intentConfig[intent]?.color }">
                {{ intentConfig[intent]?.icon }} {{ intentConfig[intent]?.label }}
              </div>
            </div>
            <div class="bubble">
              <span v-if="msg.role === 'assistant' && !msg.content && sending" class="loading-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
              <div v-else-if="msg.role === 'assistant'" class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
              <template v-else>{{ msg.content }}</template>
            </div>
            <!-- 引用来源 -->
            <!-- <div v-if="msg.sources && msg.sources.length > 0" class="sources">
              <div class="sources-title">📚 参考来源</div>
              <div v-for="(source, idx) in msg.sources" :key="idx" class="source-item">
                <div class="source-header">
                  <span class="source-filename">📄 {{ source.source?.split('\\').pop()?.split('/').pop() }}</span>
                  <span class="source-score">匹配度: {{ (source.similarity || 0* 100).toFixed(1) }}%</span>
                </div>
                <div class="source-content">{{ truncateText(source.content_preview|| '') }}</div>
              </div>
            </div> -->
            <div v-if="msg.sources && msg.sources.length > 0" class="sources">
              {{ truncateText(msg.sources) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <!-- 已上传文件列表 -->
        <div v-if="uploadedFiles.length > 0" class="uploaded-files">
          <span v-for="(file, i) in uploadedFiles" :key="i" class="uploaded-file-tag">
            📎 {{ file.filename }}
            <button class="file-remove-btn" @click="removeFile(i)">×</button>
          </span>
        </div>
        <div class="input-wrapper">
          <label class="icon-btn upload-btn" title="上传文件">
            <input type="file" accept=".txt,.doc,.docx,.pdf" @change="handleFileUpload" hidden />
            📎
          </label>
          <textarea 
            v-model="inputText" 
            :placeholder="HINT_TEXT"
            @keydown.enter.exact.prevent="sendMessage"
            rows="1"
          ></textarea>
          <button class="icon-btn send-btn" @click="sendMessage" :disabled="!inputText.trim()">➤</button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-layout { display: flex; height: 100%; }

/* 侧栏 */
.sidebar { width: 260px; background: var(--bg-sidebar); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; padding: 12px; }
.new-chat-btn { padding: 10px; border: 1px dashed var(--border-color); border-radius: 8px; background: transparent; cursor: pointer; font-size: 14px; margin-bottom: 16px; }
.new-chat-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
.session-list { flex: 1; overflow-y: auto; }
.loading { text-align: center; color: var(--text-sub); padding: 20px; font-size: 14px; }
.group-label { font-size: 12px; color: var(--text-sub); padding: 8px 8px 4px; display: block; }
.session-item { padding: 10px; border-radius: 8px; cursor: pointer; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main); }
.session-item:hover { background: #f0f0f0; }
.session-item.active { background: #e8f5ee; color: var(--primary-color); }

/* 主区域 */
.main-area { flex: 1; display: flex; flex-direction: column; background: var(--bg-primary); }
.topbar { padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); background: #fff; }
.user-info { font-weight: 600; font-size: 15px; }
.logout-btn { padding: 6px 16px; border: 1px solid var(--border-color); border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.logout-btn:hover { background: #fee; border-color: #e55; color: #c33; }

/* 聊天内容 */
.chat-content { flex: 1; overflow-y: auto; padding: 24px; }
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  max-width: 768px;
  margin-left: auto;
  margin-right: auto;
}
.error-banner span { flex: 1; }
.error-dismiss {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #856404;
  padding: 0 4px;
}
.error-dismiss:hover { color: #533f03; }
.welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--text-main); }
.welcome h1 { font-size: 28px; margin-bottom: 12px; }
.welcome p { color: var(--text-sub); font-size: 16px; max-width: 400px; line-height: 1.6; }

.messages { display: flex; flex-direction: column; gap: 16px; max-width: 768px; margin: 0 auto; }
.message.user { align-self: flex-end; }
.message.assistant { align-self: flex-start; }
.bubble { padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.6; max-width: 100%; word-break: break-word; }
.user .bubble { background: var(--primary-color); color: #fff; border-bottom-right-radius: 4px; }
.assistant .bubble { background: #fff; border: 1px solid var(--border-color); border-bottom-left-radius: 4px; }

/* 意图标签 */
.intent-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.intent-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: #fff;
  font-weight: 500;
}

/* 引用来源 */
.sources {
  margin-top: 8px;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}
.sources-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  margin-bottom: 8px;
}
.source-item {
  padding: 8px;
  background: #fff;
  border-radius: 6px;
  margin-bottom: 6px;
  border: 1px solid #eee;
}
.source-item:last-child { margin-bottom: 0; }
.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.source-filename {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-main);
}
.source-score {
  font-size: 11px;
  color: #4CAF50;
}
.source-content {
  font-size: 12px;
  color: var(--text-sub);
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 已上传文件 */
.uploaded-files {
  max-width: 768px;
  margin: 0 auto 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.uploaded-file-tag {
  background: #f0f0f0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 4px;
}
.file-remove-btn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #999;
  padding: 0 2px;
  line-height: 1;
}
.file-remove-btn:hover {
  color: #f44336;
}

/* 输入区 */
.input-area { padding: 16px 24px; background: #fff; border-top: 1px solid var(--border-color); }
.input-wrapper { max-width: 768px; margin: 0 auto; display: flex; align-items: flex-end; gap: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 8px 12px; }
.input-wrapper:focus-within { border-color: var(--primary-color); }
textarea { flex: 1; border: none; background: transparent; resize: none; outline: none; font-size: 15px; line-height: 1.5; max-height: 120px; padding: 4px 0; font-family: inherit; }
.icon-btn { width: 36px; height: 36px; border: none; border-radius: 8px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; background: transparent; flex-shrink: 0; }
.upload-btn:hover { background: #eee; }
.send-btn { background: var(--primary-color); color: #fff; }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 加载动画 */
.loading-dots { display: inline-flex; gap: 4px; padding: 4px 0; }
.loading-dots .dot { width: 8px; height: 8px; background: var(--text-sub); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
.loading-dots .dot:nth-child(1) { animation-delay: -0.32s; }
.loading-dots .dot:nth-child(2) { animation-delay: -0.16s; }

/* Markdown 样式 */
.markdown-body { width: 100%; }
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) { margin: 16px 0 8px; font-weight: 600; }
.markdown-body :deep(h1) { font-size: 1.5em; }
.markdown-body :deep(h2) { font-size: 1.3em; }
.markdown-body :deep(h3) { font-size: 1.1em; }
.markdown-body :deep(p) { margin: 8px 0; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) { margin: 8px 0; padding-left: 24px; }
.markdown-body :deep(li) { margin: 4px 0; }
.markdown-body :deep(code) { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 0.9em; }
.markdown-body :deep(pre) { background: #f4f4f4; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 12px 0; }
.markdown-body :deep(pre code) { background: transparent; padding: 0; }
.markdown-body :deep(blockquote) { border-left: 4px solid #ddd; margin: 12px 0; padding-left: 16px; color: #666; }
.markdown-body :deep(a) { color: var(--primary-color); }
.markdown-body :deep(hr) { border: none; border-top: 1px solid #eee; margin: 16px 0; }
.markdown-body :deep(table) { border-collapse: collapse; margin: 12px 0; width: 100%; }
.markdown-body :deep(th),
.markdown-body :deep(td) { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
.markdown-body :deep(th) { background: #f4f4f4; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
