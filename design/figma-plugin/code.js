// BGSC Admin Builder — draws the web admin design system into the open Figma file.
// Figma desktop → Plugins → Development → Import plugin from manifest… → pick manifest.json,
// then Plugins → Development → BGSC Admin Builder → a numbered command.
// Spec: docs/web-admin-design-plan.md
//
// Re-running a command rebuilds its pages. Tokens and text styles are updated in place, but
// components are recreated — re-run "1" only before screens use them, or instances detach.

const COLL = 'BGSC Tokens';

// name: [light, dark]. Hex, or [hex, alpha].
const C = {
  'bg/canvas': ['#F5F2ED', '#2C3135'],
  'bg/surface': ['#FFFFFF', '#33383D'],
  'bg/sunken': ['#EBE7E2', '#262A2E'],
  'bg/hover': ['#F0ECE6', '#3A4045'],
  'border/default': ['#E2DCD5', '#41474D'],
  'border/strong': ['#CFC8C0', '#565E65'],
  'text/primary': ['#2E2E2E', '#E8E8E8'],
  'text/secondary': ['#4D4D4D', '#C4C4C4'],
  'text/muted': ['#6B6B6B', '#A6A6A6'],
  // accent = brand orange for indicators; solid = AA-contrast fill for buttons
  'primary/accent': ['#E07A3F', '#E8854A'],
  'primary/solid': ['#BD5420', '#E8854A'],
  'primary/on': ['#FFFFFF', '#1E2226'],
  'primary/subtle': ['#FBE9DE', '#4A3428'],
  'primary/text': ['#9A4318', '#F0A06F'],
  'danger/solid': ['#C0392B', '#C9463A'],
  'danger/on': ['#FFFFFF', '#FFFFFF'],
  'status/neutral/bg': ['#EBE7E2', '#3A4045'],
  'status/neutral/fg': ['#4D4D4D', '#C4C4C4'],
  'status/info/bg': ['#E1ECF2', '#23363F'],
  'status/info/fg': ['#3E6E86', '#8BB6CA'],
  'status/success/bg': ['#DDF6E8', '#1F3D2E'],
  'status/success/fg': ['#16713F', '#5FE09A'],
  'status/warning/bg': ['#FDF0D5', '#45391C'],
  'status/warning/fg': ['#8A5300', '#F5B544'],
  'status/danger/bg': ['#FBE1DE', '#4A2826'],
  'status/danger/fg': ['#A93226', '#F07A6C'],
  'club/bgsc/bg': ['#E3ECFB', '#22324A'],
  'club/bgsc/fg': ['#2457B8', '#7AA7F0'],
  'club/bgec/bg': ['#EEE6FB', '#33294A'],
  'club/bgec/fg': ['#6A3CC9', '#A98BF0'],
  'club/fitsoc/bg': ['#DFF3E8', '#1F3D2E'],
  'club/fitsoc/fg': ['#1E7A4C', '#5FD394'],
  'overlay': [['#141210', 0.5], ['#000000', 0.6]],
};

// [name, family, style, size, lineHeight, letterSpacing px, uppercase]
const TYPE = [
  ['Display/Hero', 'DM Serif Display', 'Regular', 40, 48, 0],
  ['Display/Greeting', 'DM Serif Display', 'Regular', 28, 36, 0],
  ['Heading/H1', 'Inter', 'Bold', 24, 32, -0.3],
  ['Heading/H2', 'Inter', 'Semi Bold', 20, 28, -0.2],
  ['Heading/H3', 'Inter', 'Semi Bold', 16, 24, 0],
  ['Stat/Value', 'Inter', 'Bold', 30, 36, -0.5],
  ['Body/md', 'Inter', 'Regular', 14, 20, 0],
  ['Body/sm', 'Inter', 'Regular', 13, 18, 0],
  ['Label/md', 'Inter', 'Medium', 14, 20, 0],
  ['Label/strong', 'Inter', 'Semi Bold', 14, 20, 0],
  ['Label/sm', 'Inter', 'Medium', 13, 18, 0],
  ['Caption/regular', 'Inter', 'Regular', 12, 16, 0],
  ['Caption/strong', 'Inter', 'Semi Bold', 12, 16, 0],
  ['Overline', 'Inter', 'Semi Bold', 11, 16, 0.6, true],
  ['Mono/md', 'JetBrains Mono', 'Regular', 13, 20, 0],
  ['Mono/sm', 'JetBrains Mono', 'Medium', 12, 16, 0],
];

// Lucide paths (24×24, stroke 2). Swap/add more with the Lucide Figma plugin.
const ICONS = {
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'more-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  'calendar': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  'award': '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'coins': '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  'activity': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'inbox': '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  'pencil': '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  'trash': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
};

const SHADOW = { type: 'DROP_SHADOW', color: { r: 0.08, g: 0.06, b: 0.04, a: 0.12 }, offset: { x: 0, y: 8 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' };

const V = {};      // variables by name
const S = {};      // text styles by name
const ICON = {};   // icon components by name
const REG = {};    // built components: { set|comp, keys }
const FONT_OK = {};
let COLL_OBJ, LIGHT, DARK;

// ---------- primitives ----------

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 };
}
function rgba(v) {
  const c = hexRgb(Array.isArray(v) ? v[0] : v);
  c.a = Array.isArray(v) ? v[1] : 1;
  return c;
}
function paint(name) {
  if (!V[name]) throw new Error('Unknown token ' + name);
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', V[name]);
}

async function font(family, style) {
  const key = family + '|' + style;
  if (!(key in FONT_OK)) {
    try { await figma.loadFontAsync({ family, style }); FONT_OK[key] = true; } catch (e) { FONT_OK[key] = false; }
  }
  if (FONT_OK[key]) return { family, style };
  figma.notify(`Font ${family} ${style} missing — using Inter`, { timeout: 4000 });
  return { family: 'Inter', style: style === 'Regular' ? 'Regular' : 'Bold' };
}

async function txt(chars, style, color, name) {
  const t = figma.createText();
  await t.setTextStyleIdAsync(S[style].id);
  t.characters = chars;
  t.fills = [paint(color || 'text/primary')];
  t.name = name || chars;
  return t;
}

