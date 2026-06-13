# 📍 GPS da Obra

Sistema de gestão e acompanhamento de obras com EAP padrão, indicadores de qualidade e segurança.

**Site:** [gpsdaobra.eng.br](https://gpsdaobra.eng.br)

---

## Stack

- **Frontend:** HTML + CSS + JS puro (sem framework)
- **Hospedagem:** Vercel (gratuito)
- **Banco de dados:** Supabase — PostgreSQL (gratuito)

---

## 1. Configurar o banco (Supabase)

1. Acesse [supabase.com](https://supabase.com) e abra seu projeto
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `supabase_schema.sql` e clique em **Run**
4. As tabelas `obras`, `eap_itens`, `qualidade` e `seguranca` serão criadas

---

## 2. Subir no GitHub

```bash
# Na pasta do projeto:
git init
git add .
git commit -m "GPS da Obra — v1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gpsdaobra.git
git push -u origin main
```

---

## 3. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório `gpsdaobra` do GitHub
3. Clique em **Deploy** (não precisa configurar build — é HTML puro)
4. O deploy será automático a cada `git push`

---

## 4. Domínio gpsdaobra.eng.br

### No registro.br:
Adicione estas entradas DNS (mantenha DNS do registro.br):

| Tipo | Nome | Destino |
|------|------|---------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

### Na Vercel:
1. Vá em **Settings → Domains**
2. Adicione `gpsdaobra.eng.br`
3. Adicione `www.gpsdaobra.eng.br`
4. Aguarde a verificação (pode levar até 24h)

---

## Estrutura do projeto

```
gpsdaobra/
├── index.html          # App principal
├── css/
│   └── styles.css      # Estilos
├── js/
│   ├── config.js       # Credenciais Supabase + EAP padrão
│   └── app.js          # Toda a lógica da aplicação
├── vercel.json         # Configuração Vercel
├── supabase_schema.sql # Script para criar as tabelas
└── README.md
```

---

## Funcionalidades v1.0

- ✅ Cadastro de obras com dados completos
- ✅ EAP padrão com 20 etapas e pesos personalizáveis
- ✅ Lançamento de avanço físico e financeiro por etapa
- ✅ Cálculo automático do avanço global ponderado
- ✅ Indicadores de qualidade (5 dimensões, média automática)
- ✅ Indicadores de segurança do canteiro
- ✅ Painel resumo do portfólio
- ✅ Persistência em banco PostgreSQL (Supabase)

---

## Próximas versões (roadmap)

- [ ] Autenticação de usuários (login/senha)
- [ ] Upload de fotos do canteiro
- [ ] Curva S (planejado vs realizado)
- [ ] Relatório PDF mensal
- [ ] Notificações de alertas
- [ ] App mobile (PWA)
