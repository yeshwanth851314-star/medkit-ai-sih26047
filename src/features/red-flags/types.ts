import { z } from "zod";

export const redFlagRuleSchema = z.object({
  id: z.string(),
  version: z.string().default("1.0"),
  name: z.string(),
  severity: z.enum(["critical", "warning"]),
  triggers: z.object({
    keywords: z.array(z.string()),
    radiation: z.array(z.string()).optional(),
    associated: z.array(z.string()).optional(),
  }),
  message: z.string(),
  clinicalRationale: z.string(),
});

export type RedFlagRule = z.infer<typeof redFlagRuleSchema>;

export interface RedFlagAlertItem {
  ruleId: string;
  ruleVersion: string;
  severity: "critical" | "warning";
  message: string;
  triggeredAt: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
}
