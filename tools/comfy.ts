// Génère des images avec ComfyUI en local, à partir d'un workflow réglé dans son interface, une image par graine.
// ComfyUI doit tourner sur http://127.0.0.1:8188 (voir CLAUDE.md). Les images arrivent dans art/sources/,
// qui n'est pas versionné : ce sont des brouillons.
//
//   node tools/comfy.ts <nom> --prompt "…" [--workflow emblem_portrait] [--graines 1,2,3] [--taille 1024x1024]
//                             [--lora 0.9] [--depuis image.png --force 0.5]
//   node tools/comfy.ts <nom> --personnage anna [--prompt "eyes closed"] [mêmes options]
//                             le sujet vient de la fiche du personnage (art/personnages.json, docs/personnages.md)
//                             pour ce workflow ; --prompt y ajoute une variante
//   node tools/comfy.ts --installer      met les workflows de art/comfy/ dans ComfyUI (sans écraser les siens)
//
// Le workflow est celui enregistré dans ComfyUI (panneau Workflows), tel qu'il a été réglé à l'œil : modèle,
// LoRA, pas, échantillonneur, texte de style… Le script ne change que ce qu'on lui donne :
//   --prompt   remplace « {sujet} » dans le prompt du workflow (tout le prompt s'il n'y a pas de « {sujet} ») ;
//   --graines, --taille, --lora   graine, taille de l'image vide, force des LoRA (sinon, ceux du workflow) ;
//   --depuis   redessine une image existante au lieu de partir de rien ; --force de 0 (image rendue telle
//              quelle) à 1 (image ignorée), 0.5 par défaut.
// Une copie du workflow utilisé est gardée dans art/comfy/<workflow>.json (versionné), pour suivre ses réglages.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { applyOverrides, nodeTypes, promptOf, subjectFor, toApi } from './comfy-workflow.ts';
import type { ApiWorkflow, Characters, ObjectInfo, Overrides, UiWorkflow } from './comfy-workflow.ts';

const HOST = 'http://127.0.0.1:8188';
const OUT_DIR = 'art/sources';
const WORKFLOW_DIR = 'art/comfy';
const CHARACTERS = 'art/personnages.json';
const DEFAULT_WORKFLOW = 'emblem_portrait';

const userdata = (file: string): string => `${HOST}/api/userdata/${encodeURIComponent(`workflows/${file}`)}`;

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init).catch(() => {
    throw new Error(`ComfyUI ne répond pas sur ${HOST} : est-il lancé ? (voir CLAUDE.md)`);
  });
  return (await response.json()) as T;
}

// Le workflow tel qu'enregistré dans ComfyUI ; à défaut, la copie du dépôt.
export async function loadWorkflow(name: string): Promise<UiWorkflow> {
  const response = await fetch(userdata(`${name}.json`)).catch(() => undefined);
  if (response?.ok) return (await response.json()) as UiWorkflow;
  const copy = join(WORKFLOW_DIR, `${name}.json`);
  if (!existsSync(copy)) throw new Error(`workflow « ${name} » introuvable, ni dans ComfyUI ni dans ${WORKFLOW_DIR}/`);
  console.log(`workflow « ${name} » absent de ComfyUI : copie du dépôt utilisée (node tools/comfy.ts --installer pour l'y mettre)`);
  return JSON.parse(readFileSync(copy, 'utf8')) as UiWorkflow;
}

async function describe(types: string[]): Promise<ObjectInfo> {
  const info: ObjectInfo = {};
  for (const type of types) Object.assign(info, await json<ObjectInfo>(`${HOST}/api/object_info/${encodeURIComponent(type)}`));
  return info;
}

// Garde dans le dépôt la version du workflow qui a servi, si elle a changé.
function keepCopy(name: string, workflow: UiWorkflow): void {
  const path = join(WORKFLOW_DIR, `${name}.json`);
  const text = `${JSON.stringify(workflow, null, 2)}\n`;
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return;
  mkdirSync(WORKFLOW_DIR, { recursive: true });
  writeFileSync(path, text);
  console.log(`${path} : copie du workflow mise à jour`);
}