// Auto-layout frame (or component). o: dir, gap, pad, align, justify, fill, stroke, strokeW, radius, w, h, shadow, component
function al(name, o) {
  o = o || {};
  const f = o.component ? figma.createComponent() : figma.createFrame();
  f.name = name;
  f.layoutMode = o.dir || 'HORIZONTAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = o.gap === undefined ? 8 : o.gap;
  const p = [].concat(o.pad === undefined ? 0 : o.pad);
  const [t, r, b, l] = p.length === 1 ? [p[0], p[0], p[0], p[0]] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p;
  f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l;
  f.counterAxisAlignItems = o.align || (f.layoutMode === 'HORIZONTAL' ? 'CENTER' : 'MIN');
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  f.fills = o.fill ? [paint(o.fill)] : [];
  if (o.stroke) { f.strokes = [paint(o.stroke)]; f.strokeWeight = o.strokeW || 1; f.strokeAlign = 'INSIDE'; }
  if (o.radius) f.cornerRadius = o.radius;
  if (o.w || o.h) {
    f.resize(o.w || 100, o.h || 100);
    f.layoutSizingHorizontal = o.w ? 'FIXED' : 'HUG';
    f.layoutSizingVertical = o.h ? 'FIXED' : 'HUG';
  }
  if (o.shadow) f.effects = [SHADOW];
  f.clipsContent = false;
  return f;
}

function sideStroke(f, color, side, w) {
  f.strokes = [paint(color)];
  f.strokeAlign = 'INSIDE';
  f.strokeTopWeight = 0; f.strokeRightWeight = 0; f.strokeBottomWeight = 0; f.strokeLeftWeight = 0;
  f['stroke' + side + 'Weight'] = w || 1;
}

function fillX(parent, child) { parent.appendChild(child); child.layoutSizingHorizontal = 'FILL'; return child; }

function rect(w, h, color, radius) {
  const r = figma.createRectangle();
  r.resize(w, h);
  r.fills = [paint(color)];
  r.cornerRadius = radius || 0;
  return r;
}

function dot(size, color) {
  const e = figma.createEllipse();
  e.resize(size, size);
  e.fills = [paint(color)];
  e.name = 'Dot';
  return e;
}

function icon(name, color, size) {
  const i = ICON[name].createInstance();
  i.name = 'Icon';
  if (color && color !== 'text/primary') i.findOne(n => n.name === 'Vector').strokes = [paint(color)];
  i.rescale((size || 16) / 24);
  return i;
}

function props(node, defs) {
  const keys = {};
  for (const k of Object.keys(defs)) keys[k] = node.addComponentProperty(k, defs[k][0], defs[k][1]);
  return keys;
}

// Bind every layer named `layer` inside node to a component property.
function bind(node, layer, field, key) {
  for (const n of node.findAll(x => x.name === layer)) {
    const refs = Object.assign({}, n.componentPropertyReferences || {});
    refs[field] = key;
    n.componentPropertyReferences = refs;
  }
}

function combine(comps, parent, name, w) {
  for (const c of comps) parent.appendChild(c);
  const set = figma.combineAsVariants(comps, parent);
  set.name = name;
  set.layoutMode = 'HORIZONTAL';
  set.resize(w || 760, set.height);
  set.layoutSizingHorizontal = 'FIXED';
  set.layoutWrap = 'WRAP';
  set.layoutSizingVertical = 'HUG';
  set.itemSpacing = 16;
  set.counterAxisSpacing = 16;
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 16;
  set.counterAxisAlignItems = 'MIN';
  return set;
}

function variant(reg, variantName, overrides) {
  const r = REG[reg];
  const comp = r.set ? r.set.children.find(c => c.name === variantName) : r.comp;
  if (!comp) throw new Error(`No variant ${reg} / ${variantName}`);
  const i = comp.createInstance();
  if (overrides) {
    const p = {};
    for (const k of Object.keys(overrides)) p[r.keys[k]] = overrides[k];
    i.setProperties(p);
  }
  return i;
}

async function page(name) {
  let p = figma.root.children.find(x => x.name === name);
  if (!p) { p = figma.createPage(); p.name = name; }
  await p.loadAsync();
  for (const n of p.children.slice()) n.remove();
  return p;
}

async function section(root, title, desc) {
  const s = al(title, { dir: 'VERTICAL', gap: 12 });
  s.appendChild(await txt(title, 'Heading/H2', 'text/primary', 'Title'));
  if (desc) s.appendChild(await txt(desc, 'Body/sm', 'text/muted', 'Description'));
  root.appendChild(s);
  return s;
}

function row(parent, w) {
  const r = al('Row', { gap: 16, w: w || 1100 });
  r.layoutWrap = 'WRAP';
  r.counterAxisSpacing = 16;
  r.counterAxisAlignItems = 'MIN';
  parent.appendChild(r);
  return r;
}

// ---------- tokens ----------

async function tokens() {
  const colls = await figma.variables.getLocalVariableCollectionsAsync();
  const coll = colls.find(c => c.name === COLL) || figma.variables.createVariableCollection(COLL);
  let light = coll.modes.find(m => m.name === 'Light');
  if (!light) { light = coll.modes[0]; coll.renameMode(light.modeId, 'Light'); }
  LIGHT = light.modeId;
  const dark = coll.modes.find(m => m.name === 'Dark');
  if (dark) DARK = dark.modeId;
  else {
    try { DARK = coll.addMode('Dark'); }
    catch (e) { DARK = null; figma.notify('This Figma plan allows one variable mode — Dark skipped', { timeout: 8000 }); }
  }
  const existing = (await figma.variables.getLocalVariablesAsync('COLOR')).filter(v => v.variableCollectionId === coll.id);
  for (const name of Object.keys(C)) {
    const v = existing.find(x => x.name === name) || figma.variables.createVariable(name, coll, 'COLOR');
    v.setValueForMode(LIGHT, rgba(C[name][0]));
    if (DARK) v.setValueForMode(DARK, rgba(C[name][1]));
    V[name] = v;
  }
  COLL_OBJ = coll;
}

