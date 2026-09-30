const fs = require('fs');
const path = require('path');

const avatars = [
  { name: 'avatar-1.svg', bg1: '#059669', bg2: '#10b981', iconColor: '#ecfdf5', label: 'D' },
  { name: 'avatar-2.svg', bg1: '#2563eb', bg2: '#3b82f6', iconColor: '#eff6ff', label: 'R' },
  { name: 'avatar-3.svg', bg1: '#7c3aed', bg2: '#8b5cf6', iconColor: '#f5f3ff', label: 'I' },
  { name: 'avatar-4.svg', bg1: '#ea580c', bg2: '#f97316', iconColor: '#fff7ed', label: 'N' },
  { name: 'avatar-5.svg', bg1: '#0891b2', bg2: '#06b6d4', iconColor: '#ecfeff', label: 'K' }
];

avatars.forEach(a => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${a.bg1}"/>
      <stop offset="100%" stop-color="${a.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#grad)"/>
  <circle cx="50" cy="40" r="18" fill="${a.iconColor}" opacity="0.95"/>
  <path d="M22 84 C22 66, 34 58, 50 58 C66 58, 78 66, 78 84 Z" fill="${a.iconColor}" opacity="0.95"/>
</svg>`;
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'images', 'avatars', a.name), svg, 'utf8');
});

console.log('Generated avatars in public/images/avatars/');
