import { Planet, EnemyType } from './types';

export const PLANETS: Planet[] = [
  { id:1, name:'Orion', nameAr:'أوريون', bg:'#060620', starColor1:'#aaccff', starColor2:'#4466ff', nebulaColor:'#1a1a4a',
    enemyTypes:['drone','scout','probe'], waves:[1,20], bossWave:20 },
  { id:2, name:'Nova', nameAr:'نوفا', bg:'#1a0808', starColor1:'#ffaa88', starColor2:'#ff6633', nebulaColor:'#3a1a0a',
    enemyTypes:['sentry','interceptor','fighter','gunship'], waves:[21,40], bossWave:40 },
  { id:3, name:'Nebula', nameAr:'السديم', bg:'#0e0418', starColor1:'#cc88ff', starColor2:'#8833cc', nebulaColor:'#2a0a3a',
    enemyTypes:['corvette','striker','raider','tank','fortress'], waves:[41,60], bossWave:60 },
  { id:4, name:'Inferno', nameAr:'الجحيم', bg:'#180404', starColor1:'#ff4444', starColor2:'#ff0000', nebulaColor:'#3a0808',
    enemyTypes:['speeder','phantom','blur','bomber','devastator'], waves:[61,80], bossWave:80 },
  { id:5, name:'Hive', nameAr:'الخلية', bg:'#081808', starColor1:'#88ff88', starColor2:'#33cc33', nebulaColor:'#0a3a0a',
    enemyTypes:['comet','flash','scorcher','inferno','napalm','spore','tendril'], waves:[81,100], bossWave:100 },
  { id:6, name:'Mechanica', nameAr:'الآلة', bg:'#101020', starColor1:'#8888cc', starColor2:'#4444aa', nebulaColor:'#1a1a3a',
    enemyTypes:['hivemind','parasite','leech','mech','titan'], waves:[101,120], bossWave:120 },
  { id:7, name:'Swarm', nameAr:'السرب', bg:'#181008', starColor1:'#ffcc88', starColor2:'#cc8833', nebulaColor:'#3a2a0a',
    enemyTypes:['colossus','golem','sentinel','swarmling','hornet','locust'], waves:[121,140], bossWave:140 },
  { id:8, name:'Fortress', nameAr:'القلعة', bg:'#080818', starColor1:'#88aaff', starColor2:'#3366cc', nebulaColor:'#0a0a3a',
    enemyTypes:['mosquito','wasp','elite_drone','elite_fighter','elite_tank'], waves:[141,160], bossWave:160 },
  { id:9, name:'Cosmos', nameAr:'الكون', bg:'#100820', starColor1:'#cc88ff', starColor2:'#9944ff', nebulaColor:'#2a0a4a',
    enemyTypes:['warden','commander','nebula','pulsar','quasar'], waves:[161,180], bossWave:180 },
  { id:10, name:'Void', nameAr:'الفراغ', bg:'#040410', starColor1:'#6666aa', starColor2:'#333388', nebulaColor:'#0a0a2a',
    enemyTypes:['nova_enemy','singularity','shadow','wraith','specter'], waves:[181,200], bossWave:200 },
  { id:11, name:'Omega', nameAr:'أوميغا', bg:'#180008', starColor1:'#ff6688', starColor2:'#cc0044', nebulaColor:'#3a0020',
    enemyTypes:['revenant','banshee','omega_drone','omega_fighter','omega_tank'], waves:[201,220], bossWave:220 },
  { id:12, name:'Ascension', nameAr:'الصعود', bg:'#0c0c00', starColor1:'#ffff88', starColor2:'#cccc33', nebulaColor:'#2a2a00',
    enemyTypes:['omega_bomber','overlord','mythic_eye','mythic_hydra','mythic_phoenix'], waves:[221,240], bossWave:240 },
  { id:13, name:'Eternity', nameAr:'الخلود', bg:'#100010', starColor1:'#ff88ff', starColor2:'#cc44cc', nebulaColor:'#3a003a',
    enemyTypes:['mythic_kraken','mythic_dragon','mythic_eye','mythic_hydra','mythic_phoenix','overlord'], waves:[241,260], bossWave:260 },
];

export function getPlanetForWave(wave: number): Planet {
  for (const p of PLANETS) {
    if (wave >= p.waves[0] && wave <= p.waves[1]) return p;
  }
  return PLANETS[PLANETS.length - 1];
}
