// State
let canvasWidth = 1080;
let canvasHeight = 1920;
let exportFormat = 'png';
let jpgQuality = 0.9;
let orientation = 'portrait';
let elements = [];
let selectedElement = null;
let zIndexCounter = 1;

// Material Design Icons (common ones)
const materialIcons = [
    'home', 'settings', 'search', 'menu', 'close', 'check', 'add', 'remove',
    'edit', 'delete', 'save', 'share', 'download', 'upload', 'favorite',
    'star', 'heart_broken', 'thumb_up', 'thumb_down', 'visibility',
    'notifications', 'email', 'phone', 'message', 'chat', 'send',
    'person', 'group', 'account_circle', 'face', 'mood',
    'lock', 'lock_open', 'vpn_key', 'security', 'verified',
    'shopping_cart', 'store', 'payments', 'credit_card', 'receipt',
    'schedule', 'event', 'alarm', 'timer', 'hourglass_empty',
    'place', 'map', 'navigation', 'directions', 'explore',
    'photo', 'camera', 'image', 'photo_library', 'filter',
    'music_note', 'headphones', 'mic', 'volume_up', 'play_arrow',
    'pause', 'stop', 'skip_next', 'skip_previous', 'replay',
    'wifi', 'bluetooth', 'signal_cellular_alt', 'battery_full', 'flash_on',
    'light_mode', 'dark_mode', 'brightness_high', 'contrast', 'palette',
    'code', 'terminal', 'bug_report', 'build', 'extension',
    'cloud', 'cloud_upload', 'cloud_download', 'sync', 'backup',
    'folder', 'file_copy', 'attachment', 'link', 'insert_drive_file',
    'print', 'keyboard', 'mouse', 'desktop_windows', 'smartphone',
    'tablet', 'watch', 'tv', 'speaker', 'router',
    'restaurant', 'local_cafe', 'local_bar', 'cake', 'icecream',
    'fitness_center', 'sports_soccer', 'pool', 'golf_course', 'hiking',
    'flight', 'directions_car', 'directions_bus', 'train', 'directions_boat',
    'pets', 'eco', 'park', 'forest', 'waves',
    'wb_sunny', 'nights_stay', 'cloud_queue', 'thunderstorm', 'ac_unit',
    'celebration', 'emoji_emotions', 'sentiment_satisfied', 'rocket_launch', 'auto_awesome'
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    populateIcons();
    setupEventListeners();
});

function initCanvas() {
    const canvas = document.getElementById('canvas');
    const wrapper = document.getElementById('canvasWrapper');

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Scale canvas to fit viewport while maintaining aspect ratio
    const maxHeight = window.innerHeight - 150;
    const maxWidth = window.innerWidth - 600;
    const scale = Math.min(maxWidth / canvasWidth, maxHeight / canvasHeight, 1);

    canvas.style.width = (canvasWidth * scale) + 'px';
    canvas.style.height = (canvasHeight * scale) + 'px';
    wrapper.style.width = (canvasWidth * scale) + 'px';
    wrapper.style.height = (canvasHeight * scale) + 'px';

    // Create canvas center guide lines
    createCanvasCenterGuides();

    renderCanvas();
}

function renderCanvas() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = document.getElementById('bgColor').value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function populateIcons() {
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = materialIcons.map(icon =>
        `<div class="icon-item" onclick="addIcon('${icon}')" title="${icon}">
            <span class="material-icons">${icon}</span>
        </div>`
    ).join('');
}

