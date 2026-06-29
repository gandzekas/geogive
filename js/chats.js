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

var chatRealtimeChannel = null;

function subscribeToChat(chatId) {
  var sb = getSupabase();
  if (!sb) return;
  // Unsubscribe from previous channel
  if (chatRealtimeChannel) {
    sb.removeChannel(chatRealtimeChannel);
    chatRealtimeChannel = null;
  }
  chatRealtimeChannel = sb.channel('chat_' + chatId)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'chats',
      filter: 'id=eq.' + chatId
    }, function(payload) {
      var updated = payload.new;
      if (updated && updated.id === chatId) {
        var chat = window.state.chats[chatId];
        if (chat) {
          var newMessages = (updated.messages || []).map(function(m) {
            return { from: m.from || '', text: m.text || '', createdAt: m.created_at ? new Date(m.created_at).getTime() : (m.createdAt || Date.now()) };
          });
          // Only update if there are new messages to avoid overwriting local state
          if (newMessages.length > chat.messages.length) {
            chat.messages = newMessages;
            saveChatsToStorage();
            // If chat page is active, re-render
            if (window.state.currentChatId === chatId) {
              renderChatMessages(chat);
  // Mark messages as read
  markMessagesRead(chatId);
              var list = document.getElementById('chatMsgList');
              if (list) list.scrollTop = list.scrollHeight;
            }
            // Notify if not from current user
            var lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.from !== window.state.user.id) {
              addNotif('New Message', lastMsg.text.substring(0, 50), function() {
                openChat(chatId, chat.itemTitle);
              });
            }
          }
        }
      }
    })
    .subscribe(function(status) {
      log('[GeoGive] Chat subscription:', status);
    });
}

async function loadChatsFromSupabase() {
  var sb = getSupabase();
  if (!sb || !window.state.user) return;
  try {
    var { data, error } = await withRetry(function() {
      return sb.from('chats').select('*').or('participant_1.eq.' + window.state.user.id + ',participant_2.eq.' + window.state.user.id);
    }, { maxAttempts: 2, baseDelay: 500 });
    if (error) throw error;
    (data || []).forEach(function(c) {
      // Skip chats with blocked users
      if (isUserBlocked(c.participant_1) || isUserBlocked(c.participant_2)) return;
      var chat = normalizeChat(c);
      var existing = window.state.chats[chat.id];
      if (existing && existing.messages && existing.messages.length > chat.messages.length) chat.messages = existing.messages;
      window.state.chats[chat.id] = chat;
    });
    saveChatsToStorage();
  } catch(e) { handleError(e, 'load chats'); }
}

function saveChatsToStorage() { try { localStorage.setItem('geogive_chats_cache', JSON.stringify(window.state.chats)); } catch(e) {} }

function renderMessage(msg, isSent) {
  var div = document.createElement('div');
  div.style.cssText = 'margin-bottom:8px;padding:8px 12px;border-radius:12px;max-width:80%;' +
    (isSent ? 'margin-left:auto;background:#2d8a4e;color:white;text-align:right' : 'background:white;border:1px solid #e0e0e0');
  div.textContent = msg.text;
  // Add timestamp
  var timeSpan = document.createElement("span");
  timeSpan.style.cssText = "display:block;font-size:0.65rem;opacity:0.6;margin-top:4px";
  var d = new Date(msg.createdAt);
  timeSpan.textContent = d.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
  div.appendChild(timeSpan);
  return div;
}

function renderChatMessages(chat) {
  var list = document.getElementById('chatMsgList');
  if (!list) return;
  list.innerHTML = '';
  if (chat && chat.messages && chat.messages.length > 0) {
    chat.messages.forEach(function(msg) {
      var isSent = window.state.user && msg.from === window.state.user.id;
      list.appendChild(renderMessage(msg, isSent));
    });
  } else {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:#999;padding:20px';
    empty.textContent = 'No messages yet. Say hello!';
    list.appendChild(empty);
  }
}

function openChat(chatId, itemTitle) {
  window.state.currentChatId = chatId;
  var chat = window.state.chats[chatId];
  if (!chat) {
    chat = { id: chatId, itemTitle: itemTitle, messages: [], participants: [] };
    window.state.chats[chatId] = chat;
  }

  // Subscribe to realtime updates for this chat
  subscribeToChat(chatId);

  var content = document.getElementById('chatContent');
  if (!content) return;

  var html = '';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  html += '<h3 style="margin:0">' + escHtml(itemTitle) + '</h3>';
  html += '<button data-fn="closeChatPage" style="background:none;border:none;font-size:1.2rem;cursor:pointer">✕</button>';
  html += '</div>';
  html += '<div id="chatMsgList" style="max-height:50vh;overflow-y:auto;margin-bottom:12px;padding:8px;background:#f5f5f5;border-radius:8px"></div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<input type="text" id="chatMsgInput" placeholder="Type a message..." style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:1rem" onkeydown="if(event.key===\'Enter\')sendChatMsg()">';
  html += '<button class="btn btn-primary" data-fn="sendChatMsg">Send</button>';
  html += '</div>';

  content.innerHTML = html;
  switchPage('chat');

  renderChatMessages(chat);
  // Mark messages as read
  markMessagesRead(chatId);
  var list = document.getElementById('chatMsgList');
  if (list) list.scrollTop = list.scrollHeight;
}

