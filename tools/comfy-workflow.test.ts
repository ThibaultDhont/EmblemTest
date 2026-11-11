import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyOverrides, nodeTypes, promptOf, subjectFor, toApi } from './comfy-workflow.ts';
import type { ObjectInfo, UiLink, UiNode, UiWorkflow } from './comfy-workflow.ts';

// Description des nœuds, comme /api/object_info (réduite à ce qui sert).
const INFO: ObjectInfo = {
  UNETLoader: { input: { required: { unet_name: [['z.safetensors']], weight_dtype: [['default']] } } },
  LoraLoaderModelOnly: { input: { required: { model: ['MODEL'], lora_name: [['pixel.safetensors']], strength_model: ['FLOAT', {}] } } },
  ModelSamplingAuraFlow: {
    input: { required: { model: ['MODEL'], shift: ['FLOAT', {}] }, optional: { sampling: [['flow'], { advanced: true }] } },
    input_order: { required: ['model', 'shift'], optional: ['sampling'] },
  },
  CLIPLoader: { input: { required: { clip_name: [['qwen.safetensors']], type: [['lumina2']] } } },
  CLIPTextEncode: { input: { required: { text: ['STRING', { multiline: true }], clip: ['CLIP'] } }, input_order: { required: ['text', 'clip'] } },
  ConditioningZeroOut: { input: { required: { conditioning: ['CONDITIONING'] } } },
  EmptySD3LatentImage: { input: { required: { width: ['INT', {}], height: ['INT', {}], batch_size: ['INT', {}] } } },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { control_after_generate: true }],
        steps: ['INT', {}],
        cfg: ['FLOAT', {}],
        sampler_name: [['res_multistep']],
        scheduler: [['simple']],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        denoise: ['FLOAT', {}],
      },
    },
  },
  VAELoader: { input: { required: { vae_name: [['ae.safetensors']] } } },
  VAEDecode: { input: { required: { samples: ['LATENT'], vae: ['VAE'] } } },
  SaveImage: { input: { required: { images: ['IMAGE'], filename_prefix: ['STRING', {}] } } },
  LoadImagePlus: { input: { required: { image: [['a.png'], { image_upload: true }], mode: [['rgb']] } } },
};

// Petit constructeur de graphe façon interface : `link(de, sortie, vers, entrée, type)` relie deux nœuds.
function graph(): { nodes: UiNode[]; links: UiLink[]; node: (node: UiNode) => UiNode; link: (from: number, slot: number, to: number, name: string, type: string) => void } {
  const nodes: UiNode[] = [];
  const links: UiLink[] = [];
  return {
    nodes,
    links,
    node: (node) => (nodes.push(node), node),
    link: (from, slot, to, name, type) => {
      const id = links.length + 1;
      links.push([id, from, slot, to, 0, type]);
      const target = nodes.find((n) => n.id === to)!;
      const input = target.inputs?.find((i) => i.name === name);
      if (input) input.link = id;
      else (target.inputs ??= []).push({ name, type, link: id });
    },
  };
}

// Le workflow de base du projet, plus une note, un relais et une LoRA contournée en option.
function baseWorkflow(loraMode = 0): UiWorkflow {
  const g = graph();
  g.node({ id: 1, type: 'UNETLoader', widgets_values: ['z.safetensors', 'default'] });
  g.node({ id: 2, type: 'LoraLoaderModelOnly', mode: loraMode, title: 'LoRA', widgets_values: ['pixel.safetensors', 0.9] });
  g.node({ id: 3, type: 'ModelSamplingAuraFlow', widgets_values: [3, 'flow'] });
  g.node({ id: 4, type: 'CLIPLoader', widgets_values: ['qwen.safetensors', 'lumina2'] });
  g.node({ id: 5, type: 'CLIPTextEncode', title: 'Prompt', widgets_values: ['Pixel art style. {sujet}, no text'] });
  g.node({ id: 6, type: 'ConditioningZeroOut' });
  g.node({ id: 7, type: 'EmptySD3LatentImage', widgets_values: [1024, 1024, 1] });
  g.node({ id: 8, type: 'KSampler', widgets_values: [42, 'randomize', 8, 1, 'res_multistep', 'simple', 1] });
  g.node({ id: 9, type: 'VAELoader', widgets_values: ['ae.safetensors'] });
  g.node({ id: 10, type: 'Reroute' });
  g.node({ id: 11, type: 'VAEDecode' });
  g.node({ id: 12, type: 'SaveImage', widgets_values: ['emblem/test'] });
  g.node({ id: 13, type: 'Note', widgets_values: ['mode d’emploi'] });
  g.link(1, 0, 2, 'model', 'MODEL');
  g.link(2, 0, 3, 'model', 'MODEL');
  g.link(4, 0, 5, 'clip', 'CLIP');
  g.link(5, 0, 6, 'conditioning', 'CONDITIONING');
  g.link(3, 0, 8, 'model', 'MODEL');
  g.link(5, 0, 8, 'positive', 'CONDITIONING');
  g.link(6, 0, 8, 'negative', 'CONDITIONING');
  g.link(7, 0, 8, 'latent_image', 'LATENT');
  g.link(9, 0, 10, 'input', '*');
  g.link(10, 0, 11, 'vae', 'VAE');
  g.link(8, 0, 11, 'samples', 'LATENT');
  g.link(11, 0, 12, 'images', 'IMAGE');
  return { nodes: g.nodes, links: g.links };
}

