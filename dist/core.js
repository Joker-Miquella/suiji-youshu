(function(root) {
  'use strict';
  const TAU = Math.PI * 2;
  const mod = x => ((x % TAU) + TAU) % TAU;
  function parseValues(values) {
    const ids = [], invalid = [], seen = new Set(); let duplicates = 0;
    values.forEach((value, i) => {
      const s = String(value ?? '').trim();
      if (!s || /^(编号|工号|学号|员工编号|学生编号|id|number)$/i.test(s)) return;
      if (!/^\d{10}$/.test(s)) { invalid.push({row:i+1, value:s}); return; }
      if (seen.has(s)) { duplicates++; return; }
      seen.add(s); ids.push(s);
    });
    return {ids, invalid, duplicates};
  }
  function fresh(ids = [], name = '') { return {version:1, all:[...ids], remaining:[...ids], display:[...ids], history:[], pending:null, canUndo:false, name, angle:0}; }
  function randomIndex(n, cryptoSource = root.crypto) {
    if (!Number.isInteger(n) || n < 1) throw Error('无可抽取编号');
    const a = new Uint32Array(1), limit = Math.floor(4294967296 / n) * n;
    do { cryptoSource.getRandomValues(a); } while (a[0] >= limit);
    return a[0] % n;
  }
  function indexAt(angle, n) { return Math.floor(mod(-angle) / (TAU / n)) % n; }
  function targetAngle(angle, index, n, turns = 7, offset = .5) {
    const target = mod(-(index + offset) * TAU / n);
    return angle + turns * TAU + mod(target - angle);
  }
  function finish(state, pool, index, angle, time = new Date().toISOString()) {
    const id = pool[index];
    return {...state, remaining:pool.filter(x => x !== id), display:[...pool], pending:id,
      history:[...state.history, {id, time}], canUndo:true, angle:mod(angle)};
  }
  function undo(state) {
    if (!state.canUndo || !state.pending) return state;
    const available = new Set([...state.remaining, state.pending]);
    const remaining = state.all.filter(x => available.has(x));
    return {...state, remaining, display:[...remaining], pending:null, history:state.history.slice(0,-1), canUndo:false, angle:0};
  }
  function validate(s) {
    if (!s || s.version !== 1 || !Array.isArray(s.all) || s.all.length > 10000 || !s.all.every(x=>typeof x==='string' && /^\d{10}$/.test(x)) || new Set(s.all).size !== s.all.length) throw Error('存档格式无效');
    if (!Array.isArray(s.remaining) || !Array.isArray(s.history) || !Array.isArray(s.display) || typeof s.canUndo !== 'boolean' || !Number.isFinite(s.angle) || typeof s.name !== 'string') throw Error('存档格式无效');
    const drawn = s.history.map(x=>x?.id), partition = [...s.remaining,...drawn];
    if (partition.length!==s.all.length || new Set(partition).size!==s.all.length || partition.some(x=>!s.all.includes(x)) || s.history.some(x=>!Number.isFinite(Date.parse(x.time)))) throw Error('存档记录不一致');
    if (s.pending!==null && s.pending!==drawn.at(-1)) throw Error('存档结果无效');
    if (s.canUndo !== (s.pending!==null)) throw Error('存档撤销状态无效');
    const expected = [...s.remaining, ...(s.pending ? [s.pending] : [])];
    if(s.display.length!==expected.length || new Set(s.display).size!==expected.length || s.display.some(x=>!expected.includes(x))) throw Error('存档转盘不一致');
    return s;
  }
  const api = {TAU,mod,parseValues,fresh,randomIndex,indexAt,targetAngle,finish,undo,validate};
  if(typeof module!=='undefined') module.exports=api; else root.Lottery=api;
})(globalThis);
