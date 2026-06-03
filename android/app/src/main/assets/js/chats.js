// ===== CHATS =====

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
  var sb = getSupabase();
  if (!sb || !window.state.user) return;
  try {
    var { data, error } = await sb.from('chats').select('*').or('participant_1.eq.' + window.state.user.id + ',participant_2.eq.' + window.state.user.id);
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
  var chat = window.state.chats[chatId];

  var content = document.getElementById('chatContent');
  if (!content) return;

  var html = '';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  html += '<h3 style="margin:0">💬 ' + escHtml(itemTitle) + '</h3>';
  html += '<button onclick="closeChatPage()" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>';
  html += '</div>';
  html += '<div id="chatMsgList" style="max-height:50vh;overflow-y:auto;margin-bottom:12px;padding:8px;background:#f5f5f5;border-radius:8px">';

  if (chat && chat.messages && chat.messages.length > 0) {
    chat.messages.forEach(function(msg) {
      var isSent = window.state.user && msg.from === window.state.user.id;
      html += '<div style="margin-bottom:8px;padding:8px 12px;border-radius:12px;max-width:80%;' + (isSent ? 'margin-left:auto;background:#2d8a4e;color:white;text-align:right' : 'background:white;border:1px solid #e0e0e0') + '">' + escHtml(msg.text) + '</div>';
    });
  } else {
    html += '<div style="text-align:center;color:#999;padding:20px">No messages yet. Say hello!</div>';
  }
  html += '</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<input type="text" id="chatMsgInput" placeholder="Type a message..." style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:1rem" onkeydown="if(event.key===\'Enter\')sendChatMsg()">';
  html += '<button class="btn btn-primary" onclick="sendChatMsg()">Send</button>';
  html += '</div>';

  content.innerHTML = html;
  switchPage('chat');
}

function closeChatPage() {
  window.state.currentChatId = null;
  switchPage('browse');
}

function sendChatMsg() {
  var input = document.getElementById('chatMsgInput');
  var text = input ? input.value.trim() : '';
  if (!text || !window.state.currentChatId || !window.state.user) return;
  var chat = window.state.chats[window.state.currentChatId]; if (!chat) return;
  chat.messages.push({ from: window.state.user.id, text: text, createdAt: Date.now() });
  if (input) input.value = '';
  saveChatsToStorage();
  // Re-render
  openChat(window.state.currentChatId, chat.itemTitle);
}
