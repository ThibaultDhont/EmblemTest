// Passe d'un workflow tel que l'interface de ComfyUI l'enregistre (graphe : nœuds, positions, liens) au format
// que son API exécute (un objet par nœud : type et entrées), puis y applique les réglages d'une génération.
// C'est ce qui permet de régler le workflow à l'œil dans ComfyUI et de générer en série avec tools/comfy.ts.
//
// Le format de l'interface range les valeurs des widgets dans `widgets_values`, dans l'ordre des entrées que
// ComfyUI décrit (/api/object_info : obligatoires, puis optionnelles), avec deux valeurs en plus qui ne sont pas
// des entrées : le mode de la graine (« randomize », « fixed »…) après une entrée `control_after_generate`, et
// le bouton d'envoi après l'image d'un LoadImage (`image_upload`).

export interface UiInput {
  name: string;
  type: string;
  link: number | null;
}
export interface UiNode {
  id: number | string;
  type: string;
  mode?: number; // 0 actif, 2 désactivé (muet), 4 contourné
  title?: string;
  inputs?: UiInput[];
  widgets_values?: unknown[] | Record<string, unknown>;
}
// Lien : [id, nœud d'origine, sortie, nœud cible, entrée, type].
export type UiLink = [number, number | string, number, number | string, number, string];
export interface UiWorkflow {
  nodes: UiNode[];
  links: UiLink[];
}

export type InputSpec = [unknown, Record<string, unknown>?] | [unknown, Record<string, unknown> | null];
export interface NodeInfo {
  input: { required?: Record<string, InputSpec>; optional?: Record<string, InputSpec> };
  input_order?: { required?: string[]; optional?: string[] };
}
export type ObjectInfo = Record<string, NodeInfo>;

export type Link = [string, number];
export interface ApiNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title: string };
}
export type ApiWorkflow = Record<string, ApiNode>;

const MUTED = 2;
const BYPASSED = 4;
const VALUE_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']);
// Nœuds de l'interface seulement : ComfyUI ne les exécute pas.
const UI_ONLY = new Set(['Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode']);

const isWidget = (spec: InputSpec): boolean =>
  (Array.isArray(spec[0]) || VALUE_TYPES.has(String(spec[0]))) && spec[1]?.forceInput !== true;

export const isLink = (value: unknown): value is Link =>
  Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'number';

// Types de nœuds à décrire par /api/object_info pour convertir ce workflow.
export function nodeTypes(workflow: UiWorkflow): string[] {
  return [...new Set(workflow.nodes.filter((node) => !UI_ONLY.has(node.type)).map((node) => node.type))];
}

export function toApi(workflow: UiWorkflow, info: ObjectInfo): ApiWorkflow {
  const nodes = new Map(workflow.nodes.map((node) => [String(node.id), node]));
  const links = new Map(workflow.links.map((link) => [link[0], link]));

  // D'où vient vraiment une entrée : on traverse les relais et les nœuds contournés. Un nœud muet ou une
  // valeur primitive ne donne pas de lien (l'entrée garde alors la valeur de son widget).
  const resolve = (linkId: number, seen = new Set<number>()): Link | undefined => {
    const link = links.get(linkId);
    if (link === undefined || seen.has(linkId)) return undefined;
    seen.add(linkId);
    const [, originId, originSlot, , , type] = link;
    const origin = nodes.get(String(originId));
    if (origin === undefined || origin.mode === MUTED || origin.type === 'PrimitiveNode') return undefined;
    if (origin.type === 'Reroute' || origin.mode === BYPASSED) {
      const through = origin.inputs?.find((input) => input.link !== null && (input.type === type || origin.type === 'Reroute'));
      return through?.link == null ? undefined : resolve(through.link, seen);
    }
    return [String(originId), originSlot];
  };

  const api: ApiWorkflow = {};
  for (const node of workflow.nodes) {
    if (node.mode === MUTED || node.mode === BYPASSED || UI_ONLY.has(node.type)) continue;
    const spec = info[node.type];
    if (spec === undefined) throw new Error(`nœud « ${node.title ?? node.type} » : type ${node.type} inconnu de ComfyUI (sous-graphe ou extension absente ?)`);
    const required = spec.input.required ?? {};
    const optional = spec.input.optional ?? {};
    const order = [...(spec.input_order?.required ?? Object.keys(required)), ...(spec.input_order?.optional ?? Object.keys(optional))];
    const values = node.widgets_values;
    let index = 0;
    const inputs: Record<string, unknown> = {};
    for (const name of order) {
      const def = required[name] ?? optional[name];
      if (def === undefined) continue;
      const slot = node.inputs?.find((input) => input.name === name);
      const linked = slot?.link == null ? undefined : resolve(slot.link);
      if (isWidget(def)) {
        const value = Array.isArray(values) ? values[index] : values?.[name];
        index += 1 + (def[1]?.control_after_generate === true ? 1 : 0) + (def[1]?.image_upload === true ? 1 : 0);
        if (linked !== undefined) inputs[name] = linked;
        else if (value !== undefined) inputs[name] = value;
      } else if (linked !== undefined) {
        inputs[name] = linked;
      }
    }
    api[String(node.id)] = { class_type: node.type, inputs, ...(node.title === undefined ? {} : { _meta: { title: node.title } }) };
  }
  return api;
}

// --- Sujet d'un personnage (art/personnages.json) ---

// Un sujet par workflow : la clé est le nom du workflow sans « emblem_ » (portrait, combat…).
export type Characters = Record<string, Record<string, string>>;

