// GeoGive Configuration
// Reads from localStorage (injected at build time or entered via Settings)

var SUPABASE_URL = localStorage.getItem('geogive_sb_url') || '';
var SUPABASE_KEY = localStorage.getItem('geogive_sb_key') || '';

// App constants
const CONFIG = {
  DEFAULT_MAP_ZOOM: 14,
  DEFAULT_RADIUS_KM: 10,
  MAX_RADIUS_KM: 100,
  MAX_IMAGES_PER_ITEM: 5,
  MAX_IMAGE_SIZE_MB: 5,
  ITEMS_PER_PAGE: 20,

  CATEGORIES: {
    furniture: { emoji: '🪑', label: 'Furniture' },
    electronics: { emoji: '📱', label: 'Electronics' },
    clothing: { emoji: '👕', label: 'Clothing' },
    books: { emoji: '📚', label: 'Books' },
    toys: { emoji: '🧸', label: 'Toys' },
    kitchen: { emoji: '🍳', label: 'Kitchen' },
    sports: { emoji: '⚽', label: 'Sports' },
    garden: { emoji: '🌱', label: 'Garden' },
    other: { emoji: '📦', label: 'Other' }
  },

  CONDITIONS: ['Like New', 'Good', 'Fair', 'Needs Repair'],

  STATUSES: {
    available: 'Available',
    pending: 'Pending Pickup',
    given: 'Given Away',
    expired: 'Expired'
  }
};

// Category helpers used throughout the app
const CATEGORY_EMOJI = {};
const CATEGORY_COLORS = {};
const CATEGORY_DISPLAY = {};
Object.keys(CONFIG.CATEGORIES).forEach(function(k) {
  CATEGORY_EMOJI[k] = CONFIG.CATEGORIES[k].emoji;
  CATEGORY_DISPLAY[k] = CONFIG.CATEGORIES[k].label;
});
CATEGORY_COLORS['furniture'] = '#e8d5b7';
CATEGORY_COLORS['electronics'] = '#c5d5e8';
CATEGORY_COLORS['clothing'] = '#e8c5d5';
CATEGORY_COLORS['books'] = '#d5e8c5';
CATEGORY_COLORS['toys'] = '#e8ddc5';
CATEGORY_COLORS['kitchen'] = '#c5e8e8';
CATEGORY_COLORS['sports'] = '#d5c5e8';
CATEGORY_COLORS['garden'] = '#c5e8d5';
CATEGORY_COLORS['other'] = '#e0e0e0';

const CATEGORY_ICONS = {}; // simplified — we use emoji fallback

const MAX_IMAGES = CONFIG.MAX_IMAGES_PER_ITEM;
const MAX_IMAGE_SIZE = CONFIG.MAX_IMAGE_SIZE_MB;
const PROFILE_KEY = 'geogive_profile_';

// Supabase client instance (set after SDK loads)
window.supabaseClient = null;

function initSupabase() {
  SUPABASE_URL = localStorage.getItem('geogive_sb_url') || SUPABASE_URL;
  SUPABASE_KEY = localStorage.getItem('geogive_sb_key') || SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('GeoGive: missing Supabase credentials. Open Settings (⚙️) to configure.');
    return null;
  }

  try {
    // window.supabase is set by the Supabase CDN SDK
    if (window.supabase && window.supabase.createClient) {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return window.supabaseClient;
    } else {
      console.warn('GeoGive: Supabase JS SDK not loaded yet');
      return null;
    }
  } catch(e) {
    console.error('GeoGive: Supabase init error', e);
    return null;
  }
}

function getSupabase() {
  return window.supabaseClient;
}
