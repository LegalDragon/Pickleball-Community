import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, BookOpen, HomeIcon, School2Icon, User, Bell, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAssetUrl } from '../../services/api';
import { useSharedAuth } from '../../hooks/useSharedAuth';

// Shared Auth API URL from environment
const SHARED_AUTH_URL = import.meta.env.VITE_SHARED_AUTH_URL || 'https://shared.funtimepb.com/api';
const SITE_KEY = 'community';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [authKey, setAuthKey] = useState(0); // Add this
  const [logoHtml, setLogoHtml] = useState(null);
  const location = useLocation();

  const { user, logout, isAuthenticated } = useAuth();
  const { redirectToLogin, redirectToRegister } = useSharedAuth();

  // Fetch logo HTML from shared auth
  useEffect(() => {
    const fetchLogoHtml = async () => {
      try {
        const res = await fetch(`${SHARED_AUTH_URL}/settings/logo-html?site=${SITE_KEY}&size=lg`);
        if (res.ok) {
          const html = await res.text();
          setLogoHtml(html);
        }
      } catch (err) {
        console.warn('Failed to fetch logo HTML:', err);
      }
    };

    if (SHARED_AUTH_URL) {
      fetchLogoHtml();
    }
  }, []);

  console.log('Navigation useAuth returns:', { user, isAuthenticated });

  // Force re-render when auth changes
  useEffect(() => {
    console.log('Auth state changed:', { isAuthenticated, user });
    setAuthKey(prev => prev + 1); // Force re-render
  }, [isAuthenticated, user]);

  const navigation = [
    { name: 'Home', href: '/', icon: School2Icon },
    { name: 'Marketplace', href: '/marketplace', icon: BookOpen },
    { name: 'Blog', href: '/blog', icon: FileText },
  ];

  const isActive = (path) => location.pathname === path;

  const logoPath = '/Logo.png';

  const handleImageError = (e) => {
    console.error('Logo failed to load from:', e.target.src);
    e.target.style.display = 'none';
    e.target.parentElement.innerHTML = `
      <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
        <span class="text-white font-bold text-sm">PB</span>
      </div>
    `;
  };


  const handleLogout = async () => {
    try {
      await logout(); // Use the logout function from AuthContext
      setShowUserDropdown(false);
      setIsOpen(false);

      // Force a full page refresh to clear any cached state
      // window.location.href = '/home';
      // window.location.reload(); // Force reload

      // OR use navigate with force refresh
      window.location.replace('/');
      //   navigate('/', { replace: true });
      setTimeout(() => window.location.reload(), 100);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };


  // Get dashboard path - all members go to the same dashboard
  const getDashboardPath = () => {
    return user?.role ? '/member/dashboard' : '/';
  };

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const userMenuItems = [
    // Admin Dashboard - only shown for admin users
    ...(isAdmin ? [{
      name: 'Admin Dashboard',
      href: '/admin/dashboard',
      icon: School2Icon,
      isAdmin: true
    }] : []),
    {
      name: 'Dashboard',
      href: getDashboardPath(),
      icon: HomeIcon,
      isDashboard: true
    },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Sign Out', action: handleLogout, icon: LogOut, isDestructive: true },
  ];

  // Get user initials safely
  const getUserInitials = () => {
    if (!user) return '?';

    const firstInitial = user.firstName?.[0] || user.name?.[0] || '';
    const lastInitial = user.lastName?.[0] || '';

    return `${firstInitial}${lastInitial}`.toUpperCase() || 'U';
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'User';

    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }

    return user.name || user.email?.split('@')[0] || 'User';
  };

  // Get user role safely
  const getUserRole = () => {
    if (!user) return '';
    return user.role?.toLowerCase() || 'user';
  };

  // Get user avatar URL
  const getUserAvatarUrl = () => {
    if (!user?.profileImageUrl) return null;
    return getAssetUrl(user.profileImageUrl);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-dropdown-container')) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserDropdown]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            {logoHtml ? (
              <div
                className="flex items-center"
                dangerouslySetInnerHTML={{ __html: logoHtml }}
              />
            ) : (
              <>
                <div style={{ width: "60px", height: "66px" }}
                  className="rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                  <img
                    src={logoPath}
                    alt="Pickleball.Community Logo"
                    className="w-full h-full object-contain p-1"
                    onError={handleImageError}
                    onLoad={() => console.log('Logo loaded successfully from:', logoPath)}
                  />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-800 bg-clip-text text-transparent">
                    Pickleball.Community
                  </span>
                  <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-blue-500 to-purple-700 transition-all duration-300 rounded-full"></div>
                </div>
              </>
            )}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${isActive(item.href)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
              >
                {item.icon && <item.icon className="w-8 h-8 inline mr-2" />}
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* User Section */}
          <div className="hidden md:flex items-center space-x-4 user-dropdown-container">
            {isAuthenticated && user ? (
              <>


                {/* User Avatar with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-2 hover:bg-gray-100 transition-colors focus:outline-none"
                    aria-expanded={showUserDropdown}
                    aria-haspopup="true"
                  >
                    {getUserAvatarUrl() ? (
                      <img
                        src={getUserAvatarUrl()}
                        alt={getUserDisplayName()}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center text-white text-sm font-medium ${getUserAvatarUrl() ? 'hidden' : 'flex'}`}
                    >
                      {getUserInitials()}
                    </div>
                    <div className="text-sm text-left">
                      <div className="font-medium text-gray-900">{getUserDisplayName()}</div>
                      <div className="text-gray-500 capitalize">{getUserRole()}</div>
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>

                      <div className="py-2">
                        {userMenuItems.map((item) => (
                          item.action ? (
                            <button
                              key={item.name}
                              onClick={item.action}
                              className={`w-full flex items-center px-4 py-3 text-sm transition-colors ${item.isDestructive
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                              <item.icon className="w-4 h-4 mr-3" />
                              {item.name}
                            </button>
                          ) : (
                            <Link
                              key={item.name}
                              to={item.href}
                              className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setShowUserDropdown(false)}
                            >
                              <item.icon className="w-4 h-4 mr-3" />
                              {item.name}
                            </Link>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => redirectToLogin()}
                  className="text-gray-600 hover:text-blue-600 px-4 py-2 font-medium transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => redirectToRegister()}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-shadow"
                >
                  Enroll Now
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition-colors"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden absolute top-16 inset-x-0 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-xl">
          <div className="px-4 py-6 space-y-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-lg font-medium transition-colors ${isActive(item.href)
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                onClick={() => setIsOpen(false)}
              >
                {item.icon && <item.icon className="w-5 h-5" />}
                <span>{item.name}</span>
              </Link>
            ))}

            {isAuthenticated && user ? (
              <>
                <div className="px-4 py-3 border-t border-gray-200">
                  <div className="flex items-center space-x-3 mb-4">
                    {getUserAvatarUrl() ? (
                      <img
                        src={getUserAvatarUrl()}
                        alt={getUserDisplayName()}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center text-white font-medium ${getUserAvatarUrl() ? 'hidden' : 'flex'}`}
                    >
                      {getUserInitials()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{getUserDisplayName()}</div>
                      <div className="text-sm text-gray-500 capitalize">{getUserRole()}</div>
                    </div>
                  </div>


                  {/* Mobile User Menu */}
                  <div className="space-y-2 mt-4">
                    {/* Admin Dashboard link for mobile - only for admins */}
                    {isAdmin && (
                      <Link
                        to="/admin/dashboard"
                        className="flex items-center space-x-2 px-4 py-3 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors font-medium"
                        onClick={() => setIsOpen(false)}
                      >
                        <School2Icon className="w-4 h-4" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}
                    {/* Dashboard link for mobile - all members */}
                    {user?.role && (
                      <Link
                        to="/member/dashboard"
                        className="flex items-center space-x-2 px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors font-medium"
                        onClick={() => setIsOpen(false)}
                      >
                        <HomeIcon className="w-4 h-4" />
                        <span>Dashboard</span>
                      </Link>
                    )}

                    <Link
                      to="/profile"
                      className="flex items-center space-x-2 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      <span>Profile</span>
                    </Link>
                    <Link
                      to="/notifications"
                      className="flex items-center space-x-2 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <Bell className="w-4 h-4" />
                      <span>Notifications</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-4 pt-4 border-t border-gray-200 space-y-3">
                <button
                  onClick={() => { setIsOpen(false); redirectToLogin(); }}
                  className="block w-full text-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setIsOpen(false); redirectToRegister(); }}
                  className="block w-full text-center px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-shadow"
                >
                  Enroll
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;