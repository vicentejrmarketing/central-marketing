# Permissões (gerado automaticamente)

> Gerado por `pnpm docs:permissions` a partir de `src/lib/authz/catalog.ts`. Não edite à mão.
> Esta é a matriz **padrão** aplicada quando os papéis de sistema são criados; o administrador pode alterá-la na tela Papéis e permissões.

Escopos: **OWN** = Próprios · **SECTOR** = Setor · **STORES** = Lojas vinculadas · **ALL** = Todos

| Permissão | Chave | Administrador | Gestor de Marketing | Gerente Regional | Líder de Setor | Colaborador |
| --- | --- | --- | --- | --- | --- | --- |
| Requisições: Ver requisições | `requests.view` | Todos | Todos | Lojas vinculadas | Setor | Próprios |
| Requisições: Abrir requisição | `requests.create` | Todos | Todos | Lojas vinculadas | — | — |
| Requisições: Comentar e responder | `requests.comment` | Todos | Todos | Lojas vinculadas | Setor | Próprios |
| Requisições: Cancelar requisição | `requests.cancel` | Todos | Todos | Próprios | — | — |
| Requisições: Confirmar conclusão | `requests.confirm` | Todos | Todos | Próprios | — | — |
| Requisições: Aprovar requisições | `requests.approve` | Todos | Todos | — | — | — |
| Requisições: Triar e atribuir | `requests.triage` | Todos | Todos | — | Setor | — |
| Requisições: Aprovar a própria requisição | `requests.self_approve` | — | — | — | — | — |
| Tarefas: Ver tarefas | `tasks.view` | Todos | Todos | Lojas vinculadas | Setor | Próprios |
| Tarefas: Criar e atribuir tarefas | `tasks.create` | Todos | Todos | — | Setor | Próprios |
| Tarefas: Atualizar tarefas | `tasks.update` | Todos | Todos | — | Setor | Próprios |
| Tarefas: Delegar tarefas | `tasks.delegate` | Todos | Todos | — | Setor | — |
| Tarefas: Aprovar etapas | `tasks.approve` | Todos | Todos | — | Setor | — |
| Tarefas: Definir prioridades e prazos | `tasks.set_deadlines` | Todos | Todos | — | Setor | — |
| Materiais: Enviar materiais | `assets.upload` | Todos | Todos | — | Setor | Próprios |
| Materiais: Aprovar artes | `assets.approve` | Todos | Todos | — | Setor | — |
| Materiais: Ver materiais aprovados | `assets.view_approved` | Todos | Todos | Lojas vinculadas | Todos | Todos |
| Materiais: Aprovar a própria arte | `assets.self_approve` | — | — | — | — | — |
| Calendário: Ver calendário | `calendar.view` | Todos | Todos | Lojas vinculadas | Setor | Próprios |
| Lojas: Ver lojas | `stores.view` | Todos | Todos | Lojas vinculadas | Todos | Todos |
| Lojas: Gerenciar lojas | `stores.manage` | ✓ | ✓ | — | — | — |
| Lojas: Gerenciar regiões | `regions.manage` | ✓ | ✓ | — | — | — |
| Indicadores: Ver dashboard | `dashboard.view` | Todos | Todos | Lojas vinculadas | Setor | Próprios |
| Indicadores: Ver e exportar relatórios | `reports.view` | Todos | Todos | Lojas vinculadas | Setor | — |
| Equipamentos: Cadastrar equipamentos | `equipment.manage` | ✓ | — | — | — | — |
| Equipamentos: Registrar empréstimos | `loans.manage` | ✓ | ✓ | — | — | — |
| Administração: Gerenciar integrações | `integrations.manage` | ✓ | — | — | — | — |
| Administração: Gerenciar usuários | `users.manage` | ✓ | — | — | — | — |
| Administração: Gerenciar setores | `sectors.manage` | ✓ | — | — | — | — |
| Administração: Gerenciar permissões | `permissions.manage` | ✓ | — | — | — | — |
| Administração: Ver auditoria | `audit.view` | ✓ | — | — | — | — |
