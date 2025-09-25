// app.js

const emms = {};
let wifiSecurityTypes = [];

async function loadEMMs() {
  const res = await fetch("data/emms.json");
  const data = await res.json();
  Object.assign(emms, data);

  const emmSelect = document.getElementById("emm");
  Object.keys(emms).forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key;
    emmSelect.appendChild(option);
  });
}

async function loadWifiSecurityTypes() {
  const res = await fetch("data/wifi_security_types.json");
  wifiSecurityTypes = await res.json();
}

function createFieldGroup(title) {
  const group = document.createElement("div");
  group.className = "mb-6 p-4 bg-gray-50 border rounded shadow-inner";

  const heading = document.createElement("h3");
  heading.className = "text-lg font-semibold mb-2";
  heading.textContent = title;

  group.appendChild(heading);
  return group;
}

function createTooltipIcon(tooltip) {
  const wrapper = document.createElement("span");
  wrapper.className = "tooltip-wrapper relative inline-block ml-1";
  
  const icon = document.createElement("img");
  icon.src = "https://cdn.jsdelivr.net/npm/lucide-static@0.260.0/icons/info.svg";
  icon.alt = "info";
  icon.className = "w-4 h-4 inline cursor-pointer";
  
  const tooltipElement = document.createElement("div");
  tooltipElement.className = "tooltip-content absolute z-10 w-64 bg-gray-800 text-white text-xs rounded p-2 shadow-lg opacity-0 invisible transition-opacity duration-100 bottom-full left-1/2 transform -translate-x-1/2 mb-1";
  tooltipElement.textContent = tooltip;
  
  // Add a small triangle pointing down
  const arrow = document.createElement("div");
  arrow.className = "tooltip-arrow absolute h-2 w-2 bg-gray-800 transform rotate-45 left-1/2 -ml-1 -bottom-1";
  tooltipElement.appendChild(arrow);
  
  wrapper.appendChild(icon);
  wrapper.appendChild(tooltipElement);
  
  // Show tooltip immediately on hover
  wrapper.addEventListener("mouseenter", () => {
    tooltipElement.classList.remove("opacity-0", "invisible");
    tooltipElement.classList.add("opacity-100", "visible");
  });
  
  // Hide tooltip on mouse leave
  wrapper.addEventListener("mouseleave", () => {
    tooltipElement.classList.remove("opacity-100", "visible");
    tooltipElement.classList.add("opacity-0", "invisible");
  });
  
  // Toggle tooltip on click for mobile users
  wrapper.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent click from affecting parent elements
    tooltipElement.classList.toggle("opacity-0");
    tooltipElement.classList.toggle("invisible");
    tooltipElement.classList.toggle("opacity-100");
    tooltipElement.classList.toggle("visible");
  });
  
  return wrapper;
}

function createLinkIcon(link) {
  if (!link) return null;
  
  const icon = document.createElement("img");
  icon.src = "https://cdn.jsdelivr.net/npm/lucide-static@0.260.0/icons/external-link.svg";
  icon.alt = "documentation";
  icon.className = "w-4 h-4 inline cursor-pointer";
  icon.title = "View Android documentation";
  
  const anchor = document.createElement("a");
  anchor.href = link;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.appendChild(icon);
  return anchor;
}

function getConstantName(fullKey) {
  // Extract the constant name from the full key
  const parts = fullKey.split('.');
  return parts[parts.length - 1];
}

function getDocLink(fullKey) {
  // Map the full key to the appropriate documentation link
  const constName = getConstantName(fullKey);
  return `https://developer.android.com/reference/android/app/admin/DevicePolicyManager#EXTRA_${constName}`;
}

function getTooltipText(key) {
  // Return appropriate tooltip text based on the key
  const tooltips = {
    "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": "JSON-formatted key-value pairs passed to the EMM agent",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "The component name for the mobile device management application that will be set as the device owner",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "URL where the device admin package can be downloaded",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "SHA-256 checksum of the DPC package file's signature",
    "android.app.extra.PROVISIONING_WIFI_SSID": "Wi-Fi network name the device should connect to",
    "android.app.extra.PROVISIONING_WIFI_HIDDEN": "Indicates if the Wi-Fi network is hidden (not broadcasting its SSID)",
    "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE": "Security protocol used for Wi-Fi",
    "android.app.extra.PROVISIONING_WIFI_PASSWORD": "Wi-Fi password if the network is secured",
    "android.app.extra.PROVISIONING_WIFI_PAC_URL": "URL for Proxy Auto-Configuration (PAC) script",
    "android.app.extra.PROVISIONING_WIFI_PROXY_HOST": "Hostname or IP address of proxy server",
    "android.app.extra.PROVISIONING_WIFI_PROXY_PORT": "Port number for proxy server",
    "android.app.extra.PROVISIONING_WIFI_PROXY_BYPASS": "Comma-separated list of hosts that should bypass the proxy"
  };
  
  return tooltips[key] || "";
}

