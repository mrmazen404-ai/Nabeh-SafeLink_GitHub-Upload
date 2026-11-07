import { useLanguage } from '../../context/LanguageContext';
import { CheckCircleIcon } from '../../components/Icons';
import { getPasswordRequirements } from './authValidation';

export default function PasswordRequirements({ password }) {
  const { t } = useLanguage();
  const requirements = getPasswordRequirements(password);

  return (
    <section className="password-criteria-box" role="group" aria-labelledby="password-criteria-title">
      <p id="password-criteria-title" className="criteria-title">{t('auth.passwordCriteriaTitle')}</p>
      <ul className="criteria-list">
        {requirements.map(({ id, translationKey, met }) => (
          <li className={met ? 'met' : 'unmet'} key={id}>
            <span className="criteria-icon" aria-hidden="true">
              {met ? <CheckCircleIcon size={15} color="currentColor" /> : <span className="criteria-pending" />}
            </span>
            <span>
              {t(translationKey)}
              <span className="auth-sr-only"> — {t(met ? 'auth.passwordRequirementMet' : 'auth.passwordRequirementMissing')}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
