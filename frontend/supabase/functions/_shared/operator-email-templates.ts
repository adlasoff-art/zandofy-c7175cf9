/**
 * Templates email partagés Lot 11B (multi-opérateurs).
 * Centralisés ici pour faciliter l'édition et la cohérence visuelle.
 * Édition : modifier ce fichier puis redéployer les edge functions concernées
 *   (notify-operator-new-order, operator-decide-order, expire-operator-assignments).
 */

const BRAND_PRIMARY = "#16a34a";
const BRAND_WARNING = "#f59e0b";
const SITE_URL = "https://zandofy.com";
const SITE_NAME = "Zandofy";
const FOOTER_TAGLINE = "Marketplace sino-africaine";

function shell(opts: {
  headerColor: string;
  headerTitle: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr><td style="background:${opts.headerColor};padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">${opts.headerTitle}</h1>
        </td></tr>
        <tr><td style="padding:32px 28px;color:#1f2937;">
          ${opts.bodyHtml}
          <table cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td style="background:${BRAND_PRIMARY};border-radius:8px;">
            <a href="${opts.ctaHref}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
              ${opts.ctaLabel}
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#6b7280;">${SITE_NAME} — ${FOOTER_TAGLINE}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();
}

/** Email envoyé à l'owner opérateur lors d'une nouvelle attribution (B6). */
export function operatorNewOrderEmail(args: {
  greeting: string;
  orderRef: string;
  city: string;
  fee: string;
}) {
  return shell({
    headerColor: BRAND_PRIMARY,
    headerTitle: "🚚 Nouvelle commande à livrer",
    bodyHtml: `
      <p style="font-size:16px;margin:0 0 16px;">${args.greeting}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        Une nouvelle commande vient de vous être attribuée sur <strong>${SITE_NAME}</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:16px;">
          <p style="margin:0 0 8px;font-size:14px;"><strong>Référence :</strong> ${args.orderRef}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Ville :</strong> ${args.city}</p>
          <p style="margin:0;font-size:14px;"><strong>Frais last-mile :</strong> $${args.fee}</p>
        </td></tr>
      </table>
      <p style="font-size:14px;color:#4b5563;margin:0 0 24px;">
        Connectez-vous à votre tableau de bord opérateur pour assigner un livreur (réponse attendue sous 30 min).
      </p>`,
    ctaLabel: "Voir la commande",
    ctaHref: `${SITE_URL}/operator/orders`,
  });
}

/** Email client : opérateur refuse / expire — réassignation en cours. */
export function clientOperatorReassignedEmail(args: {
  greeting: string;
  orderRef: string;
  orderId: string;
  cause: "declined" | "expired";
}) {
  const reason =
    args.cause === "declined"
      ? "Le transporteur initialement attribué n'est pas disponible."
      : "Le transporteur n'a pas confirmé la prise en charge dans le délai imparti.";
  return shell({
    headerColor: args.cause === "expired" ? BRAND_WARNING : BRAND_PRIMARY,
    headerTitle: "🔄 Recherche d'un transporteur",
    bodyHtml: `
      <p style="font-size:16px;margin:0 0 16px;">${args.greeting}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">${reason}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        Pas d'inquiétude : votre commande <strong>${args.orderRef}</strong> reste valide. Nous lui cherchons un nouveau transporteur dans les plus brefs délais.
      </p>`,
    ctaLabel: "Suivre ma commande",
    ctaHref: `${SITE_URL}/orders/${args.orderId}`,
  });
}

export const OPERATOR_EMAIL_BRAND = { primary: BRAND_PRIMARY, warning: BRAND_WARNING };