async function textStyles() {
  const existing = await figma.getLocalTextStylesAsync();
  for (const [name, family, style, size, lh, ls, upper] of TYPE) {
    const s = existing.find(x => x.name === name) || figma.createTextStyle();
    s.name = name;
    s.fontName = await font(family, style);
    s.fontSize = size;
    s.lineHeight = { unit: 'PIXELS', value: lh };
    s.letterSpacing = { unit: 'PIXELS', value: ls || 0 };
    s.textCase = upper ? 'UPPER' : 'ORIGINAL';
    S[name] = s;
  }
}

// ---------- foundations page ----------

function hexLabel(v) { return Array.isArray(v) ? `${v[0]} · ${Math.round(v[1] * 100)}%` : v; }

async function buildFoundations(p) {
  const root = al('Foundations', { dir: 'VERTICAL', gap: 48, pad: 48, fill: 'bg/canvas' });
  p.appendChild(root);
  root.appendChild(await txt('BGSC Admin', 'Display/Hero', 'text/primary', 'Title'));
  root.appendChild(await txt(`Tokens live in the "${COLL}" variable collection (Light / Dark). Switch a frame's mode from the right panel → Layer → mode.`, 'Body/md', 'text/muted', 'Intro'));

  const colors = await section(root, 'Colour', 'primary/accent = brand orange for indicators. primary/solid = button fill that passes WCAG AA with its on-colour.');
  const modes = al('Modes', { gap: 24, align: 'MIN' });
  colors.appendChild(modes);
  const modeList = [['Light', LIGHT, 0]];
  if (DARK) modeList.push(['Dark', DARK, 1]);
  for (const [label, modeId, idx] of modeList) {
    const m = al(label, { dir: 'VERTICAL', gap: 20, pad: 24, radius: 16, fill: 'bg/canvas', stroke: 'border/default' });
    modes.appendChild(m);
    m.setExplicitVariableModeForCollection(COLL_OBJ, modeId);
    m.appendChild(await txt(label, 'Heading/H3', 'text/primary', 'Mode'));
    const groups = {};
    for (const name of Object.keys(C)) {
      const g = name.split('/').slice(0, -1).join('/') || name;
      (groups[g] = groups[g] || []).push(name);
    }
    for (const g of Object.keys(groups)) {
      m.appendChild(await txt(g, 'Overline', 'text/muted', 'Group'));
      const r = row(m, 680);
      for (const name of groups[g]) {
        const sw = al(name, { dir: 'VERTICAL', gap: 4, w: 150 });
        const chip = rect(150, 48, name, 8);
        chip.strokes = [paint('border/default')];
        sw.appendChild(chip);
        sw.appendChild(await txt(name, 'Label/sm', 'text/primary', 'Name'));
        sw.appendChild(await txt(hexLabel(C[name][idx]), 'Mono/sm', 'text/muted', 'Value'));
        r.appendChild(sw);
      }
    }
  }

  const type = await section(root, 'Typography', 'Inter for UI. DM Serif Display only on login + dashboard greeting. JetBrains Mono for IDs, ticket numbers, points.');
  for (const [name, family, style, size, lh] of TYPE) {
    const r = al(name, { gap: 24 });
    const meta = al('Meta', { dir: 'VERTICAL', gap: 2, w: 220 });
    meta.appendChild(await txt(name, 'Label/sm', 'text/primary', 'Name'));
    meta.appendChild(await txt(`${family} ${style} · ${size}/${lh}`, 'Mono/sm', 'text/muted', 'Spec'));
    r.appendChild(meta);
    r.appendChild(await txt(name.startsWith('Mono') ? 'BG-7F3A21C9 · 5,200 pts' : 'Badminton Smash Open — 24 / 32 registered', name, 'text/primary', 'Sample'));
    type.appendChild(r);
  }

  const shape = await section(root, 'Shape & elevation', 'Radius 8 for controls, 12 for cards/modals, full for badges. One soft shadow for overlays only; everything else is flat with 1px borders.');
  const sr = row(shape, 900);
  for (const [label, rad, shadow] of [['radius 8 · controls', 8], ['radius 12 · cards', 12], ['radius full · badges', 999], ['overlay shadow', 12, true]]) {
    const b = al(label, { dir: 'VERTICAL', gap: 8, pad: 20, w: 200, radius: Math.min(rad, 40), fill: 'bg/surface', stroke: 'border/default', shadow });
    b.appendChild(await txt(label, 'Label/sm', 'text/secondary', 'Label'));
    sr.appendChild(b);
  }
  return root;
}

// ---------- components ----------

async function buildIcons(sec) {
  const r = row(sec, 1100);
  for (const name of Object.keys(ICONS)) {
    const c = figma.createComponent();
    c.name = 'Icon/' + name;
    c.resize(24, 24);
    c.fills = [];
    const svg = figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
    const vec = figma.flatten(svg.children.slice(), svg);
    vec.name = 'Vector';
    vec.fills = [];
    vec.strokes = [paint('text/primary')];
    c.appendChild(vec);
    vec.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    svg.remove();
    r.appendChild(c);
    ICON[name] = c;
  }
}

const BTN = {
  Primary: { fill: 'primary/solid', fg: 'primary/on' },
  Secondary: { fill: 'bg/surface', fg: 'text/primary', stroke: 'border/strong' },
  Ghost: { fg: 'text/secondary' },
  Danger: { fill: 'danger/solid', fg: 'danger/on' },
};

