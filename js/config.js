// GPS da Obra — config.js v2.0
// ─── SUPABASE ────────────────────────────────
const SUPABASE_URL = 'https://pdssdswjugdsuzpsmlml.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkc3Nkc3dqdWdkc3V6cHNtbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTk3MjksImV4cCI6MjA5Njg3NTcyOX0.BiQaFmKChLSarnDEXZlzjXidvn0aN-65SgIoypTmavs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── EAP PADRÃO ──────────────────────────────
const EAP_PADRAO = [
  { codigo: '1.0',  nome: 'Documentos' },
  { codigo: '2.0',  nome: 'Projetos' },
  { codigo: '3.0',  nome: 'Canteiro de obra' },
  { codigo: '4.0',  nome: 'Serviços iniciais' },
  { codigo: '5.0',  nome: 'Movimentação de terra' },
  { codigo: '6.0',  nome: 'Infraestrutura' },
  { codigo: '7.0',  nome: 'Superestrutura' },
  { codigo: '8.0',  nome: 'Alvenarias, fechamentos e divisórias' },
  { codigo: '9.0',  nome: 'Coberturas' },
  { codigo: '10.0', nome: 'Instalações' },
  { codigo: '11.0', nome: 'Revestimento primário e impermeabilização' },
  { codigo: '12.0', nome: 'Esquadrias e metálicos' },
  { codigo: '13.0', nome: 'Forros' },
  { codigo: '14.0', nome: 'Revestimento secundário' },
  { codigo: '15.0', nome: 'Pintura' },
  { codigo: '16.0', nome: 'Acabamentos' },
  { codigo: '17.0', nome: 'Equipamentos' },
  { codigo: '18.0', nome: 'Urbanização e serviços externos' },
  { codigo: '19.0', nome: 'Serviços complementares' },
  { codigo: '20.0', nome: 'Limpeza final de obra' },
];

// ─── PERMISSÕES POR PERFIL ────────────────────
const PERMISSOES = {
  master_sistema: {
    label: 'Master do Sistema',
    badge: 'badge-purple',
    pode: {
      verPainel: true, verObras: true,
      criarEmpresa: true, editarEmpresa: true,
      criarObra: true, editarObra: true, excluirObra: true,
      lancarAvanco: true, lancarQualidade: true,
      gerenciarUsuarios: true, verTodasEmpresas: true,
    }
  },
  admin_empresa: {
    label: 'Administrador',
    badge: 'badge-blue',
    pode: {
      verPainel: true, verObras: true,
      criarEmpresa: false, editarEmpresa: true,
      criarObra: true, editarObra: true, excluirObra: true,
      lancarAvanco: true, lancarQualidade: true,
      gerenciarUsuarios: true, verTodasEmpresas: false,
    }
  },
  gerente: {
    label: 'Gerente',
    badge: 'badge-teal',
    pode: {
      verPainel: true, verObras: true,
      criarEmpresa: false, editarEmpresa: false,
      criarObra: true, editarObra: true, excluirObra: false,
      lancarAvanco: true, lancarQualidade: true,
      gerenciarUsuarios: true, verTodasEmpresas: false,
    }
  },
  coordenador: {
    label: 'Coordenador',
    badge: 'badge-amber',
    pode: {
      verPainel: true, verObras: true,
      criarEmpresa: false, editarEmpresa: false,
      criarObra: false, editarObra: true, excluirObra: false,
      lancarAvanco: true, lancarQualidade: true,
      gerenciarUsuarios: true, verTodasEmpresas: false,
    }
  },
  residente: {
    label: 'Eng. Residente',
    badge: 'badge-green',
    pode: {
      verPainel: true, verObras: true,
      criarEmpresa: false, editarEmpresa: false,
      criarObra: false, editarObra: false, excluirObra: false,
      lancarAvanco: true, lancarQualidade: true,
      gerenciarUsuarios: false, verTodasEmpresas: false,
    }
  },
  visualizador: {
    label: 'Visualizador',
    badge: 'badge-gray',
    pode: {
      verPainel: true, verObras: true,
      criarEmpresa: false, editarEmpresa: false,
      criarObra: false, editarObra: false, excluirObra: false,
      lancarAvanco: false, lancarQualidade: false,
      gerenciarUsuarios: false, verTodasEmpresas: false,
    }
  }
};

