// FLIXA brand system. `gradient`/`gradientButton` are both the canonical
// Pink -> Magenta -> Purple -> Cyan brand gradient — kept as two keys since
// both names are already used throughout the app, but they're the same
// stops so every gradient accent (nav, create button, live badges, gifts,
// progress bars, selected tabs) stays visually unified.
export const colors = {
  background: '#050509',
  surface: '#0E0E18',
  surfaceAlt: '#16162A',
  border: '#26263C',
  text: '#F7F7FA',
  textMuted: '#9A98B5',
  textDim: '#6E6C8A',
  primary: '#7A3CFF',
  pink: '#FF0A6C',
  magenta: '#D81BFF',
  purple: '#7A3CFF',
  cyan: '#18D7E8',
  gradient: ['#FF0A6C', '#D81BFF', '#7A3CFF', '#18D7E8'] as const,
  gradientButton: ['#FF0A6C', '#D81BFF', '#7A3CFF', '#18D7E8'] as const,
  danger: '#FF4D6D',
  success: '#3DDC97',
};

export default colors;
