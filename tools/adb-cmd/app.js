document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const commandsContainer = document.getElementById('commandsContainer');
    const searchInput = document.getElementById('searchInput');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const loader = document.querySelector('.loader');
    
    // Current filter
    let currentFilter = 'all';
    let commands = [];
  
    // Fetch commands from JSON file
    async function fetchCommands() {
      try {
        const response = await fetch('data/commands.json');
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        commands = await response.json();
        renderCommands();
      } catch (error) {
        console.error('Error loading commands:', error);
        commandsContainer.innerHTML = `
          <div class="col-span-1 md:col-span-2 bg-white p-6 rounded-lg shadow text-center">
            <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
            <p class="text-gray-800 font-semibold">Failed to load commands</p>
            <p class="text-gray-600 mt-2">Please try refreshing the page.</p>
          </div>
        `;
      } finally {
        // Hide loader
        loader.style.display = 'none';
      }
    }
  
    // Render Android version compatibility badge
    function renderVersionBadge(androidVersions) {
      let badgeClass = 'bg-green-100 text-green-800';
      let versionText = '';
      
      // Determine compatibility text and color
      if (androidVersions.min === 'All' && androidVersions.max === 'All') {
        versionText = 'All Android Versions';
      } else if (androidVersions.min === 'All') {
        versionText = `Up to Android ${androidVersions.max}`;
        badgeClass = 'bg-yellow-100 text-yellow-800';
      } else if (androidVersions.max === 'All') {
        versionText = `Android ${androidVersions.min}+`;
        badgeClass = 'bg-blue-100 text-blue-800';
      } else {
        versionText = `Android ${androidVersions.min} - ${androidVersions.max}`;
        badgeClass = 'bg-yellow-100 text-yellow-800';
      }
      
      return `
        <div class="mt-2">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">
            <svg class="mr-1.5 h-2 w-2" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3" />
            </svg>
            ${versionText}
          </span>
          ${androidVersions.notes ? `
            <div class="mt-1 text-xs text-gray-500 italic">${androidVersions.notes}</div>
          ` : ''}
        </div>
      `;
    }
  
    // Render multi-version command tabs
    function renderMultiVersionCommand(cmd) {
      const tabsHtml = cmd.versions.map((version, index) => {
        return `
          <button class="version-tab px-3 py-2 text-sm font-medium ${index === 0 ? 'active bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} rounded-t-lg"
                  data-cmd-id="${cmd.id}" 
                  data-version-index="${index}">
            ${version.range}
          </button>
        `;
      }).join('');
      
      const contentHtml = cmd.versions.map((version, index) => {
        const sameCommand = version.windows === version.mac;
        
        let commandHtml = '';
        if (sameCommand) {
          commandHtml = `
            <div class="mt-4">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-600">Command:</span>
                <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${version.windows}">
                  <i class="far fa-copy"></i>
                </button>
              </div>
              <div class="highlight">${version.windows}</div>
            </div>
          `;
        } else {
          commandHtml = `
            <div class="mt-4">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-600">Windows:</span>
                <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${version.windows}">
                  <i class="far fa-copy"></i>
                </button>
              </div>
              <div class="highlight">${version.windows}</div>
            </div>
            <div class="mt-4">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-600">Mac/Linux:</span>
                <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${version.mac}">
                  <i class="far fa-copy"></i>
                </button>
              </div>
              <div class="highlight">${version.mac}</div>
            </div>
          `;
        }
        
        return `
          <div class="version-content ${index === 0 ? 'block' : 'hidden'}" data-cmd-id="${cmd.id}" data-version-index="${index}">
            ${commandHtml}
            ${version.notes ? `
              <div class="mt-3 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                <i class="fas fa-info-circle text-blue-500 mr-1"></i> ${version.notes}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
      
      return `
        <div class="mt-4">
          <div class="mb-2 text-sm font-medium text-gray-700">Android Version:</div>
          <div class="flex space-x-1 mb-2 version-tabs-container overflow-x-auto pb-1">
            ${tabsHtml}
          </div>
          <div class="version-content-container">
            ${contentHtml}
          </div>
        </div>
      `;
    }
  
    // Render standard command
    function renderStandardCommand(cmd) {
      const sameCommand = cmd.windows === cmd.mac;
      
      if (sameCommand) {
        return `
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-gray-600">Command:</span>
              <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${cmd.windows}">
                <i class="far fa-copy"></i>
              </button>
            </div>
            <div class="highlight">${cmd.windows}</div>
          </div>
        `;
      } else {
        return `
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-gray-600">Windows:</span>
              <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${cmd.windows}">
                <i class="far fa-copy"></i>
              </button>
            </div>
            <div class="highlight">${cmd.windows}</div>
          </div>
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-gray-600">Mac/Linux:</span>
              <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${cmd.mac}">
                <i class="far fa-copy"></i>
              </button>
            </div>
            <div class="highlight">${cmd.mac}</div>
          </div>
        `;
      }
    }
  
    // Render commands
    function renderCommands() {
      // Clear container (except for loader)
      Array.from(commandsContainer.children).forEach(child => {
        if (!child.classList.contains('loader-container')) {
          child.remove();
        }
      });
  
      // Filter and search
      const searchTerm = searchInput.value.toLowerCase();
      const filteredCommands = commands.filter(cmd => {
        let matchesSearch = cmd.title.toLowerCase().includes(searchTerm) || 
                           cmd.description.toLowerCase().includes(searchTerm);
        
        // Handle searching in multi-version commands
        if (cmd.multiVersion && !matchesSearch) {
          matchesSearch = cmd.versions.some(version => 
            version.windows.toLowerCase().includes(searchTerm) ||
            version.mac.toLowerCase().includes(searchTerm) ||
            (version.notes && version.notes.toLowerCase().includes(searchTerm)) ||
            version.range.toLowerCase().includes(searchTerm)
          );
        } else if (!cmd.multiVersion && !matchesSearch) {
          // Handle searching in standard commands
          matchesSearch = cmd.windows.toLowerCase().includes(searchTerm) ||
                         cmd.mac.toLowerCase().includes(searchTerm) ||
                         (cmd.androidVersions && cmd.androidVersions.notes && 
                          cmd.androidVersions.notes.toLowerCase().includes(searchTerm));
        }
        
        const matchesFilter = currentFilter === 'all' || cmd.category === currentFilter;
        
        return matchesSearch && matchesFilter;
      });
  
      // If no results
      if (filteredCommands.length === 0) {
        commandsContainer.innerHTML = `
          <div class="col-span-1 md:col-span-2 bg-white p-6 rounded-lg shadow text-center">
            <i class="fas fa-search text-gray-400 text-4xl mb-4"></i>
            <p class="text-gray-600">No commands found matching your search.</p>
            <button id="clearSearch" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
              Clear Search
            </button>
          </div>
        `;
        
        document.getElementById('clearSearch').addEventListener('click', () => {
          searchInput.value = '';
          renderCommands();
        });
        
        return;
      }
  
      // Render each command
      filteredCommands.forEach(cmd => {
        const card = document.createElement('div');
        card.className = 'command-card bg-white rounded-lg shadow overflow-hidden transition-all mb-6';
        card.setAttribute('data-category', cmd.category);
        card.setAttribute('data-id', cmd.id);
        
        // Determine platform compatibility
        let platformIcons = '';
        
        if (cmd.multiVersion) {
          // If all versions have the same command for both platforms
          const allSamePlatform = cmd.versions.every(v => v.windows === v.mac);
          if (allSamePlatform) {
            platformIcons = `<span class="platform-icon both" title="All platforms"></span>`;
          } else {
            platformIcons = `
              <span class="platform-icon windows" title="Windows"><i class="fab fa-windows text-xs"></i></span>
              <span class="platform-icon mac" title="Mac/Linux"><i class="fab fa-apple text-xs"></i></span>
            `;
          }
        } else {
          // Standard command
          const sameCommand = cmd.windows === cmd.mac;
          if (sameCommand) {
            platformIcons = `<span class="platform-icon both" title="All platforms"></span>`;
          } else {
            platformIcons = `
              <span class="platform-icon windows" title="Windows"><i class="fab fa-windows text-xs"></i></span>
              <span class="platform-icon mac" title="Mac/Linux"><i class="fab fa-apple text-xs"></i></span>
            `;
          }
        }
        
        // Version compatibility badge
        let versionInfo = '';
        if (cmd.multiVersion) {
          // For multi-version commands, we'll have version tabs instead of a badge
          versionInfo = '';
        } else if (cmd.androidVersions) {
          versionInfo = renderVersionBadge(cmd.androidVersions);
        }
        
        // Render command content
        let commandContent = '';
        if (cmd.multiVersion) {
          commandContent = renderMultiVersionCommand(cmd);
        } else {
          commandContent = renderStandardCommand(cmd);
        }
        
        // Create card content
        card.innerHTML = `
          <div class="p-6">
            <div class="flex justify-between items-start mb-3">
              <h3 class="text-xl font-semibold">${cmd.title}</h3>
              <div class="flex">
                ${platformIcons}
              </div>
            </div>
            <p class="text-gray-600 mb-4">${cmd.description}</p>
            
            ${versionInfo}
            ${commandContent}
          </div>
        `;
        
        commandsContainer.appendChild(card);
      });
      
      // Add copy functionality
      const copyButtons = document.querySelectorAll('.copy-icon');
      copyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const command = btn.getAttribute('data-command');
          navigator.clipboard.writeText(command)
            .then(() => {
              // Visual feedback
              const highlight = btn.closest('div').nextElementSibling;
              highlight.classList.add('copied');
              setTimeout(() => highlight.classList.remove('copied'), 1000);
              
              // Change icon temporarily
              const icon = btn.querySelector('i');
              icon.className = 'fas fa-check';
              setTimeout(() => {
                icon.className = 'far fa-copy';
              }, 1000);
            })
            .catch(err => {
              console.error('Could not copy text: ', err);
            });
        });
      });
      
      // Add version tab switching functionality
      const versionTabs = document.querySelectorAll('.version-tab');
      versionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const cmdId = tab.getAttribute('data-cmd-id');
          const versionIndex = tab.getAttribute('data-version-index');
          
          // Update active tab
          document.querySelectorAll(`.version-tab[data-cmd-id="${cmdId}"]`).forEach(t => {
            t.classList.remove('active', 'bg-blue-600', 'text-white');
            t.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
          });
          tab.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
          tab.classList.add('active', 'bg-blue-600', 'text-white');
          
          // Show selected content
          document.querySelectorAll(`.version-content[data-cmd-id="${cmdId}"]`).forEach(c => {
            c.classList.add('hidden');
          });
          document.querySelector(`.version-content[data-cmd-id="${cmdId}"][data-version-index="${versionIndex}"]`).classList.remove('hidden');
        });
      });
    }
    
    // Event listeners for search
    searchInput.addEventListener('input', renderCommands);
    
    // Event listeners for filters
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active button
        filterButtons.forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
        filterButtons.forEach(b => b.classList.add('bg-gray-300', 'text-gray-800'));
        btn.classList.remove('bg-gray-300', 'text-gray-800');
        btn.classList.add('active', 'bg-blue-600', 'text-white');
        
        // Set filter
        const filterId = btn.id.replace('filter', '').toLowerCase();
        currentFilter = filterId;
        
        // Re-render
        renderCommands();
      });
    });
    
    // Initialize by fetching commands
    fetchCommands();
  });