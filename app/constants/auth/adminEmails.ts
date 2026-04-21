export const ADMIN_EMAILS = [
  "ti.emporioarouca@gmail.com",
  "renan@gmail.com",
];

const ADMIN_EMAILS_NORMALIZED = ADMIN_EMAILS.map((email) => email.toLowerCase());

export const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS_NORMALIZED.includes(email.toLowerCase());
