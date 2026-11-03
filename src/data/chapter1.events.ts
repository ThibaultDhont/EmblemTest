import { parseScript } from '../core/script.ts';
import chapter1Script from './chapter1.script?raw';

// Événements du chapitre (dialogues, drapeaux). Une erreur de script fait échouer le chargement,
// avec le numéro de ligne.
export const CHAPTER1_EVENTS = parseScript(chapter1Script);
