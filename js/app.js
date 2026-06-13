// GPS da Obra — app.js v2.0

// ─── ESTADO GLOBAL ───────────────────────────
let obras    = [];
let empresa  = null;
let editandoId = null;
let telaAtual  = 'painel';
let obraDetalheAtual = null;

// ─── UTILITÁRIOS ─────────────────────────────
function fmt(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtM(val) {
  const n = Number(val || 0);
  if (n >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
  if (n >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'K';
  return 'R$ ' + fmt(n);
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
  if (inc <= 2)  return 'badge-amber';
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
function perfil() { return window._sessao?.perfil; }
function pode(acao) { return podefazer(acao); }

// ─── AUTH: TELA DE LOGIN ─────────────────────
function mostrarLogin() {
  document.getElementById('app-wrapper').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}
function mostrarApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'flex';
}

async function fazerLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const senha = document.getElementById('auth-senha').value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('auth-erro');
  err.textContent = '';
  if (!email || !senha) { err.textContent = 'Preencha e-mail e senha.'; return; }
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  btn.disabled = false;
  btn.textContent = 'Entrar';
  if (error) { err.textContent = 'E-mail ou senha inválidos.'; }
}

async function fazerLogout() {
  await db.auth.signOut();
  window._sessao = null;
  mostrarLogin();
}

// ─── INICIALIZAÇÃO AUTH ───────────────────────
db.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    await carregarSessao(session.user);
  } else {
    mostrarLogin();
  }
});

async function carregarSessao(user) {
  loading(true);
  const { data: p } = await db.from('perfis').select('*').eq('user_id', user.id).single();
  if (!p) {
    loading(false);
    toast('Perfil não encontrado. Fale com o administrador.', 'error');
    await db.auth.signOut();
    mostrarLogin();
    return;
  }
  window._sessao = { ...p, user };
  renderSidebarUsuario();
  renderMenuPerfil();
  await carregarTudo();
  mostrarApp();
  loading(false);
}

// ─── CARREGAR DADOS ───────────────────────────
async function carregarTudo() {
  loading(true);
  try {
    // Empresa
    if (perfil() === 'master_sistema') {
      // Master vê tudo — carrega lista de empresas para seleção
      const { data } = await db.from('empresas').select('*').eq('ativa', true).order('nome');
      window._todasEmpresas = data || [];
      empresa = data?.[0] || null;
    } else {
      const empId = window._sessao.empresa_id;
      if (empId) {
        const { data } = await db.from('empresas').select('*').eq('id', empId).single();
        empresa = data;
      }
    }

    // Obras
    let query = db.from('obras').select('*').order('created_at', { ascending: false });
    if (perfil() === 'residente') {
      // Residente vê apenas obras vinculadas
      const { data: ous } = await db.from('obras_usuarios').select('obra_id').eq('user_id', window._sessao.user_id);
      const ids = (ous || []).map(o => o.obra_id);
      if (!ids.length) { obras = []; renderPainel(); loading(false); return; }
      query = query.in('id', ids);
    } else if (perfil() !== 'master_sistema') {
      query = query.eq('empresa_id', window._sessao.empresa_id);
    }
    const { data: obrasData, error } = await query;
    if (error) throw error;
    obras = obrasData || [];

    for (const o of obras) {
      const { data: eap }  = await db.from('eap_itens').select('*').eq('obra_id', o.id).order('ordem');
      const { data: qual } = await db.from('qualidade').select('*').eq('obra_id', o.id).order('created_at', { ascending: false }).limit(1);
      const { data: seg }  = await db.from('seguranca').select('*').eq('obra_id', o.id).order('created_at', { ascending: false }).limit(1);
      o.eap        = eap || [];
      o.qualidade  = qual?.[0] || null;
      o.seguranca  = seg?.[0] || null;
    }

    renderPainel();
    popularSelects();
    atualizarEmpresaHeader();
  } catch (e) {
    toast('Erro ao carregar dados: ' + e.message, 'error');
  }
  loading(false);
}

function atualizarEmpresaHeader() {
  const el = document.getElementById('empresa-nome-header');
  if (el) el.textContent = empresa?.nome || 'GPS da Obra';
}

// ─── SIDEBAR ─────────────────────────────────
function renderSidebarUsuario() {
  const s = window._sessao;
  const el = document.getElementById('sidebar-usuario');
  if (!el) return;
  const pConf = PERMISSOES[s.perfil];
  el.innerHTML = `
    <div class="sidebar-user-info">
      <div class="sidebar-user-name">${s.nome}</div>
      <span class="badge ${pConf?.badge || 'badge-gray'}" style="font-size:10px">${pConf?.label || s.perfil}</span>
    </div>
    <button class="btn-logout" onclick="fazerLogout()" title="Sair"><i class="ti ti-logout"></i></button>`;
}

function renderMenuPerfil() {
  const p = perfil();
  // Mostrar/ocultar itens de menu baseado no perfil
  const itens = {
    'nav-painel':   true,
    'nav-obras':    true,
    'nav-cadastro': pode('criarObra'),
    'nav-avanco':   pode('lancarAvanco'),
    'nav-segqual':  pode('lancarQualidade'),
    'nav-usuarios': pode('gerenciarUsuarios'),
    'nav-empresas': p === 'master_sistema',
  };
  Object.entries(itens).forEach(([id, visivel]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visivel ? 'flex' : 'none';
  });
}

