// Pure operations on vessel contents. Volume units are a capacity convention,
// not a mass, concentration or amount of substance.
export function transferContents(from, to) {
  const volume = from.contents.reduce((sum, c) => sum + c.amount, 0);
  const free = to.capacity - to.contents.reduce((sum, c) => sum + c.amount, 0);
  if (!(volume > 0 && free > 0)) return 0;
  const fraction = Math.min(1, free / volume);
  const moved = volume * fraction;
  for (const c of from.contents) {
    to.contents.push({ ...c, ions: c.ions ? [...c.ions] : undefined, amount: c.amount * fraction });
    c.amount *= 1 - fraction;
  }
  from.contents = from.contents.filter((c) => c.amount > 1e-9);
  return moved;
}

export function removeIons(contents, ions, reagents) {
  // Qualitative complete separation: remove participating ion types from the
  // current records, retaining spectator ions. Fresh additions remain active.
  for (const c of contents) {
    c.ions = (c.ions ?? reagents[c.id]?.ions ?? []).filter((ion) => !ions.includes(ion));
  }
}

export function extractIron(contents) {
  return contents.filter((c) => c.id !== 'fe' || c.processed);
}
