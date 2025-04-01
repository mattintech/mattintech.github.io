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

function createTooltipIcon(tooltip, link) {
  const icon = document.createElement("img");
  icon.src = "https://cdn.jsdelivr.net/npm/lucide-static@0.260.0/icons/info.svg";
  icon.alt = "info";
  icon.className = "w-4 h-4 inline cursor-pointer";
  icon.title = tooltip;

  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.appendChild(icon);
    return anchor;
  }
  return icon;
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

function createField(labelText, name, value = "", placeholder = "", isTextarea = false, tooltip = "", isDropdown = false, docLink = "") {
  const div = document.createElement("div");
  div.className = "flex flex-col mb-2";

  const label = document.createElement("label");
  label.className = "font-semibold flex items-center gap-1";
  label.textContent = labelText;
  
  if (tooltip) {
    label.appendChild(createTooltipIcon(tooltip, docLink));
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

function renderForm(emmName) {
  const configForm = document.getElementById("config-form");
  configForm.innerHTML = "";

  const defaults = emms[emmName]?.defaults || {};
  const baseGroup = createFieldGroup("Device Provisioning");

  for (const [key, value] of Object.entries(defaults)) {
    const isTextarea = key === "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE";
    const tooltip = isTextarea ? "JSON-formatted key-value pairs passed to the EMM agent" : "";
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
        "JSON-formatted key-value pairs passed to the EMM agent",
        false,
        getDocLink(extrasKey)
      )
    );
  }

  const wifiGroup = createFieldGroup("Wi-Fi Configuration");
  
  const wifiSsidKey = "android.app.extra.PROVISIONING_WIFI_SSID";
  wifiGroup.appendChild(createField(
    wifiSsidKey,
    wifiSsidKey,
    "",
    "YourWiFi",
    false,
    "Wi-Fi network name the device should connect to",
    false,
    getDocLink(wifiSsidKey)
  ));
  
  const wifiSecurityKey = "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE";
  wifiGroup.appendChild(createField(
    wifiSecurityKey,
    wifiSecurityKey,
    "",
    "",
    false,
    "Security protocol used for Wi-Fi",
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
    "Wi-Fi password if the network is secured",
    false,
    getDocLink(wifiPasswordKey)
  ));

  configForm.appendChild(baseGroup);
  configForm.appendChild(wifiGroup);
}

function generateQRCodeText(fields) {
  let json = {};
  let extrasUsed = false;
  let wifiUsed = false;

  fields.forEach(input => {
    const name = input.name;
    const value = input.value.trim();
    if (!value) return;

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
      json[name] = value;
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
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });

  if (format === "svg") {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(svgBlob);
    link.download = "qr_code.svg";
    link.click();
  } else if (format === "png") {
    const canvas = document.createElement("canvas");
    const img = new Image();
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
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
  toast.className = "toast show";
  setTimeout(() => { 
    toast.className = toast.className.replace("show", ""); 
  }, 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadEMMs(), loadWifiSecurityTypes()]);

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

  // Modern clipboard copy functionality
  document.getElementById("copy-json").addEventListener("click", () => {
    const textArea = document.getElementById("qrtext");
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textArea.value)
        .then(() => {
          showToast();
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          // Fallback to older method if clipboard API fails
          fallbackCopyTextToClipboard(textArea);
        });
    } else {
      // Fallback for browsers that don't support clipboard API
      fallbackCopyTextToClipboard(textArea);
    }
  });
  
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