async function buildButtons(sec) {
  const comps = [];
  for (const kind of Object.keys(BTN)) for (const size of ['md', 'sm']) {
    const b = BTN[kind];
    const c = al(`Kind=${kind}, Size=${size}`, { component: true, gap: 6, pad: size === 'md' ? [9, 16] : [6, 12], radius: 8, fill: b.fill, stroke: b.stroke, justify: 'CENTER' });
    const ic = icon('plus', b.fg, 16);
    ic.visible = false;
    c.appendChild(ic);
    c.appendChild(await txt('Button', size === 'md' ? 'Label/strong' : 'Label/sm', b.fg, 'Label'));
    comps.push(c);
  }
  const set = combine(comps, sec, 'Button');
  const keys = props(set, { Label: ['TEXT', 'Button'], 'Show icon': ['BOOLEAN', false], Icon: ['INSTANCE_SWAP', ICON['plus'].id] });
  bind(set, 'Label', 'characters', keys.Label);
  bind(set, 'Icon', 'visible', keys['Show icon']);
  bind(set, 'Icon', 'mainComponent', keys.Icon);
  REG.Button = { set, keys };

  const icomps = [];
  for (const kind of ['Secondary', 'Ghost']) for (const size of ['md', 'sm']) {
    const s = size === 'md' ? 36 : 28;
    const c = al(`Kind=${kind}, Size=${size}`, { component: true, w: s, h: s, radius: 8, justify: 'CENTER', align: 'CENTER', fill: BTN[kind].fill, stroke: BTN[kind].stroke });
    c.appendChild(icon('more-horizontal', 'text/secondary', size === 'md' ? 18 : 16));
    icomps.push(c);
  }
  const iset = combine(icomps, sec, 'Icon button');
  const ikeys = props(iset, { Icon: ['INSTANCE_SWAP', ICON['more-horizontal'].id] });
  bind(iset, 'Icon', 'mainComponent', ikeys.Icon);
  REG.IconButton = { set: iset, keys: ikeys };
}

const FIELD = {
  Default: { fill: 'bg/surface', stroke: 'border/strong', helper: 'text/muted' },
  Focus: { fill: 'bg/surface', stroke: 'primary/accent', w: 2, helper: 'text/muted' },
  Error: { fill: 'bg/surface', stroke: 'status/danger/fg', helper: 'status/danger/fg' },
  Disabled: { fill: 'bg/sunken', stroke: 'border/default', helper: 'text/muted' },
};

async function buildFields(sec) {
  const comps = [];
  for (const type of ['Text', 'Select', 'Search', 'Textarea']) for (const state of Object.keys(FIELD)) {
    const s = FIELD[state];
    const c = al(`Type=${type}, State=${state}`, { component: true, dir: 'VERTICAL', gap: 6, w: 280 });
    c.appendChild(await txt('Label', 'Label/sm', 'text/secondary', 'Label'));
    const box = fillX(c, al('Box', { gap: 8, pad: [9, 12], radius: 8, fill: s.fill, stroke: s.stroke, strokeW: s.w }));
    if (type === 'Search') box.appendChild(icon('search', 'text/muted', 16));
    const placeholder = { Text: 'Placeholder', Select: 'Select…', Search: 'Search…', Textarea: 'Write something…' }[type];
    fillX(box, await txt(placeholder, 'Body/md', 'text/muted', 'Value'));
    if (type === 'Select') box.appendChild(icon('chevron-down', 'text/muted', 16));
    if (type === 'Textarea') { box.counterAxisAlignItems = 'MIN'; box.layoutSizingVertical = 'FIXED'; box.resize(box.width, 96); }
    c.appendChild(await txt(state === 'Error' ? 'This field is required' : 'Helper text', 'Caption/regular', s.helper, 'Helper'));
    comps.push(c);
  }
  const set = combine(comps, sec, 'Field', 1240);
  const keys = props(set, { Label: ['TEXT', 'Label'], Value: ['TEXT', 'Placeholder'], Helper: ['TEXT', 'Helper text'], 'Show label': ['BOOLEAN', true], 'Show helper': ['BOOLEAN', false] });
  bind(set, 'Label', 'characters', keys.Label);
  bind(set, 'Label', 'visible', keys['Show label']);
  bind(set, 'Value', 'characters', keys.Value);
  bind(set, 'Helper', 'characters', keys.Helper);
  bind(set, 'Helper', 'visible', keys['Show helper']);
  REG.Field = { set, keys };
}

async function buildChoices(sec) {
  const r = row(sec, 1100);
  const cb = [];
  for (const checked of [false, true]) {
    const c = al(`Checked=${checked}`, { component: true, gap: 8 });
    const box = al('Box', { w: 16, h: 16, radius: 4, justify: 'CENTER', align: 'CENTER', fill: checked ? 'primary/solid' : 'bg/surface', stroke: checked ? null : 'border/strong' });
    if (checked) box.appendChild(icon('check', 'primary/on', 12));
    c.appendChild(box);
    c.appendChild(await txt('Checkbox label', 'Body/md', 'text/primary', 'Label'));
    cb.push(c);
  }
  const cset = combine(cb, r, 'Checkbox', 360);
  REG.Checkbox = { set: cset, keys: props(cset, { Label: ['TEXT', 'Checkbox label'] }) };
  bind(cset, 'Label', 'characters', REG.Checkbox.keys.Label);

  const tg = [];
  for (const on of [false, true]) {
    const c = al(`On=${on}`, { component: true, gap: 8 });
    const track = al('Track', { w: 32, h: 18, radius: 9, pad: 2, justify: on ? 'MAX' : 'MIN', align: 'CENTER', fill: on ? 'primary/solid' : 'border/strong' });
    const knob = dot(14, 'bg/surface');
    knob.name = 'Knob';
    track.appendChild(knob);
    c.appendChild(track);
    c.appendChild(await txt('Toggle label', 'Body/md', 'text/primary', 'Label'));
    tg.push(c);
  }
  const tset = combine(tg, r, 'Toggle', 360);
  REG.Toggle = { set: tset, keys: props(tset, { Label: ['TEXT', 'Toggle label'] }) };
  bind(tset, 'Label', 'characters', REG.Toggle.keys.Label);
}

const TONES = ['Neutral', 'Info', 'Success', 'Warning', 'Danger'];

