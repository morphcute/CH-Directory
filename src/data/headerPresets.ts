export interface HeaderPreset {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  badge: string;
}

export const HEADER_PRESETS: HeaderPreset[] = [
  {
    id: 'official-ch-banner',
    name: 'Community Heroes Official Gold Banner',
    description: 'Gold & midnight MLBB Community Heroes championship banner with hero champions',
    imageUrl:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
    badge: 'Official Banner',
  },
  {
    id: 'anniversary-10th',
    name: '10th Anniversary Tournament (Sunset Gold)',
    description: 'Golden celebratory atmosphere with hero champions, stardust, and twilight arena',
    imageUrl:
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop',
    badge: 'Anniversary Theme',
  },
  {
    id: 'mythic-esports',
    name: 'Esports Championship Stadium Stage',
    description: 'Dark midnight navy arena with radiant golden spotlights and tournament crowd',
    imageUrl:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop',
    badge: 'Esports Stadium',
  },
  {
    id: 'cosmic-dawn',
    name: 'Dawn of Heroes (Twilight & Amber)',
    description: 'Heroic fantasy skyline with vibrant gold, magenta, and celestial energy ribbons',
    imageUrl:
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2094&auto=format&fit=crop',
    badge: 'Cosmic Gold',
  },
  {
    id: 'cyber-glory',
    name: 'M-Series Neon Champions',
    description: 'High-tech competitive tournament background with golden hex matrix',
    imageUrl:
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop',
    badge: 'Neon Esports',
  },
];