function createField(labelText, name, value = "", placeholder = "", isTextarea = false, tooltip = "", isDropdown = false, docLink = "") {
  const div = document.createElement("div");
  div.className = "flex flex-col mb-2";

  const label = document.createElement("label");
  label.className = "font-semibold flex items-center gap-1";
  label.textContent = labelText;
  
  // Add doc link icon (if available)
  if (docLink) {
    label.appendChild(createLinkIcon(docLink));
  }
  
  // Add tooltip icon (if provided)
  if (tooltip) {
    label.appendChild(createTooltipIcon(tooltip));
  }

  let input;
  if (isDropdown) {
    input = document.createElement("select");
    wifiSecurityTypes.forEach(type => {
      const option = document.createElement("option");
      option.value = type.value;
      option.textContent = type.label;
      input.appendChild(option);
    });
  } else {
    input = document.createElement(isTextarea ? "textarea" : "input");
    if (typeof value === 'object') {
      value = JSON.stringify(value, null, 2);
    }
    input.value = value;
    if (placeholder) input.placeholder = placeholder;
    if (isTextarea) input.rows = 5;
  }

  input.className = "border p-2 rounded mt-1";
  input.name = name;

  div.appendChild(label);
  div.appendChild(input);
  return div;
}

function createToggleField(labelText, name, checked = false, tooltip = "", docLink = "") {
  const div = document.createElement("div");
  div.className = "flex items-center justify-between mb-2";

  const labelContainer = document.createElement("div");
  labelContainer.className = "flex items-center gap-1";
  
  const label = document.createElement("label");
  label.className = "font-semibold";
  label.textContent = labelText;
  label.htmlFor = name;
  
  labelContainer.appendChild(label);
  
  // Add doc link icon (if available)
  if (docLink) {
    labelContainer.appendChild(createLinkIcon(docLink));
  }
  
  // Add tooltip icon (if provided)
  if (tooltip) {
    labelContainer.appendChild(createTooltipIcon(tooltip));
  }

  const toggle = document.createElement("div");
  toggle.className = "relative inline-block w-10 align-middle select-none";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.id = name;
  input.className = "toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer transition-transform duration-200";
  input.checked = checked;
  
  const toggleBg = document.createElement("label");
  toggleBg.htmlFor = name;
  toggleBg.className = "toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer";

  // Add custom styling for toggle
  const style = document.createElement("style");
  style.textContent = `
    .toggle-checkbox:checked {
      transform: translateX(100%);
      border-color: #3B82F6;
    }
    .toggle-checkbox:checked + .toggle-label {
      background-color: #3B82F6;
    }
  `;
  
  toggle.appendChild(style);
  toggle.appendChild(input);
  toggle.appendChild(toggleBg);

  div.appendChild(labelContainer);
  div.appendChild(toggle);
  return div;
}

