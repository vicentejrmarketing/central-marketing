/**
 * Catálogo de permissões e matriz padrão dos papéis de sistema.
 *
 * O catálogo é a fonte da verdade: o seed sincroniza a tabela Permission com ele.
 * A matriz padrão só é aplicada quando um papel de sistema é criado; depois disso,
 * o administrador edita as permissões pela tela de Papéis e permissões.
 */
import type { PermissionScope } from "@/generated/prisma/enums";

export type PermissionDef = {
  key: string;
  module: string;
  label: string;
  description: string;
  /** Permissões sem escopo valem para todo o sistema (ex.: gerenciar usuários). */
  scoped: boolean;
};

export const PERMISSIONS = [
  // Requisições
  { key: "requests.view", module: "Requisições", label: "Ver requisições", description: "Listar e abrir requisições.", scoped: true },
  {
    key: "requests.create",
    module: "Requisições",
    label: "Abrir requisição",
    description: "Abrir requisições para lojas. Com escopo STORES, só para as lojas vinculadas.",
    scoped: true,
  },
  {
    key: "requests.comment",
    module: "Requisições",
    label: "Comentar e responder",
    description: "Comentar, anexar e responder pedidos de informação.",
    scoped: true,
  },
  {
    key: "requests.cancel",
    module: "Requisições",
    label: "Cancelar requisição",
    description: "Cancelar requisições em aberto (OWN: só as que abriu).",
    scoped: true,
  },
  {
    key: "requests.confirm",
    module: "Requisições",
    label: "Confirmar conclusão",
    description: "Concluir requisições em revisão (OWN: só as que abriu).",
    scoped: true,
  },
  {
    key: "requests.approve",
    module: "Requisições",
    label: "Aprovar requisições",
    description: "Aprovar, recusar ou devolver requisições.",
    scoped: true,
  },
  {
    key: "requests.triage",
    module: "Requisições",
    label: "Triar e atribuir",
    description: "Definir responsável, pedir informações e gerar tarefas.",
    scoped: true,
  },
  {
    key: "requests.self_approve",
    module: "Requisições",
    label: "Aprovar a própria requisição",
    description: "Exceção: permite aprovar requisições que o próprio usuário abriu.",
    scoped: false,
  },
  // Tarefas
  { key: "tasks.view", module: "Tarefas", label: "Ver tarefas", description: "Listar e abrir tarefas.", scoped: true },
  {
    key: "tasks.create",
    module: "Tarefas",
    label: "Criar e atribuir tarefas",
    description: "Criar tarefas e definir responsáveis.",
    scoped: true,
  },
  {
    key: "tasks.update",
    module: "Tarefas",
    label: "Atualizar tarefas",
    description: "Mudar status, comentar, anexar e lançar horas.",
    scoped: true,
  },
  { key: "tasks.delegate", module: "Tarefas", label: "Delegar tarefas", description: "Passar uma tarefa para outra pessoa.", scoped: true },
  {
    key: "tasks.approve",
    module: "Tarefas",
    label: "Aprovar etapas",
    description: "Aprovar ou devolver tarefas em aprovação.",
    scoped: true,
  },
  {
    key: "tasks.set_deadlines",
    module: "Tarefas",
    label: "Definir prioridades e prazos",
    description: "Alterar prioridade e prazo de tarefas e requisições.",
    scoped: true,
  },
  // Materiais
  {
    key: "assets.upload",
    module: "Materiais",
    label: "Enviar materiais",
    description: "Enviar artes e vídeos para o Google Drive pelo sistema.",
    scoped: true,
  },
  {
    key: "assets.approve",
    module: "Materiais",
    label: "Aprovar artes",
    description: "Aprovar ou pedir alterações em materiais.",
    scoped: true,
  },
  {
    key: "assets.view_approved",
    module: "Materiais",
    label: "Ver materiais aprovados",
    description: "Ver, copiar link e baixar materiais aprovados.",
    scoped: true,
  },
  {
    key: "assets.self_approve",
    module: "Materiais",
    label: "Aprovar a própria arte",
    description: "Exceção: permite aprovar materiais enviados pelo próprio usuário.",
    scoped: false,
  },
  // Calendário
  { key: "calendar.view", module: "Calendário", label: "Ver calendário", description: "Ver o calendário do marketing.", scoped: true },
  // Lojas
  {
    key: "stores.view",
    module: "Lojas",
    label: "Ver lojas",
    description: "Ver lojas e suas páginas. Com escopo STORES, só as lojas vinculadas.",
    scoped: true,
  },
  { key: "stores.manage", module: "Lojas", label: "Gerenciar lojas", description: "Cadastrar, editar e importar lojas.", scoped: false },
  {
    key: "regions.manage",
    module: "Lojas",
    label: "Gerenciar regiões",
    description: "Criar regiões e vincular gerentes regionais.",
    scoped: false,
  },
  // Indicadores
  { key: "dashboard.view", module: "Indicadores", label: "Ver dashboard", description: "Ver indicadores do dashboard.", scoped: true },
  {
    key: "reports.view",
    module: "Indicadores",
    label: "Ver e exportar relatórios",
    description: "Ver relatórios e exportar para Excel e PDF.",
    scoped: true,
  },
  // Equipamentos
  {
    key: "equipment.manage",
    module: "Equipamentos",
    label: "Cadastrar equipamentos",
    description: "Cadastrar e editar equipamentos e acessórios.",
    scoped: false,
  },
  {
    key: "loans.manage",
    module: "Equipamentos",
    label: "Registrar empréstimos",
    description: "Registrar saídas e devoluções de equipamentos.",
    scoped: false,
  },
  // Administração
  {
    key: "integrations.manage",
    module: "Administração",
    label: "Gerenciar integrações",
    description: "Conectar e reconectar o Google Drive.",
    scoped: false,
  },
  {
    key: "users.manage",
    module: "Administração",
    label: "Gerenciar usuários",
    description: "Convidar, editar, desativar usuários e redefinir senhas.",
    scoped: false,
  },
  {
    key: "sectors.manage",
    module: "Administração",
    label: "Gerenciar setores",
    description: "Criar, editar, arquivar e excluir setores.",
    scoped: false,
  },
  {
    key: "permissions.manage",
    module: "Administração",
    label: "Gerenciar permissões",
    description: "Editar papéis e permissões individuais.",
    scoped: false,
  },
  { key: "audit.view", module: "Administração", label: "Ver auditoria", description: "Consultar a trilha de auditoria.", scoped: false },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

export function permissionDef(key: string): PermissionDef | undefined {
  return PERMISSIONS.find((p) => p.key === key);
}

export const SYSTEM_ROLES = {
  ADMIN: "admin",
  MARKETING_MANAGER: "marketing_manager",
  REGIONAL_MANAGER: "regional_manager",
  SECTOR_LEADER: "sector_leader",
  COLLABORATOR: "collaborator",
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

type Matrix = Partial<Record<PermissionKey, PermissionScope>>;

const all = (keys: PermissionKey[]): Matrix => Object.fromEntries(keys.map((k) => [k, "ALL"])) as Matrix;

export const SYSTEM_ROLE_DEFS: Record<SystemRoleKey, { name: string; description: string; permissions: Matrix }> = {
  admin: {
    name: "Administrador",
    description: "Acesso completo. Gerencia usuários, setores, permissões, equipamentos e integrações.",
    permissions: all(PERMISSION_KEYS.filter((k) => !k.endsWith("self_approve"))),
  },
  marketing_manager: {
    name: "Gestor de Marketing",
    description: "Vê todas as atividades, distribui tarefas, aprova requisições e acompanha todas as lojas.",
    permissions: all([
      "requests.view",
      "requests.create",
      "requests.comment",
      "requests.cancel",
      "requests.confirm",
      "requests.approve",
      "requests.triage",
      "tasks.view",
      "tasks.create",
      "tasks.update",
      "tasks.delegate",
      "tasks.approve",
      "tasks.set_deadlines",
      "assets.upload",
      "assets.approve",
      "assets.view_approved",
      "calendar.view",
      "stores.view",
      "stores.manage",
      "regions.manage",
      "dashboard.view",
      "reports.view",
      "loans.manage",
    ]),
  },
  regional_manager: {
    name: "Gerente Regional",
    description: "Representa as lojas da sua região: abre e acompanha requisições apenas para as lojas vinculadas.",
    permissions: {
      "requests.view": "STORES",
      "requests.create": "STORES",
      "requests.comment": "STORES",
      "requests.cancel": "OWN",
      "requests.confirm": "OWN",
      "tasks.view": "STORES",
      "assets.view_approved": "STORES",
      "calendar.view": "STORES",
      "stores.view": "STORES",
      "dashboard.view": "STORES",
      "reports.view": "STORES",
    },
  },
  sector_leader: {
    name: "Líder de Setor",
    description: "Gerencia as atividades do próprio setor, distribui tarefas e aprova etapas.",
    permissions: {
      "requests.view": "SECTOR",
      "requests.comment": "SECTOR",
      "requests.triage": "SECTOR",
      "tasks.view": "SECTOR",
      "tasks.create": "SECTOR",
      "tasks.update": "SECTOR",
      "tasks.delegate": "SECTOR",
      "tasks.approve": "SECTOR",
      "tasks.set_deadlines": "SECTOR",
      "assets.upload": "SECTOR",
      "assets.approve": "SECTOR",
      "assets.view_approved": "ALL",
      "calendar.view": "SECTOR",
      "stores.view": "ALL",
      "dashboard.view": "SECTOR",
      "reports.view": "SECTOR",
    },
  },
  collaborator: {
    name: "Colaborador",
    description: "Executa as próprias tarefas, atualiza o andamento, comenta e anexa arquivos.",
    permissions: {
      "requests.view": "OWN",
      "requests.comment": "OWN",
      "tasks.view": "OWN",
      "tasks.create": "OWN",
      "tasks.update": "OWN",
      "assets.upload": "OWN",
      "assets.view_approved": "ALL",
      "calendar.view": "OWN",
      "stores.view": "ALL",
      "dashboard.view": "OWN",
    },
  },
};

export const INITIAL_SECTORS = [
  { name: "Gestão de Marketing", color: "#2563eb" },
  { name: "Design", color: "#db2777" },
  { name: "Tráfego Pago", color: "#16a34a" },
  { name: "Vídeo e Audiovisual", color: "#ea580c" },
  { name: "Social Media", color: "#7c3aed" },
  { name: "Administrativo", color: "#475569" },
];

export const SCOPE_LABELS: Record<PermissionScope, string> = {
  OWN: "Próprios",
  SECTOR: "Setor",
  STORES: "Lojas vinculadas",
  ALL: "Todos",
};
