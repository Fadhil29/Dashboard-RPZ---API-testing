import fs from 'fs';

const F = '.state.json';
export const getState = (): Record<string, any> => {
  try { return JSON.parse(fs.readFileSync(F, 'utf8')); } catch { return {}; }
};
export const setState = (p: Record<string, any>) => fs.writeFileSync(F, JSON.stringify({ ...getState(), ...p }));
