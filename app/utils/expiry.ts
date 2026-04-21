export type ExpiryMeta = {
  diffDays: number | null;
  expired: boolean;
  warning: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const getExpiryMeta = (expiryDate?: string | null): ExpiryMeta => {
  if (!expiryDate) {
    return { diffDays: null, expired: false, warning: false };
  }

  const parsed = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { diffDays: null, expired: false, warning: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((parsed.getTime() - today.getTime()) / DAY_IN_MS);
  if (diffDays < 0) {
    return { diffDays, expired: true, warning: false };
  }

  return { diffDays, expired: false, warning: diffDays < 30 };
};

export const formatExpiryInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const toStorageExpiryDate = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return { value: '', valid: true };
  }

  if (digits.length !== 6) {
    return { value: '', valid: false };
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = 2000 + Number(digits.slice(4, 6));

  const date = new Date(year, month - 1, day);
  const isValid =
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) {
    return { value: '', valid: false };
  }

  return {
    value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    valid: true,
  };
};

export const toDisplayExpiryDate = (value?: string | null, shortYear = false) => {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }

  return shortYear ? `${day}/${month}/${year.slice(-2)}` : `${day}/${month}/${year}`;
};
