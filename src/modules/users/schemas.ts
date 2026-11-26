import { z } from "zod";

const phone = z
  .string()
  .trim()
  .max(30, "Telefone muito longo.")
  .regex(/^[0-9()+\-\s]*$/, "Use só números, espaços, parênteses, + e -.")
  .optional();

export const userFields = {
  name: z.string({ error: "Informe o nome." }).trim().min(3, "Informe o nome completo.").max(120),
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase().max(200),
  jobTitle: z.string().trim().max(80).optional(),
  phone,
  sectorId: z.uuid({ error: "Setor inválido." }).optional(),
  roleId: z.uuid({ error: "Selecione o papel." }),
};

export const inviteUserSchema = z.object(userFields);
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({ id: z.uuid(), version: z.coerce.number().int(), ...userFields });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const setUserStatusSchema = z.object({ id: z.uuid(), active: z.boolean() });

export const overrideSchema = z.object({
  userId: z.uuid(),
  permissionKey: z.string().min(1),
  effect: z.enum(["GRANT", "DENY"]).nullable(),
  scope: z.enum(["OWN", "SECTOR", "STORES", "ALL"]).default("ALL"),
  reason: z.string().trim().max(300).optional(),
});

export const profileSchema = z.object({
  name: userFields.name,
  phone,
  jobTitle: z.string().trim().max(80).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: "Informe a senha atual." }).min(1, "Informe a senha atual."),
    newPassword: z.string({ error: "Informe a nova senha." }).min(1, "Informe a nova senha."),
    confirmPassword: z.string({ error: "Repita a nova senha." }),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem." });