async function buildBadges(sec) {
  const r = row(sec, 1100);
  const comps = [];
  for (const tone of TONES) {
    const t = tone.toLowerCase();
    const c = al(`Tone=${tone}`, { component: true, gap: 6, pad: [2, 8], radius: 999, fill: `status/${t}/bg` });
    c.appendChild(dot(6, `status/${t}/fg`));
    c.appendChild(await txt(tone, 'Caption/strong', `status/${t}/fg`, 'Label'));
    comps.push(c);
  }
  const set = combine(comps, r, 'Badge', 560);
  REG.Badge = { set, keys: props(set, { Label: ['TEXT', 'Status'] }) };
  bind(set, 'Label', 'characters', REG.Badge.keys.Label);

  const clubs = { BGSC: 'club/bgsc', BGEC: 'club/bgec', FitSoc: 'club/fitsoc', General: 'status/neutral' };
  const tags = [];
  for (const club of Object.keys(clubs)) {
    const c = al(`Club=${club}`, { component: true, pad: [2, 8], radius: 6, fill: clubs[club] + '/bg' });
    c.appendChild(await txt(club, 'Caption/strong', clubs[club] + '/fg', 'Label'));
    tags.push(c);
  }
  const tset = combine(tags, r, 'Club tag', 400);
  REG.ClubTag = { set: tset, keys: props(tset, { Label: ['TEXT', 'BGSC'] }) };
  bind(tset, 'Label', 'characters', REG.ClubTag.keys.Label);

  const av = [];
  for (const [size, px, style] of [['sm', 24, 'Caption/strong'], ['md', 32, 'Label/strong'], ['lg', 40, 'Label/strong']]) {
    const c = al(`Size=${size}`, { component: true, w: px, h: px, radius: px / 2, justify: 'CENTER', align: 'CENTER', fill: 'primary/subtle' });
    c.appendChild(await txt('AS', style, 'primary/text', 'Initials'));
    av.push(c);
  }
  const aset = combine(av, r, 'Avatar', 240);
  REG.Avatar = { set: aset, keys: props(aset, { Initials: ['TEXT', 'AS'] }) };
  bind(aset, 'Initials', 'characters', REG.Avatar.keys.Initials);
}

async function buildNav(sec) {
  const r = row(sec, 1100);
  const nav = [];
  for (const state of ['Default', 'Active']) {
    const a = state === 'Active';
    const c = al(`State=${state}`, { component: true, gap: 10, pad: [8, 12], radius: 8, w: 216, fill: a ? 'primary/subtle' : null });
    c.appendChild(icon('layout-dashboard', a ? 'primary/text' : 'text/secondary', 20));
    fillX(c, await txt('Dashboard', a ? 'Label/strong' : 'Label/md', a ? 'primary/text' : 'text/secondary', 'Label'));
    const count = al('Count', { pad: [0, 6], radius: 999, fill: a ? 'primary/solid' : 'bg/sunken' });
    count.appendChild(await txt('3', 'Caption/strong', a ? 'primary/on' : 'text/secondary', 'Count value'));
    count.visible = false;
    c.appendChild(count);
    nav.push(c);
  }
  const nset = combine(nav, r, 'Nav item', 520);
  REG.NavItem = { set: nset, keys: props(nset, { Label: ['TEXT', 'Dashboard'], Icon: ['INSTANCE_SWAP', ICON['layout-dashboard'].id], 'Show count': ['BOOLEAN', false], Count: ['TEXT', '3'] }) };
  bind(nset, 'Label', 'characters', REG.NavItem.keys.Label);
  bind(nset, 'Icon', 'mainComponent', REG.NavItem.keys.Icon);
  bind(nset, 'Count', 'visible', REG.NavItem.keys['Show count']);
  bind(nset, 'Count value', 'characters', REG.NavItem.keys.Count);

  const tabs = [];
  for (const state of ['Default', 'Active']) {
    const a = state === 'Active';
    const c = al(`State=${state}`, { component: true, gap: 6, pad: [10, 4] });
    if (a) sideStroke(c, 'primary/accent', 'Bottom', 2);
    c.appendChild(await txt('Tab', a ? 'Label/strong' : 'Label/md', a ? 'text/primary' : 'text/muted', 'Label'));
    tabs.push(c);
  }
  const tset = combine(tabs, r, 'Tab', 240);
  REG.Tab = { set: tset, keys: props(tset, { Label: ['TEXT', 'Tab'] }) };
  bind(tset, 'Label', 'characters', REG.Tab.keys.Label);

  const steps = [];
  for (const state of ['Upcoming', 'Current', 'Done']) {
    const c = al(`State=${state}`, { component: true, gap: 10 });
    const circle = al('Circle', { w: 28, h: 28, radius: 14, justify: 'CENTER', align: 'CENTER',
      fill: state === 'Upcoming' ? 'bg/surface' : 'primary/solid', stroke: state === 'Upcoming' ? 'border/strong' : null });
    if (state === 'Done') circle.appendChild(icon('check', 'primary/on', 14));
    else circle.appendChild(await txt('1', 'Caption/strong', state === 'Current' ? 'primary/on' : 'text/muted', 'Number'));
    c.appendChild(circle);
    c.appendChild(await txt('Step', state === 'Current' ? 'Label/strong' : 'Label/md', state === 'Upcoming' ? 'text/muted' : 'text/primary', 'Label'));
    steps.push(c);
  }
  const sset = combine(steps, r, 'Step', 420);
  REG.Step = { set: sset, keys: props(sset, { Label: ['TEXT', 'Step'], Number: ['TEXT', '1'] }) };
  bind(sset, 'Label', 'characters', REG.Step.keys.Label);
  bind(sset, 'Number', 'characters', REG.Step.keys.Number);
}

async function buildCards(sec) {
  const r = row(sec, 1100);
  const c = al('Stat card', { component: true, dir: 'VERTICAL', gap: 6, pad: 20, radius: 12, w: 260, fill: 'bg/surface', stroke: 'border/default' });
  c.appendChild(await txt('Total members', 'Overline', 'text/muted', 'Label'));
  c.appendChild(await txt('1,248', 'Stat/Value', 'text/primary', 'Value'));
  c.appendChild(await txt('+12% this month', 'Caption/strong', 'status/success/fg', 'Delta'));
  r.appendChild(c);
  REG.StatCard = { comp: c, keys: props(c, { Label: ['TEXT', 'Total members'], Value: ['TEXT', '1,248'], Delta: ['TEXT', '+12% this month'] }) };
  bind(c, 'Label', 'characters', REG.StatCard.keys.Label);
  bind(c, 'Value', 'characters', REG.StatCard.keys.Value);
  bind(c, 'Delta', 'characters', REG.StatCard.keys.Delta);

  const card = al('Card', { component: true, dir: 'VERTICAL', gap: 0, radius: 12, w: 480, fill: 'bg/surface', stroke: 'border/default' });
  card.clipsContent = true;
  const head = fillX(card, al('Header', { pad: [16, 20], justify: 'SPACE_BETWEEN' }));
  sideStroke(head, 'border/default', 'Bottom');
  head.appendChild(await txt('Card title', 'Heading/H3', 'text/primary', 'Title'));
  head.appendChild(variant('Button', 'Kind=Ghost, Size=sm', { Label: 'View all' }));
  const body = fillX(card, al('Body', { dir: 'VERTICAL', pad: 20 }));
  const slot = fillX(body, al('Slot', { pad: 24, radius: 8, h: 120, fill: 'bg/sunken', justify: 'CENTER', align: 'CENTER' }));
  slot.appendChild(await txt('Content', 'Body/sm', 'text/muted', 'Hint'));
  r.appendChild(card);
  REG.Card = { comp: card, keys: props(card, { Title: ['TEXT', 'Card title'] }) };
  bind(card, 'Title', 'characters', REG.Card.keys.Title);
}

