import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

const Footer = () => {
  const { t } = useTranslation('nav');
  const [checking, setChecking] = useState(false);

  // Get build version from environment
  const buildTime = import.meta.env.VITE_BUILD_TIME;
  const buildDate = buildTime ? new Date(parseInt(buildTime)).toLocaleDateString() : null;

  // Check for updates manually
  const handleCheckForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      alert('Service worker not supported');
      return;
    }

    setChecking(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();

      // Check if there's a waiting worker after update check
      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
          detail: { registration }
        }));
      } else {
        alert('You have the latest version!');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      alert('Error checking for updates. Try refreshing the page.');
    } finally {
      setChecking(false);
    }
  };

  const footerLinks = {
    play: [
      { key: 'events', href: '/events' },
      { key: 'venues', href: '/venues' },
      { key: 'clubs', href: '/clubs' },
      { key: 'leagues', href: '/leagues' },
      { key: 'instagame', href: '/instagame' }
    ],
    community: [
      { key: 'blog', href: '/blog' },
      { key: 'friends', href: '/friends' },
      { key: 'videoRooms', href: '/rooms' }
    ],
    support: [
      { key: 'faq', href: '/faq' },
      { key: 'features', href: '/features' },
      { key: 'feedback', href: '/feedback' },
      { key: 'usaPickleballRules', href: 'https://usapickleball.org/what-is-pickleball/official-rules/', external: true }
    ],
    legal: [
      { key: 'privacyPolicy', href: 'https://shared.funtimepb.com/privacy-policy?site=community', external: true },
      { key: 'termsOfService', href: 'https://shared.funtimepb.com/terms-of-service?site=community', external: true }
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
            <h3 className="text-xl font-bold mb-4">{t('footer.play')}</h3>
            <ul>
              {footerLinks.play.map((link, index) => (
                <li key={index}>
                  <Link to={link.href}>{t(`footer.${link.key}`)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">{t('footer.community')}</h3>
            <ul>
              {footerLinks.community.map((link, index) => (
                <li key={index}>
                  <Link to={link.href}>{t(`footer.${link.key}`)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">{t('footer.support')}</h3>
            <ul>
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t(`footer.${link.key}`)}
                    </a>
                  ) : (
                    <Link to={link.href}>{t(`footer.${link.key}`)}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">{t('footer.legal')}</h3>
            <ul>
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t(`footer.${link.key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="copyright">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <span>&copy; 2023-{new Date().getFullYear()} {t('footer.copyright')}</span>
            {buildDate && (
              <span className="text-gray-500 text-xs">
                Build: {buildDate}
              </span>
            )}
            <button
              onClick={handleCheckForUpdates}
              disabled={checking}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
              title="Check for app updates"
            >
              <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
