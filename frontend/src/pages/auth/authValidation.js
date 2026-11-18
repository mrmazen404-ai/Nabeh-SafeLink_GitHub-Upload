const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function getPasswordRequirements(password = '') {
  return [
    { id: 'length', translationKey: 'auth.criteriaLength', met: password.length >= 12 && password.length <= 128 },
  ];
}

export function isPasswordCompliant(password = '') {
  return getPasswordRequirements(password).every((requirement) => requirement.met);
}

export function normalizeOtpDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}
