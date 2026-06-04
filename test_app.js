const fs = require('fs');
const P = '/data/data/com.termux/files/home/geogive';
const issues = [], warnings = [], ok = [];

const html = fs.readFileSync(P + '/index.html', 'utf8');
const ids = [...new Set((html.match(/id="([^"]+)"/g)||[]).map(r => r.replace(/id="(.+)"/,'$1')))];

// 1. Critical elements
'authModalOverlay,settingsModalOverlay,itemModalOverlay,itemModalContent,itemList,myListings,requestsList,loginBtn,logoutBtn,userInfo,headerAvatar,headerName,loginForm,registerForm,authError,authErrorReg,authSuccessReg,postTitle,postCategory,postCondition,postDesc,postPhotos,imagePreviews,mapContainer,map,locStatus,radiusSlider,radiusValue,searchInput,categoryFilter,statusFilter,viewListBtn,viewMapBtn,connIndicator,settingsBtn,profileContent,chatContent,requestsBadge,showExpiredBtn,toast,loadingOverlay,debugPanel'.split(',').forEach(id => {
  ids.includes(id) ? ok.push('#'+id) : issues.push('MISSING #'+id);
});

// 2. Script order
const scripts = (html.match(/<script[^>]*src="([^"]*)"[^>]*>/g)||[]).map(s => s.match(/src="([^"]*)"/)[1]);
const idx = n => scripts.indexOf(n);
idx('js/config.js?v=1780569489') < idx('js/utils.js?v=1780569489') ? ok.push('config<utils') : issues.push('config AFTER utils');
idx('js/auth.js?v=1780569489') < idx('js/app.js?v=1780569489') ? ok.push('auth<app') : issues.push('auth AFTER app');
idx('js/chats.js?v=1780569489') < idx('js/requests.js?v=1780569489') ? ok.push('chats<requests') : issues.push('chats AFTER requests');

// 3. Local scripts cache-busted
const local = scripts.filter(s => s.startsWith('js/'));
local.every(s => s.includes('?v=')) ? ok.push('All '+local.length+' scripts cache-busted') : local.filter(s=>!s.includes('?v=')).forEach(s => warnings.push('No cache-bust: '+s));

// 4. Supabase injection
html.includes('tfqrgytmlppgovgvyaor') ? ok.push('Supabase URL injected') : issues.push('Supabase URL NOT injected');
html.includes('sb_publishable') ? ok.push('Supabase Key injected') : issues.push('Supabase Key NOT injected');

// 5. JS syntax
const jsFiles = 'config,utils,auth,app,ui,items,map,geo,chats,requests,images,profile,notifications,offline,router'.split(',').map(n => 'js/'+n+'.js');
jsFiles.forEach(f => {
  const c = fs.readFileSync(P+'/'+f,'utf8');
  try { new Function(c); ok.push(f+' syntax OK'); } catch(e) { issues.push(f+' SYNTAX ERROR: '+e.message); }
});

// 6. auth.js checks
const a = fs.readFileSync(P+'/js/auth.js','utf8');
const fnBody = a.substring(a.indexOf('function handleGoogleAuth'), a.indexOf('\n}\n', a.indexOf('function handleGoogleAuth')));
[
  ['handleGoogleAuth defined', a.includes('function handleGoogleAuth()')],
  ['dbg() in handleGoogleAuth', fnBody.includes('dbg(')],
  ['window.location.assign redirect', a.includes('window.location.assign(result.data.url)')],
  ['Fallback authorize endpoint', a.includes('authorize?provider=google')],
  ['closeModal authModalOverlay', a.includes("closeModal('authModalOverlay')")],
  ['INITIAL_SESSION handler', a.includes('INITIAL_SESSION')],
  ['Profile auto-creation', a.includes('upsert')],
  ['Email confirm error', a.includes('confirm your email')],
  ['Password min 6', a.includes('password.length < 6')],
  ['classList toggle for tabs', a.includes("classList.toggle('active')")],
].forEach(([name,pass]) => { pass ? ok.push('auth: '+name) : issues.push('auth: '+name); });

// 7. config.js checks
const cfg = fs.readFileSync(P+'/js/config.js','utf8');
[
  ['CATEGORY_EMOJI', cfg.includes('CATEGORY_EMOJI')],
  ['CATEGORY_COLORS', cfg.includes('CATEGORY_COLORS')],
  ['CATEGORY_DISPLAY', cfg.includes('CATEGORY_DISPLAY')],
  ['initSupabase()', cfg.includes('function initSupabase()')],
  ['getSupabase()', cfg.includes('function getSupabase()')],
  ['window.supabase.createClient', cfg.includes('window.supabase.createClient')],
].forEach(([name,pass]) => { pass ? ok.push('config: '+name) : issues.push('config: '+name); });

// 8. app.js checks
const app = fs.readFileSync(P+'/js/app.js','utf8');
[
  ['DOMContentLoaded', app.includes('DOMContentLoaded')],
  ['initSupabase()', app.includes('initSupabase()')],
  ['setupAuthListener()', app.includes('setupAuthListener()')],
  ['checkSession()', app.includes('checkSession()')],
  ['initGeolocation()', app.includes('initGeolocation()')],
  ['loadItemsFromSupabase()', app.includes('loadItemsFromSupabase()')],
  ['window.handleGoogleAuth', app.includes('window.handleGoogleAuth = handleGoogleAuth')],
  ['window.openAuthModal', app.includes('window.openAuthModal = openAuthModal')],
  ['window.switchPage', app.includes('window.switchPage = switchPage')],
].forEach(([name,pass]) => { pass ? ok.push('app: '+name) : issues.push('app: '+name); });

// 9. Duplicate global functions
const glob = {};
jsFiles.forEach(f => {
  const c = fs.readFileSync(P+'/'+f,'utf8');
  (c.match(/function\s+([a-zA-Z_]\w*)\s*\(/g)||[]).forEach(m => {
    const n = m.replace(/function\s+/,'').replace(/\s*\(/,'');
    (glob[n] = glob[n]||[]).push(f);
  });
});
Object.keys(glob).filter(k => glob[k].length > 1).forEach(k => {
  warnings.push('Duplicate "'+k+'": '+glob[k].join(', '));
});

// 10. Summary
console.log('========================================');
console.log('RESULTS: '+ok.length+' passed, '+warnings.length+' warnings, '+issues.length+' issues');
console.log('========================================');
if (issues.length) { console.log('\nISSUES:'); issues.forEach(i => console.log('  FAIL '+i)); }
if (warnings.length) { console.log('\nWARNINGS:'); warnings.forEach(w => console.log('  WARN '+w)); }
if (!issues.length) console.log('\nAll critical checks passed.');
