/**
 * The greenhouse crops every farmer starts with. A farmer ticks the ones they grow (and can add their own); each one carries what the
 * fruit counter needs to find its fruit in a photo: the colours the fruit has while it ripens, whether it is round or long, and whether
 * it stands out from the leaves.
 *
 *   fruit_colors  from the counter's colour list: red, orange, yellow, purple, green
 *   shape         'round' (cherry tomato, strawberry) or 'elongated' (cucumber, pepper pods, beans): long fruit are never "split"
 *   contrast      'high' when the fruit differs from the leaves; 'low' for green fruit on green plants (counted, but never trusted)
 */
export const COLOR_NAMES = ['red', 'orange', 'yellow', 'purple', 'green'];

export const CATALOG = [
  { key: 'cherry_tomato', name: 'Cherry tomato', fruit_colors: ['red', 'orange', 'yellow'], shape: 'round', contrast: 'high', days_to_harvest: '60 to 80', tip: 'Count red, orange and yellow fruit. Green fruit are not counted.' },
  { key: 'tomato', name: 'Tomato', fruit_colors: ['red', 'orange'], shape: 'round', contrast: 'high', days_to_harvest: '70 to 90', tip: 'Count ripening and ripe fruit. Green fruit are not counted.' },
  { key: 'sweet_pepper', name: 'Sweet pepper (bell pepper)', fruit_colors: ['red', 'yellow', 'orange'], shape: 'round', contrast: 'high', days_to_harvest: '70 to 90', tip: 'Count coloured peppers. Green peppers hide among the leaves.' },
  { key: 'hot_pepper', name: 'Hot pepper (chilli)', fruit_colors: ['red', 'orange', 'yellow'], shape: 'elongated', contrast: 'high', days_to_harvest: '70 to 100', tip: 'Count red, orange and yellow pods.' },
  { key: 'cucumber', name: 'Cucumber', fruit_colors: ['green'], shape: 'elongated', contrast: 'low', days_to_harvest: '50 to 70', tip: 'Green on green: the count is only a rough guide, so the photo check is not conclusive.' },
  { key: 'eggplant', name: 'Eggplant (aubergine)', fruit_colors: ['purple'], shape: 'elongated', contrast: 'high', days_to_harvest: '70 to 90', tip: 'Count the dark purple fruit.' },
  { key: 'strawberry', name: 'Strawberry', fruit_colors: ['red'], shape: 'round', contrast: 'high', days_to_harvest: '60 to 90', tip: 'Count ripe red berries.' },
  { key: 'zucchini', name: 'Zucchini (courgette)', fruit_colors: ['yellow', 'green'], shape: 'elongated', contrast: 'low', days_to_harvest: '45 to 60', tip: 'Green fruit are hard to see among the leaves, so the photo check is not conclusive.' },
  { key: 'melon', name: 'Melon', fruit_colors: ['yellow', 'orange'], shape: 'round', contrast: 'high', days_to_harvest: '75 to 100', tip: 'Count ripening yellow and orange melons.' },
  { key: 'green_beans', name: 'Green beans (pods)', fruit_colors: ['green'], shape: 'elongated', contrast: 'low', days_to_harvest: '50 to 65', tip: 'Green on green: the count is only a rough guide, so the photo check is not conclusive.' },
];

export const catalogEntry = (key) => CATALOG.find((c) => c.key === key) || null;
