import { randomUUID } from "node:crypto";
import { demoLeadBody, type DemoLeadResult, type LeadPayload } from "@leadline/shared";
import type { FastifyPluginAsync } from "fastify";
import { findPractice } from "../practice";
import { PRACTICE_HEADER, SIGNATURE_HEADER, sign } from "../signature";

/**
 * Demo only, off in production: the "try it" ad form posts here, and this route plays the ad
 * platform. It signs the lead with the clinic's secret and sends it through the real webhook
 * route, so the form exercises signature checks, idempotency, tracing and triage, while the
 * secret never leaves the API. Retries reuse the same signed body, like a platform resending.
 */
export const demoRoutes: FastifyPluginAsync = async (app) => {
  app.post("/demo/leads", async (req, reply): Promise<DemoLeadResult | undefined> => {
    const body = demoLeadBody.parse(req.body);
    const practice = await findPractice(body.practice);
    if (!practice) return reply.code(404).send({ error: "practice not found" });

    const lead: LeadPayload = {
      source: "META_LEAD_ADS",
      sourceLeadId: `demo_${randomUUID()}`,
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      utm: body.campaign ? { source: "facebook", medium: "paid_social", campaign: body.campaign } : undefined,
    };
    const raw = JSON.stringify(lead);
    const signature = sign(practice.webhookSecret, raw);

    // Each delivery gets its own trace id, as each platform retry is its own HTTP request.
    const deliveries = await Promise.all(
      Array.from({ length: body.deliveries }, async () => {
        const res = await app.inject({
          method: "POST",
          url: "/webhooks/leads",
          headers: { [PRACTICE_HEADER]: practice.slug, [SIGNATURE_HEADER]: signature, "content-type": "application/json" },
          payload: raw,
        });
        if (res.statusCode !== 200) throw new Error(`webhook answered ${res.statusCode}: ${res.body}`);
        return res.json<{ leadId: string; duplicate: boolean; traceId: string }>();
      }),
    );
    req.log.info({ practice: practice.slug, deliveries: deliveries.length }, "demo lead sent");
    return { leadId: deliveries[0].leadId, deliveries: deliveries.map(({ duplicate, traceId }) => ({ duplicate, traceId })) };
  });
};