function setupEventListeners() {
    // Background color sync
    const bgColor = document.getElementById('bgColor');
    const bgColorHex = document.getElementById('bgColorHex');

    bgColor.addEventListener('input', (e) => {
        bgColorHex.value = e.target.value;
        renderCanvas();
    });

    bgColorHex.addEventListener('input', (e) => {
        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
            bgColor.value = e.target.value;
            renderCanvas();
        }
    });

    // Image upload
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);

    // Device select
    document.getElementById('deviceSelect').addEventListener('change', handleDeviceChange);

    // Quality slider
    document.getElementById('qualitySlider').addEventListener('input', (e) => {
        jpgQuality = e.target.value / 100;
        document.getElementById('qualityValue').textContent = e.target.value;
    });

    // Icon search
    document.getElementById('iconSearch').addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.icon-item');
        items.forEach(item => {
            const iconName = item.getAttribute('title');
            item.style.display = iconName.includes(search) ? 'flex' : 'none';
        });
    });

    // Font preview in text input
    const textInput = document.getElementById('textInput');
    const fontSelect = document.getElementById('fontSelect');
    const textColor = document.getElementById('textColor');
    const fontWeight = document.getElementById('fontWeight');

    // Initialize with default font
    updateTextPreview();

    fontSelect.addEventListener('change', updateTextPreview);
    textColor.addEventListener('input', updateTextPreview);
    fontWeight.addEventListener('change', updateTextPreview);

    // Click outside to deselect
    document.getElementById('canvasWrapper').addEventListener('click', (e) => {
        if (e.target.id === 'canvas' || e.target.id === 'canvasWrapper') {
            deselectAll();
        }
    });

    // Keyboard delete
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
            deleteSelected();
        }
    });

    // Opacity slider
    document.getElementById('elementOpacity').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('opacityValue').textContent = value + '%';
        if (selectedElement) {
            selectedElement.style.opacity = value / 100;
            selectedElement.dataset.opacity = value;
        }
    });
}

function updateTextPreview() {
    const textInput = document.getElementById('textInput');
    const font = document.getElementById('fontSelect').value;
    const color = document.getElementById('textColor').value;
    const weight = document.getElementById('fontWeight').value;

    textInput.style.fontFamily = font;
    textInput.style.color = color;
    textInput.style.fontWeight = weight;
}

// Alignment guide system
const SNAP_THRESHOLD = 6;

function getElementBounds(element) {
    const left = parseFloat(element.style.left) || 0;
    const top = parseFloat(element.style.top) || 0;
    const width = element.offsetWidth;
    const height = element.offsetHeight;

    return {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height,
        centerX: left + width / 2,
        centerY: top + height / 2,
        width: width,
        height: height
    };
}

function createCanvasCenterGuides() {
    const wrapper = document.getElementById('canvasWrapper');

    if (!document.getElementById('canvasCenterH')) {
        const guideH = document.createElement('div');
        guideH.id = 'canvasCenterH';
        guideH.className = 'canvas-center-guide canvas-center-guide-h';
        wrapper.appendChild(guideH);

        const guideV = document.createElement('div');
        guideV.id = 'canvasCenterV';
        guideV.className = 'canvas-center-guide canvas-center-guide-v';
        wrapper.appendChild(guideV);
    }
}

function showCanvasCenterGuides() {
    const guideH = document.getElementById('canvasCenterH');
    const guideV = document.getElementById('canvasCenterV');
    if (guideH) guideH.classList.add('visible');
    if (guideV) guideV.classList.add('visible');
}

function hideCanvasCenterGuides() {
    const guideH = document.getElementById('canvasCenterH');
    const guideV = document.getElementById('canvasCenterV');
    if (guideH) guideH.classList.remove('visible');
    if (guideV) guideV.classList.remove('visible');
}

function clearAlignmentGuides() {
    const wrapper = document.getElementById('canvasWrapper');
    wrapper.querySelectorAll('.align-guide').forEach(g => g.remove());
}

function createAlignGuide(type, position) {
    const wrapper = document.getElementById('canvasWrapper');
    const guide = document.createElement('div');
    guide.className = `align-guide align-guide-${type}`;

    if (type === 'h') {
        guide.style.top = position + 'px';
    } else {
        guide.style.left = position + 'px';
    }

    wrapper.appendChild(guide);
    return guide;
}

