# BEATRIZ ABREU · Agendamento online (Bia Nail Studio)

Sistema de agendamento para a profissional **Beatriz Abreu**. A cliente agenda sem criar conta
(**abriu → escolheu → agendou → confirmou**) e a profissional gerencia tudo num painel protegido.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · componentes no padrão shadcn/ui ·
Supabase PostgreSQL + Supabase Auth.

## Como rodar

1. **Crie um projeto no Supabase** (supabase.com).
2. **Aplique as migrations**, em ordem, pelo SQL Editor do Supabase (ou `supabase db push` com a CLI):
   - `supabase/migrations/20261023120000_initial_schema.sql` (tabelas, RLS, funções)
   - `supabase/migrations/20261023120100_initial_config.sql` (os 10 serviços, expediente seg–sáb 13h–18h)
3. **Crie o acesso da Beatriz**: Supabase > Authentication > Users > *Add user* (e-mail e senha).
   Depois, no SQL Editor:
   ```sql
   insert into public.profiles (id, full_name, role)
   select id, 'Beatriz Abreu', 'admin' from auth.users where email = 'EMAIL-DA-BEATRIZ';

   update public.professionals
   set user_id = (select id from auth.users where email = 'EMAIL-DA-BEATRIZ');
   ```
   Recomendado: em Authentication > Providers > Email, desative *Allow new users to sign up*.
4. **Configure o app**: `cp .env.example .env.local` e preencha URL e chave **anon** do projeto.
5. `npm install` e `npm run dev` → http://localhost:3000 (painel em `/admin`).
6. **Primeiro uso do painel**: em *Configurações > Horários disponíveis*, cadastre os horários de
   início que as clientes podem escolher. Enquanto não houver horários, o calendário público fica vazio
   (de propósito: nenhum intervalo é inventado automaticamente).

## Estrutura de pastas

```
src/
  app/
    page.tsx                    Tela 1 — Início (nome, mensagem, serviços, "Agendar agora")
    agendar/                    Telas 2–6 — serviço, data/horário, dados, confirmação, sucesso
      actions.ts                Server Actions públicas (disponibilidade + reserva)
    admin/
      login/                    Login (Supabase Auth)
      actions.ts                Server Actions do painel (todas exigem admin)
      (painel)/                 Área protegida
        page.tsx                Dashboard
        agenda/                 Dia / semana / mês, criar, confirmar, remarcar, cancelar, concluir, bloquear
        clientes/               Lista, pesquisa, contato e histórico
        servicos/               Criar, editar, preço, ativar/desativar
        configuracoes/          Funcionamento, horários disponíveis, bloqueios, regras online
  components/
    ui/                         Componentes base (shadcn/ui)
    booking/                    Fluxo da cliente
    admin/                      Componentes do painel
  lib/
    supabase/                   Clientes Supabase (servidor + middleware)
    datetime.ts                 Datas sempre em America/Sao_Paulo
    validation.ts, format.ts    Validação (zod) e formatação
    errors.ts                   Tradução dos erros do banco
  middleware.ts                 Protege /admin
supabase/
  migrations/                   Banco de dados
  tests/                        Testes SQL das regras críticas
scripts/                        Testes de banco e concorrência
```

## Regras importantes

- **Sem duplicidade**: a reserva passa pela função `create_public_booking`, que trava o horário
  (`pg_advisory_xact_lock`), revalida tudo e grava. Além disso, o índice único parcial
  `appointments_one_active_per_slot` impede dois agendamentos não cancelados no mesmo horário,
  mesmo que alguém contorne o app. Se o horário foi tomado, a cliente vê
  *"Esse horário já está marcado! Escolha outro horário disponível para continuar."* e volta para a escolha de horário.
- **Cancelamento libera o horário** imediatamente. Pendente, confirmado, concluído e "não compareceu" ocupam o horário.
- **Status**: pendente → confirmado/cancelado; confirmado → concluído/cancelado/não compareceu; concluído e cancelado são finais.
- **Preço e nome do serviço** ficam gravados no agendamento: mudar o preço não altera reservas já feitas.
- **Sucesso só depois de salvar**: a tela final só aparece quando o banco devolve o agendamento gravado.
- **Bloqueios** escondem horários da agenda pública; agendamentos já existentes no período não são cancelados.
- **Duração** dos serviços é opcional. A profissional define os horários de início liberados.
- **Fuso**: tudo é gravado em UTC (`timestamptz`) e exibido em America/Sao_Paulo.

## Segurança

- RLS em todas as tabelas. Visitantes só leem serviços ativos, expediente e nome da profissional.
  Clientes, agendamentos, bloqueios e histórico só são acessíveis por usuárias com `profiles.role = 'admin'`.
- Alterações de status e horário passam por funções que validam permissão e transições.
- O app usa apenas a chave pública (anon). Nenhuma chave secreta é usada ou exposta.
- Histórico: `appointment_history` (criação, mudança de status, remarcação) e `change_log`
  (serviços, clientes, horários, bloqueios, regras), com quem alterou e quando.
- Limite de reservas abertas por telefone (padrão 3, configurável) para conter abusos.

## Testes

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # testes unitários (datas/fuso, preços, telefone, validação, mensagens)
PGURL=postgres://postgres@localhost:5432/postgres npm run test:db
                    # aplica as migrations num PostgreSQL local descartável e testa
                    # RLS, regras de reserva, histórico e 20 reservas simultâneas
```