function renderForm(emmName) {
  const configForm = document.getElementById("config-form");
  configForm.innerHTML = "";

  const defaults = emms[emmName]?.defaults || {};
  const baseGroup = createFieldGroup("Device Provisioning");

  for (const [key, value] of Object.entries(defaults)) {
    const isTextarea = key === "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE";
    const tooltip = getTooltipText(key);
    const docLink = key.startsWith("android.app.extra.") ? getDocLink(key) : "";
    baseGroup.appendChild(createField(key, key, value, "", isTextarea, tooltip, false, docLink));
  }

  if (!defaults["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"]) {
    const extrasKey = "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE";
    baseGroup.appendChild(
      createField(
        extrasKey,
        extrasKey,
        "",
        "",
        true,
        getTooltipText(extrasKey),
        false,
        getDocLink(extrasKey)
      )
    );
  }

  // Create Wi-Fi section header with add button
  const wifiSectionHeader = document.createElement("div");
  wifiSectionHeader.className = "flex items-center justify-between mb-4";
  
  const wifiTitle = document.createElement("h3");
  wifiTitle.className = "text-lg font-semibold";
  wifiTitle.textContent = "Wi-Fi Configuration";
  
  const addWifiButton = document.createElement("button");
  addWifiButton.className = "bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition flex items-center justify-center";
  addWifiButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  addWifiButton.title = "Add Wi-Fi Configuration";
  
  wifiSectionHeader.appendChild(wifiTitle);
  wifiSectionHeader.appendChild(addWifiButton);
  
  // Create Wi-Fi configuration group (initially hidden)
  const wifiGroup = document.createElement("div");
  wifiGroup.className = "mb-6 p-4 bg-gray-50 border rounded shadow-inner hidden";
  wifiGroup.id = "wifi-config-group";
  
  // Basic Wi-Fi settings
  const wifiSsidKey = "android.app.extra.PROVISIONING_WIFI_SSID";
  wifiGroup.appendChild(createField(
    wifiSsidKey,
    wifiSsidKey,
    "",
    "YourWiFi",
    false,
    getTooltipText(wifiSsidKey),
    false,
    getDocLink(wifiSsidKey)
  ));
  
  // Add Hidden Wi-Fi toggle right after SSID
  const wifiHiddenKey = "android.app.extra.PROVISIONING_WIFI_HIDDEN";
  wifiGroup.appendChild(createToggleField(
    wifiHiddenKey,
    wifiHiddenKey,
    false,
    getTooltipText(wifiHiddenKey),
    getDocLink(wifiHiddenKey)
  ));
  
  const wifiSecurityKey = "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE";
  wifiGroup.appendChild(createField(
    wifiSecurityKey,
    wifiSecurityKey,
    "",
    "",
    false,
    getTooltipText(wifiSecurityKey),
    true,
    getDocLink(wifiSecurityKey)
  ));
  
  const wifiPasswordKey = "android.app.extra.PROVISIONING_WIFI_PASSWORD";
  wifiGroup.appendChild(createField(
    wifiPasswordKey,
    wifiPasswordKey,
    "",
    "Password123",
    false,
    getTooltipText(wifiPasswordKey),
    false,
    getDocLink(wifiPasswordKey)
  ));

  // Add proxy settings section header
  const proxyHeader = document.createElement("h4");
  proxyHeader.className = "font-semibold mt-4 mb-2 text-gray-700";
  proxyHeader.textContent = "Proxy Settings";
  wifiGroup.appendChild(proxyHeader);
  
  // Add proxy constants
  const wifiPacUrlKey = "android.app.extra.PROVISIONING_WIFI_PAC_URL";
  wifiGroup.appendChild(createField(
    wifiPacUrlKey,
    wifiPacUrlKey,
    "",
    "https://example.com/proxy.pac",
    false,
    getTooltipText(wifiPacUrlKey),
    false,
    getDocLink(wifiPacUrlKey)
  ));
  
  const wifiProxyHostKey = "android.app.extra.PROVISIONING_WIFI_PROXY_HOST";
  wifiGroup.appendChild(createField(
    wifiProxyHostKey,
    wifiProxyHostKey,
    "",
    "proxy.example.com",
    false,
    getTooltipText(wifiProxyHostKey),
    false,
    getDocLink(wifiProxyHostKey)
  ));
  
  const wifiProxyPortKey = "android.app.extra.PROVISIONING_WIFI_PROXY_PORT";
  wifiGroup.appendChild(createField(
    wifiProxyPortKey,
    wifiProxyPortKey,
    "",
    "8080",
    false,
    getTooltipText(wifiProxyPortKey),
    false,
    getDocLink(wifiProxyPortKey)
  ));
  
  const wifiProxyBypassKey = "android.app.extra.PROVISIONING_WIFI_PROXY_BYPASS";
  wifiGroup.appendChild(createField(
    wifiProxyBypassKey,
    wifiProxyBypassKey,
    "",
    "localhost,127.0.0.1,internal.example.com",
    false,
    getTooltipText(wifiProxyBypassKey),
    false,
    getDocLink(wifiProxyBypassKey)
  ));

  // Add event listener to toggle Wi-Fi configuration
  addWifiButton.addEventListener("click", (e) => {
    // Prevent default button behavior to avoid page refresh
    e.preventDefault();
    e.stopPropagation();
    
    wifiGroup.classList.toggle("hidden");
    // Change button icon based on visibility
    if (wifiGroup.classList.contains("hidden")) {
      addWifiButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
      addWifiButton.title = "Add Wi-Fi Configuration";
    } else {
      addWifiButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
      addWifiButton.title = "Remove Wi-Fi Configuration";
    }
  });

  configForm.appendChild(baseGroup);
  configForm.appendChild(wifiSectionHeader);
  configForm.appendChild(wifiGroup);
}

function generateQRCodeText(fields) {
  let json = {};
  let extrasUsed = false;
  let wifiUsed = false;

  fields.forEach(input => {
    const name = input.name;
    let value = input.value;
    
    // Handle checkbox/toggle inputs
    if (input.type === 'checkbox') {
      value = input.checked ? "true" : "";
      // Don't include unchecked toggles in the output
      if (!input.checked) return;
    } else {
      value = value.trim();
      if (!value) return;
    }

    const isWifiField = name.startsWith("android.app.extra.PROVISIONING_WIFI_");
    const isExtrasField = name === "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE";
    const isRequired = [
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"
    ].includes(name);

    if (isExtrasField) {
      try {
        const parsed = JSON.parse(value);
        if (Object.keys(parsed).length > 0) {
          json[name] = parsed;
          extrasUsed = true;
        }
      } catch (e) {
        alert("Invalid JSON in PROVISIONING_ADMIN_EXTRAS_BUNDLE");
        throw e;
      }
    } else if (isWifiField) {
      wifiUsed = true;
      // Make sure all values are strings in the JSON output
      json[name] = value.toString();
    } else if (isRequired) {
      json[name] = value;
    }
  });

  let pretty = JSON.stringify(json, null, 2);

  const encoder = new TextEncoder();
  const data = encoder.encode(pretty);

  return crypto.subtle.digest("SHA-256", data).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer.slice(0, 3)));
    const b64 = btoa(String.fromCharCode(...hashArray));
    pretty += `\nCheckSum:${b64}`;
    return { json: JSON.stringify(json, null, 2), withChecksum: pretty };
  });
}