function markMessagesRead(chatId) {
  var chat = window.state.chats[chatId];
  if (!chat || !window.state.user) return;
  var sb = getSupabase();
  if (!sb) return;
  // Mark all messages not from current user as read
  var updated = false;
  chat.messages.forEach(function(m) {
    if (m.from !== window.state.user.id && !m.read) {
      m.read = true;
      updated = true;
    }
  });
  if (!updated) return;
  saveChatsToStorage();
  // Update Supabase read receipt
  var messagesToSync = chat.messages.map(function(m) {
    return { from: m.from, text: m.text, created_at: new Date(m.createdAt).toISOString(), read: !!m.read };
  });
  withRetry(function() {
    return sb.from('chats').update({ messages: messagesToSync }).eq('id', chatId);
  }, { maxAttempts: 1, baseDelay: 300 }).catch(function() {});
  // Update UI indicators for sent messages
  var list = document.getElementById('chatMsgList');
  if (list) {
    var indicators = list.querySelectorAll('.msg-status-indicator');
    indicators.forEach(function(ind) {
      if (ind.textContent.indexOf('sent') !== -1 && ind.textContent.indexOf('read') === -1) {
        ind.textContent = ' • ✓✓ read';
        ind.style.color = '#2196f3';
      }
    });
  }
}

function closeChatPage() {
  window.state.currentChatId = null;
  if (chatRealtimeChannel) {
    var sb = getSupabase();
    if (sb) sb.removeChannel(chatRealtimeChannel);
    chatRealtimeChannel = null;
  }
  switchPage('browse');
}
async function sendChatMsg() {
  var input = document.getElementById('chatMsgInput');
  var text = input ? input.value.trim() : '';
  if (!text || !window.state.currentChatId || !window.state.user) return;
  if (!rateLimit('send_msg', 1000)) return;
  var chat = window.state.chats[window.state.currentChatId]; if (!chat) return;
  var msg = { from: window.state.user.id, text: text, createdAt: Date.now(), status: 'sending' };
  chat.messages.push(msg);
  if (input) { input.value = ''; input.disabled = true; }
  saveChatsToStorage();

  var list = document.getElementById('chatMsgList');
  if (list) {
    var placeholder = list.querySelector('div[style*="text-align:center"]');
    if (placeholder && placeholder.textContent.includes('No messages')) {
      list.removeChild(placeholder);
    }
    var msgDiv = renderMessage(msg, true);
    msgDiv.style.opacity = '0.5';
    // Add sending indicator
    var indicator = document.createElement('span');
    indicator.className = 'msg-status-indicator';
    indicator.textContent = ' • sending...';
    indicator.style.fontSize = '0.7rem';
    indicator.style.color = '#999';
    msgDiv.appendChild(indicator);
    list.appendChild(msgDiv);
    list.scrollTop = list.scrollHeight;
  }

  // Sync to Supabase
  var sb = getSupabase();
  if (sb) {
    try {
      var messagesToSync = chat.messages.map(function(m) {
        return { from: m.from, text: m.text, created_at: new Date(m.createdAt).toISOString() };
      });
      await withRetry(function() {
        return sb.from('chats').update({ messages: messagesToSync }).eq('id', window.state.currentChatId);
      }, { maxAttempts: 2, baseDelay: 500 });
      msg.status = 'sent';
      // Update UI
      var indicators = list ? list.querySelectorAll('.msg-status-indicator') : [];
      if (indicators.length > 0) {
        indicators[indicators.length - 1].textContent = ' • ✓ sent';
        indicators[indicators.length - 1].style.color = '#4caf50';
      }
      var lastMsg = list ? list.lastChild : null;
      if (lastMsg) lastMsg.style.opacity = '1';
    } catch(e) {
      msg.status = 'failed';
      var indicators2 = list ? list.querySelectorAll('.msg-status-indicator') : [];
      if (indicators2.length > 0) {
        indicators2[indicators2.length - 1].textContent = ' • failed (tap to retry)';
        indicators2[indicators2.length - 1].style.color = '#f44336';
        indicators2[indicators2.length - 1].style.cursor = 'pointer';
        indicators2[indicators2.length - 1].onclick = function() { sendChatMsg(); };
      }
    } finally {
      if (input) input.disabled = false;
    }
  }
}
