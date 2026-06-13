// GPS da Obra — app.js
// Inicializa o cliente Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let obras = [];
let editandoId = null;
let telaAtual = 'painel';

// ─── UTILITÁRIOS ────────────────────────────────────────────
function fmt(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtM(val) {
  if (!val && val !== 0) return '—';
  return 'R$ ' + (Number(val) / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
}
function calcAvanco(eap) {
  if (!eap || !eap.length) return 0;
  return eap.reduce((s, e) => s + (parseFloat(e.peso) * parseFloat(e.avanco || 0)) / 100, 0);
}
function badgeAv(pct) {
  if (pct >= 80) return 'badge-green';
  if (pct >= 40) return 'badge-blue';
  return 'badge-gray';
}
function badgeSeg(inc) {
  if (inc === 0) return 'badge-green';
  if (inc <= 2) return 'badge-amber';
  return 'badge-red';
}
function toast(msg, tipo = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast toast-' + tipo;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}
function loading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// ─── NAVEGAÇÃO ───────────────────────────────────────────────
function navegar(tela) {
  telaAtual = tela;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + tela).classList.add('active');
  document.querySelector(`.nav-btn[data-tela="${tela}"]`)?.classList.add('active');

  if (tela === 'painel') renderPainel();
  if (tela === 'obras') renderListaObras();
  if (tela === 'cadastro') initCadastro();
  if (tela === 'avanco') initAvanco();
  if (tela === 'segqual') initSegQual();
}

// ─── CARREGAMENTO INICIAL ────────────────────────────────────
async function carregarTudo() {
  loading(true);
  try {
    const { data: obrasData, error } = await db.from('obras').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    obras = obrasData || [];

    // Carregar EAP de todas as obras
    for (const o of obras) {
      const { data: eap } = await db.from('eap_itens').select('*').eq('obra_id', o.id).order('ordem');
      o.eap = eap || [];
      const { data: qual } = await db.from('qualidade').select('*').eq('obra_id', o.id).order('created_at', { ascending: false }).limit(1);
      o.qualidade = qual?.[0] || null;
      const { data: seg } = await db.from('seguranca').select('*').eq('obra_id', o.id).order('created_at', { ascending: false }).limit(1);
      o.seguranca = seg?.[0] || null;
    }

    renderPainel();
    popularSelects();
  } catch (e) {
    toast('Erro ao carregar dados: ' + e.message, 'error');
  }
  loading(false);
}

// ─── PAINEL RESUMO ───────────────────────────────────────────
function renderPainel() {
  const cont = document.getElementById('painel-content');
  if (!obras.length) {
    cont.innerHTML = `<div class="empty-state">
      <i class="ti ti-building" style="font-size:40px;display:block;margin-bottom:12px"></i>
      Nenhuma obra cadastrada ainda.<br>
      <button class="btn-primary" style="margin-top:16px" onclick="navegar('cadastro')">+ Cadastrar primeira obra</button>
    </div>`;
    return;
  }

  const totalValor = obras.reduce((s, o) => s + parseFloat(o.valor || 0), 0);
  const totalCusto = obras.reduce((s, o) => s + parseFloat(o.custo_realizado || 0), 0);
  const avgAvanco = obras.length ? obras.reduce((s, o) => s + calcAvanco(o.eap || []), 0) / obras.length : 0;
  const totalInc = obras.reduce((s, o) => s + (o.seguranca?.incidentes || 0), 0);
  const avgQual = obras.filter(o => o.qualidade).length
    ? obras.filter(o => o.qualidade).reduce((s, o) => s + parseFloat(o.qualidade.media || 0), 0) / obras.filter(o => o.qualidade).length
    : null;

  cont.innerHTML = `
    <div class="grid-4" style="margin-bottom:16px">
      <div class="metric-card">
        <div class="metric-label">Valor total do portfólio</div>
        <div class="metric-value">${fmtM(totalValor)}</div>
        <div class="metric-sub">${obras.length} obra${obras.length !== 1 ? 's' : ''} ativa${obras.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avanço físico médio</div>
        <div class="metric-value">${avgAvanco.toFixed(1)}%</div>
        <div class="metric-sub">Média ponderada EAP</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Custo realizado</div>
        <div class="metric-value">${fmtM(totalCusto)}</div>
        <div class="metric-sub">${totalValor > 0 ? ((totalCusto / totalValor) * 100).toFixed(1) : 0}% do orçamento total</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Qualidade média</div>
        <div class="metric-value">${avgQual !== null ? avgQual.toFixed(2) + ' / 5' : '—'}</div>
        <div class="metric-sub">Incidentes de segurança: ${totalInc}</div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">Obras em andamento</div>
      <table class="obras-table">
        <thead><tr>
          <th>Empreendimento</th>
          <th>Valor total</th>
          <th style="min-width:130px">Avanço físico</th>
          <th>Custo realizado</th>
          <th>Qualidade</th>
          <th>Segurança</th>
        </tr></thead>
        <tbody>
          ${obras.map(o => {
            const av = calcAvanco(o.eap || []);
            const pctCusto = o.valor > 0 ? ((o.custo_realizado / o.valor) * 100).toFixed(1) : '0.0';
            const segLabel = o.seguranca ? (o.seguranca.incidentes === 0 ? 'Ótima' : o.seguranca.incidentes <= 2 ? 'Regular' : 'Atenção') : '—';
            return `<tr>
              <td><strong>${o.nome}</strong><br><span style="color:var(--color-text-secondary);font-size:11px">${o.local || ''} ${o.tipo ? '· ' + o.tipo : ''}</span></td>
              <td>R$ ${fmt(o.valor)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${Math.min(av,100)}%"></div></div>
                  <span style="font-size:12px;font-weight:500;min-width:32px">${av.toFixed(1)}%</span>
                </div>
              </td>
              <td>R$ ${fmt(o.custo_realizado)} <span style="color:var(--color-text-secondary);font-size:11px">(${pctCusto}%)</span></td>
              <td>${o.qualidade ? `<span class="badge ${o.qualidade.media >= 4 ? 'badge-green' : o.qualidade.media >= 3 ? 'badge-amber' : 'badge-red'}">${parseFloat(o.qualidade.media).toFixed(1)}</span>` : '<span class="badge badge-gray">—</span>'}</td>
              <td><span class="badge ${badgeSeg(o.seguranca?.incidentes ?? -1)}">${segLabel}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── LISTA DE OBRAS ──────────────────────────────────────────
function renderListaObras() {
  const cont = document.getElementById('obras-lista');
  if (!obras.length) {
    cont.innerHTML = `<div class="empty-state"><i class="ti ti-building" style="font-size:40px;display:block;margin-bottom:12px"></i>Nenhuma obra cadastrada.</div>`;
    return;
  }
  cont.innerHTML = obras.map(o => {
    const av = calcAvanco(o.eap || []);
    const pctCusto = o.valor > 0 ? ((o.custo_realizado / o.valor) * 100).toFixed(1) : '0.0';
    return `<div class="obra-card">
      <div class="obra-card-header">
        <div>
          <div class="obra-card-title">${o.nome}</div>
          <div class="obra-card-sub">${o.local || '—'} ${o.tipo ? '· ' + o.tipo : ''} ${o.responsavel ? '· ' + o.responsavel : ''}</div>
        </div>
        <span class="badge ${badgeAv(av)}">${av.toFixed(1)}% concluído</span>
      </div>
      <div style="margin-bottom:8px"><div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${Math.min(av,100)}%"></div></div></div>
      <div class="mini-grid">
        <div class="mini-metric"><div class="mini-label">Valor total</div><div class="mini-val">${fmtM(o.valor)}</div></div>
        <div class="mini-metric"><div class="mini-label">Custo realizado</div><div class="mini-val">${pctCusto}%</div></div>
        <div class="mini-metric"><div class="mini-label">Qualidade</div><div class="mini-val">${o.qualidade ? parseFloat(o.qualidade.media).toFixed(1) + '/5' : '—'}</div></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button style="font-size:11px;padding:4px 10px" onclick="irAvanco('${o.id}')"><i class="ti ti-chart-bar"></i> Avanço</button>
        <button style="font-size:11px;padding:4px 10px" onclick="irSegQual('${o.id}')"><i class="ti ti-shield"></i> Qual/Seg</button>
        <button style="font-size:11px;padding:4px 10px" onclick="editarObra('${o.id}')"><i class="ti ti-edit"></i> Editar</button>
        <button style="font-size:11px;padding:4px 10px;color:#A32D2D" onclick="excluirObra('${o.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

// ─── CADASTRO ────────────────────────────────────────────────
function initCadastro() {
  if (!editandoId) limparFormCadastro();
  renderEapForm();
}

function renderEapForm() {
  const tbody = document.getElementById('eap-tbody');
  if (!tbody) return;
  tbody.innerHTML = EAP_PADRAO.map((e, i) => `
    <tr>
      <td style="font-size:12px"><span style="color:var(--color-text-secondary);margin-right:6px">${e.codigo}</span>${e.nome}</td>
      <td><input type="number" class="peso-input" data-cod="${e.codigo}" min="0" max="100" step="0.1" placeholder="0" style="width:70px" oninput="atualizarTotalPeso()"></td>
      <td><input type="number" class="orcado-input" data-cod="${e.codigo}" min="0" step="100" placeholder="0" style="width:90px"></td>
      <td><input type="number" class="prazo-input" data-cod="${e.codigo}" min="0" placeholder="0" style="width:70px"></td>
    </tr>`).join('');
}

function atualizarTotalPeso() {
  let total = 0;
  document.querySelectorAll('.peso-input').forEach(i => { total += parseFloat(i.value) || 0; });
  const el = document.getElementById('total-peso');
  if (!el) return;
  el.textContent = total.toFixed(1) + '%';
  el.style.color = Math.abs(total - 100) < 0.1 ? '#3B6D11' : total > 100 ? '#A32D2D' : 'var(--color-text-primary)';
}

function limparFormCadastro() {
  ['f-nome','f-local','f-valor','f-inicio','f-fim','f-resp','f-desc'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const tipo = document.getElementById('f-tipo'); if (tipo) tipo.value = '';
  editandoId = null;
  renderEapForm();
}

async function salvarObra() {
  const nome = document.getElementById('f-nome').value.trim();
  const valor = parseFloat(document.getElementById('f-valor').value) || 0;
  if (!nome) { toast('Informe o nome da obra.', 'error'); return; }

  let totalPeso = 0;
  document.querySelectorAll('.peso-input').forEach(i => { totalPeso += parseFloat(i.value) || 0; });
  if (Math.abs(totalPeso - 100) > 1) {
    if (!confirm(`Total dos pesos é ${totalPeso.toFixed(1)}%. Salvar assim mesmo?`)) return;
  }

  loading(true);
  try {
    const obraData = {
      nome,
      local: document.getElementById('f-local').value.trim(),
      valor,
      inicio: document.getElementById('f-inicio').value || null,
      fim: document.getElementById('f-fim').value || null,
      responsavel: document.getElementById('f-resp').value.trim(),
      tipo: document.getElementById('f-tipo').value,
      descricao: document.getElementById('f-desc').value.trim(),
    };

    let obraId = editandoId;
    if (editandoId) {
      await db.from('obras').update(obraData).eq('id', editandoId);
      await db.from('eap_itens').delete().eq('obra_id', editandoId);
    } else {
      const { data, error } = await db.from('obras').insert(obraData).select().single();
      if (error) throw error;
      obraId = data.id;
    }

    const eapItens = EAP_PADRAO.map((e, i) => ({
      obra_id: obraId,
      codigo: e.codigo,
      nome: e.nome,
      peso: parseFloat(document.querySelector(`.peso-input[data-cod="${e.codigo}"]`)?.value) || 0,
      orcado: parseFloat(document.querySelector(`.orcado-input[data-cod="${e.codigo}"]`)?.value) || 0,
      prazo_dias: parseInt(document.querySelector(`.prazo-input[data-cod="${e.codigo}"]`)?.value) || 0,
      avanco: 0,
      executado: 0,
      ordem: i + 1,
    }));

    const { error: eapError } = await db.from('eap_itens').insert(eapItens);
    if (eapError) throw eapError;

    toast(`Obra "${nome}" ${editandoId ? 'atualizada' : 'cadastrada'} com sucesso!`);
    editandoId = null;
    await carregarTudo();
    navegar('obras');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'error');
  }
  loading(false);
}

async function editarObra(id) {
  const o = obras.find(ob => ob.id === id);
  if (!o) return;
  editandoId = id;
  navegar('cadastro');
  setTimeout(() => {
    document.getElementById('f-nome').value = o.nome || '';
    document.getElementById('f-local').value = o.local || '';
    document.getElementById('f-valor').value = o.valor || '';
    document.getElementById('f-inicio').value = o.inicio || '';
    document.getElementById('f-fim').value = o.fim || '';
    document.getElementById('f-resp').value = o.responsavel || '';
    document.getElementById('f-tipo').value = o.tipo || '';
    document.getElementById('f-desc').value = o.descricao || '';
    (o.eap || []).forEach(e => {
      const pi = document.querySelector(`.peso-input[data-cod="${e.codigo}"]`); if (pi) pi.value = e.peso || '';
      const oi = document.querySelector(`.orcado-input[data-cod="${e.codigo}"]`); if (oi) oi.value = e.orcado || '';
      const pri = document.querySelector(`.prazo-input[data-cod="${e.codigo}"]`); if (pri) pri.value = e.prazo_dias || '';
    });
    atualizarTotalPeso();
  }, 100);
}

async function excluirObra(id) {
  const o = obras.find(ob => ob.id === id);
  if (!confirm(`Excluir a obra "${o?.nome}"? Esta ação não pode ser desfeita.`)) return;
  loading(true);
  await db.from('obras').delete().eq('id', id);
  await carregarTudo();
  renderListaObras();
  loading(false);
  toast('Obra excluída.');
}

// ─── AVANÇO ──────────────────────────────────────────────────
function initAvanco() {
  popularSelects();
  document.getElementById('avanco-area').innerHTML = '';
  document.getElementById('avanco-save-btn').style.display = 'none';
}

function irAvanco(id) {
  navegar('avanco');
  setTimeout(() => {
    document.getElementById('av-obra-sel').value = id;
    carregarEapAvanco();
  }, 100);
}

function carregarEapAvanco() {
  const id = document.getElementById('av-obra-sel').value;
  const area = document.getElementById('avanco-area');
  const saveBtn = document.getElementById('avanco-save-btn');
  if (!id) { area.innerHTML = ''; saveBtn.style.display = 'none'; return; }
  const o = obras.find(ob => ob.id === id);
  if (!o) return;
  saveBtn.style.display = 'flex';
  area.innerHTML = `<div class="card">
    <div class="sec-title">EAP — ${o.nome}</div>
    <p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px">Informe o % de avanço real e o valor executado de cada etapa.</p>
    <div style="overflow-x:auto">
    <table class="obras-table">
      <thead><tr>
        <th>Etapa</th><th>Peso (%)</th><th>Avanço real (%)</th><th>Executado (R$)</th><th>Contribuição</th>
      </tr></thead>
      <tbody>
        ${(o.eap || []).map(e => `<tr>
          <td style="font-size:12px"><span style="color:var(--color-text-secondary);margin-right:4px">${e.codigo}</span>${e.nome}</td>
          <td style="font-size:12px;color:var(--color-text-secondary)">${parseFloat(e.peso||0).toFixed(1)}%</td>
          <td><input type="number" class="av-real-input" data-id="${e.id}" min="0" max="100" step="0.1" value="${e.avanco||0}" style="width:70px" oninput="recalcGlobal('${o.id}',this,'${e.id}')"></td>
          <td><input type="number" class="exec-real-input" data-id="${e.id}" min="0" step="100" value="${e.executado||0}" style="width:100px"></td>
          <td id="contrib-${e.id}" style="font-size:12px;color:var(--color-text-secondary)">${(parseFloat(e.peso||0)*parseFloat(e.avanco||0)/100).toFixed(2)}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:0.5px solid var(--color-border-tertiary);margin-top:4px">
      <span style="font-size:12px;color:var(--color-text-secondary)">Avanço físico global</span>
      <span id="avanco-global" style="font-size:18px;font-weight:500;color:#185FA5">${calcAvanco(o.eap||[]).toFixed(1)}%</span>
    </div>
  </div>`;
}

function recalcGlobal(obraId, input, eapId) {
  const o = obras.find(ob => ob.id === obraId);
  if (!o) return;
  const etapa = o.eap.find(e => e.id === eapId);
  if (etapa) etapa.avanco = parseFloat(input.value) || 0;
  const contrib = document.getElementById('contrib-' + eapId);
  if (contrib && etapa) contrib.textContent = (parseFloat(etapa.peso||0) * parseFloat(etapa.avanco||0) / 100).toFixed(2) + '%';
  const globEl = document.getElementById('avanco-global');
  if (globEl) globEl.textContent = calcAvanco(o.eap).toFixed(1) + '%';
}

async function salvarAvanco() {
  const id = document.getElementById('av-obra-sel').value;
  if (!id) return;
  const o = obras.find(ob => ob.id === id);
  if (!o) return;
  loading(true);
  try {
    let custoTotal = 0;
    for (const e of o.eap) {
      const av = parseFloat(document.querySelector(`.av-real-input[data-id="${e.id}"]`)?.value) || 0;
      const exec = parseFloat(document.querySelector(`.exec-real-input[data-id="${e.id}"]`)?.value) || 0;
      e.avanco = av; e.executado = exec;
      custoTotal += exec;
      await db.from('eap_itens').update({ avanco: av, executado: exec }).eq('id', e.id);
    }
    await db.from('obras').update({ custo_realizado: custoTotal }).eq('id', id);
    o.custo_realizado = custoTotal;
    toast('Avanço salvo com sucesso!');
    await carregarTudo();
    navegar('obras');
  } catch (e) {
    toast('Erro ao salvar avanço: ' + e.message, 'error');
  }
  loading(false);
}

// ─── QUALIDADE & SEGURANÇA ───────────────────────────────────
function initSegQual() {
  popularSelects();
  const pm = new Date().toISOString().slice(0, 7);
  const p1 = document.getElementById('sq-periodo'); if (p1 && !p1.value) p1.value = pm;
}

function irSegQual(id) {
  navegar('segqual');
  setTimeout(() => { document.getElementById('sq-obra-sel').value = id; }, 100);
}

function calcMediaQual() {
  const ids = ['q-materiais','q-execucao','q-conformidade','q-prazo','q-acabamento'];
  const vals = ids.map(id => parseFloat(document.getElementById(id)?.value) || 0);
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const el = document.getElementById('q-media');
  if (el) el.textContent = media.toFixed(2) + ' / 5';
}

async function salvarSegQual() {
  const id = document.getElementById('sq-obra-sel').value;
  const periodo = document.getElementById('sq-periodo').value;
  if (!id) { toast('Selecione uma obra.', 'error'); return; }
  if (!periodo) { toast('Informe o período.', 'error'); return; }

  const vals = ['materiais','execucao','conformidade','prazo','acabamento'].map(k => parseFloat(document.getElementById('q-' + k)?.value) || 0);
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;

  loading(true);
  try {
    await db.from('qualidade').insert({
      obra_id: id, periodo,
      materiais: vals[0], execucao: vals[1], conformidade: vals[2], prazo: vals[3], acabamento: vals[4],
      media: parseFloat(media.toFixed(2)),
    });
    await db.from('seguranca').insert({
      obra_id: id, periodo,
      incidentes: parseInt(document.getElementById('s-incidentes')?.value) || 0,
      afastamentos: parseInt(document.getElementById('s-afastamento')?.value) || 0,
      dias_sem_acidente: parseInt(document.getElementById('s-dias')?.value) || 0,
      treinamentos: parseInt(document.getElementById('s-treinamentos')?.value) || 0,
      trabalhadores_treinados: parseInt(document.getElementById('s-trabalhadores')?.value) || 0,
      observacoes: document.getElementById('s-obs')?.value || '',
    });
    toast('Qualidade e segurança salvos!');
    await carregarTudo();
    navegar('painel');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'error');
  }
  loading(false);
}

// ─── SELECTS ─────────────────────────────────────────────────
function popularSelects() {
  ['av-obra-sel','sq-obra-sel'].forEach(sid => {
    const sel = document.getElementById(sid);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Selecionar obra...</option>' + obras.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
    if (cur) sel.value = cur;
  });
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  carregarTudo();
  // listeners qualidade
  ['q-materiais','q-execucao','q-conformidade','q-prazo','q-acabamento'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcMediaQual);
  });
});
