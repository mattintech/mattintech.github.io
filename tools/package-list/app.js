/**
 * Android Package Names Database
 * Searchable list of system packages by OEM
 */

let allPackages = [];
let filteredPackages = [];
let currentOemFilter = 'all';
let currentCategoryFilter = 'all';
let searchQuery = '';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const packagesContainer = document.getElementById('packagesContainer');
const resultsCount = document.getElementById('resultsCount');
const statsContainer = document.getElementById('statsContainer');
const oemFilters = document.getElementById('oemFilters');
const categoryFilters = document.getElementById('categoryFilters');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchPackages();
  setupEventListeners();
});

/**
 * Fetch packages from JSON file
 */
async function fetchPackages() {
  try {
    const response = await fetch('data/packages.json');
    if (!response.ok) {
      throw new Error('Failed to load packages');
    }
    allPackages = await response.json();
    filteredPackages = [...allPackages];

    renderStats();
    updateOemFilterButtons();
    renderPackages();
  } catch (error) {
    console.error('Error loading packages:', error);
    packagesContainer.innerHTML = `
      <div class="col-span-full text-center py-10">
        <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
        <p class="text-red-600">Failed to load packages. Please try again later.</p>
      </div>
    `;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Search input with debounce
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = e.target.value.toLowerCase().trim();
      applyFilters();
    }, 200);
  });

  // OEM filter buttons
  oemFilters.addEventListener('click', (e) => {
    if (e.target.matches('[data-oem]')) {
      currentOemFilter = e.target.dataset.oem;
      updateFilterButtonState(oemFilters, e.target);
      applyFilters();
    }
  });

  // Category filter buttons
  categoryFilters.addEventListener('click', (e) => {
    if (e.target.matches('[data-category]')) {
      currentCategoryFilter = e.target.dataset.category;
      updateFilterButtonState(categoryFilters, e.target);
      applyFilters();
    }
  });
}

/**
 * Update filter button active state
 */
function updateFilterButtonState(container, activeButton) {
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  activeButton.classList.add('active');
}

/**
 * Update OEM filter buttons based on available OEMs in data
 */
function updateOemFilterButtons() {
  const oems = new Set();
  allPackages.forEach(pkg => {
    pkg.oems.forEach(oem => oems.add(oem));
  });

  // Keep the "All OEMs" button, add buttons for each OEM found
  const oemArray = Array.from(oems).sort();
  let buttonsHtml = '<button data-oem="all" class="px-3 py-1 text-xs rounded-full transition filter-btn active">All OEMs</button>';

  oemArray.forEach(oem => {
    const displayName = oem.charAt(0).toUpperCase() + oem.slice(1);
    buttonsHtml += `<button data-oem="${oem}" class="px-3 py-1 text-xs rounded-full transition filter-btn">${displayName}</button>`;
  });

  oemFilters.innerHTML = buttonsHtml;
}

/**
 * Apply all filters and render
 */
function applyFilters() {
  filteredPackages = allPackages.filter(pkg => {
    // Search filter
    if (searchQuery) {
      const matchesSearch =
        pkg.package.toLowerCase().includes(searchQuery) ||
        pkg.name.toLowerCase().includes(searchQuery) ||
        (pkg.description && pkg.description.toLowerCase().includes(searchQuery));
      if (!matchesSearch) return false;
    }

    // OEM filter
    if (currentOemFilter !== 'all') {
      if (!pkg.oems.includes(currentOemFilter)) return false;
    }

    // Category filter
    if (currentCategoryFilter !== 'all') {
      if (pkg.category !== currentCategoryFilter) return false;
    }

    return true;
  });

  renderPackages();
}

/**
 * Render statistics
 */
