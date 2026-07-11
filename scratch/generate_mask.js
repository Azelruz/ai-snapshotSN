const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const srcPath = 'C:\\Users\\pond_\\.gemini\\antigravity\\brain\\078109a0-9c88-487a-af4a-9f6b5b69e047\\media__1783757671520.jpg';
const destDir = 'd:/pond/Antigravity/Ai-SnAPShot/ai-snapshot/public/templates';
const destJpg = path.join(destDir, 'wedding_original.jpg');
const destPng = path.join(destDir, 'wedding_mask.png');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 1. Copy the original JPEG
fs.copyFileSync(srcPath, destJpg);
console.log('Copied original photo to:', destJpg);

// 2. Parse JPEG dimensions (SOF0/SOF2 header parsing)
const jpegBuffer = fs.readFileSync(destJpg);
let width = 0;
let height = 0;

let i = 2;
if (jpegBuffer[0] === 0xFF && jpegBuffer[1] === 0xD8) {
  while (i < jpegBuffer.length) {
    if (jpegBuffer[i] === 0xFF) {
      const marker = jpegBuffer[i + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        height = jpegBuffer.readUInt16BE(i + 5);
        width = jpegBuffer.readUInt16BE(i + 7);
        break;
      }
      i += 2;
    } else {
      i++;
    }
  }
}

if (!width || !height) {
  console.error('Failed to parse JPEG dimensions. Using fallback 1024x682.');
  width = 1024;
  height = 682;
} else {
  console.log(`Parsed JPEG dimensions: ${width}x${height}`);
}

// 3. Generate the PNG mask
// Left 40% of the image (the guest) will be white (#FFFFFF), the rest will be black (#000000)
const png = new PNG({ width, height });

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (width * y + x) << 2;
    // แขกในรูปตัวอย่างห่มชุดขาวและเบนตัวเข้าหาฝั่งซ้ายของรูป ครอบคลุมประมาณ 38% ของขอบกว้างฝั่งซ้าย
    const isMask = x < (width * 0.38);
    const colorVal = isMask ? 255 : 0;
    
    png.data[idx] = colorVal;     // R
    png.data[idx + 1] = colorVal; // G
    png.data[idx + 2] = colorVal; // B
    png.data[idx + 3] = 255;      // A (opaque)
  }
}

png.pack()
  .pipe(fs.createWriteStream(destPng))
  .on('finish', () => {
    console.log('Generated and saved mask PNG successfully to:', destPng);
  });
