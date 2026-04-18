import { writable } from 'svelte/store';

export const regionStore = writable('madrid');

export const regions = [
  { id: 'madrid', name: 'Madrid' },
  { id: 'facatativa', name: 'Facatativá' },
  { id: 'funza', name: 'Funza' },
];

export const setRegion = (region) => {
  regionStore.set(region);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('regionchange', { detail: region }));
  }
};