// ─── NAVEGAÇÃO ────────────────────────────────
function navegar(tela, params = {}) {
  telaAtual = tela;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const screenEl = document.getElementById('screen-' + tela);
  if (screenEl) screenEl.classList.add('active');
  document.querySelector(`.nav-btn[data-tela="${tela}"]`)?.classList.add('active');

  if (tela === 'painel')    renderPainel();
  if (tela === 'obras')     renderListaObras();
  if (tela === 'cadastro')  initCadastro();
  if (tela === 'avanco')    initAvanco(params.obraId);
  if (tela === 'segqual')   initSegQual(params.obraId);
  if (tela === 'detalhe')   renderDetalheObra(params.obraId);
  if (tela === 'usuarios')  renderUsuarios();
  if (tela === 'empresas')  renderEmpresas();
}

// ─── PAINEL ───────────────────────────────────
function renderPainel() {
  const cont = document.getElementById('painel-content');
  if (!cont) return;
  if (!obras.length) {
    cont.innerHTML = `<div class="empty-state">
      <i class="ti ti-building" style="font-size:40px;display:block;margin-bottom:12px"></i>
      Nenhuma obra cadastrada ainda.<br>
      ${pode('criarObra') ? `<button class="btn-primary" style="margin-top:16px" onclick="navegar('cadastro')">+ Cadastrar primeira obra</button>` : ''}
    </div>`;
    return;
  }

  const totalValor  = obras.reduce((s, o) => s + parseFloat(o.valor || 0), 0);
  const totalCusto  = obras.reduce((s, o) => s + parseFloat(o.custo_realizado || 0), 0);
  const avgAvanco   = obras.reduce((s, o) => s + calcAvanco(o.eap || []), 0) / obras.length;
  const totalInc    = obras.reduce((s, o) => s + (o.seguranca?.incidentes || 0), 0);
  const qualObras   = obras.filter(o => o.qualidade);
  const avgQual     = qualObras.length ? qualObras.reduce((s, o) => s + parseFloat(o.qualidade.media || 0), 0) / qualObras.length : null;
  const obrasExec   = obras.filter(o => o.status === 'execucao' || !o.status).length;

  cont.innerHTML = `
    <div class="grid-4" style="margin-bottom:16px">
      <div class="metric-card">
        <div class="metric-label">Portfólio total</div>
        <div class="metric-value">${fmtM(totalValor)}</div>
        <div class="metric-sub">${obras.length} obra${obras.length !== 1 ? 's' : ''} · ${obrasExec} em execução</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avanço físico médio</div>
        <div class="metric-value">${avgAvanco.toFixed(1)}%</div>
        <div class="metric-sub">Média ponderada EAP</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Custo realizado</div>
        <div class="metric-value">${fmtM(totalCusto)}</div>
        <div class="metric-sub">${totalValor > 0 ? ((totalCusto / totalValor) * 100).toFixed(1) : 0}% do orçamento</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Qualidade média</div>
        <div class="metric-value">${avgQual !== null ? avgQual.toFixed(2) + ' / 5' : '—'}</div>
        <div class="metric-sub">Incidentes: ${totalInc}</div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title"><i class="ti ti-building"></i>Empreendimentos</div>
      <table class="obras-table">
        <thead><tr>
          <th>Empreendimento</th>
          <th>Status</th>
          <th style="min-width:130px">Avanço físico</th>
          <th>Valor total</th>
          <th>Custo realizado</th>
          <th>Qualidade</th>
          <th>Segurança</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${obras.map(o => {
            const av       = calcAvanco(o.eap || []);
            const pctCusto = o.valor > 0 ? ((o.custo_realizado / o.valor) * 100).toFixed(1) : '0.0';
            const segInc   = o.seguranca?.incidentes ?? -1;
            const segLabel = segInc < 0 ? '—' : segInc === 0 ? 'Ótima' : segInc <= 2 ? 'Regular' : 'Atenção';
            const statusBadge = {
              execucao: 'badge-blue', planejamento: 'badge-amber',
              paralisada: 'badge-red', concluida: 'badge-green'
            }[o.status || 'execucao'];
            const statusLabel = {
              execucao: 'Em execução', planejamento: 'Planejamento',
              paralisada: 'Paralisada', concluida: 'Concluída'
            }[o.status || 'execucao'];
            return `<tr style="cursor:pointer" onclick="navegar('detalhe',{obraId:'${o.id}'})">
              <td>
                <strong>${o.nome}</strong>
                <br><span style="color:var(--color-text3);font-size:11px">${o.local || ''} ${o.tipo ? '· ' + o.tipo : ''}</span>
              </td>
              <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${Math.min(av, 100)}%"></div></div>
                  <span style="font-size:12px;font-weight:500;min-width:34px">${av.toFixed(1)}%</span>
                </div>
              </td>
              <td>R$ ${fmt(o.valor)}</td>
              <td>R$ ${fmt(o.custo_realizado)} <span style="color:var(--color-text3);font-size:11px">(${pctCusto}%)</span></td>
              <td>${o.qualidade
                ? `<span class="badge ${o.qualidade.media >= 4 ? 'badge-green' : o.qualidade.media >= 3 ? 'badge-amber' : 'badge-red'}">${parseFloat(o.qualidade.media).toFixed(1)}</span>`
                : '<span class="badge badge-gray">—</span>'}</td>
              <td><span class="badge ${badgeSeg(segInc)}">${segLabel}</span></td>
              <td onclick="event.stopPropagation()">
                <div style="display:flex;gap:4px">
                  ${pode('lancarAvanco')   ? `<button class="btn-icon" onclick="navegar('avanco',{obraId:'${o.id}'})" title="Lançar avanço"><i class="ti ti-chart-bar"></i></button>` : ''}
                  ${pode('lancarQualidade') ? `<button class="btn-icon" onclick="navegar('segqual',{obraId:'${o.id}'})" title="Qualidade/Seg"><i class="ti ti-shield"></i></button>` : ''}
                  ${pode('editarObra')     ? `<button class="btn-icon" onclick="editarObra('${o.id}')" title="Editar"><i class="ti ti-edit"></i></button>` : ''}
                  ${pode('excluirObra')    ? `<button class="btn-icon btn-icon-red" onclick="excluirObra('${o.id}')" title="Excluir"><i class="ti ti-trash"></i></button>` : ''}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── DETALHE DA OBRA (drill-down) ─────────────
async function renderDetalheObra(obraId) {
  const o = obras.find(ob => ob.id === obraId);
  if (!o) return;
  obraDetalheAtual = obraId;

  // Carregar histórico completo de qualidade e segurança
  const { data: histQual } = await db.from('qualidade').select('*').eq('obra_id', obraId).order('created_at', { ascending: false });
  const { data: histSeg }  = await db.from('seguranca').select('*').eq('obra_id', obraId).order('created_at', { ascending: false });

  const av       = calcAvanco(o.eap || []);
  const pctCusto = o.valor > 0 ? ((parseFloat(o.custo_realizado) / parseFloat(o.valor)) * 100).toFixed(1) : '0.0';
  const diasRestantes = o.fim ? Math.ceil((new Date(o.fim) - new Date()) / 86400000) : null;

  const cont = document.getElementById('detalhe-content');
  cont.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn-back" onclick="navegar('painel')"><i class="ti ti-arrow-left"></i> Voltar ao painel</button>
        <div class="page-title" style="margin-top:6px">${o.nome}</div>
        <div class="page-sub">${o.local || ''} ${o.tipo ? '· ' + o.tipo : ''} ${o.responsavel ? '· ' + o.responsavel : ''}</div>
      </div>
      <div style="display:flex;gap:8px">
        ${pode('lancarAvanco')    ? `<button class="btn-secondary" onclick="navegar('avanco',{obraId:'${o.id}'})"><i class="ti ti-chart-bar"></i> Lançar avanço</button>` : ''}
        ${pode('lancarQualidade') ? `<button class="btn-secondary" onclick="navegar('segqual',{obraId:'${o.id}'})"><i class="ti ti-shield"></i> Qualidade/Seg</button>` : ''}
        ${pode('editarObra')      ? `<button class="btn-primary" onclick="editarObra('${o.id}')"><i class="ti ti-edit"></i> Editar</button>` : ''}
      </div>
    </div>

    <!-- KPIs da obra -->
    <div class="grid-4" style="margin-bottom:16px">
      <div class="metric-card">
        <div class="metric-label">Avanço físico</div>
        <div class="metric-value">${av.toFixed(1)}%</div>
        <div style="margin-top:8px"><div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${Math.min(av,100)}%"></div></div></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Valor total</div>
        <div class="metric-value">${fmtM(o.valor)}</div>
        <div class="metric-sub">Custo: ${fmtM(o.custo_realizado)} (${pctCusto}%)</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Qualidade</div>
        <div class="metric-value">${o.qualidade ? parseFloat(o.qualidade.media).toFixed(2) + ' / 5' : '—'}</div>
        <div class="metric-sub">${o.qualidade ? 'Ref: ' + o.qualidade.periodo : 'Sem lançamento'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">${diasRestantes !== null ? (diasRestantes >= 0 ? 'Prazo restante' : 'Prazo vencido') : 'Prazo previsto'}</div>
        <div class="metric-value" style="color:${diasRestantes !== null && diasRestantes < 30 ? 'var(--color-red)' : 'var(--color-text)'}">
          ${diasRestantes !== null ? Math.abs(diasRestantes) + ' dias' : o.fim ? o.fim : '—'}
        </div>
        <div class="metric-sub">Início: ${o.inicio || '—'} · Fim: ${o.fim || '—'}</div>
      </div>
    </div>

    <!-- EAP Detalhada -->
    <div class="card">
      <div class="sec-title"><i class="ti ti-sitemap"></i>EAP — Estrutura Analítica do Projeto</div>
      <div style="overflow-x:auto">
        <table class="obras-table">
          <thead><tr>
            <th>Etapa</th>
            <th>Peso (%)</th>
            <th>Orçado</th>
            <th>Executado</th>
            <th>% Executado</th>
            <th style="min-width:140px">Avanço real (%)</th>
            <th>Contribuição</th>
          </tr></thead>
          <tbody>
            ${(o.eap || []).map(e => {
              const pctExec = e.orcado > 0 ? ((e.executado / e.orcado) * 100).toFixed(1) : '—';
              return `<tr>
                <td style="font-size:12px"><span style="color:var(--color-text3);margin-right:4px">${e.codigo}</span>${e.nome}</td>
                <td style="font-size:12px">${parseFloat(e.peso || 0).toFixed(1)}%</td>
                <td style="font-size:12px">R$ ${fmt(e.orcado)}</td>
                <td style="font-size:12px">R$ ${fmt(e.executado)}</td>
                <td style="font-size:12px">${pctExec}%</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="prog-bar-bg" style="min-width:60px"><div class="prog-bar-fill" style="width:${Math.min(parseFloat(e.avanco||0),100)}%"></div></div>
                    <span style="font-size:12px;min-width:32px">${parseFloat(e.avanco || 0).toFixed(1)}%</span>
                  </div>
                </td>
                <td style="font-size:12px;color:var(--color-primary)">${(parseFloat(e.peso||0)*parseFloat(e.avanco||0)/100).toFixed(2)}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;padding:10px 0 0;border-top:0.5px solid var(--color-border2);margin-top:4px">
        <span style="font-size:13px;color:var(--color-text3)">Avanço global:</span>
        <span style="font-size:17px;font-weight:600;color:var(--color-primary);margin-left:10px">${av.toFixed(2)}%</span>
      </div>
    </div>

    <!-- Histórico Qualidade -->
    ${histQual?.length ? `
    <div class="card">
      <div class="sec-title"><i class="ti ti-star"></i>Histórico de Qualidade</div>
      <table class="obras-table">
        <thead><tr>
          <th>Período</th><th>Materiais</th><th>Execução</th>
          <th>Conformidade</th><th>Prazo</th><th>Acabamento</th><th>Média</th>
        </tr></thead>
        <tbody>
          ${(histQual || []).map(q => `<tr>
            <td>${q.periodo}</td>
            <td>${q.materiais}</td><td>${q.execucao}</td>
            <td>${q.conformidade}</td><td>${q.prazo}</td><td>${q.acabamento}</td>
            <td><span class="badge ${q.media >= 4 ? 'badge-green' : q.media >= 3 ? 'badge-amber' : 'badge-red'}">${parseFloat(q.media).toFixed(2)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Histórico Segurança -->
    ${histSeg?.length ? `
    <div class="card">
      <div class="sec-title"><i class="ti ti-helmet"></i>Histórico de Segurança</div>
      <table class="obras-table">
        <thead><tr>
          <th>Período</th><th>Incidentes</th><th>Afastamentos</th>
          <th>Dias s/ acidente</th><th>Treinamentos</th><th>Trabalhadores</th>
        </tr></thead>
        <tbody>
          ${(histSeg || []).map(s => `<tr>
            <td>${s.periodo}</td>
            <td><span class="badge ${badgeSeg(s.incidentes)}">${s.incidentes}</span></td>
            <td>${s.afastamentos}</td>
            <td>${s.dias_sem_acidente}</td>
            <td>${s.treinamentos}</td>
            <td>${s.trabalhadores_treinados}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}`;
}

// ─── LISTA DE OBRAS ───────────────────────────
function renderListaObras() {
  const cont = document.getElementById('obras-lista');
  if (!obras.length) {
    cont.innerHTML = `<div class="empty-state"><i class="ti ti-building" style="font-size:40px;display:block;margin-bottom:12px"></i>Nenhuma obra cadastrada.</div>`;
    return;
  }
  cont.innerHTML = obras.map(o => {
    const av       = calcAvanco(o.eap || []);
    const pctCusto = o.valor > 0 ? ((o.custo_realizado / o.valor) * 100).toFixed(1) : '0.0';
    return `<div class="obra-card" onclick="navegar('detalhe',{obraId:'${o.id}'})">
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
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" onclick="event.stopPropagation()">
        ${pode('lancarAvanco')    ? `<button style="font-size:11px;padding:4px 10px" onclick="navegar('avanco',{obraId:'${o.id}'})"><i class="ti ti-chart-bar"></i> Avanço</button>` : ''}
        ${pode('lancarQualidade') ? `<button style="font-size:11px;padding:4px 10px" onclick="navegar('segqual',{obraId:'${o.id}'})"><i class="ti ti-shield"></i> Qual/Seg</button>` : ''}
        ${pode('editarObra')      ? `<button style="font-size:11px;padding:4px 10px" onclick="editarObra('${o.id}')"><i class="ti ti-edit"></i> Editar</button>` : ''}
        ${pode('excluirObra')     ? `<button style="font-size:11px;padding:4px 10px;color:var(--color-red)" onclick="excluirObra('${o.id}')"><i class="ti ti-trash"></i></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── CADASTRO DE OBRA ─────────────────────────
function initCadastro() {
  if (!editandoId) limparFormCadastro();
  renderEapForm();
}
function renderEapForm() {
  const tbody = document.getElementById('eap-tbody');
  if (!tbody) return;
  tbody.innerHTML = EAP_PADRAO.map((e) => `
    <tr>
      <td style="font-size:12px"><span style="color:var(--color-text3);margin-right:6px">${e.codigo}</span>${e.nome}</td>
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
  el.style.color = Math.abs(total - 100) < 0.1 ? 'var(--color-green)' : total > 100 ? 'var(--color-red)' : 'var(--color-text)';
}
function limparFormCadastro() {
  ['f-nome','f-local','f-valor','f-inicio','f-fim','f-resp','f-desc'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const tipo   = document.getElementById('f-tipo');   if (tipo)   tipo.value   = '';
  const status = document.getElementById('f-status'); if (status) status.value = 'execucao';
  editandoId = null;
  renderEapForm();
}
async function salvarObra() {
  const nome  = document.getElementById('f-nome').value.trim();
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
      empresa_id:  empresa?.id || window._sessao.empresa_id,
      nome,
      local:       document.getElementById('f-local').value.trim(),
      valor,
      inicio:      document.getElementById('f-inicio').value || null,
      fim:         document.getElementById('f-fim').value || null,
      responsavel: document.getElementById('f-resp').value.trim(),
      tipo:        document.getElementById('f-tipo').value,
      status:      document.getElementById('f-status').value || 'execucao',
      descricao:   document.getElementById('f-desc').value.trim(),
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
      obra_id:   obraId,
      codigo:    e.codigo,
      nome:      e.nome,
      peso:      parseFloat(document.querySelector(`.peso-input[data-cod="${e.codigo}"]`)?.value) || 0,
      orcado:    parseFloat(document.querySelector(`.orcado-input[data-cod="${e.codigo}"]`)?.value) || 0,
      prazo_dias:parseInt(document.querySelector(`.prazo-input[data-cod="${e.codigo}"]`)?.value) || 0,
      avanco:    0, executado: 0, ordem: i + 1,
    }));
    const { error: eapErr } = await db.from('eap_itens').insert(eapItens);
    if (eapErr) throw eapErr;
    toast(`Obra "${nome}" ${editandoId ? 'atualizada' : 'cadastrada'}!`);
    editandoId = null;
    await carregarTudo();
    navegar('obras');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'error');
  }
  loading(false);
}
async function editarObra(id) {
  if (!pode('editarObra')) return;
  const o = obras.find(ob => ob.id === id);
  if (!o) return;
  editandoId = id;
  navegar('cadastro');
  setTimeout(() => {
    document.getElementById('f-nome').value    = o.nome || '';
    document.getElementById('f-local').value   = o.local || '';
    document.getElementById('f-valor').value   = o.valor || '';
    document.getElementById('f-inicio').value  = o.inicio || '';
    document.getElementById('f-fim').value     = o.fim || '';
    document.getElementById('f-resp').value    = o.responsavel || '';
    document.getElementById('f-tipo').value    = o.tipo || '';
    document.getElementById('f-desc').value    = o.descricao || '';
    const stEl = document.getElementById('f-status'); if (stEl) stEl.value = o.status || 'execucao';
    (o.eap || []).forEach(e => {
      const pi  = document.querySelector(`.peso-input[data-cod="${e.codigo}"]`);   if (pi)  pi.value  = e.peso || '';
      const oi  = document.querySelector(`.orcado-input[data-cod="${e.codigo}"]`); if (oi)  oi.value  = e.orcado || '';
      const pri = document.querySelector(`.prazo-input[data-cod="${e.codigo}"]`);  if (pri) pri.value = e.prazo_dias || '';
    });
    atualizarTotalPeso();
  }, 100);
}
async function excluirObra(id) {
  if (!pode('excluirObra')) return;
  const o = obras.find(ob => ob.id === id);
  if (!confirm(`Excluir a obra "${o?.nome}"? Esta ação não pode ser desfeita.`)) return;
  loading(true);
  await db.from('obras').delete().eq('id', id);
  await carregarTudo();
  loading(false);
  toast('Obra excluída.');
}

// ─── AVANÇO ───────────────────────────────────
function initAvanco(obraIdParam) {
  popularSelects();
  document.getElementById('avanco-area').innerHTML = '';
  document.getElementById('avanco-save-btn').style.display = 'none';
  if (obraIdParam) {
    setTimeout(() => {
      document.getElementById('av-obra-sel').value = obraIdParam;
      carregarEapAvanco();
    }, 100);
  }
}
function carregarEapAvanco() {
  const id     = document.getElementById('av-obra-sel').value;
  const area   = document.getElementById('avanco-area');
  const saveBtn= document.getElementById('avanco-save-btn');
  if (!id) { area.innerHTML = ''; saveBtn.style.display = 'none'; return; }
  const o = obras.find(ob => ob.id === id);
  if (!o) return;
  saveBtn.style.display = 'flex';
  area.innerHTML = `<div class="card">
    <div class="sec-title">EAP — ${o.nome}</div>
    <p style="font-size:12px;color:var(--color-text3);margin-bottom:12px">Informe o % de avanço real e o valor executado de cada etapa.</p>
    <div style="overflow-x:auto">
    <table class="obras-table">
      <thead><tr>
        <th>Etapa</th><th>Peso (%)</th><th>Avanço real (%)</th><th>Executado (R$)</th><th>Contribuição</th>
      </tr></thead>
      <tbody>
        ${(o.eap || []).map(e => `<tr>
          <td style="font-size:12px"><span style="color:var(--color-text3);margin-right:4px">${e.codigo}</span>${e.nome}</td>
          <td style="font-size:12px;color:var(--color-text3)">${parseFloat(e.peso||0).toFixed(1)}%</td>
          <td><input type="number" class="av-real-input" data-id="${e.id}" min="0" max="100" step="0.1" value="${e.avanco||0}" style="width:70px" oninput="recalcGlobal('${o.id}',this,'${e.id}')"></td>
          <td><input type="number" class="exec-real-input" data-id="${e.id}" min="0" step="100" value="${e.executado||0}" style="width:100px"></td>
          <td id="contrib-${e.id}" style="font-size:12px;color:var(--color-text3)">${(parseFloat(e.peso||0)*parseFloat(e.avanco||0)/100).toFixed(2)}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:0.5px solid var(--color-border2);margin-top:4px">
      <span style="font-size:12px;color:var(--color-text3)">Avanço físico global</span>
      <span id="avanco-global" style="font-size:18px;font-weight:600;color:var(--color-primary)">${calcAvanco(o.eap||[]).toFixed(1)}%</span>
    </div>
  </div>`;
}
function recalcGlobal(obraId, input, eapId) {
  const o = obras.find(ob => ob.id === obraId); if (!o) return;
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
  const o = obras.find(ob => ob.id === id); if (!o) return;
  loading(true);
  try {
    let custoTotal = 0;
    for (const e of o.eap) {
      const av   = parseFloat(document.querySelector(`.av-real-input[data-id="${e.id}"]`)?.value) || 0;
      const exec = parseFloat(document.querySelector(`.exec-real-input[data-id="${e.id}"]`)?.value) || 0;
      e.avanco = av; e.executado = exec; custoTotal += exec;
      await db.from('eap_itens').update({ avanco: av, executado: exec }).eq('id', e.id);
    }
    await db.from('obras').update({ custo_realizado: custoTotal }).eq('id', id);
    o.custo_realizado = custoTotal;
    toast('Avanço salvo!');
    await carregarTudo();
    navegar('obras');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'error');
  }
  loading(false);
}

// ─── QUALIDADE & SEGURANÇA ────────────────────
function initSegQual(obraIdParam) {
  popularSelects();
  const pm = new Date().toISOString().slice(0, 7);
  const p1 = document.getElementById('sq-periodo'); if (p1 && !p1.value) p1.value = pm;
  if (obraIdParam) {
    setTimeout(() => { document.getElementById('sq-obra-sel').value = obraIdParam; }, 100);
  }
}
function calcMediaQual() {
  const ids  = ['q-materiais','q-execucao','q-conformidade','q-prazo','q-acabamento'];
  const vals = ids.map(id => parseFloat(document.getElementById(id)?.value) || 0);
  const media= vals.reduce((a, b) => a + b, 0) / vals.length;
  const el = document.getElementById('q-media');
  if (el) el.textContent = media.toFixed(2) + ' / 5';
}
async function salvarSegQual() {
  const id     = document.getElementById('sq-obra-sel').value;
  const periodo= document.getElementById('sq-periodo').value;
  if (!id)     { toast('Selecione uma obra.', 'error');   return; }
  if (!periodo){ toast('Informe o período.', 'error');    return; }
  const vals = ['materiais','execucao','conformidade','prazo','acabamento'].map(k => parseFloat(document.getElementById('q-'+k)?.value)||0);
  const media = vals.reduce((a,b)=>a+b,0)/vals.length;
  loading(true);
  try {
    await db.from('qualidade').insert({
      obra_id: id, periodo,
      materiais: vals[0], execucao: vals[1], conformidade: vals[2], prazo: vals[3], acabamento: vals[4],
      media: parseFloat(media.toFixed(2)),
      lancado_por: window._sessao?.user_id,
    });
    await db.from('seguranca').insert({
      obra_id: id, periodo,
      incidentes:              parseInt(document.getElementById('s-incidentes')?.value)   || 0,
      afastamentos:            parseInt(document.getElementById('s-afastamento')?.value)  || 0,
      dias_sem_acidente:       parseInt(document.getElementById('s-dias')?.value)         || 0,
      treinamentos:            parseInt(document.getElementById('s-treinamentos')?.value) || 0,
      trabalhadores_treinados: parseInt(document.getElementById('s-trabalhadores')?.value)|| 0,
      observacoes:             document.getElementById('s-obs')?.value || '',
      lancado_por:             window._sessao?.user_id,
    });
    toast('Qualidade e segurança salvos!');
    await carregarTudo();
    navegar('painel');
  } catch(e) {
    toast('Erro: ' + e.message, 'error');
  }
  loading(false);
}

// ─── GESTÃO DE USUÁRIOS ───────────────────────
async function renderUsuarios() {
  const cont = document.getElementById('usuarios-content');
  if (!cont) return;
  loading(true);
  let query = db.from('perfis').select('*').order('nome');
  if (perfil() !== 'master_sistema') query = query.eq('empresa_id', window._sessao.empresa_id);
  const { data: usuarios } = await query;
  loading(false);
  const podeCriar = pode('gerenciarUsuarios');
  cont.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Usuários</div>
        <div class="page-sub">Gerencie os acessos da equipe</div>
      </div>
      ${podeCriar ? `<button class="btn-primary" onclick="abrirModalUsuario()"><i class="ti ti-user-plus"></i> Convidar usuário</button>` : ''}
    </div>
    <div class="card">
      <table class="obras-table">
        <thead><tr>
          <th>Nome</th><th>E-mail</th><th>Perfil</th><th>Área</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${(usuarios || []).map(u => {
            const pConf = PERMISSOES[u.perfil];
            return `<tr>
              <td><strong>${u.nome}</strong></td>
              <td style="font-size:12px;color:var(--color-text3)">${u.email}</td>
              <td><span class="badge ${pConf?.badge || 'badge-gray'}">${pConf?.label || u.perfil}</span></td>
              <td style="font-size:12px">${AREAS[u.area] || '—'}</td>
              <td><span class="badge ${u.ativo ? 'badge-green' : 'badge-red'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td>
                ${podeCriar && u.user_id !== window._sessao?.user_id
                  ? `<button class="btn-icon btn-icon-red" onclick="desativarUsuario('${u.id}','${u.nome}','${u.ativo}')" title="${u.ativo ? 'Desativar' : 'Ativar'}">
                      <i class="ti ti-${u.ativo ? 'user-x' : 'user-check'}"></i>
                    </button>`
                  : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <!-- Modal convidar -->
    <div id="modal-usuario" style="display:none">
      <div class="modal-backdrop" onclick="fecharModalUsuario()"></div>
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">Convidar usuário</span>
          <button class="btn-icon" onclick="fecharModalUsuario()"><i class="ti ti-x"></i></button>
        </div>
        <div class="field"><label>Nome completo *</label><input type="text" id="inv-nome" placeholder="João da Silva"></div>
        <div class="field"><label>E-mail *</label><input type="email" id="inv-email" placeholder="joao@empresa.com"></div>
        <div class="field"><label>Senha provisória *</label><input type="password" id="inv-senha" placeholder="Min. 6 caracteres"></div>
        <div class="field"><label>Perfil *</label>
          <select id="inv-perfil">
            ${Object.entries(PERMISSOES)
              .filter(([k]) => k !== 'master_sistema')
              .map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Área</label>
          <select id="inv-area">
            ${Object.entries(AREAS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button onclick="fecharModalUsuario()">Cancelar</button>
          <button class="btn-primary" onclick="criarUsuario()"><i class="ti ti-check"></i> Criar acesso</button>
        </div>
        <div id="inv-erro" style="color:var(--color-red);font-size:12px;margin-top:8px"></div>
      </div>
    </div>`;
}

function abrirModalUsuario() {
  document.getElementById('modal-usuario').style.display = 'block';
}
function fecharModalUsuario() {
  document.getElementById('modal-usuario').style.display = 'none';
}
async function criarUsuario() {
  const nome  = document.getElementById('inv-nome').value.trim();
  const email = document.getElementById('inv-email').value.trim();
  const senha = document.getElementById('inv-senha').value;
  const pf    = document.getElementById('inv-perfil').value;
  const area  = document.getElementById('inv-area').value;
  const errEl = document.getElementById('inv-erro');
  errEl.textContent = '';
  if (!nome || !email || !senha) { errEl.textContent = 'Preencha todos os campos obrigatórios.'; return; }
  if (senha.length < 6) { errEl.textContent = 'Senha deve ter pelo menos 6 caracteres.'; return; }
  loading(true);
  try {
    // Criar usuário via signUp (funciona no frontend)
    const { data: authData, error: authErr } = await db.auth.signUp({
      email, password: senha,
      options: { data: { nome } }
    });
    if (authErr) throw authErr;
    if (!authData.user) throw new Error('Erro ao criar usuário. Tente outro e-mail.');

    const { error: perfErr } = await db.from('perfis').insert({
      user_id:    authData.user.id,
      empresa_id: window._sessao.empresa_id,
      nome, email,
      perfil: pf,
      area,
      ativo: true,
    });
    if (perfErr) throw perfErr;
    toast(`Usuário "${nome}" criado! Ele receberá um e-mail de confirmação.`);
    fecharModalUsuario();
    await renderUsuarios();
  } catch(e) {
    errEl.textContent = e.message;
  }
  loading(false);
}
async function desativarUsuario(id, nome, ativo) {
  const novoAtivo = ativo === 'true' ? false : true;
  const msg = novoAtivo ? `Reativar "${nome}"?` : `Desativar "${nome}"?`;
  if (!confirm(msg)) return;
  await db.from('perfis').update({ ativo: novoAtivo }).eq('id', id);
  toast(`Usuário ${novoAtivo ? 'reativado' : 'desativado'}.`);
  await renderUsuarios();
}

// ─── GESTÃO DE EMPRESAS (Master) ──────────────
async function renderEmpresas() {
  if (perfil() !== 'master_sistema') return;
  const cont = document.getElementById('empresas-content');
  if (!cont) return;
  loading(true);
  const { data: emps } = await db.from('empresas').select('*').order('nome');
  loading(false);
  cont.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Empresas</div>
        <div class="page-sub">Gerencie incorporadoras e construtoras</div>
      </div>
      <button class="btn-primary" onclick="abrirModalEmpresa()"><i class="ti ti-plus"></i> Nova empresa</button>
    </div>
    <div class="card">
      <table class="obras-table">
        <thead><tr>
          <th>Nome</th><th>CNPJ</th><th>Tipo</th><th>Cidade/UF</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${(emps || []).map(e => `<tr>
            <td><strong>${e.nome}</strong></td>
            <td style="font-size:12px">${e.cnpj || '—'}</td>
            <td><span class="badge badge-blue">${e.tipo || '—'}</span></td>
            <td style="font-size:12px">${e.cidade ? e.cidade + (e.uf ? ' / ' + e.uf : '') : '—'}</td>
            <td><span class="badge ${e.ativa ? 'badge-green' : 'badge-red'}">${e.ativa ? 'Ativa' : 'Inativa'}</span></td>
            <td>
              <button class="btn-icon" onclick="editarEmpresaModal('${e.id}')" title="Editar"><i class="ti ti-edit"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <!-- Modal empresa -->
    <div id="modal-empresa" style="display:none">
      <div class="modal-backdrop" onclick="fecharModalEmpresa()"></div>
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title" id="modal-emp-titulo">Nova empresa</span>
          <button class="btn-icon" onclick="fecharModalEmpresa()"><i class="ti ti-x"></i></button>
        </div>
        <div class="field-group">
          <div class="field"><label>Nome *</label><input type="text" id="emp-nome"></div>
          <div class="field"><label>CNPJ</label><input type="text" id="emp-cnpj" placeholder="00.000.000/0000-00"></div>
        </div>
        <div class="field-group">
          <div class="field"><label>Tipo</label>
            <select id="emp-tipo">
              <option value="construtora">Construtora</option>
              <option value="incorporadora">Incorporadora</option>
              <option value="misto">Misto</option>
            </select>
          </div>
          <div class="field"><label>E-mail</label><input type="email" id="emp-email"></div>
        </div>
        <div class="field-group">
          <div class="field"><label>Cidade</label><input type="text" id="emp-cidade"></div>
          <div class="field"><label>UF</label><input type="text" id="emp-uf" maxlength="2" style="width:60px"></div>
        </div>
        <div class="field"><label>Endereço</label><input type="text" id="emp-endereco"></div>
        <input type="hidden" id="emp-id">
        <div class="btn-row" style="margin-top:16px">
          <button onclick="fecharModalEmpresa()">Cancelar</button>
          <button class="btn-primary" onclick="salvarEmpresa()"><i class="ti ti-check"></i> Salvar</button>
        </div>
        <div id="emp-erro" style="color:var(--color-red);font-size:12px;margin-top:8px"></div>
      </div>
    </div>`;
}

function abrirModalEmpresa() {
  document.getElementById('emp-id').value = '';
  document.getElementById('modal-emp-titulo').textContent = 'Nova empresa';
  ['emp-nome','emp-cnpj','emp-email','emp-cidade','emp-uf','emp-endereco'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('modal-empresa').style.display = 'block';
}
function fecharModalEmpresa() {
  document.getElementById('modal-empresa').style.display = 'none';
}
async function editarEmpresaModal(id) {
  const { data: e } = await db.from('empresas').select('*').eq('id', id).single();
  if (!e) return;
  document.getElementById('emp-id').value        = e.id;
  document.getElementById('modal-emp-titulo').textContent = 'Editar empresa';
  document.getElementById('emp-nome').value      = e.nome     || '';
  document.getElementById('emp-cnpj').value      = e.cnpj     || '';
  document.getElementById('emp-tipo').value      = e.tipo     || 'construtora';
  document.getElementById('emp-email').value     = e.email    || '';
  document.getElementById('emp-cidade').value    = e.cidade   || '';
  document.getElementById('emp-uf').value        = e.uf       || '';
  document.getElementById('emp-endereco').value  = e.endereco || '';
  document.getElementById('modal-empresa').style.display = 'block';
}
async function salvarEmpresa() {
  const nome = document.getElementById('emp-nome').value.trim();
  const errEl= document.getElementById('emp-erro');
  errEl.textContent = '';
  if (!nome) { errEl.textContent = 'Nome é obrigatório.'; return; }
  const empId = document.getElementById('emp-id').value;
  const dados = {
    nome,
    cnpj:     document.getElementById('emp-cnpj').value.trim() || null,
    tipo:     document.getElementById('emp-tipo').value,
    email:    document.getElementById('emp-email').value.trim() || null,
    cidade:   document.getElementById('emp-cidade').value.trim() || null,
    uf:       document.getElementById('emp-uf').value.trim().toUpperCase() || null,
    endereco: document.getElementById('emp-endereco').value.trim() || null,
    ativa:    true,
  };
  loading(true);
  try {
    if (empId) {
      const { error } = await db.from('empresas').update(dados).eq('id', empId);
      if (error) throw error;
      toast('Empresa atualizada!');
    } else {
      const { data, error } = await db.from('empresas').insert(dados).select().single();
      if (error) throw error;
      toast('Empresa criada!');
    }
    fecharModalEmpresa();
    await renderEmpresas();
  } catch(e) {
    errEl.textContent = 'Erro: ' + e.message;
    console.error('Erro ao salvar empresa:', e);
  }
  loading(false);
}

// ─── SELECTS ──────────────────────────────────
function popularSelects() {
  ['av-obra-sel','sq-obra-sel'].forEach(sid => {
    const sel = document.getElementById(sid); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Selecionar obra...</option>' + obras.map(o => `<option value="${o.id}">${o.nome}</option>`).join('');
    if (cur) sel.value = cur;
  });
}

// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ['q-materiais','q-execucao','q-conformidade','q-prazo','q-acabamento'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcMediaQual);
  });
});