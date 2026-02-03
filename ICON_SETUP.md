
# FaceAuth Attendance - Icon Setup Guide

## 📱 Required Icons

Create the following icon files in `public/icons/`:

- `icon-72x72.png` (72×72 pixels)
- `icon-96x96.png` (96×96 pixels)
- `icon-128x128.png` (128×128 pixels)
- `icon-144x144.png` (144×144 pixels)
- `icon-152x152.png` (152×152 pixels)
- `icon-192x192.png` (192×192 pixels)
- `icon-384x384.png` (384×384 pixels)
- `icon-512x512.png` (512×512 pixels)

## 🖼️ Required Screenshots

Create these screenshots in `public/screenshots/`:

- `dashboard-mobile.png` (1080×1920 pixels)
- `attendance-mobile.png` (1080×1920 pixels)
- `enrollment-mobile.png` (1080×1920 pixels)
- `dashboard-desktop.png` (1920×1080 pixels)
- `attendance-desktop.png` (1920×1080 pixels)

## 🎨 How to Generate Icons

### Option A: Using Online Tools (Recommended)
1. Go to [RealFaviconGenerator](https://realfavicongenerator.net/)
2. Upload a **512×512 PNG** logo
3. Configure settings as needed
4. Download the generated package
5. Extract files to `public/icons/` folder
6. Rename files if needed

### Option B: Using Your Own Design
1. Create a 512×512 logo in any design tool (Figma, Canva, Photoshop)
2. Save as PNG with transparent background
3. Use [Squoosh](https://squoosh.app/) or any image editor to resize
4. Save each size with the correct filename

### Option C: Quick Template (Use the SVG below)
Copy this SVG code, save as `logo.svg` and use online converters:

```svg
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f093fb" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#667eea" stop-opacity="0"/>
    </radialGradient>
  </defs>
  
  <circle cx="256" cy="256" r="250" fill="url(#grad)"/>
  <circle cx="256" cy="256" r="245" fill="url(#halo)"/>
  
  <circle cx="256" cy="170" r="85" fill="white" opacity="0.9"/>
  <ellipse cx="256" cy="341" rx="128" ry="85" fill="white" opacity="0.9"/>
  
  <circle cx="192" cy="170" r="25" fill="#2d3748"/>
  <circle cx="320" cy="170" r="25" fill="#2d3748"/>
  
  <path d="M192 280 Q256 340 320 280" stroke="#2d3748" stroke-width="15" fill="none" stroke-linecap="round"/>
  
  <circle cx="256" cy="256" r="170" stroke="white" stroke-width="8" stroke-opacity="0.7" stroke-dasharray="8,8" fill="none"/>
  <circle cx="256" cy="256" r="205" stroke="white" stroke-width="6" stroke-opacity="0.5" stroke-dasharray="6,6" fill="none"/>
</svg>
```

## 🚀 Quick Setup Commands

```bash
# 1. First, install dependencies (if not already installed)
npm install

# 2. Run the setup script
npm run setup-icons

# 3. Generate placeholder icons (creates basic colored squares)
npm run generate-icons

# 4. Start your React app
npm start
```

## 📁 Folder Structure After Setup

```
faceauthattendance/
├── public/
│   ├── icons/           # Your icon files go here
│   ├── screenshots/     # Screenshot placeholders
│   ├── index.html
│   └── manifest.json
├── src/
│   └── components/
│       └── AppIcon.tsx  # React icon component
└── scripts/
    ├── setup-icons.js   # This script
    └── generate-icons-no-deps.js
```

## 🎯 Design Guidelines

1. **Colors**: Use gradient #667eea to #764ba2
2. **Style**: Clean, modern, tech-focused
3. **Theme**: Face recognition/security
4. **Format**: PNG with transparent background
5. **Size**: Minimum 512×512 for source

## 🔗 Helpful Links

- [Favicon Generator](https://www.favicon-generator.org/)
- [Favicon.io](https://favicon.io/)
- [Canva](https://www.canva.com/) (for designing)
- [Figma](https://www.figma.com/) (free design tool)

## ⚡ Quick Fix: Use Placeholder Icons

If you just want to get started, run `npm run generate-icons` to create simple colored icons.
These will be replaced later with your actual design.
