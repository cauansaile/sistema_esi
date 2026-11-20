SISTEMA ESI — VERSÃO COM BANCO DE DADOS EM NUVEM

O QUE FOI ALTERADO
- Dados de alunos, responsáveis, pagamentos, despesas e notas são lidos e gravados no PostgreSQL do Supabase.
- Login real por e-mail e senha (Supabase Auth), sem senha de demonstração.
- Dados compartilhados entre computadores que usam a mesma escola e têm usuário autorizado.
- Atualização de dados ao reabrir a página ou voltar à aba.
- Validação no banco, RLS e vínculo de cada usuário a uma escola.
- Formulários para novos alunos, lançamentos financeiros e notas.

PASSO A PASSO (10–15 MINUTOS)
1. Acesse https://supabase.com e crie um projeto.
2. Em SQL Editor, execute o arquivo database/schema.sql. Copie o UUID da escola exibido ao final.
3. Em Authentication > Users, crie um usuário (e-mail e senha) pela opção Add user.
4. Copie o UUID desse usuário e execute no SQL Editor:
   insert into public.memberships(school_id,user_id,role)
   values ('UUID_DA_ESCOLA','UUID_DO_USUARIO','admin');
5. Em Project Settings > API (ou Connect > API Keys, conforme a interface), copie a Project URL e a chave publicável (publishable/anon).
6. Edite js/config.js, preenchendo URL e chave. NUNCA use secret/service_role no navegador.
7. Publique a pasta em hospedagem HTTPS (Vercel/Netlify) ou abra com VS Code Live Server. Evite abrir com file://.
8. Acesse index.html e entre com o e-mail e senha criados no passo 3.
9. Para outro computador: acesse a mesma URL publicada, com um usuário autorizado.
10. Para mais funcionários: crie usuários em Authentication > Users e insira cada UUID na tabela memberships com o mesmo school_id.

OBSERVAÇÕES IMPORTANTES
- O Supabase precisa ser criado na SUA conta. Sem as credenciais em js/config.js, não há conexão.
- A base começa vazia: os dados de demonstração do projeto anterior NÃO são importados automaticamente.
- As páginas mostram dados atualizados ao entrar e ao voltar à aba. Não há atualização em tempo real enquanto a aba fica aberta.
- Responsáveis são cadastrados junto ao aluno, como no protótipo original; não há cadastro independente.
- A versão inclui criação e consulta; edição/exclusão ainda não têm interface.
- A política atual permite a todos os membros autorizados da escola consultar e alterar os registros. Antes de uso real, defina perfis de acesso e rotinas de backup, retenção e privacidade/LGPD para dados de crianças.
- Este é um ponto de partida, não uma auditoria de segurança nem um sistema pronto para produção sem testes.
