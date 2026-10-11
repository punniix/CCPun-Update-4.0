// Pure state and seeded randomness shared by the engine's internal modules.
import { getMoneyStoryCharacter } from './characters';
import type { CharacterProfile, GameState } from './types';

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomAt(seed: string, cursor: number): number {
  let t = (hashSeed(seed) + Math.imul(cursor + 1, 0x6D2B79F5)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextRandom(state: GameState): [number, GameState] {
  const value = randomAt(state.seed, state.rngCursor);
  return [value, { ...state, rngCursor: state.rngCursor + 1 }];
}

export function activeProtection(state: GameState, type: string) {
  return state.protections.find(
    (protection) => protection.type === type && protection.activeFromMonth <= state.currentMonth,
  );
}

export function relevantModifiers(state: GameState, kind: 'income' | 'expense') {
  return state.modifiers.filter(
    (modifier) => modifier.kind === kind && modifier.throughMonth >= state.currentMonth,
  );
}

export function characterFor(state: GameState): CharacterProfile {
  return getMoneyStoryCharacter(state.characterId);
}
