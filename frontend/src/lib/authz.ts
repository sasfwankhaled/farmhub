const DEFAULT_ADMIN_EMAILS = ['saafwanrawashdeh@gmail.com'];

const parseAdminEmails = () => {
  const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined;
  const list = (raw || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list.length > 0 ? list : DEFAULT_ADMIN_EMAILS);
};

const ALLOWED_ADMIN_EMAILS = parseAdminEmails();

export const isAllowedAdminEmail = (email?: string | null) => {
  return !!email && ALLOWED_ADMIN_EMAILS.has(email.trim().toLowerCase());
};
