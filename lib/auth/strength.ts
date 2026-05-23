import { zxcvbnOptions, zxcvbn } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnDePackage from '@zxcvbn-ts/language-de';

let configured = false;
function configure() {
  if (configured) return;
  zxcvbnOptions.setOptions({
    translations: zxcvbnDePackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnDePackage.dictionary,
    },
  });
  configured = true;
}

export type StrengthResult = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  warning?: string;
  suggestions: string[];
};

const LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Sehr schwach',
  1: 'Schwach',
  2: 'Mittel',
  3: 'Stark',
  4: 'Sehr stark',
};

export function checkStrength(password: string, userInputs: string[] = []): StrengthResult {
  configure();
  const r = zxcvbn(password, userInputs);
  const score = r.score as 0 | 1 | 2 | 3 | 4;
  return {
    score,
    label: LABELS[score],
    warning: r.feedback.warning ?? undefined,
    suggestions: r.feedback.suggestions ?? [],
  };
}
