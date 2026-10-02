const UNPAID = /\b(free|unpaid|no budget)\b|₹\s*0\b|\b0\s*inr\b/i;

export function policy(lead) {
  if (UNPAID.test(lead.lead)) {
    return { fit: false, reason: "The lead asks for the work at no charge. Sales declines it." };
  }
  if (lead.lead.length < 20) {
    return { fit: false, reason: "The lead does not say what the work is. Sales declines it." };
  }
  return null;
}
