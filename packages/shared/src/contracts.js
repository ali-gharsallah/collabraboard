"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cursor = exports.Problem = exports.KycValidate = exports.QuestionAnswer = exports.KycCreate = exports.ClientCreate = void 0;
const zod_1 = require("zod");
exports.ClientCreate = zod_1.z.object({
    name: zod_1.z.string().min(2),
    structure: zod_1.z.enum(["PP", "SA", "SARL", "TRUST", "FOUNDATION", "DOMICILE", "HOLDING", "FUND"]),
    country: zod_1.z.string().length(2),
    externalRef: zod_1.z.string().optional(),
    corrLang: zod_1.z.enum(["FR", "EN", "DE", "IT"]).default("FR"),
});
exports.KycCreate = zod_1.z.object({
    clientId: zod_1.z.string().uuid(),
    legalStructure: zod_1.z.string(),
    accountType: zod_1.z.enum(["CURRENT", "DISCRETIONARY", "ADVISORY", "LOMBARD"]),
    countryCode: zod_1.z.string().length(2),
    rmId: zod_1.z.string().uuid(),
});
exports.QuestionAnswer = zod_1.z.object({ answer: zod_1.z.string().max(4000) });
exports.KycValidate = zod_1.z.object({ validatorId: zod_1.z.string().uuid() });
exports.Problem = zod_1.z.object({
    type: zod_1.z.string(), title: zod_1.z.string(), status: zod_1.z.number(), detail: zod_1.z.string().optional(),
});
exports.Cursor = zod_1.z.object({ next_cursor: zod_1.z.string().nullable() });
