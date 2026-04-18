import { writable } from 'svelte/store';

export const regionStore = writable('madrid');

export const regions = [
  { id: 'madrid', name: 'Madrid' },
  { id: 'facatativa', name: 'Facatativá' },
  { id: 'funza', name: 'Funza' },
];

export const setRegion = (region) => {
  regionStore.set(region);
  window.dispatchEvent(new CustomEvent('regionchange', { detail: region }));
};