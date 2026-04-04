const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../../frontend/public');
const iconsDir = path.join(publicDir, 'icons');
const shotsDir = path.join(publicDir, 'screenshots');

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(shotsDir, { recursive: true });

const brand = '#3090cf';

async function main() {
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect fill="${brand}" width="512" height="512"/><circle cx="256" cy="220" r="100" fill="#ffffff" opacity="0.9"/></svg>`;

  await sharp(Buffer.from(iconSvg)).png().resize(192, 192).toFile(path.join(iconsDir, 'icon-192.png'));
  await sharp(Buffer.from(iconSvg)).png().resize(512, 512).toFile(path.join(iconsDir, 'icon-512.png'));

  const wideSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect fill="#f5f5f5" width="1280" height="720"/><rect fill="${brand}" x="0" y="0" width="1280" height="80"/><text x="640" y="380" font-size="48" fill="#333" text-anchor="middle" font-family="sans-serif">Zippyyy</text></svg>`;
  await sharp(Buffer.from(wideSvg)).png().toFile(path.join(shotsDir, 'desktop-wide.png'));

  const narrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect fill="#f5f5f5" width="390" height="844"/><rect fill="${brand}" x="0" y="0" width="390" height="64"/><text x="195" y="420" font-size="22" fill="#333" text-anchor="middle" font-family="sans-serif">Zippyyy</text></svg>`;
  await sharp(Buffer.from(narrowSvg)).png().toFile(path.join(shotsDir, 'mobile.png'));

  console.log('PWA assets written to frontend/public/icons and screenshots');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