// Envoie une image dans le dossier input de ComfyUI ; renvoie le nom sous lequel la retrouver.
export async function upload(path: string): Promise<string> {
  const form = new FormData();
  form.append('image', new Blob([readFileSync(path)], { type: 'image/png' }), basename(path));
  form.append('overwrite', 'true');
  const answer = await json<{ name?: string; subfolder?: string }>(`${HOST}/upload/image`, { method: 'POST', body: form });
  if (answer.name === undefined) throw new Error(`ComfyUI refuse l'image : ${JSON.stringify(answer)}`);
  return answer.subfolder ? `${answer.subfolder}/${answer.name}` : answer.name;
}

interface HistoryEntry {
  status?: { status_str?: string; messages?: unknown };
  outputs: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
}

// Lance une génération et écrit la première image produite dans `target`.
export async function generate(api: ApiWorkflow, target: string): Promise<void> {
  const started = Date.now();
  const queued = await json<{ prompt_id?: string; error?: unknown; node_errors?: unknown }>(`${HOST}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: api }),
  });
  if (queued.prompt_id === undefined) throw new Error(`ComfyUI refuse la demande : ${JSON.stringify(queued.error ?? queued)} ${JSON.stringify(queued.node_errors ?? '')}`);

  let entry: HistoryEntry | undefined;
  while (entry === undefined) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    entry = (await json<Record<string, HistoryEntry>>(`${HOST}/history/${queued.prompt_id}`))[queued.prompt_id];
    if (entry?.status?.status_str === 'error') throw new Error(`ComfyUI : ${JSON.stringify(entry.status.messages)}`);
  }

  const image = Object.values(entry.outputs).flatMap((output) => output.images ?? [])[0];
  if (image === undefined) throw new Error('ComfyUI n’a renvoyé aucune image (le workflow a-t-il un SaveImage ?)');
  const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
  writeFileSync(target, Buffer.from(await fetch(`${HOST}/view?${query}`).then((r) => r.arrayBuffer())));
  console.log(`${target} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

// Met les workflows du dépôt dans ComfyUI, sans écraser ceux qui y sont déjà.
async function install(): Promise<void> {
  for (const file of readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith('.json'))) {
    const response = await fetch(`${userdata(file)}?overwrite=false`, { method: 'POST', body: readFileSync(join(WORKFLOW_DIR, file)) });
    console.log(response.status === 409 ? `${file} : déjà dans ComfyUI, laissé tel quel` : `${file} : ajouté à ComfyUI (${response.status})`);
  }
}

async function main(args: string[]): Promise<void> {
  if (args.includes('--installer')) return install();
  const option = (key: string): string | undefined => {
    const at = args.indexOf(`--${key}`);
    return at === -1 ? undefined : args[at + 1];
  };
  const name = args[0];
  const character = option('personnage');
  if (name === undefined || name.startsWith('--') || (option('prompt') === undefined && character === undefined)) {
    console.error('usage : node tools/comfy.ts <nom> (--prompt "…" | --personnage <id> [--prompt "variante"]) [--workflow emblem_portrait] [--graines 1,2,3] [--taille 1024x1024] [--lora 0.9] [--depuis image.png --force 0.5]');
    process.exit(1);
  }
  const workflowName = option('workflow') ?? DEFAULT_WORKFLOW;
  const characters = character === undefined ? {} : (JSON.parse(readFileSync(CHARACTERS, 'utf8')) as Characters);
  const subject = subjectFor(characters, character, workflowName, option('prompt'));
  if (character !== undefined) console.log(`sujet : ${subject}`);
  const ui = await loadWorkflow(workflowName);
  const api = toApi(ui, await describe(nodeTypes(ui)));
  keepCopy(workflowName, ui);
  const template = promptOf(api) ?? '';
  console.log(`workflow « ${workflowName} », prompt : ${template.includes('{sujet}') ? template : '(remplacé par --prompt)'}`);

  const size = option('taille')?.split('x').map(Number);
  const from = option('depuis');
  const base: Overrides = {
    subject,
    ...(size === undefined ? {} : { width: size[0], height: size[1] }),
    ...(option('lora') === undefined ? {} : { lora: Number(option('lora')) }),
    ...(from === undefined ? {} : { source: await upload(from), strength: Number(option('force') ?? 0.5) }),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const seeds = option('graines')?.split(',').map(Number) ?? [undefined];
  for (const seed of seeds) {
    const label = seed ?? 'workflow';
    await generate(applyOverrides(api, { ...base, ...(seed === undefined ? {} : { seed }), prefix: `${name}_${label}` }), join(OUT_DIR, `${name}_${label}.png`));
  }
}

if (import.meta.main) await main(process.argv.slice(2));