function updateAlignmentGuides(draggedElement) {
    clearAlignmentGuides();

    const wrapper = document.getElementById('canvasWrapper');
    const wrapperWidth = parseFloat(wrapper.style.width);
    const wrapperHeight = parseFloat(wrapper.style.height);

    const draggedBounds = getElementBounds(draggedElement);

    // Canvas center points
    const canvasCenterX = wrapperWidth / 2;
    const canvasCenterY = wrapperHeight / 2;

    // Collect all alignment points from other elements
    const hPoints = []; // horizontal alignment (y positions)
    const vPoints = []; // vertical alignment (x positions)

    // Add canvas center as alignment points
    hPoints.push({ y: canvasCenterY, type: 'canvas-center' });
    vPoints.push({ x: canvasCenterX, type: 'canvas-center' });

    // Add canvas edges
    hPoints.push({ y: 0, type: 'canvas-edge' });
    hPoints.push({ y: wrapperHeight, type: 'canvas-edge' });
    vPoints.push({ x: 0, type: 'canvas-edge' });
    vPoints.push({ x: wrapperWidth, type: 'canvas-edge' });

    // Collect alignment points from other elements
    elements.forEach(el => {
        if (el === draggedElement) return;

        const bounds = getElementBounds(el);

        // Add element edges and center
        hPoints.push({ y: bounds.top, type: 'element-edge' });
        hPoints.push({ y: bounds.bottom, type: 'element-edge' });
        hPoints.push({ y: bounds.centerY, type: 'element-center' });

        vPoints.push({ x: bounds.left, type: 'element-edge' });
        vPoints.push({ x: bounds.right, type: 'element-edge' });
        vPoints.push({ x: bounds.centerX, type: 'element-center' });
    });

    // Check dragged element's key points against alignment points
    const draggedHPoints = [draggedBounds.top, draggedBounds.centerY, draggedBounds.bottom];
    const draggedVPoints = [draggedBounds.left, draggedBounds.centerX, draggedBounds.right];

    // Find horizontal alignments
    hPoints.forEach(point => {
        draggedHPoints.forEach(dragY => {
            if (Math.abs(dragY - point.y) < SNAP_THRESHOLD) {
                createAlignGuide('h', point.y);
            }
        });
    });

    // Find vertical alignments
    vPoints.forEach(point => {
        draggedVPoints.forEach(dragX => {
            if (Math.abs(dragX - point.x) < SNAP_THRESHOLD) {
                createAlignGuide('v', point.x);
            }
        });
    });
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            addImageElement(img, event.target.result);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function addImageElement(img, src) {
    const wrapper = document.getElementById('canvasWrapper');
    const scale = parseFloat(wrapper.style.width) / canvasWidth;

    // Scale image to fit canvas (max 50% of canvas size)
    let width = img.width;
    let height = img.height;
    const maxSize = Math.min(canvasWidth, canvasHeight) * 0.5;

    if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
    }

    const element = document.createElement('div');
    element.className = 'canvas-element image-element';
    element.style.width = (width * scale) + 'px';
    element.style.height = (height * scale) + 'px';
    element.style.left = ((canvasWidth - width) / 2 * scale) + 'px';
    element.style.top = ((canvasHeight - height) / 2 * scale) + 'px';
    element.style.zIndex = zIndexCounter++;

    element.innerHTML = `
        <img src="${src}" draggable="false">
        <div class="resize-handle se"></div>
        <button class="delete-btn" onclick="deleteElement(this.parentElement)">&times;</button>
    `;

    element.dataset.type = 'image';
    element.dataset.src = src;
    element.dataset.originalWidth = width;
    element.dataset.originalHeight = height;
    element.dataset.opacity = 100;

    wrapper.appendChild(element);
    elements.push(element);

    makeDraggable(element);
    makeResizable(element);
    selectElement(element);
}