async function buildTable(sec) {
  const r = row(sec, 1240);
  const hc = al('Table/Header cell', { component: true, pad: [0, 16], w: 200, h: 40, fill: 'bg/sunken' });
  sideStroke(hc, 'border/default', 'Bottom');
  hc.appendChild(await txt('Column', 'Overline', 'text/secondary', 'Label'));
  r.appendChild(hc);
  REG.HeaderCell = { comp: hc, keys: props(hc, { Label: ['TEXT', 'Column'] }) };
  bind(hc, 'Label', 'characters', REG.HeaderCell.keys.Label);

  const cells = [];
  for (const type of ['Text', 'Primary', 'Muted', 'Mono', 'Badge', 'Actions']) {
    const c = al(`Type=${type}`, { component: true, gap: 8, pad: [0, 16], w: 200, h: 56, fill: 'bg/surface', justify: type === 'Actions' ? 'MAX' : 'MIN' });
    sideStroke(c, 'border/default', 'Bottom');
    if (type === 'Primary') {
      c.appendChild(variant('Avatar', 'Size=md'));
      const stack = al('Stack', { dir: 'VERTICAL', gap: 0 });
      stack.appendChild(await txt('Aarav Sharma', 'Label/strong', 'text/primary', 'Text'));
      stack.appendChild(await txt('aarav.sharma@bgsc.club', 'Caption/regular', 'text/muted', 'Subtext'));
      c.appendChild(stack);
    } else if (type === 'Badge') { const b = variant('Badge', 'Tone=Success', { Label: 'Active' }); b.name = 'Badge'; c.appendChild(b); }
    else if (type === 'Actions') c.appendChild(variant('IconButton', 'Kind=Ghost, Size=sm'));
    else c.appendChild(await txt({ Text: 'Cell text', Muted: '12 Oct 2026', Mono: '5,200' }[type],
      { Text: 'Body/md', Muted: 'Body/sm', Mono: 'Mono/md' }[type], type === 'Muted' ? 'text/muted' : 'text/primary', 'Text'));
    cells.push(c);
  }
  const set = combine(cells, r, 'Table/Cell', 1000);
  REG.Cell = { set, keys: props(set, { Text: ['TEXT', 'Cell text'], Subtext: ['TEXT', 'aarav.sharma@bgsc.club'] }) };
  bind(set, 'Text', 'characters', REG.Cell.keys.Text);
  bind(set, 'Subtext', 'characters', REG.Cell.keys.Subtext);

  // Example composition — shows how tables are assembled from cells.
  const cols = [['Member', 300, 'Primary'], ['Role', 140, 'Text'], ['Status', 140, 'Badge'], ['Points', 120, 'Mono'], ['Joined', 160, 'Muted'], ['', 72, 'Actions']];
  const data = [
    ['Aarav Sharma', 'aarav.sharma@bgsc.club', 'Core', ['Success', 'Active'], '5,200', '10 Jul 2025'],
    ['Rohan Mehta', 'rohan.mehta@bgsc.club', 'Member', ['Danger', 'Suspended'], '1,940', '02 Jan 2025'],
    ['Sneha Gupta', 'sneha.gupta@bgsc.club', 'User', ['Neutral', 'Active'], '0', '28 Sep 2026'],
  ];
  const table = al('Example / Users table', { dir: 'VERTICAL', gap: 0, radius: 12, stroke: 'border/default' });
  table.clipsContent = true;
  const hr = al('Header', { gap: 0 });
  for (const [label, w] of cols) {
    const h = REG.HeaderCell.comp.createInstance();
    h.setProperties({ [REG.HeaderCell.keys.Label]: label });
    h.resize(w, 40);
    hr.appendChild(h);
  }
  table.appendChild(hr);
  for (const d of data) {
    const tr = al('Row', { gap: 0 });
    cols.forEach(([, w, type], i) => {
      let cell;
      if (type === 'Primary') cell = variant('Cell', 'Type=Primary', { Text: d[0], Subtext: d[1] });
      else if (type === 'Badge') {
        cell = variant('Cell', 'Type=Badge');
        const b = cell.findOne(n => n.name === 'Badge');
        b.swapComponent(REG.Badge.set.children.find(c => c.name === 'Tone=' + d[3][0]));
        b.setProperties({ [REG.Badge.keys.Label]: d[3][1] });
      } else if (type === 'Actions') cell = variant('Cell', 'Type=Actions');
      else cell = variant('Cell', 'Type=' + type, { Text: d[i + 1] });
      cell.resize(w, 56);
      tr.appendChild(cell);
    });
    table.appendChild(tr);
  }
  sec.appendChild(table);

  const pg = al('Pagination', { component: true, gap: 12, pad: [12, 16], w: 932, justify: 'SPACE_BETWEEN', fill: 'bg/surface' });
  pg.appendChild(await txt('Showing 1–25 of 1,248', 'Body/sm', 'text/muted', 'Summary'));
  const nav = al('Controls', { gap: 8 });
  const prev = variant('IconButton', 'Kind=Secondary, Size=sm');
  prev.setProperties({ [REG.IconButton.keys.Icon]: ICON['chevron-left'].id });
  const next = variant('IconButton', 'Kind=Secondary, Size=sm');
  next.setProperties({ [REG.IconButton.keys.Icon]: ICON['chevron-right'].id });
  nav.appendChild(prev);
  nav.appendChild(await txt('Page 1 of 50', 'Label/sm', 'text/secondary', 'Page'));
  nav.appendChild(next);
  pg.appendChild(nav);
  sec.appendChild(pg);
  REG.Pagination = { comp: pg, keys: props(pg, { Summary: ['TEXT', 'Showing 1–25 of 1,248'], Page: ['TEXT', 'Page 1 of 50'] }) };
  bind(pg, 'Summary', 'characters', REG.Pagination.keys.Summary);
  bind(pg, 'Page', 'characters', REG.Pagination.keys.Page);
}