function renderStats() {
  const totalPackages = allPackages.length;
  const oems = new Set();
  const categories = {};

  allPackages.forEach(pkg => {
    pkg.oems.forEach(oem => oems.add(oem));
    categories[pkg.category] = (categories[pkg.category] || 0) + 1;
  });

  const playStoreCount = allPackages.filter(p => p.playStore).length;

  statsContainer.innerHTML = `
    <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg text-center">
      <div class="text-2xl font-bold">${totalPackages}</div>
      <div class="text-xs opacity-90">Total Packages</div>
    </div>
    <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg text-center">
      <div class="text-2xl font-bold">${oems.size}</div>
      <div class="text-xs opacity-90">OEMs Covered</div>
    </div>
    <div class="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg text-center">
      <div class="text-2xl font-bold">${Object.keys(categories).length}</div>
      <div class="text-xs opacity-90">Categories</div>
    </div>
    <div class="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg text-center">
      <div class="text-2xl font-bold">${playStoreCount}</div>
      <div class="text-xs opacity-90">On Play Store</div>
    </div>
  `;
}

/**
 * Render packages
 */
function renderPackages() {
  resultsCount.textContent = filteredPackages.length;

  if (filteredPackages.length === 0) {
    packagesContainer.innerHTML = `
      <div class="col-span-full no-results">
        <i class="fas fa-search text-4xl text-gray-400 mb-4"></i>
        <p class="text-lg">No packages found</p>
        <p class="text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    `;
    return;
  }

  const html = filteredPackages.map(pkg => createPackageCard(pkg)).join('');
  packagesContainer.innerHTML = html;
}

/**
 * Create package card HTML
 */
function createPackageCard(pkg) {
  // OEM badges
  const oemBadges = pkg.oems.map(oem => {
    const oemClass = `oem-${oem}`;
    return `<span class="oem-badge ${oemClass}">${oem}</span>`;
  }).join('');

  // Category badge
  const categoryClass = `category-${pkg.category}`;
  const categoryBadge = `<span class="category-badge ${categoryClass}">${pkg.category}</span>`;

  // Play Store button
  const playStoreBtn = pkg.playStore
    ? `<a href="https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg.package)}"
          target="_blank"
          rel="noopener noreferrer"
          class="play-store-btn"
          title="View on Google Play">
        <i class="fab fa-google-play mr-1"></i>Play Store
       </a>`
    : '';

  // System badge
  const systemBadge = pkg.system
    ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><i class="fas fa-cog mr-1 text-xs"></i>System</span>'
    : '';

  return `
    <div class="package-card bg-white rounded-lg shadow-md p-4">
      <div class="flex justify-between items-start mb-2">
        <h3 class="font-semibold text-gray-900">${escapeHtml(pkg.name)}</h3>
        ${categoryBadge}
      </div>

      <div class="flex items-center gap-2 mb-3">
        <code class="package-name flex-grow" id="pkg-${sanitizeId(pkg.package)}">${escapeHtml(pkg.package)}</code>
        <button onclick="copyPackage('${escapeHtml(pkg.package)}')"
                class="copy-btn text-gray-400 hover:text-blue-600 transition p-1"
                title="Copy package name">
          <i class="fas fa-copy"></i>
        </button>
      </div>

      ${pkg.description ? `<p class="text-sm text-gray-600 mb-3">${escapeHtml(pkg.description)}</p>` : ''}

      <div class="flex flex-wrap gap-1 mb-3">
        ${oemBadges}
      </div>

      <div class="flex items-center justify-between">
        <div class="flex gap-2">
          ${systemBadge}
        </div>
        ${playStoreBtn}
      </div>
    </div>
  `;
}

/**
 * Copy package name to clipboard
 */
function copyPackage(packageName) {
  navigator.clipboard.writeText(packageName).then(() => {
    // Find and animate the package name element
    const elements = document.querySelectorAll('.package-name');
    elements.forEach(el => {
      if (el.textContent === packageName) {
        el.classList.add('copied');
        setTimeout(() => el.classList.remove('copied'), 1000);
      }
    });

    // Show brief toast
    showToast('Copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy', true);
  });
}

/**
 * Show toast notification
 */
function showToast(message, isError = false) {
  // Remove existing toast
  const existingToast = document.getElementById('toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white text-sm transition-opacity duration-300 ${isError ? 'bg-red-600' : 'bg-green-600'}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize string for use as ID
 */
function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '-');
}

// Make copyPackage available globally
window.copyPackage = copyPackage;
