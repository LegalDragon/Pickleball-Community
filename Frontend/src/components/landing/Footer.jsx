import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation('nav');

  const footerLinks = {
    quickLinks: [
      { key: 'home', href: '/' },
      { key: 'courses', href: '#' },
      { key: 'coaches', href: '#' },
      { key: 'pricing', href: '#' }
    ],
    resources: [
      { key: 'blog', href: '/blog' },
      { key: 'trainingVideos', href: '#' },
      { key: 'drills', href: '#' },
      { key: 'strategyGuides', href: '#' },
      { key: 'usaPickleballRules', href: 'https://usapickleball.org/what-is-pickleball/official-rules/', external: true }
    ],
    contact: [
      { key: 'support', href: '#' },
      { key: 'becomeACoach', href: '#' },
      { key: 'partnerships', href: '#' }
    ]
  };

  return (
    <footer className="landing-footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-column">
            <h3 className="text-blue-500">{t('footer.mission')}</h3>
            <p className="text-gray-500">
              {t('footer.missionText')}
            </p>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-500">
                {t('footer.communityText')}
              </p>
            </div>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">{t('footer.quickLinks')}</h3>
            <ul>
              {footerLinks.quickLinks.map((link, index) => (
                <li key={index}>
                  {link.href !== '#' ? (
                    <Link to={link.href}>{t(`footer.${link.key}`)}</Link>
                  ) : (
                    <a href="#">{t(`footer.${link.key}`)}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">{t('footer.resources')}</h3>
            <ul>
              {footerLinks.resources.map((resource, index) => (
                <li key={index}>
                  {resource.external ? (
                    <a
                      href={resource.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t(`footer.${resource.key}`)}
                    </a>
                  ) : resource.href !== '#' ? (
                    <Link to={resource.href}>{t(`footer.${resource.key}`)}</Link>
                  ) : (
                    <a href="#">{t(`footer.${resource.key}`)}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">{t('footer.contact')}</h3>
            <ul>
              {footerLinks.contact.map((contact, index) => (
                <li key={index}><a href="#">{t(`footer.${contact.key}`)}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="copyright">
          &copy; 2023-{new Date().getFullYear()} {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