async function buildOverlays(sec) {
  const r = row(sec, 1240);

  // Modal
  const m = al('Modal', { component: true, dir: 'VERTICAL', gap: 0, w: 520, radius: 12, fill: 'bg/surface', stroke: 'border/default', shadow: true });
  m.clipsContent = true;
  const mh = fillX(m, al('Header', { pad: [16, 20], justify: 'SPACE_BETWEEN' }));
  sideStroke(mh, 'border/default', 'Bottom');
  mh.appendChild(await txt('Modal title', 'Heading/H3', 'text/primary', 'Title'));
  mh.appendChild(variant('IconButton', 'Kind=Ghost, Size=sm', { Icon: ICON['x'].id }));
  const mb = fillX(m, al('Body', { dir: 'VERTICAL', gap: 16, pad: 20 }));
  const slot = fillX(mb, al('Slot', { pad: 24, radius: 8, h: 140, fill: 'bg/sunken', justify: 'CENTER', align: 'CENTER' }));
  slot.appendChild(await txt('Content — place fields here', 'Body/sm', 'text/muted', 'Hint'));
  const mf = fillX(m, al('Footer', { pad: [14, 20], gap: 8, justify: 'MAX' }));
  sideStroke(mf, 'border/default', 'Top');
  mf.appendChild(variant('Button', 'Kind=Secondary, Size=md', { Label: 'Cancel' }));
  mf.appendChild(variant('Button', 'Kind=Primary, Size=md', { Label: 'Confirm' }));
  r.appendChild(m);
  REG.Modal = { comp: m, keys: props(m, { Title: ['TEXT', 'Modal title'] }) };
  bind(m, 'Title', 'characters', REG.Modal.keys.Title);

  // Drawer
  const d = al('Drawer', { component: true, dir: 'VERTICAL', gap: 0, w: 480, h: 760, fill: 'bg/surface', shadow: true });
  sideStroke(d, 'border/default', 'Left');
  d.clipsContent = true;
  const dh = fillX(d, al('Header', { dir: 'VERTICAL', gap: 12, pad: [20, 24, 0, 24] }));
  const top = fillX(dh, al('Top', { justify: 'SPACE_BETWEEN' }));
  top.appendChild(await txt('Drawer title', 'Heading/H2', 'text/primary', 'Title'));
  top.appendChild(variant('IconButton', 'Kind=Ghost, Size=sm', { Icon: ICON['x'].id }));
  const tabs = al('Tabs', { gap: 20 });
  tabs.appendChild(variant('Tab', 'State=Active', { Label: 'Profile' }));
  tabs.appendChild(variant('Tab', 'State=Default', { Label: 'Points' }));
  tabs.appendChild(variant('Tab', 'State=Default', { Label: 'Audit' }));
  fillX(dh, tabs);
  sideStroke(tabs, 'border/default', 'Bottom');
  const db = fillX(d, al('Body', { dir: 'VERTICAL', pad: 24 }));
  db.layoutSizingVertical = 'FILL';
  const dslot = fillX(db, al('Slot', { pad: 24, radius: 8, fill: 'bg/sunken', justify: 'CENTER', align: 'CENTER' }));
  dslot.layoutSizingVertical = 'FILL';
  dslot.appendChild(await txt('Content', 'Body/sm', 'text/muted', 'Hint'));
  const df = fillX(d, al('Footer', { pad: [14, 24], gap: 8, justify: 'MAX' }));
  sideStroke(df, 'border/default', 'Top');
  df.appendChild(variant('Button', 'Kind=Secondary, Size=md', { Label: 'Close' }));
  df.appendChild(variant('Button', 'Kind=Primary, Size=md', { Label: 'Save' }));
  r.appendChild(d);
  REG.Drawer = { comp: d, keys: props(d, { Title: ['TEXT', 'Drawer title'] }) };
  bind(d, 'Title', 'characters', REG.Drawer.keys.Title);

  // Menu
  const items = [];
  for (const state of ['Default', 'Hover', 'Selected']) {
    const c = al(`State=${state}`, { component: true, gap: 8, pad: [8, 10], radius: 6, w: 208, justify: 'SPACE_BETWEEN', fill: state === 'Default' ? null : 'bg/hover' });
    c.appendChild(await txt('Menu item', state === 'Selected' ? 'Label/strong' : 'Label/md', 'text/primary', 'Label'));
    if (state === 'Selected') c.appendChild(icon('check', 'primary/text', 16));
    items.push(c);
  }
  const mset = combine(items, r, 'Menu item', 520);
  REG.MenuItem = { set: mset, keys: props(mset, { Label: ['TEXT', 'Menu item'] }) };
  bind(mset, 'Label', 'characters', REG.MenuItem.keys.Label);
  const menu = al('Menu', { component: true, dir: 'VERTICAL', gap: 2, pad: 6, radius: 10, fill: 'bg/surface', stroke: 'border/default', shadow: true });
  for (const [label, state] of [['All roles', 'Selected'], ['Founder', 'Default'], ['Coordinator', 'Hover'], ['Core', 'Default'], ['Member', 'Default']]) {
    menu.appendChild(variant('MenuItem', 'State=' + state, { Label: label }));
  }
  r.appendChild(menu);
}

