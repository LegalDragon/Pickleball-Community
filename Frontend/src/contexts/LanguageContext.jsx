import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
  ];

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
  };

  // Get the current language, handling cases where it might be a locale like 'en-US'
  const getCurrentLanguage = () => {
    const lang = i18n.language;
    // If the language is a locale (e.g., 'en-US'), extract just the language code
    return lang?.split('-')[0] || 'en';
  };

  return (
    <LanguageContext.Provider value={{
      currentLanguage: getCurrentLanguage(),
      languages,
      changeLanguage
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
