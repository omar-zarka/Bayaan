// @ai-generated
import {resources, namespaces} from '../resources';

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /{{\s*([\w.]+)\s*(?:,[^}]*)?}}/g;

type Tree = {[key: string]: string | Tree};

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[path] = value;
    } else {
      Object.assign(out, flatten(value, path));
    }
  }
  return out;
}

/** Groups keys by base key, merging plural variants. */
function group(flat: Record<string, string>) {
  const groups = new Map<string, {plural: boolean; values: string[]}>();
  for (const [key, value] of Object.entries(flat)) {
    const plural = PLURAL_SUFFIX.test(key);
    const base = key.replace(PLURAL_SUFFIX, '');
    const entry = groups.get(base) ?? {plural, values: []};
    entry.plural = entry.plural || plural;
    entry.values.push(value);
    groups.set(base, entry);
  }
  return groups;
}

function placeholders(values: string[], ignoreCount: boolean): string[] {
  const names = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(PLACEHOLDER)) {
      if (!(ignoreCount && match[1] === 'count')) names.add(match[1]);
    }
  }
  return [...names].sort();
}

describe.each(namespaces)('locale namespace "%s"', ns => {
  const en = group(flatten(resources.en[ns] as Tree));
  const ar = group(flatten(resources.ar[ns] as Tree));

  it('has the same keys in English and Arabic', () => {
    expect([...ar.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('has no empty strings', () => {
    for (const groups of [en, ar]) {
      for (const [key, {values}] of groups) {
        for (const value of values) {
          expect({key, empty: value.trim() === ''}).toEqual({
            key,
            empty: false,
          });
        }
      }
    }
  });

  it('uses the same interpolation variables', () => {
    for (const [key, enEntry] of en) {
      const arEntry = ar.get(key);
      if (!arEntry) continue;
      const ignoreCount = enEntry.plural;
      expect({key, vars: placeholders(arEntry.values, ignoreCount)}).toEqual({
        key,
        vars: placeholders(enEntry.values, ignoreCount),
      });
    }
  });

  it('defines an _other form for every plural key', () => {
    const flatAr = flatten(resources.ar[ns] as Tree);
    const flatEn = flatten(resources.en[ns] as Tree);
    for (const [key, {plural}] of en) {
      if (!plural) continue;
      expect({key, en: `${key}_other` in flatEn}).toEqual({key, en: true});
      expect({key, ar: `${key}_other` in flatAr}).toEqual({key, ar: true});
    }
  });
});