async function buildFeedback(sec) {
  const r = row(sec, 1240);
  const TONE_ICON = { Info: 'info', Success: 'check-circle', Warning: 'alert-triangle', Danger: 'alert-triangle' };

  const alerts = [];
  for (const tone of ['Info', 'Success', 'Warning', 'Danger']) {
    const t = tone.toLowerCase();
    const c = al(`Tone=${tone}`, { component: true, gap: 12, pad: [12, 16], radius: 10, w: 560, align: 'MIN', fill: `status/${t}/bg` });
    c.appendChild(icon(TONE_ICON[tone], `status/${t}/fg`, 20));
    const s = fillX(c, al('Text', { dir: 'VERTICAL', gap: 2 }));
    fillX(s, await txt('Alert title', 'Label/strong', `status/${t}/fg`, 'Title'));
    fillX(s, await txt('Supporting message that explains what happened and what to do.', 'Body/sm', 'text/primary', 'Message'));
    alerts.push(c);
  }
  const aset = combine(alerts, r, 'Alert', 1180);
  REG.Alert = { set: aset, keys: props(aset, { Title: ['TEXT', 'Alert title'], Message: ['TEXT', 'Supporting message'] }) };
  bind(aset, 'Title', 'characters', REG.Alert.keys.Title);
  bind(aset, 'Message', 'characters', REG.Alert.keys.Message);

  const toasts = [];
  for (const tone of ['Success', 'Danger', 'Info']) {
    const t = tone.toLowerCase();
    const c = al(`Tone=${tone}`, { component: true, gap: 12, pad: 14, radius: 10, w: 360, align: 'MIN', fill: 'bg/surface', stroke: 'border/default', shadow: true });
    c.appendChild(icon(TONE_ICON[tone], `status/${t}/fg`, 20));
    const s = fillX(c, al('Text', { dir: 'VERTICAL', gap: 2 }));
    fillX(s, await txt('Saved', 'Label/strong', 'text/primary', 'Title'));
    fillX(s, await txt('Event published to members.', 'Body/sm', 'text/muted', 'Message'));
    c.appendChild(icon('x', 'text/muted', 16));
    toasts.push(c);
  }
  const tset = combine(toasts, r, 'Toast', 1180);
  REG.Toast = { set: tset, keys: props(tset, { Title: ['TEXT', 'Saved'], Message: ['TEXT', 'Event published to members.'] }) };
  bind(tset, 'Title', 'characters', REG.Toast.keys.Title);
  bind(tset, 'Message', 'characters', REG.Toast.keys.Message);

  const e = al('Empty state', { component: true, dir: 'VERTICAL', gap: 12, pad: 40, w: 480, align: 'CENTER', fill: 'bg/surface', radius: 12, stroke: 'border/default' });
  const circle = al('Circle', { w: 48, h: 48, radius: 24, justify: 'CENTER', align: 'CENTER', fill: 'bg/sunken' });
  circle.appendChild(icon('inbox', 'text/muted', 24));
  e.appendChild(circle);
  e.appendChild(await txt('Nothing here yet', 'Heading/H3', 'text/primary', 'Title'));
  const desc = await txt('Create the first one to get started.', 'Body/sm', 'text/muted', 'Description');
  desc.textAlignHorizontal = 'CENTER';
  e.appendChild(desc);
  e.appendChild(variant('Button', 'Kind=Secondary, Size=sm', { Label: 'Create', 'Show icon': true }));
  r.appendChild(e);
  REG.Empty = { comp: e, keys: props(e, { Title: ['TEXT', 'Nothing here yet'], Description: ['TEXT', 'Create the first one to get started.'] }) };
  bind(e, 'Title', 'characters', REG.Empty.keys.Title);
  bind(e, 'Description', 'characters', REG.Empty.keys.Description);

  const sk = al('Skeleton row', { component: true, gap: 24, pad: [18, 16], w: 640, fill: 'bg/surface' });
  sideStroke(sk, 'border/default', 'Bottom');
  sk.appendChild(dot(32, 'bg/sunken'));
  for (const w of [180, 100, 80, 60]) sk.appendChild(rect(w, 12, 'bg/sunken', 6));
  r.appendChild(sk);
}

async function buildComponents(p) {
  const root = al('Components', { dir: 'VERTICAL', gap: 56, pad: 48, fill: 'bg/canvas' });
  p.appendChild(root);
  root.appendChild(await txt('Components', 'Display/Hero', 'text/primary', 'Title'));
  root.appendChild(await txt('Every colour is a variable — switch this frame to Dark mode to check both themes.', 'Body/md', 'text/muted', 'Intro'));

  await buildIcons(await section(root, 'Icons', 'Lucide, 24px grid, stroke 2. Instances recolour via the Vector layer stroke.'));
  await buildButtons(await section(root, 'Buttons', 'Primary = one per view. Danger for destructive confirms. Props: Label, Show icon, Icon.'));
  await buildFields(await section(root, 'Fields', 'Text, Select, Search, Textarea × Default / Focus / Error / Disabled.'));
  await buildChoices(await section(root, 'Checkbox & Toggle'));
  await buildBadges(await section(root, 'Badges, club tags, avatars', 'Status → tone mapping lives in docs/web-admin-design-plan.md §5.'));
  await buildNav(await section(root, 'Navigation', 'Sidebar nav item, tab, wizard step.'));
  await buildCards(await section(root, 'Cards'));
  await buildTable(await section(root, 'Table', 'Header cell + cell types. Example shows composition; build real tables from instances.'));
  await buildOverlays(await section(root, 'Overlays', 'Modal (520), drawer (480), menu.'));
  await buildFeedback(await section(root, 'Feedback states', 'Alert, toast, empty, loading skeleton.'));
  return root;
}

// ---------- commands ----------

async function foundations() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await tokens();
  await textStyles();
  const fp = await page('Foundations');
  await buildFoundations(fp);
  const cp = await page('Components');
  const root = await buildComponents(cp);
  await figma.setCurrentPageAsync(cp);
  figma.viewport.scrollAndZoomIntoView([root]);
}

const COMMANDS = { foundations };

(async () => {
  try {
    await (COMMANDS[figma.command] || foundations)();
    figma.closePlugin('✓ BGSC Admin: done');
  } catch (e) {
    console.error(e);
    figma.closePlugin('✗ ' + (e && e.message ? e.message : e));
  }
})();
