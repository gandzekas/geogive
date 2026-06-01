function normalizeChat(c) {
  return {
    id: c.id, itemId: c.item_id || '', itemTitle: c.item_title || 'Chat',
    participants: [c.participant_1 || '', c.participant_2 || ''],
    messages: (c.messages || []).map(function(m) {
      return { from: m.from || '', text: m.text || '', createdAt: m.created_at ? new Date(m.created_at).getTime() : (m.createdAt || Date.now()) };
    })
  };
}

function buildChatId(user1, user2, itemId) { var s = [user1, user2].sort(); return s[0] + '_' + s[1] + '_' + itemId; }

async function loadChatsFromSupabase() {
  if (!supabase || !window.state.user) return;
  try {
    var { data, error } = await window.supabaseClient.from('chats').select('*').or('participant_1.eq.' + window.state.user.id + ',participant_2.eq.' + window.state.user.id);
    if (error) throw error;
    (data || []).forEach(function(c) {
      var chat = normalizeChat(c);
      var existing = window.state.chats[chat.id];
      if (existing && existing.messages && existing.messages.length > chat.messages.length) chat.messages = existing.messages;
      window.state.chats[chat.id] = chat;
    });
    saveChatsToStorage();
  } catch(e) {}
}

function saveChatsToStorage() { try { localStorage.setItem('geogive_chats_cache', JSON.stringify(window.state.chats)); } catch(e) {} }

function openChat(chatId, itemTitle) {
  window.state.currentChatId = chatId;
  document.getElementById('chatPageTitle').textContent = '💬 ' + itemTitle;
  document.getElementById('page-chat').classList.add('active');
  renderChatPageMessages();
  setTimeout(function() { var el = document.getElementById('chatPageInput'); if (el) el.focus(); }, 100);
}

function closeChatPage() {
  document.getElementById('page-chat').classList.remove('active');
  window.state.currentChatId = null; // Prevent auto-replies from firing on closed chat
}

function renderChatPageMessages() {
  var container = document.getElementById('chatPageMessages');
  var chat = window.state.chats[window.state.currentChatId];
  if (!chat) { container.innerHTML = '<div style="text-align:center;color:var(--gray-400);padding:20px">No messages yet.</div>'; return; }
  var html = '';
  chat.messages.forEach(function(msg) { var isSent = window.state.user && msg.from === window.state.user.id; html += '<div class="chat-msg ' + (isSent ? 'sent' : 'received') + '">' + escHtml(msg.text) + '</div>'; });
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function renderChatMessages() {
  var container = document.getElementById('chatMessages');
  var chat = window.state.chats[window.state.currentChatId];
  if (!chat) { container.innerHTML = '<div style="text-align:center;color:var(--gray-400);padding:20px">No messages yet.</div>'; return; }
  var html = '';
  chat.messages.forEach(function(msg) { var isSent = window.state.user && msg.from === window.state.user.id; html += '<div class="chat-msg ' + (isSent ? 'sent' : 'received') + '">' + escHtml(msg.text) + '</div>'; });
  container.innerHTML = html; container.scrollTop = container.scrollHeight;
}

function sendChatMsg() {
  var input = document.getElementById('chatPageInput'); var text = input.value.trim();
  if (!text || !window.state.currentChatId || !window.state.user) return;
  var chat = window.state.chats[window.state.currentChatId]; if (!chat) return;
  chat.messages.push({ from: window.state.user.id, text: text, createdAt: Date.now() }); input.value = ''; renderChatPageMessages(); saveChatsToStorage();
  var otherId = chat.participants.find(function(p) { return p !== window.state.user.id; });
  setTrackedTimeout(function() {
    var replies = ['Sure, that works!', 'When would be a good time?', 'I can meet tomorrow afternoon.', 'Sounds great! 😊'];
    var reply = replies[Math.floor(Math.random() * replies.length)];
    var c = window.state.chats[window.state.currentChatId];
    if (c) { c.messages.push({ from: otherId, text: reply, createdAt: Date.now() }); saveChatsToStorage();
    addNotif('New Reply', reply); renderChatPageMessages(); }
  }, 1500 + Math.random() * 2000);
}
