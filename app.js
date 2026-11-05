'use strict';
/* Minhas Finanças — PWA offline. Dados ficam no IndexedDB do aparelho. */

const APP_VERSION = '1.0.0';
const NICHOS = [
  { id: 'acoes',   nome: 'Ações',          cor: '--s1' },
  { id: 'imoveis', nome: 'FIIs e Terrenos', cor: '--s2' },
  { id: 'caixa',   nome: 'Caixa',          cor: '--s3' },
  { id: 'dolar',   nome: 'Dólar',          cor: '--s4' },
];
const TIPOS = {
  acao:    { nome: 'Ação',    nicho: 'acoes' },
  fii:     { nome: 'FII',     nicho: 'imoveis' },
  terreno: { nome: 'Terreno', nicho: 'imoveis' },
  caixa:   { nome: 'Caixa',   nicho: 'caixa' },
  dolar:   { nome: 'Dólar',   nicho: 'dolar' },
};
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });
const nfmt = (v, d = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const qfmt = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(v);
const money = v => brl.format(v || 0);
const pct = v => (isFinite(v) ? nfmt(v * 100, 1) : '0,0') + '%';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const mesAtual = () => hoje().slice(0, 7);
function parseNum(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').replace(/[R$US\s]/g, '').trim();
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "90.000" = noventa mil
  return Number(s);
}
const numIn = v => (v === undefined || v === null || v === '' || isNaN(v)) ? '' : String(v).replace('.', ',');
function addMeses(ym, n) { let [y, m] = ym.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; }
function addMesesData(d, n) {
  const [y, m, dd] = d.split('-').map(Number);
  const ym = addMeses(`${y}-${pad(m)}`, n);
  const [ny, nm] = ym.split('-').map(Number);
  const ult = new Date(ny, nm, 0).getDate();
  return `${ym}-${pad(Math.min(dd, ult))}`;
}
const nomeMes = ym => { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
const dataCurta = d => { const [y, m, dd] = d.split('-').map(Number); const dt = new Date(y, m - 1, dd); return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }); };
function haQuanto(ts) {
  if (!ts) return 'nunca';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

/* ---------- armazenamento (IndexedDB) ---------- */
let _db;
function idb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open('financas-db', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function load() {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function save() {
  try {
    const db = await idb();
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(S, 'state'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch (e) { toast('Erro ao salvar: ' + e.message, 5000); }
}
function estadoInicial() {
  return {
    v: 1, gastos: [], receitas: [], ativos: [],
    config: {
      token: '',
      catGastos: ['Moradia', 'Alimentação', 'Mercado', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Contas da casa', 'Vestuário', 'Impostos', 'Outros'],
      catReceitas: ['Salário', 'Pró-labore', 'Locação', 'Vendas', 'Dividendos e juros', 'Freelance', 'Outros'],
      formasPag: ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Boleto'],
      usdbrl: null, usdEm: null, ultimaCotacao: null, ultimoBackup: null,
    },
  };
}
let S = estadoInicial();
const ui = { tab: 'gastos', mes: mesAtual(), sel: null, busy: false };

/* ---------- cálculos de investimentos ---------- */
function valores(a) {
  const q = S.config.usdbrl;
  switch (a.tipo) {
    case 'acao': case 'fii': {
      const custo = (a.qtd || 0) * (a.pm || 0);
      const preco = a.precoAtual || a.pm || 0;
      return { custo, atual: (a.qtd || 0) * preco };
    }
    case 'dolar': {
      const custo = (a.usd || 0) * (a.cotCompra || 0);
      return { custo, atual: (a.usd || 0) * (q || a.cotCompra || 0) };
    }
    default: return { custo: a.valorAplicado || 0, atual: a.valorAtual ?? a.valorAplicado ?? 0 };
  }
}
function carteira() {
  const por = Object.fromEntries(NICHOS.map(n => [n.id, { atual: 0, custo: 0, itens: [] }]));
  let total = 0, custo = 0;
  for (const a of S.ativos) {
    const v = valores(a); const n = TIPOS[a.tipo].nicho;
    por[n].atual += v.atual; por[n].custo += v.custo; por[n].itens.push({ a, ...v });
    total += v.atual; custo += v.custo;
  }
  return { por, total, custo };
}

/* ---------- render ---------- */
const TITULOS = { gastos: 'Gastos', receitas: 'Receitas', invest: 'Investimentos' };
function render() {
  $('#title').textContent = TITULOS[ui.tab];
  $('#monthnav').classList.toggle('hidden', ui.tab === 'invest');
  $('#monthLabel').textContent = nomeMes(ui.mes);
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  $('#main').innerHTML = bannerBackup() + (ui.tab === 'invest' ? renderInvest() : renderFluxo(ui.tab));
}

function bannerBackup() {
  const temDados = S.gastos.length + S.receitas.length + S.ativos.length > 0;
  const ult = S.config.ultimoBackup;
  if (!temDados || (ult && Date.now() - ult < 30 * 864e5)) return '';
  return `<div class="banner"><span>${ult ? 'Seu último backup tem mais de 30 dias.' : 'Você ainda não fez backup. Se o app for apagado, os dados se perdem.'}</span><button class="btn sm" data-act="backup">Fazer backup</button></div>`;
}

function totalMes(lista, ym) { return lista.reduce((s, x) => s + (x.data.startsWith(ym) ? x.valor : 0), 0); }

function renderFluxo(kind) {
  const lista = S[kind].filter(x => x.data.startsWith(ui.mes)).sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0));
  const total = lista.reduce((s, x) => s + x.valor, 0);
  const gastos = totalMes(S.gastos, ui.mes), receitas = totalMes(S.receitas, ui.mes);
  const saldo = receitas - gastos;
  const anterior = totalMes(S[kind], addMeses(ui.mes, -1));
  let comp = '';
  if (anterior > 0) {
    const d = (total - anterior) / anterior;
    const bom = kind === 'gastos' ? d <= 0 : d >= 0;
    comp = `<span>vs mês anterior <b class="${bom ? 'pos' : 'neg'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</b></span>`;
  }
  const outro = kind === 'gastos' ? `<span>Receitas <b class="num">${money(receitas)}</b></span>` : `<span>Gastos <b class="num">${money(gastos)}</b></span>`;
  const rotulo = kind === 'gastos' ? 'Gastos de ' : 'Receitas de ';
  let h = `<section class="card hero">
    <div class="label">${rotulo}${MESES[Number(ui.mes.slice(5)) - 1]}</div>
    <div class="big num">${money(total)}</div>
    <div class="sub">${outro}<span>Saldo <b class="num ${saldo >= 0 ? 'pos' : 'neg'}">${money(saldo)}</b></span>${comp}</div>
  </section>`;

  if (!lista.length) {
    return h + `<section class="card"><div class="empty"><b>Nenhum lançamento em ${nomeMes(ui.mes)}</b>Toque no + para adicionar ${kind === 'gastos' ? 'um gasto' : 'uma receita'}.</div></section>`;
  }
  const cats = {};
  lista.forEach(x => cats[x.cat] = (cats[x.cat] || 0) + x.valor);
  const ord = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const max = ord[0][1];
  h += `<section class="card"><h3>Por categoria <small>${ord.length} ${ord.length > 1 ? 'categorias' : 'categoria'}</small></h3>` +
    ord.map(([c, v]) => `<div class="bar-row"><div class="bar-top"><span>${esc(c)}</span><span><span class="v num">${money(v)}</span><span class="p num">${pct(v / total)}</span></span></div><div class="track"><div class="fill" style="width:${Math.max(2, v / max * 100)}%${kind === 'receitas' ? ';background:var(--s2)' : ''}"></div></div></div>`).join('') +
    `</section>`;

  h += `<section class="card"><h3>Lançamentos <small>${lista.length}</small></h3>`;
  let dia = '';
  for (const x of lista) {
    if (x.data !== dia) { dia = x.data; h += `<div class="day">${dataCurta(dia)}</div>`; }
    const sub = [x.cat, x.pag].filter(Boolean).map(esc).join(' · ');
    h += `<button class="row" data-act="edit" data-kind="${kind}" data-id="${x.id}">
      <div class="ic">${esc((x.cat || '?').slice(0, 2))}</div>
      <div class="mid"><div class="t">${esc(x.desc || x.cat)}</div><div class="s">${sub}</div></div>
      <div class="r"><div class="t num ${kind === 'receitas' ? 'pos' : ''}">${kind === 'receitas' ? '+' : '−'} ${money(x.valor)}</div></div>
    </button>`;
  }
  return h + `</section>`;
}

function donutSVG(c) {
  const R = 70, W = 24, C = 2 * Math.PI * R, gap = 3;
  const ativos = NICHOS.map((n, i) => ({ ...n, i, v: c.por[n.id].atual })).filter(n => n.v > 0);
  let off = 0, segs = '';
  for (const n of ativos) {
    const len = n.v / c.total * C;
    const vis = ativos.length > 1 ? Math.max(len - gap, 0.5) : len;
    const sel = ui.sel === n.i;
    segs += `<circle class="seg" data-act="selNicho" data-i="${n.i}" r="${R}" cx="90" cy="90" fill="none" stroke="var(${n.cor})" stroke-width="${sel ? W + 6 : W}" stroke-dasharray="${vis} ${C - vis}" stroke-dashoffset="${-off}"><title>${n.nome}: ${money(n.v)} (${pct(n.v / c.total)})</title></circle>`;
    off += len;
  }
  const s = ui.sel !== null && c.por[NICHOS[ui.sel].id].atual > 0 ? NICHOS[ui.sel] : null;
  const l1 = s ? s.nome : 'Patrimônio';
  const l2 = s ? pct(c.por[s.id].atual / c.total) : compacto(c.total);
  return `<svg class="donut" viewBox="0 0 180 180" role="img" aria-label="Distribuição da carteira">
    <g transform="rotate(-90 90 90)">${segs}</g>
    <text x="90" y="84" text-anchor="middle" font-size="12" style="fill:var(--ink2)">${esc(l1)}</text>
    <text x="90" y="106" text-anchor="middle" font-size="20" font-weight="700" class="num">${esc(l2)}</text>
  </svg>`;
}
function compacto(v) {
  if (v >= 1e6) return 'R$ ' + nfmt(v / 1e6, 2) + ' mi';
  if (v >= 1e4) return 'R$ ' + nfmt(v / 1e3, 1) + ' mil';
  return money(v);
}

function renderInvest() {
  const c = carteira();
  const ganho = c.total - c.custo, gp = c.custo ? ganho / c.custo : 0;
  const q = S.config.usdbrl;
  let h = `<section class="card hero">
    <div class="label">Patrimônio investido</div>
    <div class="big num">${money(c.total)}</div>
    <div class="sub"><span>Aplicado <b class="num">${money(c.custo)}</b></span>
    <span>Resultado <b class="num ${ganho >= 0 ? 'pos' : 'neg'}">${ganho >= 0 ? '▲' : '▼'} ${money(Math.abs(ganho))} (${pct(Math.abs(gp))})</b></span></div>
  </section>`;

  const temTicker = S.ativos.some(a => a.tipo === 'acao' || a.tipo === 'fii');
  h += `<section class="card"><div class="quote">
    <div>Dólar <b class="num">${q ? 'R$ ' + nfmt(q, 4) : '—'}</b><br><small style="color:var(--muted)">Cotações ${haQuanto(S.config.ultimaCotacao)}${temTicker && !S.config.token ? ' · configure o token brapi em Ajustes' : ''}</small></div>
    <button class="btn sm sec" data-act="quotes" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '<span class="spin"></span>Atualizando' : 'Atualizar'}</button>
  </div></section>`;

  if (!S.ativos.length) {
    return h + `<section class="card"><div class="empty"><b>Nenhum investimento cadastrado</b>Toque no + para adicionar ações, FIIs, terrenos, caixa ou dólar.</div></section>`;
  }

  h += `<section class="card"><h3>Distribuição por nicho</h3><div class="donut-wrap">${donutSVG(c)}<div class="legend">` +
    NICHOS.map((n, i) => {
      const v = c.por[n.id].atual;
      return `<button class="leg ${ui.sel === i ? 'on' : ''}" data-act="selNicho" data-i="${i}"><span class="sw" style="background:var(${n.cor})"></span><span class="n">${n.nome}<span class="vv num">${money(v)}</span></span><span class="pc num">${pct(c.total ? v / c.total : 0)}</span></button>`;
    }).join('') + `</div></div></section>`;

  for (const n of NICHOS) {
    const g = c.por[n.id];
    if (!g.itens.length) continue;
    g.itens.sort((a, b) => b.atual - a.atual);
    h += `<section class="card"><h3><span><span class="sw" style="display:inline-block;background:var(${n.cor});margin-right:8px;vertical-align:-1px"></span>${n.nome}</span><small class="num">${money(g.atual)} · ${pct(c.total ? g.atual / c.total : 0)}</small></h3>`;
    for (const it of g.itens) {
      const a = it.a; const r = it.custo ? (it.atual - it.custo) / it.custo : 0;
      let titulo, sub;
      if (a.tipo === 'acao' || a.tipo === 'fii') {
        titulo = a.ticker;
        sub = `${qfmt(a.qtd)} × ${a.precoAtual ? money(a.precoAtual) : money(a.pm) + ' (PM)'}${a.atualizadoEm ? ' · ' + haQuanto(a.atualizadoEm) : ''}`;
      } else if (a.tipo === 'dolar') {
        titulo = a.nome || 'Dólar';
        sub = `${usd.format(a.usd || 0)} · PM R$ ${nfmt(a.cotCompra || 0, 2)}`;
      } else {
        titulo = a.nome || TIPOS[a.tipo].nome;
        sub = `${TIPOS[a.tipo].nome}${a.atualizadoEm ? ' · ' + new Date(a.atualizadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}`;
      }
      h += `<button class="row" data-act="editAtivo" data-id="${a.id}">
        <div class="ic">${esc(TIPOS[a.tipo].nome.slice(0, 3))}</div>
        <div class="mid"><div class="t">${esc(titulo)}</div><div class="s num">${esc(sub)}</div></div>
        <div class="r"><div class="t num">${money(it.atual)}</div><div class="s num ${r >= 0 ? 'pos' : 'neg'}">${r >= 0 ? '▲' : '▼'} ${pct(Math.abs(r))}</div></div>
      </button>`;
    }
    h += `</section>`;
  }
  return h;
}

/* ---------- bottom sheet ---------- */
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheetBody').innerHTML = ''; document.body.style.overflow = ''; }
const opts = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');

function formLanc(kind, item) {
  const novo = !item; item = item || { data: hoje(), cat: '', pag: S.config.formasPag[0] };
  const cats = kind === 'gastos' ? S.config.catGastos : S.config.catReceitas;
  const catList = item.cat && !cats.includes(item.cat) ? [...cats, item.cat] : cats;
  openSheet(`<form id="f" autocomplete="off">
    <h2>${novo ? (kind === 'gastos' ? 'Novo gasto' : 'Nova receita') : 'Editar'}<button type="button" data-act="closeSheet">Cancelar</button></h2>
    <div class="group">
      <div class="field col"><label>Valor (R$)</label><input class="bigval num" name="valor" inputmode="decimal" placeholder="0,00" value="${numIn(item.valor)}" required></div>
      <div class="field"><label>Descrição</label><input name="desc" placeholder="Opcional" value="${esc(item.desc || '')}"></div>
      <div class="field"><label>Categoria</label><select name="cat">${opts(catList, item.cat)}</select></div>
      ${kind === 'gastos' ? `<div class="field"><label>Pagamento</label><select name="pag">${opts(S.config.formasPag, item.pag)}</select></div>` : ''}
      <div class="field"><label>Data</label><input type="date" name="data" value="${item.data}" required></div>
      ${novo ? `<div class="field"><label>Repetir por</label><select name="rep">${[1, 2, 3, 6, 12, 24].map(n => `<option value="${n}">${n === 1 ? 'Não repetir' : n + ' meses'}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="actions">
      <button class="btn full" type="submit">Salvar</button>
      ${novo ? '' : `<button class="btn danger full" type="button" data-act="delLanc" data-kind="${kind}" data-id="${item.id}">Excluir lançamento</button>`}
    </div>
  </form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const valor = parseNum(fd.get('valor'));
    if (!(valor > 0)) return toast('Informe um valor maior que zero');
    const base = { valor: Math.round(valor * 100) / 100, desc: fd.get('desc').trim(), cat: fd.get('cat'), data: fd.get('data') };
    if (kind === 'gastos') base.pag = fd.get('pag');
    if (novo) {
      const rep = Number(fd.get('rep') || 1), grupo = rep > 1 ? uid() : undefined;
      for (let i = 0; i < rep; i++) S[kind].push({ ...base, id: uid(), criado: Date.now() + i, data: addMesesData(base.data, i), grupo, desc: rep > 1 ? `${base.desc || base.cat} (${i + 1}/${rep})` : base.desc });
      ui.mes = base.data.slice(0, 7);
    } else Object.assign(item, base);
    await save(); closeSheet(); render(); toast(novo ? 'Lançamento salvo' : 'Alterações salvas');
  };
}

function camposAtivo(tipo, a) {
  const f = (label, name, val, ph = '', mode = 'decimal') => `<div class="field"><label>${label}</label><input name="${name}" inputmode="${mode}" placeholder="${ph}" value="${esc(val)}"></div>`;
  if (tipo === 'acao' || tipo === 'fii') return `
    <div class="field"><label>Ticker</label><input name="ticker" placeholder="${tipo === 'fii' ? 'HGLG11' : 'PETR4'}" autocapitalize="characters" value="${esc(a.ticker || '')}" required></div>
    ${f('Quantidade', 'qtd', numIn(a.qtd), '0')}
    ${f('Preço médio (R$)', 'pm', numIn(a.pm), '0,00')}
    ${f('Preço atual (R$)', 'precoAtual', numIn(a.precoAtual), 'automático')}`;
  if (tipo === 'dolar') return `
    ${f('Descrição', 'nome', a.nome || '', 'Ex.: Conta global', 'text')}
    ${f('Quantidade (US$)', 'usd', numIn(a.usd), '0,00')}
    ${f('Cotação média de compra', 'cotCompra', numIn(a.cotCompra), '5,0000')}`;
  return `
    ${f('Nome', 'nome', a.nome || '', tipo === 'terreno' ? 'Ex.: Lote Jardim X' : 'Ex.: CDB Banco X / Tesouro Selic', 'text')}
    ${f(tipo === 'terreno' ? 'Valor de compra (R$)' : 'Valor aplicado (R$)', 'valorAplicado', numIn(a.valorAplicado), '0,00')}
    ${f(tipo === 'terreno' ? 'Valor atual estimado' : 'Saldo atual (R$)', 'valorAtual', numIn(a.valorAtual), 'igual ao aplicado')}`;
}
const DICAS = {
  acao: 'O preço atual é buscado na brapi ao tocar em Atualizar. Deixe em branco para usar o automático.',
  fii: 'O preço atual é buscado na brapi ao tocar em Atualizar. Deixe em branco para usar o automático.',
  terreno: 'Atualize o valor estimado sempre que tiver uma avaliação nova.',
  caixa: 'Conta, CDB, Tesouro Selic, reserva de emergência. Atualize o saldo quando quiser.',
  dolar: 'O valor em reais usa a cotação do dólar atualizada automaticamente.',
};

function formAtivo(a) {
  const novo = !a; a = a ? { ...a } : { tipo: 'acao' };
  let tipo = a.tipo;
  const draw = () => {
    openSheet(`<form id="f" autocomplete="off">
      <h2>${novo ? 'Novo investimento' : 'Editar investimento'}<button type="button" data-act="closeSheet">Cancelar</button></h2>
      ${novo ? `<div class="seg-ctl">${Object.entries(TIPOS).map(([k, t]) => `<button type="button" data-tipo="${k}" class="${k === tipo ? 'on' : ''}">${t.nome}</button>`).join('')}</div>` : ''}
      <div class="group">${camposAtivo(tipo, a)}</div>
      <p class="hint">${DICAS[tipo]}</p>
      <div class="actions">
        <button class="btn full" type="submit">Salvar</button>
        ${novo ? '' : `<button class="btn danger full" type="button" data-act="delAtivo" data-id="${a.id}">Excluir investimento</button>`}
      </div>
    </form>`);
    document.querySelectorAll('.seg-ctl button').forEach(b => b.onclick = () => { coletar(); tipo = b.dataset.tipo; draw(); });
    $('#f').onsubmit = submit;
  };
  const coletar = () => { const fd = new FormData($('#f')); for (const [k, v] of fd) a[k] = ['ticker', 'nome'].includes(k) ? v : parseNum(v); };
  const submit = async e => {
    e.preventDefault(); coletar();
    const o = { tipo };
    const num = k => isNaN(a[k]) ? undefined : a[k];
    if (tipo === 'acao' || tipo === 'fii') {
      o.ticker = String(a.ticker || '').toUpperCase().replace(/\s/g, '');
      o.qtd = num('qtd'); o.pm = num('pm'); o.precoAtual = num('precoAtual');
      if (!/^[A-Z0-9]{4,7}$/.test(o.ticker)) return toast('Ticker inválido. Ex.: PETR4, HGLG11');
      if (!(o.qtd > 0)) return toast('Informe a quantidade');
      if (!(o.pm >= 0)) return toast('Informe o preço médio');
    } else if (tipo === 'dolar') {
      o.nome = (a.nome || '').trim(); o.usd = num('usd'); o.cotCompra = num('cotCompra');
      if (!(o.usd > 0)) return toast('Informe a quantidade em dólares');
      if (!(o.cotCompra > 0)) return toast('Informe a cotação de compra');
    } else {
      o.nome = (a.nome || '').trim(); o.valorAplicado = num('valorAplicado'); o.valorAtual = num('valorAtual');
      if (!o.nome) return toast('Informe um nome');
      if (!(o.valorAplicado >= 0)) return toast('Informe o valor aplicado');
      if (o.valorAtual === undefined) o.valorAtual = o.valorAplicado;
    }
    let alvo;
    if (novo) { alvo = { id: uid(), ...o }; S.ativos.push(alvo); }
    else {
      alvo = S.ativos.find(x => x.id === a.id);
      const mudouValor = alvo.valorAtual !== o.valorAtual;
      const mudouPreco = alvo.precoAtual !== o.precoAtual;
      Object.assign(alvo, o);
      if ((tipo === 'terreno' || tipo === 'caixa') && mudouValor) alvo.atualizadoEm = Date.now();
      if ((tipo === 'acao' || tipo === 'fii') && mudouPreco && o.precoAtual) alvo.atualizadoEm = Date.now();
    }
    if (novo && (tipo === 'terreno' || tipo === 'caixa')) alvo.atualizadoEm = Date.now();
    await save(); closeSheet(); render(); toast('Investimento salvo');
    if ((tipo === 'acao' || tipo === 'fii') && !o.precoAtual && navigator.onLine) atualizarTicker(alvo.ticker);
  };
  draw();
}

/* ---------- cotações ---------- */
let ultimoErro = null;
async function cotacaoBrapi(ticker) {
  const tok = (S.config.token || '').trim();
  const base = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`;
  const tentar = async (url, init, tentativa = 0) => {
    const r = await fetch(url, { cache: 'no-store', ...init });
    if (r.status === 429 && tentativa < 2) { await new Promise(s => setTimeout(s, 1500 * (tentativa + 1))); return tentar(url, init, tentativa + 1); }
    return r;
  };
  let r;
  try {
    r = await tentar(tok ? `${base}?token=${encodeURIComponent(tok)}` : base);
    if (r.status === 401 && tok) r = await tentar(base, { headers: { Authorization: `Bearer ${tok}` } });
  } catch (e) {
    try { if (tok) r = await tentar(base, { headers: { Authorization: `Bearer ${tok}` } }); } catch (e2) { }
    if (!r) { ultimoErro = 'rede'; return null; }
  }
  if (!r.ok) { ultimoErro = r.status; return null; }
  try {
    const j = await r.json();
    const q = j.results && j.results[0];
    const p = q && (q.regularMarketPrice ?? q.price ?? (q.quote && q.quote.lastPrice));
    if (typeof p === 'number' && p > 0) return p;
    ultimoErro = 404; return null;
  } catch { ultimoErro = 'formato'; return null; }
}
async function cotacaoDolar() {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); const v = parseFloat(j.USDBRL && j.USDBRL.bid); if (v > 0) return v; }
  } catch { }
  const tok = (S.config.token || '').trim();
  if (tok) {
    try {
      const r = await fetch(`https://brapi.dev/api/v2/currency?currency=USD-BRL&token=${encodeURIComponent(tok)}`, { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); const v = parseFloat(j.currency && j.currency[0] && j.currency[0].bidPrice); if (v > 0) return v; }
    } catch { }
  }
  return null;
}
function msgErro(e) {
  if (e === 401) return 'token inválido ou ausente';
  if (e === 402 || e === 403) return 'seu plano brapi não libera esse ativo';
  if (e === 404) return 'ticker não encontrado';
  if (e === 429) return 'limite de requisições atingido';
  if (e === 'rede') return 'sem conexão com a brapi';
  return 'erro ' + e;
}
async function atualizarTicker(t) {
  ultimoErro = null;
  const p = await cotacaoBrapi(t);
  if (p) { S.ativos.forEach(a => { if ((a.tipo === 'acao' || a.tipo === 'fii') && a.ticker === t) { a.precoAtual = p; a.atualizadoEm = Date.now(); } }); await save(); render(); toast(`${t}: ${money(p)}`); }
  else toast(`${t}: ${msgErro(ultimoErro)}`, 4000);
}
async function atualizarCotacoes(manual) {
  if (ui.busy) return;
  if (!navigator.onLine) { if (manual) toast('Sem internet. Os valores salvos continuam valendo.'); return; }
  ui.busy = true; if (ui.tab === 'invest') render();
  const d = await cotacaoDolar();
  if (d) { S.config.usdbrl = d; S.config.usdEm = Date.now(); }
  const semToken = !(S.config.token || '').trim();
  const tickers = (!manual && semToken) ? [] : [...new Set(S.ativos.filter(a => a.tipo === 'acao' || a.tipo === 'fii').map(a => a.ticker))];
  const falhas = []; let ok = 0;
  for (const t of tickers) {
    ultimoErro = null;
    const p = await cotacaoBrapi(t);
    if (p) { ok++; S.ativos.forEach(a => { if ((a.tipo === 'acao' || a.tipo === 'fii') && a.ticker === t) { a.precoAtual = p; a.atualizadoEm = Date.now(); } }); }
    else falhas.push(`${t} (${msgErro(ultimoErro)})`);
  }
  if (d || ok) S.config.ultimaCotacao = Date.now();
  ui.busy = false; await save(); render();
  if (manual || falhas.length) {
    const partes = [];
    partes.push(d ? `Dólar R$ ${nfmt(d, 4)}` : 'Dólar não atualizado');
    if (tickers.length) partes.push(`${ok}/${tickers.length} ativos`);
    toast(partes.join(' · ') + (falhas.length ? ` · Falhou: ${falhas.join(', ')}` : ''), falhas.length ? 6000 : 2600);
  }
}

/* ---------- ajustes, backup e CSV ---------- */
function abrirAjustes() {
  const c = S.config;
  openSheet(`<h2>Ajustes<button type="button" data-act="closeSheet">OK</button></h2>
    <div class="small-cap">Cotações (brapi.dev)</div>
    <div class="group"><div class="field"><label>Token</label><input id="tok" type="password" placeholder="cole seu token" value="${esc(c.token)}" autocapitalize="off" autocorrect="off"></div></div>
    <p class="hint">Crie um token gratuito em brapi.dev/dashboard. O token fica só neste aparelho. O plano gratuito busca 1 ativo por vez, com atraso de cerca de 30 min.</p>
    <div class="actions" style="margin-bottom:6px"><button class="btn sec full" data-act="testToken">Salvar e testar token</button></div>

    <div class="small-cap">Backup</div>
    <div class="group">
      <button class="setrow blue" data-act="backup"><span>Exportar backup criptografado</span><span>${c.ultimoBackup ? 'último: ' + new Date(c.ultimoBackup).toLocaleDateString('pt-BR') : 'nunca'}</span></button>
      <button class="setrow blue" data-act="restore"><span>Restaurar backup</span><span></span></button>
      <button class="setrow blue" data-act="csv"><span>Exportar lançamentos (CSV)</span><span>sem senha</span></button>
    </div>
    <p class="hint">Salve o backup no app Arquivos ou no iCloud Drive. Sem a senha, o arquivo não pode ser aberto, nem por você.</p>

    <div class="small-cap">Categorias</div>
    <div class="group">
      <button class="setrow" data-act="editLista" data-k="catGastos"><span>Categorias de gastos</span><span>${c.catGastos.length} ›</span></button>
      <button class="setrow" data-act="editLista" data-k="catReceitas"><span>Categorias de receitas</span><span>${c.catReceitas.length} ›</span></button>
      <button class="setrow" data-act="editLista" data-k="formasPag"><span>Formas de pagamento</span><span>${c.formasPag.length} ›</span></button>
    </div>

    <div class="small-cap">Dados</div>
    <div class="group"><button class="setrow red" data-act="wipe"><span>Apagar todos os dados</span><span></span></button></div>
    <p class="hint">Minhas Finanças v${APP_VERSION} · ${S.gastos.length} gastos · ${S.receitas.length} receitas · ${S.ativos.length} investimentos</p>`);
}
const NOMES_LISTA = { catGastos: 'Categorias de gastos', catReceitas: 'Categorias de receitas', formasPag: 'Formas de pagamento' };
function editarLista(k) {
  openSheet(`<form id="f"><h2>${NOMES_LISTA[k]}<button type="button" data-act="settings">Voltar</button></h2>
    <div class="group"><div class="field col"><label>Uma por linha</label><textarea name="l" rows="10">${esc(S.config[k].join('\n'))}</textarea></div></div>
    <p class="hint">Lançamentos antigos mantêm a categoria que já tinham.</p>
    <button class="btn full" type="submit">Salvar</button></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const l = [...new Set(new FormData(e.target).get('l').split('\n').map(s => s.trim()).filter(Boolean))];
    if (!l.length) return toast('A lista não pode ficar vazia');
    S.config[k] = l; await save(); abrirAjustes(); toast('Lista salva');
  };
}

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function chave(senha, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function entregarArquivo(nome, conteudo, tipo) {
  const file = new File([conteudo], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
function formBackup() {
  openSheet(`<form id="f"><h2>Exportar backup<button type="button" data-act="closeSheet">Cancelar</button></h2>
    <div class="group">
      <div class="field"><label>Senha</label><input type="password" name="s1" autocomplete="new-password" required></div>
      <div class="field"><label>Repetir senha</label><input type="password" name="s2" autocomplete="new-password" required></div>
    </div>
    <p class="hint">Mínimo de 8 caracteres. Se você esquecer a senha, não há como recuperar o backup.</p>
    <button class="btn full" type="submit">Gerar arquivo</button></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target); const s1 = fd.get('s1'), s2 = fd.get('s2');
    if (s1.length < 8) return toast('Use pelo menos 8 caracteres');
    if (s1 !== s2) return toast('As senhas não conferem');
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const dados = new TextEncoder().encode(JSON.stringify({ ...S, config: { ...S.config } }));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(s1, salt), dados);
    const arq = JSON.stringify({ app: 'minhas-financas', formato: 1, criado: new Date().toISOString(), kdf: 'PBKDF2-SHA256-250000', salt: b64(salt), iv: b64(iv), dados: b64(ct) });
    const ok = await entregarArquivo(`financas-backup-${hoje()}.json`, arq, 'application/json');
    if (ok) { S.config.ultimoBackup = Date.now(); await save(); closeSheet(); render(); toast('Backup gerado'); }
  };
}
let arquivoRestore = null;
function formRestore() {
  arquivoRestore = null;
  openSheet(`<form id="f"><h2>Restaurar backup<button type="button" data-act="closeSheet">Cancelar</button></h2>
    <div class="group">
      <button type="button" class="setrow blue" data-act="pickFile"><span id="fname">Escolher arquivo…</span><span></span></button>
      <div class="field"><label>Senha</label><input type="password" name="s" required></div>
    </div>
    <p class="hint">Os dados atuais deste aparelho serão substituídos pelos do backup.</p>
    <button class="btn full" type="submit">Restaurar</button></form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    if (!arquivoRestore) return toast('Escolha o arquivo de backup');
    try {
      const j = JSON.parse(arquivoRestore);
      if (j.app !== 'minhas-financas') throw new Error('Arquivo não é um backup deste app');
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(j.iv) }, await chave(new FormData(e.target).get('s'), unb64(j.salt)), unb64(j.dados));
      const novo = JSON.parse(new TextDecoder().decode(pt));
      if (!Array.isArray(novo.gastos) || !Array.isArray(novo.ativos)) throw new Error('Backup inválido');
      if (!confirm(`Substituir os dados atuais por este backup?\n${novo.gastos.length} gastos · ${novo.receitas.length} receitas · ${novo.ativos.length} investimentos`)) return;
      S = migrar(novo); await save(); closeSheet(); render(); toast('Backup restaurado');
    } catch (err) {
      toast(err.name === 'OperationError' ? 'Senha incorreta' : (err.message || 'Falha ao ler o backup'), 4000);
    }
  };
}
async function exportarCSV() {
  const linhas = [['tipo', 'data', 'descricao', 'categoria', 'pagamento', 'valor']];
  const v = n => nfmt(n, 2).replace(/\./g, '');
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  S.gastos.forEach(g => linhas.push(['gasto', g.data, q(g.desc), q(g.cat), q(g.pag), v(-g.valor)]));
  S.receitas.forEach(r => linhas.push(['receita', r.data, q(r.desc), q(r.cat), '', v(r.valor)]));
  linhas.sort((a, b) => a === linhas[0] ? -1 : b === linhas[0] ? 1 : a[1].localeCompare(b[1]));
  await entregarArquivo(`financas-lancamentos-${hoje()}.csv`, '﻿' + linhas.map(l => l.join(';')).join('\n'), 'text/csv');
}
function migrar(s) {
  const d = estadoInicial();
  return { ...d, ...s, config: { ...d.config, ...(s.config || {}) }, gastos: s.gastos || [], receitas: s.receitas || [], ativos: s.ativos || [] };
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-act]');
  if (!t) return;
  if (t.dataset.tab) { ui.tab = t.dataset.tab; ui.sel = null; render(); window.scrollTo(0, 0); return; }
  const act = t.dataset.act;
  switch (act) {
    case 'prevMonth': ui.mes = addMeses(ui.mes, -1); render(); break;
    case 'nextMonth': ui.mes = addMeses(ui.mes, 1); render(); break;
    case 'add': ui.tab === 'invest' ? formAtivo() : formLanc(ui.tab); break;
    case 'edit': formLanc(t.dataset.kind, S[t.dataset.kind].find(x => x.id === t.dataset.id)); break;
    case 'delLanc': {
      const k = t.dataset.kind, item = S[k].find(x => x.id === t.dataset.id);
      let apagar = [item.id];
      if (item.grupo) {
        const futuros = S[k].filter(x => x.grupo === item.grupo && x.data >= item.data);
        if (futuros.length > 1 && confirm(`Este lançamento se repete. Excluir também os ${futuros.length - 1} seguintes?`)) apagar = futuros.map(x => x.id);
        else if (!confirm('Excluir só este lançamento?')) return;
      } else if (!confirm('Excluir este lançamento?')) return;
      S[k] = S[k].filter(x => !apagar.includes(x.id)); await save(); closeSheet(); render(); toast('Excluído');
      break;
    }
    case 'editAtivo': formAtivo(S.ativos.find(x => x.id === t.dataset.id)); break;
    case 'delAtivo':
      if (!confirm('Excluir este investimento?')) return;
      S.ativos = S.ativos.filter(x => x.id !== t.dataset.id); await save(); closeSheet(); render(); toast('Excluído');
      break;
    case 'selNicho': { const i = Number(t.dataset.i); ui.sel = ui.sel === i ? null : i; render(); break; }
    case 'quotes': atualizarCotacoes(true); break;
    case 'settings': abrirAjustes(); break;
    case 'closeSheet': closeSheet(); break;
    case 'editLista': editarLista(t.dataset.k); break;
    case 'testToken': {
      S.config.token = $('#tok').value.trim(); await save();
      if (!S.config.token) return toast('Token removido');
      if (!navigator.onLine) return toast('Token salvo. Teste quando tiver internet.');
      t.disabled = true; t.innerHTML = '<span class="spin"></span>Testando';
      ultimoErro = null;
      const p = await cotacaoBrapi('BBAS3');
      t.disabled = false; t.textContent = 'Salvar e testar token';
      toast(p ? `Token OK · BBAS3 ${money(p)}` : `Falhou: ${msgErro(ultimoErro)}`, 4000);
      break;
    }
    case 'backup': formBackup(); break;
    case 'restore': formRestore(); break;
    case 'pickFile': $('#fileIn').click(); break;
    case 'csv': exportarCSV(); break;
    case 'wipe':
      if (!confirm('Apagar TODOS os gastos, receitas e investimentos deste aparelho?')) return;
      if (!confirm('Tem certeza? Sem backup, não há como recuperar.')) return;
      S = estadoInicial(); await save(); closeSheet(); render(); toast('Dados apagados');
      break;
  }
});
$('#fileIn').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  arquivoRestore = await f.text(); const n = $('#fname'); if (n) n.textContent = f.name;
  e.target.value = '';
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
window.addEventListener('online', () => atualizarCotacoes(false));

/* ---------- início ---------- */
(async function init() {
  try { const s = await load(); if (s) S = migrar(s); } catch (e) { toast('Não foi possível abrir os dados: ' + e.message, 6000); }
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  if (S.ativos.length && (!S.config.ultimaCotacao || Date.now() - S.config.ultimaCotacao > 30 * 60000)) atualizarCotacoes(false);
})();