test('le workflow de l’interface devient celui de l’API : valeurs des widgets, liens, titres', () => {
  const api = toApi(baseWorkflow(), INFO);
  assert.deepEqual(api['8'], {
    class_type: 'KSampler',
    inputs: {
      model: ['3', 0],
      seed: 42, // « randomize » qui suit la graine n'est pas une entrée
      steps: 8,
      cfg: 1,
      sampler_name: 'res_multistep',
      scheduler: 'simple',
      positive: ['5', 0],
      negative: ['6', 0],
      latent_image: ['7', 0],
      denoise: 1,
    },
  });
  assert.deepEqual(api['3']?.inputs, { model: ['2', 0], shift: 3, sampling: 'flow' }); // entrée optionnelle
  assert.deepEqual(api['2'], { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: 'pixel.safetensors', strength_model: 0.9 }, _meta: { title: 'LoRA' } });
  assert.deepEqual(api['11']?.inputs.vae, ['9', 0]); // le relais est traversé
  assert.equal(api['10'], undefined); // ni le relais…
  assert.equal(api['13'], undefined); // … ni la note ne sont exécutés
  assert.deepEqual(nodeTypes(baseWorkflow()).includes('Note'), false);
});

test('un nœud contourné laisse passer son entrée, un nœud muet disparaît avec ses liens', () => {
  const bypassed = toApi(baseWorkflow(4), INFO);
  assert.equal(bypassed['2'], undefined);
  assert.deepEqual(bypassed['3']?.inputs.model, ['1', 0]); // le modèle passe directement
  const muted = toApi(baseWorkflow(2), INFO);
  assert.equal(muted['2'], undefined);
  assert.equal(muted['3']?.inputs.model, undefined);
});

test('le bouton d’envoi d’image ne décale pas les valeurs suivantes', () => {
  const api = toApi({ nodes: [{ id: 1, type: 'LoadImagePlus', widgets_values: ['b.png', 'image', 'rgb'] }], links: [] }, INFO);
  assert.deepEqual(api['1']?.inputs, { image: 'b.png', mode: 'rgb' });
});

test('un type inconnu de ComfyUI est refusé avec le nom du nœud', () => {
  assert.throws(() => toApi({ nodes: [{ id: 1, type: 'Mystere', title: 'Truc' }], links: [] }, INFO), /« Truc » : type Mystere inconnu/);
});

test('les réglages d’une génération : sujet dans le prompt, graine, taille, LoRA, nom des fichiers', () => {
  const api = toApi(baseWorkflow(), INFO);
  const out = applyOverrides(api, { subject: 'a red fox', seed: 7, width: 768, height: 512, lora: 0.7, prefix: 'renard_7' });
  assert.equal(out['5']?.inputs.text, 'Pixel art style. a red fox, no text');
  assert.equal(out['8']?.inputs.seed, 7);
  assert.deepEqual([out['7']?.inputs.width, out['7']?.inputs.height], [768, 512]);
  assert.equal(out['2']?.inputs.strength_model, 0.7);
  assert.equal(out['12']?.inputs.filename_prefix, 'emblem/renard_7');
  assert.equal(api['5']?.inputs.text, 'Pixel art style. {sujet}, no text'); // l'original n'est pas touché
  assert.equal(promptOf(api), 'Pixel art style. {sujet}, no text');
  // Sans « {sujet} », le sujet remplace tout le prompt.
  const plain = toApi(baseWorkflow(), INFO);
  plain['5']!.inputs.text = 'Pixel art style. a cat';
  assert.equal(applyOverrides(plain, { subject: 'Pixel art style. a dog' })['5']?.inputs.text, 'Pixel art style. a dog');
});

test('avec une image de départ, l’échantillonneur part d’elle, encodée par le VAE du workflow', () => {
  const out = applyOverrides(toApi(baseWorkflow(), INFO), { source: 'emblem/depart.png', strength: 0.6 });
  assert.deepEqual(out.depuis_image?.inputs, { image: 'emblem/depart.png' });
  assert.deepEqual(out.depuis_encodage?.inputs, { pixels: ['depuis_image', 0], vae: ['9', 0] });
  assert.deepEqual(out['8']?.inputs.latent_image, ['depuis_encodage', 0]);
  assert.equal(out['8']?.inputs.denoise, 0.6);
  assert.equal(out['7'], undefined); // l'image vide ne sert plus
});

test('le sujet d’un personnage dépend du workflow, et --prompt s’y ajoute', () => {
  const characters = { anna: { portrait: 'red bob hair, teal scarf', combat: 'full body, sword' } };
  assert.equal(subjectFor(characters, 'anna', 'emblem_portrait', undefined), 'red bob hair, teal scarf');
  assert.equal(subjectFor(characters, 'anna', 'emblem_combat', undefined), 'full body, sword');
  assert.equal(subjectFor(characters, 'anna', 'emblem_portrait', 'eyes closed'), 'red bob hair, teal scarf, eyes closed');
  assert.equal(subjectFor(characters, undefined, 'emblem_portrait', 'a fox'), 'a fox');
  assert.throws(() => subjectFor(characters, 'bob', 'emblem_portrait', undefined), /« bob » absent.*connus : anna/);
  assert.throws(() => subjectFor(characters, 'anna', 'emblem_carte', undefined), /pas de sujet « carte »/);
  assert.throws(() => subjectFor(characters, undefined, 'emblem_portrait', undefined), /--prompt ou --personnage/);
});

test('un workflow à deux échantillonneurs est refusé', () => {
  const api = toApi(baseWorkflow(), INFO);
  api['99'] = structuredClone(api['8']!);
  assert.throws(() => applyOverrides(api, { seed: 1 }), /un seul échantillonneur/);
});
