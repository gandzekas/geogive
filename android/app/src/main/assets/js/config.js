// GeoGive Configuration
// Reads from environment variables (for build tools) or falls back to localStorage/prompts

let SUPABASE_URL = localStorage.getItem('geogive_sb_url') || '';
let SUPABASE_KEY = localStorage.getItem('geogive_sb_key') || '';

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
    if (window.supabase && window.supabaseClient.createClient) {
      window.supabaseClient = window.supabaseClient.createClient(SUPABASE_URL, SUPABASE_KEY);
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
