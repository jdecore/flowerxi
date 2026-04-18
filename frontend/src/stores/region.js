import { writable } from 'svelte/store';

export const regionStore = writable('madrid');
export const lotStore = writable('lote-3-lavanda');

export const regions = [
  { id: 'madrid', name: 'Madrid' },
  { id: 'facatativa', name: 'Facatativá' },
  { id: 'funza', name: 'Funza' },
];

export const lotsByRegion = {
  madrid: [
    { id: 'lote-3-lavanda', name: 'Lote 3 Lavanda' },
    { id: 'lote-1-rosa', name: 'Lote 1 Rosa' },
    { id: 'lote-5-mixto', name: 'Lote 5 Mixto' },
  ],
  facatativa: [
    { id: 'lote-2-estandar', name: 'Lote 2 Estándar' },
    { id: 'lote-4-clavel', name: 'Lote 4 Clavel' },
    { id: 'lote-7-export', name: 'Lote 7 Export' },
  ],
  funza: [
    { id: 'lote-1-funza', name: 'Lote 1 Funza' },
    { id: 'lote-6-ensayo', name: 'Lote 6 Ensayo' },
    { id: 'lote-9-norte', name: 'Lote 9 Norte' },
  ],
};

export const setRegion = (region) => {
  regionStore.set(region);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('regionchange', { detail: region }));
  }
};

export const setLot = (lot) => {
  lotStore.set(lot);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lotchange', { detail: lot }));
  }
};