// Sujet à mettre dans « {sujet} » : celui de la fiche du personnage pour ce workflow, suivi de `extra`
// (une expression, une variante : « eyes closed »). Sans personnage, `extra` seul.
export function subjectFor(characters: Characters, id: string | undefined, workflow: string, extra: string | undefined): string {
  if (id === undefined) {
    if (extra === undefined) throw new Error('--prompt ou --personnage attendu');
    return extra;
  }
  const sheet = characters[id];
  if (sheet === undefined) throw new Error(`personnage « ${id} » absent de art/personnages.json (connus : ${Object.keys(characters).join(', ')})`);
  const key = workflow.replace(/^emblem_/, '');
  const subject = sheet[key];
  if (subject === undefined) throw new Error(`personnage « ${id} » : pas de sujet « ${key} » pour le workflow ${workflow}`);
  return extra === undefined ? subject : `${subject}, ${extra}`;
}

// --- Réglages d'une génération ---

export interface Overrides {
  subject?: string; // remplace « {sujet} » dans le prompt, ou tout le prompt s'il n'y a pas de « {sujet} »
  seed?: number;
  width?: number;
  height?: number;
  lora?: number; // force du modèle de chaque LoRA
  prefix?: string; // nom des fichiers enregistrés (dans output/emblem/)
  source?: string; // image déjà envoyée à ComfyUI : on redessine à partir d'elle (image vers image)
  strength?: number; // part redessinée (denoise), avec `source`
}

const SAMPLERS = new Set(['KSampler', 'KSamplerAdvanced']);

function onlySampler(api: ApiWorkflow): [string, ApiNode] {
  const samplers = Object.entries(api).filter(([, node]) => SAMPLERS.has(node.class_type));
  if (samplers.length !== 1) throw new Error(`le workflow doit avoir un seul échantillonneur (KSampler), il en a ${samplers.length}`);
  return samplers[0]!;
}

// Le nœud de texte d'où vient une entrée de conditionnement, en remontant les nœuds intermédiaires
// (ControlNet, combinaisons…).
function findText(api: ApiWorkflow, from: unknown, seen = new Set<string>()): ApiNode | undefined {
  if (!isLink(from) || seen.has(from[0])) return undefined;
  seen.add(from[0]);
  const node = api[from[0]];
  if (node === undefined) return undefined;
  if (typeof node.inputs.text === 'string') return node;
  for (const value of Object.values(node.inputs)) {
    const found = findText(api, value, seen);
    if (found !== undefined) return found;
  }
  return undefined;
}

// Prompt positif du workflow (celui qui mène à l'entrée `positive` de l'échantillonneur).
export function promptOf(api: ApiWorkflow): string | undefined {
  const text = findText(api, onlySampler(api)[1].inputs.positive)?.inputs.text;
  return typeof text === 'string' ? text : undefined;
}

export function applyOverrides(source: ApiWorkflow, overrides: Overrides): ApiWorkflow {
  const api: ApiWorkflow = structuredClone(source);
  const [samplerId, sampler] = onlySampler(api);

  if (overrides.subject !== undefined) {
    const node = findText(api, sampler.inputs.positive);
    if (node === undefined) throw new Error('prompt introuvable : aucun nœud de texte ne mène à l’entrée « positive » de l’échantillonneur');
    const text = String(node.inputs.text);
    node.inputs.text = text.includes('{sujet}') ? text.replaceAll('{sujet}', overrides.subject) : overrides.subject;
  }
  if (overrides.seed !== undefined) {
    if ('noise_seed' in sampler.inputs) sampler.inputs.noise_seed = overrides.seed;
    else sampler.inputs.seed = overrides.seed;
  }
  if (overrides.width !== undefined || overrides.height !== undefined) {
    const latent = isLink(sampler.inputs.latent_image) ? api[sampler.inputs.latent_image[0]] : undefined;
    if (latent === undefined || !('width' in latent.inputs)) throw new Error('taille : l’image de départ de l’échantillonneur n’a pas de largeur ni de hauteur');
    if (overrides.width !== undefined) latent.inputs.width = overrides.width;
    if (overrides.height !== undefined) latent.inputs.height = overrides.height;
  }
  if (overrides.lora !== undefined) {
    for (const node of Object.values(api)) if ('strength_model' in node.inputs) node.inputs.strength_model = overrides.lora;
  }
  if (overrides.prefix !== undefined) {
    for (const node of Object.values(api)) if (node.class_type === 'SaveImage') node.inputs.filename_prefix = `emblem/${overrides.prefix}`;
  }
  if (overrides.source !== undefined) {
    // L'échantillonneur part de l'image donnée, encodée par le même VAE que celui qui décode le résultat.
    const decoder = Object.values(api).find((node) => node.class_type === 'VAEDecode');
    const vae = decoder?.inputs.vae;
    if (!isLink(vae)) throw new Error('image de départ : aucun VAEDecode dans le workflow pour trouver le VAE');
    api.depuis_image = { class_type: 'LoadImage', inputs: { image: overrides.source }, _meta: { title: 'Image de départ' } };
    api.depuis_encodage = { class_type: 'VAEEncode', inputs: { pixels: ['depuis_image', 0], vae }, _meta: { title: 'Encodage de l’image de départ' } };
    sampler.inputs.latent_image = ['depuis_encodage', 0];
    sampler.inputs.denoise = overrides.strength ?? 0.5;
    // L'ancienne image vide ne mène plus à rien : on la retire.
    for (const [id, node] of Object.entries(api)) {
      const used = Object.values(api).some((other) => Object.values(other.inputs).some((value) => isLink(value) && value[0] === id));
      if (!used && node.class_type !== 'SaveImage' && id !== samplerId && node.class_type.startsWith('Empty')) delete api[id];
    }
  }
  return api;
}
