import { Planet } from './types';

export const PLANETS: Planet[] = [
  {
    id: 1, name: 'Orion', nameAr: 'أوريون',
    bg: '#060620', starColor1: '#aaccff', starColor2: '#4466ff',
    nebulaColor: '#1a1a4a',
    enemyTypes: ['drone'],
    waves: [1, 5], bossWave: 5,
  },
  {
    id: 2, name: 'Nova', nameAr: 'نوفا',
    bg: '#1a0808', starColor1: '#ffaa88', starColor2: '#ff6633',
    nebulaColor: '#3a1a0a',
    enemyTypes: ['drone', 'fighter'],
    waves: [6, 10], bossWave: 10,
  },
  {
    id: 3, name: 'Void', nameAr: 'الفراغ',
    bg: '#0e0418', starColor1: '#cc88ff', starColor2: '#8833cc',
    nebulaColor: '#2a0a3a',
    enemyTypes: ['fighter', 'tank', 'speeder'],
    waves: [11, 15], bossWave: 15,
  },
  {
    id: 4, name: 'Apocalypse', nameAr: 'القيامة',
    bg: '#180404', starColor1: '#ff4444', starColor2: '#ff0000',
    nebulaColor: '#3a0808',
    enemyTypes: ['drone', 'fighter', 'tank', 'speeder', 'bomber'],
    waves: [16, 20], bossWave: 20,
  },
];

export function getPlanetForWave(wave: number): Planet {
  for (const p of PLANETS) {
    if (wave >= p.waves[0] && wave <= p.waves[1]) return p;
  }
  return PLANETS[3];
}
