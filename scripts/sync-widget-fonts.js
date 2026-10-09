// scripts/sync-widget-fonts.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const copies = [
  [
    'data/mushaf/digitalkhatt/DigitalKhattFont.otf',
    'targets/widgets/DigitalKhattFont.otf',
  ],
  ['assets/fonts/surah_names.ttf', 'targets/widgets/surah_names.ttf'],
];

for (const [from, to] of copies) {
  fs.copyFileSync(path.join(root, from), path.join(root, to));
}
console.log('[sync-widget-fonts] copied', copies.length, 'fonts');
