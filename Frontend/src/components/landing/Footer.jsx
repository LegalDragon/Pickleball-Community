import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const footerLinks = {
    quickLinks: ['Home', 'Courses', 'Coaches', 'Pricing'],
    resources: [
      { name: 'Blog', href: '/blog' },
      { name: 'Training Videos', href: '#' },
      { name: 'Drills', href: '#' },
      { name: 'Strategy Guides', href: '#' },
      { name: 'USA Pickleball Rules', href: 'https://usapickleball.org/what-is-pickleball/official-rules/', external: true }
    ],
    contact: ['Support', 'Become a Coach', 'Partnerships']
  };

  return (
    <footer className="landing-footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-column">
  <h3 className=" text-blue-500">Our Mission:</h3>
  <p className="text-gray-500">

       Democratizing pickleball education through technology.
    </p>

  <div className="mt-4 pt-4 border-t border-gray-700">
    <p className=" text-sm  text-gray-500">
    To create a friendly and supportive community  where every pickleball player
     can learn, grow, and connect with each other.
  </p>
  </div>
</div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">Quick Links</h3>
            <ul>
              {footerLinks.quickLinks.map((link, index) => (
                <li key={index}><a href="#">{link}</a></li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">Resources</h3>
            <ul>
              {footerLinks.resources.map((resource, index) => (
                <li key={index}>
                  {resource.external ? (
                    <a
                      href={resource.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {resource.name}
                    </a>
                  ) : resource.href !== '#' ? (
                    <Link to={resource.href}>{resource.name}</Link>
                  ) : (
                    <a href="#">{resource.name}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h3 className="text-xl font-bold mb-4">Contact</h3>
            <ul>
              {footerLinks.contact.map((contact, index) => (
                <li key={index}><a href="#">{contact}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="copyright">
          &copy; 2023-{new Date().getFullYear()} Funtime Pickleball Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;