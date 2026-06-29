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
  html += '<div id="chatSearchBar" style="display:flex;gap:6px;margin-bottom:8px">';
  html += '<input type="text" id="chatSearchInput" placeholder="🔍 Search messages..." style="flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:0.85rem" oninput="filterChatMessages()">';
  html += '<button class="btn btn-sm btn-secondary" data-fn="clearChatSearch" style="display:none" id="clearSearchBtn">✕</button>';
  html += '</div>';
  html += '<div id="chatMsgList" style="max-height:50vh;overflow-y:auto;margin-bottom:12px;padding:8px;background:#f5f5f5;border-radius:8px"></div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<input type="text" id="chatMsgInput" placeholder="Type a message..." style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:1rem" onkeydown="if(event.key===\'Enter\')sendChatMsg()" oninput="handleChatTyping()">';
  html += '<button class="btn btn-primary" data-fn="sendChatMsg">Send</button>';
  html += '</div>';

  content.innerHTML = html;
  switchPage('chat');

  // Subscribe to typing indicators (M17)
  handleTypingBroadcast(chatId);

  renderChatMessages(chat);
  // Mark messages as read
  markMessagesRead(chatId);
  var list = document.getElementById('chatMsgList');
  if (list) list.scrollTop = list.scrollHeight;
}

// ===== TYPING INDICATORS (M17) =====
var typingTimeout = null;
var lastTypingBroadcast = 0;

function showTypingIndicator(chatId, userName) {
  var list = document.getElementById('chatMsgList');
  if (!list) return;
  var existing = document.querySelector('.typing-indicator');
  if (existing) existing.remove();
  var indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.style.cssText = 'font-size:0.75rem;color:#999;padding:4px 8px;font-style:italic';
  indicator.textContent = userName + ' is typing...';
  list.appendChild(indicator);
  list.scrollTop = list.scrollHeight;
  // Auto-remove after 3 seconds
  setTrackedTimeout(function() { indicator.remove(); }, 3000);
}

function broadcastTyping(chatId) {
  var now = Date.now();
  if (now - lastTypingBroadcast < 2000) return; // Throttle to once per 2s
  lastTypingBroadcast = now;
  var sb = getSupabase();
  if (!sb || !window.state.user) return;
  // Use Supabase realtime presence or broadcast
  sb.channel('typing_' + chatId).send({
    type: 'broadcast',
    event: 'typing',
    payload: { user: window.state.user.id, userName: window.state.userProfile ? window.state.userProfile.display_name : 'Someone' }
  });
}

function handleTypingBroadcast(chatId) {
  var sb = getSupabase();
  if (!sb) return;
  sb.channel('typing_' + chatId).on('broadcast', { event: 'typing' }, function(payload) {
    if (payload && payload.payload && payload.payload.user !== window.state.user.id) {
      showTypingIndicator(chatId, payload.payload.userName || 'Someone');
    }
  }).subscribe();
}

// ===== CHAT SEARCH UI (M18) =====
function filterChatMessages() {
  var searchInput = document.getElementById('chatSearchInput');
  var query = searchInput ? searchInput.value.trim() : '';
  var clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
  
  var chatId = window.state.currentChatId;
  if (!chatId) return;
  var chat = window.state.chats[chatId];
  if (!chat) return;

  var list = document.getElementById('chatMsgList');
  if (!list) return;
  list.innerHTML = '';
  
  var messages = query ? searchMessages(chatId, query) : chat.messages;
  if (messages.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:#999;padding:20px';
    empty.textContent = query ? 'No messages match "' + query + '"' : 'No messages yet.';
    list.appendChild(empty);
    return;
  }
  messages.forEach(function(msg) {
    var isSent = window.state.user && msg.from === window.state.user.id;
    var div = document.createElement('div');
    div.style.cssText = 'margin-bottom:8px;padding:8px 12px;border-radius:12px;max-width:80%;' +
      (isSent ? 'margin-left:auto;background:#2d8a4e;color:white;text-align:right' : 'background:white;border:1px solid #e0e0e0');
    div.innerHTML = query ? highlightSearchMatches(msg.text, query) : escHtml(msg.text);
    var timeSpan = document.createElement('span');
    timeSpan.style.cssText = 'display:block;font-size:0.65rem;opacity:0.6;margin-top:4px';
    var d = new Date(msg.createdAt);
    timeSpan.textContent = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    div.appendChild(timeSpan);
    list.appendChild(div);
  });
}

function clearChatSearch() {
  var searchInput = document.getElementById('chatSearchInput');
  if (searchInput) searchInput.value = '';
  var clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  var chatId = window.state.currentChatId;
  if (chatId) {
    var chat = window.state.chats[chatId];
    if (chat) renderChatMessages(chat);
  }
}

function handleChatTyping() {
  var chatId = window.state.currentChatId;
  if (chatId) broadcastTyping(chatId);
}

// ===== MESSAGE SEARCH (M18) =====
function searchMessages(chatId, query) {
  var chat = window.state.chats[chatId];
  if (!chat || !query) return [];
  var q = query.toLowerCase();
  return chat.messages.filter(function(m) {
    return m.text && m.text.toLowerCase().indexOf(q) !== -1;
  });
}

function highlightSearchMatches(text, query) {
  if (!query) return escHtml(text);
  var escaped = escHtml(text);
  var escapedQuery = escHtml(query);
  var regex = new RegExp('(' + escJs(escapedQuery) + ')', 'gi');
  return escaped.replace(regex, '<mark style="background:#fff59d;padding:0 2px">$1</mark>');
}

function markMessagesRead(chatId) {
  var chat = window.state.chats[chatId];
  if (!chat || !window.state.user) return;
  var sb = getSupabase();
  if (!sb) return;
  var updated = false;
  chat.messages.forEach(function(m) {
    if (m.from !== window.state.user.id && !m.read) {
      m.read = true;
      updated = true;
    }
  });
  if (!updated) return;
  saveChatsToStorage();
  var messagesToSync = chat.messages.map(function(m) {
    return { from: m.from, text: m.text, created_at: new Date(m.createdAt).toISOString(), read: !!m.read };
  });
  withRetry(function() {
    return sb.from('chats').update({ messages: messagesToSync }).eq('id', chatId);
  }, { maxAttempts: 1, baseDelay: 300 }).catch(function() {});
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

function openChat(chatId, itemTitle) {
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
  hapticLight();

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