function renderQRCode(content) {
  const qr = qrcode(0, "L");
  qr.addData(content.withChecksum);
  qr.make();

  document.getElementById("qrcode").innerHTML = qr.createSvgTag();
  document.getElementById("qrtext").value = content.json;
  document.getElementById("output").classList.remove("hidden");
}

function downloadQRCode(format) {
  const svgElement = document.querySelector("#qrcode svg");

  if (format === "svg") {
    // Clone the SVG element to modify it for download
    const clonedSvg = svgElement.cloneNode(true);

    // Set a much larger size for the SVG download (e.g., 1024x1024)
    const targetSize = 1024;
    clonedSvg.setAttribute("width", targetSize);
    clonedSvg.setAttribute("height", targetSize);

    // Get the modified SVG data
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(svgBlob);
    link.download = "qr_code.svg";
    link.click();
  } else if (format === "png") {
    // Get the SVG data for PNG conversion
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });

    const canvas = document.createElement("canvas");
    const img = new Image();
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Set a much larger size for the PNG download (e.g., 1024x1024 pixels)
      const targetSize = 1024;
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");

      // Scale the image to fit the larger canvas
      ctx.drawImage(img, 0, 0, targetSize, targetSize);
      URL.revokeObjectURL(url);

      canvas.toBlob(blob => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "qr_code.png";
        link.click();
      });
    };
    img.src = url;
  }
}

function showToast() {
  const toast = document.getElementById("toast");
  
  // Clear any existing timeout to prevent issues if button is clicked multiple times
  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }
  
  // Show the toast
  toast.className = "toast show";
  
  // Set a timeout to hide the toast
  toast.timeoutId = setTimeout(() => { 
    toast.className = toast.className.replace("show", ""); 
  }, 3000);
}

function closeAllTooltips() {
  document.querySelectorAll('.tooltip-content').forEach(tooltip => {
    tooltip.classList.remove("opacity-100", "visible");
    tooltip.classList.add("opacity-0", "invisible");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadEMMs(), loadWifiSecurityTypes()]);

  // Load external CSS file if not already loaded
  if (!document.querySelector('link[href="tooltips.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'tooltips.css';
    document.head.appendChild(link);
  }

  // Close tooltips when clicking elsewhere on the page
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.tooltip-wrapper')) {
      closeAllTooltips();
    }
  });

  document.getElementById("emm").addEventListener("change", (e) => {
    if (e.target.value) {
      renderForm(e.target.value);
    }
  });

  document.getElementById("generate").addEventListener("click", async () => {
    const form = document.getElementById("config-form");
    const fields = Array.from(form.querySelectorAll("input, textarea, select"));

    try {
      const qrText = await generateQRCodeText(fields);
      renderQRCode(qrText);
    } catch (_) {}
  });

  document.getElementById("download-png").addEventListener("click", () => downloadQRCode("png"));
  document.getElementById("download-svg").addEventListener("click", () => downloadQRCode("svg"));

  // Add event listener for copy-text button
  document.getElementById("copy-text").addEventListener("click", () => {
    const textArea = document.getElementById("qrtext");
    copyTextToClipboard(textArea.value);
  });

  // Modern clipboard copy functionality
  document.getElementById("copy-json").addEventListener("click", () => {
    const textArea = document.getElementById("qrtext");
    copyTextToClipboard(textArea.value);
  });
  
  // Centralized copy function
  function copyTextToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast();
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          // Fallback to older method if clipboard API fails
          fallbackCopyTextToClipboard(document.getElementById("qrtext"));
        });
    } else {
      // Fallback for browsers that don't support clipboard API
      fallbackCopyTextToClipboard(document.getElementById("qrtext"));
    }
  }
  
  // Fallback copy method for older browsers
  function fallbackCopyTextToClipboard(textArea) {
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast();
      } else {
        console.error('Fallback: Copying text failed');
      }
    } catch (err) {
      console.error('Fallback: Unable to copy', err);
    }
    
    // Deselect the text
    window.getSelection().removeAllRanges();
  }
});