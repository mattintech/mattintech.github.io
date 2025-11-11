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

    // Render verification badge with tooltip
    function renderVerificationBadge(verification) {
      if (!verification) return '';

      let badgeClass = 'unverified';
      let badgeText = 'Unverified';
      let badgeIcon = 'fa-question-circle';
      let tooltipContent = '';

      if (verification.verified === true) {
        badgeClass = 'verified';
        badgeText = 'Verified';
        badgeIcon = 'fa-check-circle';
      } else if (verification.overallStatus === 'partial') {
        badgeClass = 'partial';
        badgeText = 'Partially Verified';
        badgeIcon = 'fa-exclamation-circle';
      }

      // Build tooltip content
      if (verification.testedVersions && Object.keys(verification.testedVersions).length > 0) {
        const apiVersionMap = {
          '31': '12',
          '33': '13',
          '34': '14',
          '35': '15',
          '36': '16'
        };

        const versions = Object.keys(verification.testedVersions)
          .sort((a, b) => Number(b) - Number(a))
          .map(api => {
            const test = verification.testedVersions[api];
            const androidVersion = apiVersionMap[api] || api;
            const icon = test.status === 'pass' ?
              '<i class="fas fa-check text-green-400"></i>' :
              '<i class="fas fa-times text-red-400"></i>';
            return `
              <div class="tooltip-version">
                ${icon}
                <span>Android ${androidVersion} (API ${api})</span>
              </div>
            `;
          }).join('');

        tooltipContent = `
          <div class="verification-tooltip">
            <div class="verification-tooltip-content">
              <div style="font-weight: 600; margin-bottom: 0.25rem;">Tested Versions:</div>
              ${versions}
            </div>
          </div>
        `;
      } else if (badgeClass === 'unverified') {
        tooltipContent = `
          <div class="verification-tooltip">
            <div class="verification-tooltip-content">
              <div>Not yet tested on any Android version</div>
            </div>
          </div>
        `;
      }

      return `
        <span class="verification-badge ${badgeClass}" data-tooltip="${escapeHtml(tooltipContent)}">
          <i class="fas ${badgeIcon}"></i>
          ${badgeText}
        </span>
      `;
    }

    // Render API level test badges (deprecated - using tooltips instead)
    function renderApiLevelBadges(verification) {
      // This function is no longer used - we show versions in the tooltip
      return '';
    }

    // Render command output from verification
    function renderVerificationOutput(verification) {
      // Don't show output by default to keep cards clean
      return '';
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Render verification info for multi-version commands
    function renderMultiVersionVerification(versions, cmd) {
      if (!versions || versions.length === 0) return '';

      // Collect all tested versions across all version entries
      const allTestedVersions = {};
      let hasVerified = false;
      let hasPartial = false;

      versions.forEach(version => {
        if (version.verification && version.verification.testedVersions) {
          Object.entries(version.verification.testedVersions).forEach(([api, testData]) => {
            if (!allTestedVersions[api]) {
              allTestedVersions[api] = {
                status: testData.status,
                date: testData.date,
                range: version.range
              };
              if (testData.status === 'pass') {
                hasVerified = true;
              } else {
                hasPartial = true;
              }
            }
          });
        }
      });

      if (Object.keys(allTestedVersions).length === 0) {
        return renderVerificationBadge({ verified: false });
      }

      // Create verification badge with tooltip for multi-version commands
      let badgeClass = 'unverified';
      let badgeText = 'Unverified';
      let badgeIcon = 'fa-question-circle';

      if (hasVerified && !hasPartial) {
        badgeClass = 'verified';
        badgeText = 'Verified';
        badgeIcon = 'fa-check-circle';
      } else if (hasVerified) {
        badgeClass = 'partial';
        badgeText = 'Partially Verified';
        badgeIcon = 'fa-exclamation-circle';
      }

      const apiVersionMap = {
        '31': '12',
        '33': '13',
        '34': '14',
        '35': '15',
        '36': '16'
      };

      const tooltipVersions = Object.keys(allTestedVersions)
        .sort((a, b) => Number(b) - Number(a))
        .map(api => {
          const test = allTestedVersions[api];
          const androidVersion = apiVersionMap[api] || api;
          const icon = test.status === 'pass' ?
            '<i class="fas fa-check text-green-400"></i>' :
            '<i class="fas fa-times text-red-400"></i>';
          return `
            <div class="tooltip-version">
              ${icon}
              <span>Android ${androidVersion} (API ${api})</span>
            </div>
          `;
        }).join('');

      const tooltipContent = `
        <div class="verification-tooltip">
          <div class="verification-tooltip-content">
            <div style="font-weight: 600; margin-bottom: 0.25rem;">Tested Versions:</div>
            ${tooltipVersions}
          </div>
        </div>
      `;

      return `
        <span class="verification-badge ${badgeClass}" data-tooltip="${escapeHtml(tooltipContent)}">
          <i class="fas ${badgeIcon}"></i>
          ${badgeText}
        </span>
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
                <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${escapeHtml(version.windows)}">
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
                <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${escapeHtml(version.windows)}">
                  <i class="far fa-copy"></i>
                </button>
              </div>
              <div class="highlight">${version.windows}</div>
            </div>
            <div class="mt-4">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-600">Mac/Linux:</span>
                <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${escapeHtml(version.mac)}">
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
              <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${escapeHtml(cmd.windows)}">
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
              <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${escapeHtml(cmd.windows)}">
                <i class="far fa-copy"></i>
              </button>
            </div>
            <div class="highlight">${cmd.windows}</div>
          </div>
          <div class="mt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-gray-600">Mac/Linux:</span>
              <button class="copy-icon text-gray-400 hover:text-blue-600 transition" data-command="${escapeHtml(cmd.mac)}">
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
        card.className = 'command-card bg-white rounded-lg shadow transition-all mb-6';
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
          // Check for explicit allPlatforms flag first
          if (cmd.allPlatforms) {
            platformIcons = `<span class="platform-icon both" title="All platforms"></span>`;
          } else {
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
        
        // Get verification badges
        let verificationBadge = '';
        let verificationOutput = '';

        if (cmd.multiVersion) {
          // For multi-version commands, check overall verification
          verificationBadge = renderMultiVersionVerification(cmd.versions, cmd);
          // Output is handled within each version tab
        } else {
          // For standard commands
          verificationBadge = renderVerificationBadge(cmd.verification);
          verificationOutput = renderVerificationOutput(cmd.verification);
        }

        // Create card content
        card.innerHTML = `
          <div class="p-6">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="text-xl font-semibold inline">${cmd.title}</h3>
                ${verificationBadge}
              </div>
              <div class="flex">
                ${platformIcons}
              </div>
            </div>
            <p class="text-gray-600 mb-4">${cmd.description}</p>

            ${versionInfo}
            ${commandContent}
            ${verificationOutput}
          </div>
        `;
        
        commandsContainer.appendChild(card);
      });
      
      // Add copy functionality
      const copyButtons = document.querySelectorAll('.copy-icon');
      copyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const commandEscaped = btn.getAttribute('data-command');
          // Decode HTML entities
          const textarea = document.createElement('textarea');
          textarea.innerHTML = commandEscaped;
          const command = textarea.value;

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

      // Add tooltip positioning for verification badges
      let currentTooltip = null;
      const verificationBadges = document.querySelectorAll('.verification-badge');

      verificationBadges.forEach(badge => {
        const tooltipHTML = badge.getAttribute('data-tooltip');
        if (!tooltipHTML || tooltipHTML === 'undefined') return;

        badge.addEventListener('mouseenter', () => {
          // Remove any existing tooltip
          if (currentTooltip) {
            currentTooltip.remove();
          }

          // Create new tooltip element
          const tooltip = document.createElement('div');
          tooltip.innerHTML = tooltipHTML.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
          const tooltipElement = tooltip.firstElementChild;

          if (!tooltipElement) return;

          // Add it to the body but keep it invisible to measure
          tooltipElement.style.visibility = 'hidden';
          tooltipElement.style.opacity = '0';
          document.body.appendChild(tooltipElement);
          currentTooltip = tooltipElement;

          const badgeRect = badge.getBoundingClientRect();

          // Position tooltip initially to measure its size
          tooltipElement.style.left = `${badgeRect.left + badgeRect.width / 2}px`;
          tooltipElement.style.transform = 'translateX(-50%)';

          // Get actual height after a brief delay to ensure rendering
          setTimeout(() => {
            const tooltipRect = tooltipElement.getBoundingClientRect();
            const actualHeight = tooltipRect.height;

            // Position tooltip above the badge by default with actual height
            tooltipElement.style.top = `${badgeRect.top - actualHeight - 10}px`;

            // Remove previous positioning classes
            tooltipElement.classList.remove('below');

            // Check if tooltip goes off screen top
            if (badgeRect.top - actualHeight - 10 < 10) {
              // Position below instead
              tooltipElement.style.top = `${badgeRect.bottom + 10}px`;
              tooltipElement.classList.add('below');
            }

            // Make sure tooltip stays within viewport horizontally
            if (tooltipRect.left < 10) {
              tooltipElement.style.left = `${10 + tooltipRect.width / 2}px`;
            } else if (tooltipRect.right > window.innerWidth - 10) {
              tooltipElement.style.left = `${window.innerWidth - 10 - tooltipRect.width / 2}px`;
            }

            // Now show the tooltip
            tooltipElement.style.visibility = 'visible';
            tooltipElement.style.opacity = '';
            tooltipElement.classList.add('show');
          }, 10);
        });

        badge.addEventListener('mouseleave', () => {
          if (currentTooltip) {
            currentTooltip.classList.remove('show');
            setTimeout(() => {
              if (currentTooltip && !currentTooltip.classList.contains('show')) {
                currentTooltip.remove();
                currentTooltip = null;
              }
            }, 200);
          }
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
    
    // Initialize button styles
    function updateButtonStyles() {
      filterButtons.forEach(b => {
        if (b.classList.contains('active')) {
          b.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
          b.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        } else {
          b.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
          b.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
        }
      });
    }

    // Initial styling
    updateButtonStyles();

    // Event listeners for filters
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active button
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateButtonStyles();
        
        // Set filter
        const filterId = btn.id.replace('filter', '').toLowerCase();

        // Map filter IDs to category names
        const categoryMap = {
          'all': 'all',
          'connection': 'connection',
          'installation': 'installation',
          'deviceinfo': 'deviceinfo',
          'troubleshooting': 'troubleshooting',
          'packagemanagement': 'package-management',
          'settings': 'settings',
          'systeminfo': 'system-info',
          'androidenterprise': 'android-enterprise'
        };

        currentFilter = categoryMap[filterId] || filterId;
        
        // Re-render
        renderCommands();
      });
    });
    
    // Initialize by fetching commands
    fetchCommands();
  });