function addText() {
    const text = document.getElementById('textInput').value;
    if (!text) return;

    const font = document.getElementById('fontSelect').value;
    const size = document.getElementById('fontSize').value;
    const color = document.getElementById('textColor').value;
    const weight = document.getElementById('fontWeight').value;

    const wrapper = document.getElementById('canvasWrapper');
    const scale = parseFloat(wrapper.style.width) / canvasWidth;

    const element = document.createElement('div');
    element.className = 'canvas-element text-element';
    element.style.fontFamily = font;
    element.style.fontSize = (size * scale) + 'px';
    element.style.color = color;
    element.style.fontWeight = weight;
    element.style.left = (canvasWidth * scale / 2 - 50) + 'px';
    element.style.top = (canvasHeight * scale / 2) + 'px';
    element.style.zIndex = zIndexCounter++;
    element.textContent = text;

    element.innerHTML += `
        <div class="resize-handle se"></div>
        <button class="delete-btn" onclick="deleteElement(this.parentElement)">&times;</button>
    `;

    element.dataset.type = 'text';
    element.dataset.text = text;
    element.dataset.font = font;
    element.dataset.size = size;
    element.dataset.color = color;
    element.dataset.weight = weight;
    element.dataset.opacity = 100;

    wrapper.appendChild(element);
    elements.push(element);

    makeDraggable(element);
    makeResizable(element);
    selectElement(element);

    document.getElementById('textInput').value = '';
}

function addIcon(iconName) {
    const size = document.getElementById('iconSize').value;
    const color = document.getElementById('iconColor').value;

    const wrapper = document.getElementById('canvasWrapper');
    const scale = parseFloat(wrapper.style.width) / canvasWidth;

    const element = document.createElement('div');
    element.className = 'canvas-element icon-element';
    element.style.fontSize = (size * scale) + 'px';
    element.style.color = color;
    element.style.width = (size * scale) + 'px';
    element.style.height = (size * scale) + 'px';
    element.style.left = (canvasWidth * scale / 2 - size * scale / 2) + 'px';
    element.style.top = (canvasHeight * scale / 2 - size * scale / 2) + 'px';
    element.style.zIndex = zIndexCounter++;

    element.innerHTML = `
        <span class="material-icons">${iconName}</span>
        <div class="resize-handle se"></div>
        <button class="delete-btn" onclick="deleteElement(this.parentElement)">&times;</button>
    `;

    element.dataset.type = 'icon';
    element.dataset.icon = iconName;
    element.dataset.size = size;
    element.dataset.color = color;
    element.dataset.opacity = 100;

    wrapper.appendChild(element);
    elements.push(element);

    makeDraggable(element);
    makeResizable(element);
    selectElement(element);
}

