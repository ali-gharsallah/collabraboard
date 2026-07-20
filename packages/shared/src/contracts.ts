import { z } from "zod";

export const ClientCreate = z.object({
  name: z.string().min(2),
  structure: z.enum(["PP","SA","SARL","TRUST","FOUNDATION","DOMICILE","HOLDING","FUND"]),
  country: z.string().length(2),
  externalRef: z.string().optional(),
  corrLang: z.enum(["FR","EN","DE","IT"]).default("FR"),
});
export type ClientCreate = z.infer<typeof ClientCreate>;

export const KycCreate = z.object({
  clientId: z.string().uuid(),
  legalStructure: z.string(),
  accountType: z.enum(["CURRENT","DISCRETIONARY","ADVISORY","LOMBARD"]),
  countryCode: z.string().length(2),
  rmId: z.string().uuid(),
});
export type KycCreate = z.infer<typeof KycCreate>;

export const QuestionAnswer = z.object({ answer: z.string().max(4000) });
export const KycValidate = z.object({ validatorId: z.string().uuid() });

export const Problem = z.object({          // RFC 7807
  type: z.string(), title: z.string(), status: z.number(), detail: z.string().optional(),
});
export const Cursor = z.object({ next_cursor: z.string().nullable() });