// ─── ÁREAS DA EMPRESA ─────────────────────────
const AREAS = {
  administrativo_financeiro: 'Administrativo & Financeiro',
  engenharia:                'Engenharia',
  incorporacao:              'Incorporação',
  geral:                     'Geral',
};

// ─── TIPOS DE EMPRESA ─────────────────────────
const TIPOS_EMPRESA = {
  incorporadora: 'Incorporadora',
  construtora:   'Construtora',
  mista:         'Mista (Incorporadora + Construtora)',
  empreiteira:   'Empreiteira',
};

const ESPECIALIDADES_EMPREITEIRA = [
  'Estrutura e fundação',
  'Alvenaria e vedação',
  'Elétrica',
  'Hidráulica',
  'Pintura',
  'Impermeabilização',
  'Esquadrias e vidros',
  'Revestimentos e acabamentos',
  'Drywall e forros',
  'Climatização (HVAC)',
  'Terraplenagem',
  'Paisagismo',
  'Outro',
];

// ─── TIPOS DE LANÇAMENTO (Indicadores) ────────
// acumulado: 'soma' = soma cumulativa dos meses | 'media' = média cumulativa
const LANCAMENTO_TIPOS = {
  fisico: {
    label: 'Avanço Físico', icone: 'ti-chart-bar',
    unidade: '%', acumulado: 'soma', cor: 'var(--color-primary)',
    descricao: 'Percentual de avanço físico executado no período.'
  },
  financeiro: {
    label: 'Custo Financeiro', icone: 'ti-currency-dollar',
    unidade: 'R$', acumulado: 'soma', cor: 'var(--color-amber)',
    descricao: 'Valor financeiro desembolsado no período.'
  },
  qualidade: {
    label: 'Qualidade', icone: 'ti-star',
    unidade: 'pts (0-5)', acumulado: 'media', cor: 'var(--color-teal)',
    descricao: 'Índice médio de qualidade dos serviços no período.'
  },
  seguranca: {
    label: 'Segurança', icone: 'ti-shield-check',
    unidade: 'pts (0-100)', acumulado: 'media', cor: 'var(--color-green)',
    descricao: 'Índice de segurança no trabalho no período.'
  },
};

function podefazer(acao) {
  const p = window._sessao?.perfil;
  if (!p) return false;
  return PERMISSOES[p]?.pode[acao] ?? false;
}

// Verifica se o usuário pode LANÇAR/EDITAR um tipo específico de indicador
function podeEditarLancamento(tipo) {
  const s = window._sessao;
  if (!s) return false;
  if (['master_sistema','admin_empresa'].includes(s.perfil)) return true;
  if (s.perfil === 'visualizador') return false;
  if (s.perfil === 'gerente') {
    if (s.area === 'geral') return true;
    if (s.area === 'engenharia') return ['fisico','qualidade','seguranca'].includes(tipo);
    if (s.area === 'administrativo_financeiro') return tipo === 'financeiro';
    return false;
  }
  // coordenador / residente — acesso restrito pela RLS às obras vinculadas
  if (['coordenador','residente'].includes(s.perfil)) return true;
  return false;
}

// Verifica se o usuário pode VISUALIZAR um tipo específico de indicador
function podeVerLancamento(tipo) {
  const s = window._sessao;
  if (!s) return false;
  if (['master_sistema','admin_empresa','visualizador','coordenador','residente'].includes(s.perfil)) return true;
  if (s.perfil === 'gerente') {
    if (s.area === 'geral') return true;
    if (s.area === 'engenharia') return ['fisico','qualidade','seguranca'].includes(tipo);
    if (s.area === 'administrativo_financeiro') return tipo === 'financeiro';
    return false;
  }
  return true;
}