function addShape(shapeType) {
    const fillColor = document.getElementById('shapeFillColor').value;
    const strokeColor = document.getElementById('shapeStrokeColor').value;
    const strokeWidth = document.getElementById('shapeStrokeWidth').value;

    const wrapper = document.getElementById('canvasWrapper');
    const scale = parseFloat(wrapper.style.width) / canvasWidth;

    const size = 150;
    const element = document.createElement('div');
    element.className = 'canvas-element shape-element';
    element.style.width = (size * scale) + 'px';
    element.style.height = (size * scale) + 'px';
    element.style.left = (canvasWidth * scale / 2 - size * scale / 2) + 'px';
    element.style.top = (canvasHeight * scale / 2 - size * scale / 2) + 'px';
    element.style.zIndex = zIndexCounter++;

    // Create SVG for the shape
    let svgContent = '';
    const sw = parseInt(strokeWidth);
    const offset = sw / 2;

    switch (shapeType) {
        case 'rectangle':
            svgContent = `<rect x="${offset}" y="${offset}" width="calc(100% - ${sw}px)" height="calc(100% - ${sw}px)"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                style="width: calc(100% - ${sw}px); height: calc(100% - ${sw}px);"/>`;
            break;
        case 'circle':
            svgContent = `<ellipse cx="50%" cy="50%" rx="calc(50% - ${offset}px)" ry="calc(50% - ${offset}px)"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'triangle':
            svgContent = `<polygon points="50,${offset} ${100 - offset},${100 - offset} ${offset},${100 - offset}"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                style="transform-origin: center;"/>`;
            break;
        case 'rounded':
            svgContent = `<rect x="${offset}" y="${offset}" rx="15" ry="15"
                width="calc(100% - ${sw}px)" height="calc(100% - ${sw}px)"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                style="width: calc(100% - ${sw}px); height: calc(100% - ${sw}px);"/>`;
            break;
        case 'line':
            element.style.height = (20 * scale) + 'px';
            svgContent = `<line x1="0" y1="50%" x2="100%" y2="50%"
                stroke="${fillColor}" stroke-width="${Math.max(4, strokeWidth)}" stroke-linecap="round"/>`;
            break;
        case 'star':
            svgContent = `<polygon points="50,5 61,40 98,40 68,62 79,96 50,75 21,96 32,62 2,40 39,40"
                fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                style="transform-origin: center;"/>`;
            break;
    }

    element.innerHTML = `
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
            ${svgContent}
        </svg>
        <div class="resize-handle se"></div>
        <button class="delete-btn" onclick="deleteElement(this.parentElement)">&times;</button>
    `;

    element.dataset.type = 'shape';
    element.dataset.shapeType = shapeType;
    element.dataset.fillColor = fillColor;
    element.dataset.strokeColor = strokeColor;
    element.dataset.strokeWidth = strokeWidth;
    element.dataset.opacity = 100;

    wrapper.appendChild(element);
    elements.push(element);

    makeDraggable(element);
    makeResizable(element);
    selectElement(element);
}

function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('delete-btn')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(element.style.left) || 0;
        initialTop = parseInt(element.style.top) || 0;

        selectElement(element);
        showCanvasCenterGuides();
        updateAlignmentGuides(element);
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        element.style.left = (initialLeft + dx) + 'px';
        element.style.top = (initialTop + dy) + 'px';

        updateAlignmentGuides(element);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            hideCanvasCenterGuides();
            clearAlignmentGuides();
        }
        isDragging = false;
    });
}

function makeResizable(element) {
    const handle = element.querySelector('.resize-handle');
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(element.style.width) || element.offsetWidth;
        startHeight = parseInt(element.style.height) || element.offsetHeight;
        showCanvasCenterGuides();
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (element.dataset.type === 'text') {
            // Scale font for text
            const wrapper = document.getElementById('canvasWrapper');
            const scale = parseFloat(wrapper.style.width) / canvasWidth;
            const baseSize = parseFloat(element.dataset.size);
            const scaleFactor = Math.max(0.5, 1 + dx / 100);
            element.style.fontSize = (baseSize * scale * scaleFactor) + 'px';
        } else if (element.dataset.type === 'icon') {
            // Scale icon
            const newSize = Math.max(16, startWidth + dx);
            element.style.width = newSize + 'px';
            element.style.height = newSize + 'px';
            element.style.fontSize = newSize + 'px';
        } else if (element.dataset.type === 'shape') {
            // Scale shape freely (not maintaining aspect ratio for flexibility)
            const newWidth = Math.max(20, startWidth + dx);
            const newHeight = Math.max(20, startHeight + dy);
            element.style.width = newWidth + 'px';
            element.style.height = newHeight + 'px';
        } else {
            // Scale image maintaining aspect ratio
            const aspectRatio = startWidth / startHeight;
            const newWidth = Math.max(20, startWidth + dx);
            const newHeight = newWidth / aspectRatio;
            element.style.width = newWidth + 'px';
            element.style.height = newHeight + 'px';
        }

        updateAlignmentGuides(element);
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            hideCanvasCenterGuides();
            clearAlignmentGuides();
        }
        isResizing = false;
    });
}

function selectElement(element) {
    deselectAll();
    element.classList.add('selected');
    selectedElement = element;

    // Show opacity controls
    const propertyRow = document.querySelector('.property-row');
    const noSelectionMsg = document.getElementById('noSelectionMsg');
    propertyRow.classList.add('visible');
    noSelectionMsg.classList.add('hidden');

    // Set opacity slider to element's current opacity
    const opacity = element.dataset.opacity || 100;
    document.getElementById('elementOpacity').value = opacity;
    document.getElementById('opacityValue').textContent = opacity + '%';
}

function deselectAll() {
    elements.forEach(el => el.classList.remove('selected'));
    selectedElement = null;

    // Hide opacity controls
    const propertyRow = document.querySelector('.property-row');
    const noSelectionMsg = document.getElementById('noSelectionMsg');
    propertyRow.classList.remove('visible');
    noSelectionMsg.classList.remove('hidden');
}

function deleteElement(element) {
    element.remove();
    elements = elements.filter(el => el !== element);
    if (selectedElement === element) {
        selectedElement = null;
        deselectAll();
    }
}

function deleteSelected() {
    if (selectedElement) {
        deleteElement(selectedElement);
    }
}

function clearCanvas() {
    elements.forEach(el => el.remove());
    elements = [];
    selectedElement = null;
    deselectAll();
}

function bringToFront() {
    if (selectedElement) {
        selectedElement.style.zIndex = zIndexCounter++;
    }
}

function sendToBack() {
    if (selectedElement) {
        selectedElement.style.zIndex = 0;
    }
}

function handleDeviceChange(e) {
    const value = e.target.value;

    if (value !== 'custom') {
        const [width, height] = value.split('x').map(Number);
        // Update manual override inputs to show current preset values
        document.getElementById('customWidth').value = width;
        document.getElementById('customHeight').value = height;
        setCanvasSize(width, height);
    }
}

function applyCustomSize() {
    const width = parseInt(document.getElementById('customWidth').value);
    const height = parseInt(document.getElementById('customHeight').value);
    if (width > 0 && height > 0) {
        // Set dropdown to "Custom" when manual values are applied
        document.getElementById('deviceSelect').value = 'custom';
        setCanvasSize(width, height);
    }
}

function setOrientation(orient) {
    orientation = orient;
    document.getElementById('portraitBtn').classList.toggle('active', orient === 'portrait');
    document.getElementById('landscapeBtn').classList.toggle('active', orient === 'landscape');

    if ((orient === 'landscape' && canvasWidth < canvasHeight) ||
        (orient === 'portrait' && canvasWidth > canvasHeight)) {
        setCanvasSize(canvasHeight, canvasWidth);
    }
}

function setCanvasSize(width, height) {
    // Store element positions as percentages
    const wrapper = document.getElementById('canvasWrapper');
    const oldScale = parseFloat(wrapper.style.width) / canvasWidth;

    const elementData = elements.map(el => ({
        element: el,
        leftPercent: parseInt(el.style.left) / (canvasWidth * oldScale),
        topPercent: parseInt(el.style.top) / (canvasHeight * oldScale),
        widthPercent: el.offsetWidth / (canvasWidth * oldScale),
        heightPercent: el.offsetHeight / (canvasHeight * oldScale)
    }));

    canvasWidth = width;
    canvasHeight = height;

    // Update orientation buttons
    if (width > height) {
        orientation = 'landscape';
        document.getElementById('portraitBtn').classList.remove('active');
        document.getElementById('landscapeBtn').classList.add('active');
    } else {
        orientation = 'portrait';
        document.getElementById('portraitBtn').classList.add('active');
        document.getElementById('landscapeBtn').classList.remove('active');
    }

    document.getElementById('currentSize').textContent = `${width} x ${height}`;

    initCanvas();

    // Restore element positions scaled to new size
    const newScale = parseFloat(wrapper.style.width) / canvasWidth;
    elementData.forEach(data => {
        data.element.style.left = (data.leftPercent * canvasWidth * newScale) + 'px';
        data.element.style.top = (data.topPercent * canvasHeight * newScale) + 'px';

        if (data.element.dataset.type !== 'text') {
            data.element.style.width = (data.widthPercent * canvasWidth * newScale) + 'px';
            data.element.style.height = (data.heightPercent * canvasHeight * newScale) + 'px';
        }
    });
}

function setFormat(format) {
    exportFormat = format;
    document.getElementById('pngBtn').classList.toggle('active', format === 'png');
    document.getElementById('jpgBtn').classList.toggle('active', format === 'jpg');
    document.getElementById('qualitySection').style.display = format === 'jpg' ? 'block' : 'none';
}

// Helper to convert hex color to rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function exportImage() {
    // Create export canvas at full resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasWidth;
    exportCanvas.height = canvasHeight;
    const ctx = exportCanvas.getContext('2d');

    // Draw background
    ctx.fillStyle = document.getElementById('bgColor').value;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Get wrapper scale
    const wrapper = document.getElementById('canvasWrapper');
    const scale = parseFloat(wrapper.style.width) / canvasWidth;

    // Sort elements by z-index
    const sortedElements = [...elements].sort((a, b) =>
        parseInt(a.style.zIndex) - parseInt(b.style.zIndex)
    );

    // Draw each element
    for (const element of sortedElements) {
        const left = parseInt(element.style.left) / scale;
        const top = parseInt(element.style.top) / scale;
        const opacity = (element.dataset.opacity || 100) / 100;

        ctx.save();
        ctx.globalAlpha = opacity;

        if (element.dataset.type === 'image') {
            const img = element.querySelector('img');
            const width = element.offsetWidth / scale;
            const height = element.offsetHeight / scale;
            ctx.drawImage(img, left, top, width, height);
        } else if (element.dataset.type === 'text') {
            const fontSize = parseFloat(element.style.fontSize) / scale;
            const padding = 5 / scale; // Account for CSS padding on .text-element
            ctx.font = `${element.dataset.weight} ${fontSize}px ${element.dataset.font}`;
            ctx.fillStyle = element.dataset.color;
            ctx.textBaseline = 'top';
            ctx.fillText(element.dataset.text, left + padding, top + padding);
        } else if (element.dataset.type === 'icon') {
            const width = element.offsetWidth / scale;
            const height = element.offsetHeight / scale;
            const size = parseFloat(element.style.fontSize) / scale;
            ctx.font = `${size}px Material Icons`;
            ctx.fillStyle = element.dataset.color;
            // Center icon within its container (matches CSS flexbox centering)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(element.dataset.icon, left + width / 2, top + height / 2);
            ctx.textAlign = 'left'; // Reset for other elements
        } else if (element.dataset.type === 'shape') {
            const width = element.offsetWidth / scale;
            const height = element.offsetHeight / scale;
            const fillColor = element.dataset.fillColor;
            const strokeColor = element.dataset.strokeColor;
            const strokeWidth = parseInt(element.dataset.strokeWidth);
            const shapeType = element.dataset.shapeType;

            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;

            switch (shapeType) {
                case 'rectangle':
                    ctx.fillRect(left, top, width, height);
                    if (strokeWidth > 0) ctx.strokeRect(left, top, width, height);
                    break;
                case 'circle':
                    ctx.beginPath();
                    ctx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    if (strokeWidth > 0) ctx.stroke();
                    break;
                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(left + width / 2, top);
                    ctx.lineTo(left + width, top + height);
                    ctx.lineTo(left, top + height);
                    ctx.closePath();
                    ctx.fill();
                    if (strokeWidth > 0) ctx.stroke();
                    break;
                case 'rounded':
                    const radius = 15 * (width / 150);
                    ctx.beginPath();
                    ctx.roundRect(left, top, width, height, radius);
                    ctx.fill();
                    if (strokeWidth > 0) ctx.stroke();
                    break;
                case 'line':
                    ctx.beginPath();
                    ctx.strokeStyle = fillColor;
                    ctx.lineWidth = Math.max(4, strokeWidth);
                    ctx.lineCap = 'round';
                    ctx.moveTo(left, top + height / 2);
                    ctx.lineTo(left + width, top + height / 2);
                    ctx.stroke();
                    break;
                case 'star':
                    drawStar(ctx, left + width / 2, top + height / 2, 5, width / 2, width / 4);
                    ctx.fill();
                    if (strokeWidth > 0) ctx.stroke();
                    break;
            }
        }

        ctx.restore();
    }

    // Export
    const mimeType = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
    const quality = exportFormat === 'jpg' ? jpgQuality : undefined;

    const dataUrl = exportCanvas.toDataURL(mimeType, quality);

    const link = document.createElement('a');
    link.download = `wallpaper_${canvasWidth}x${canvasHeight}.${exportFormat}`;
    link.href = dataUrl;
    link.click();
}

// Helper function to draw a star
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
}
