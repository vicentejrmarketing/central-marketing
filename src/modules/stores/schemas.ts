import { z } from "zod";

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const storeSchema = z.object({
  code: z
    .string({ error: "Informe o código." })
    .trim()
    .min(2, "Informe o código da loja.")
    .max(20, "Use até 20 caracteres.")
    .regex(/^[A-Za-z0-9\-_. ]+$/, "Use letras, números, espaço, hífen, ponto ou sublinhado.")
    .transform((v) => v.toUpperCase()),
  name: z.string({ error: "Informe o nome." }).trim().min(2, "Informe o nome da loja.").max(100),
  city: z.string({ error: "Informe a cidade." }).trim().min(2, "Informe a cidade.").max(80),
  state: z.enum(UFS, { error: "Selecione a UF." }),
  address: z.string().trim().max(200).optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9()+\-\s]*$/, "Telefone inválido.")
    .optional(),
  regionId: z.uuid({ error: "Selecione a região." }),
  responsibleUserId: z.uuid().optional(),
  managerName: z.string().trim().max(100).optional(),
  managerPhone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9()+\-\s]*$/, "Telefone inválido.")
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type StoreInput = z.infer<typeof storeSchema>;

export const updateStoreSchema = storeSchema.extend({ id: z.uuid(), version: z.coerce.number().int() });

export const regionSchema = z.object({
  name: z.string({ error: "Informe o nome." }).trim().min(2, "Informe o nome da região.").max(60),
  description: z.string().trim().max(300).optional(),
});
export const updateRegionSchema = regionSchema.extend({ id: z.uuid(), version: z.coerce.number().int() });

export const linkManagerSchema = z.object({ regionId: z.uuid(), userId: z.uuid({ error: "Selecione o gerente regional." }) });
export const unlinkManagerSchema = z.object({ linkId: z.uuid() });

export const storeFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  regionId: z.uuid().optional().catch(undefined),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().catch(undefined),
});
export type StoreFilters = z.infer<typeof storeFiltersSchema>;
