import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, HomeIcon, School2Icon, User, Bell, FileText, Calendar, MapPin, Users, MessageCircle, HelpCircle, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAssetUrl, getSharedAssetUrl, notificationsApi } from '../../services/api';
import { useSharedAuth } from '../../hooks/useSharedAuth';
import { useNotifications } from '../../hooks/useNotifications';

// Shared Auth API URL from environment
const SHARED_AUTH_URL = import.meta.env.VITE_SHARED_AUTH_URL || 'https://shared.funtimepb.com/api';
const SITE_KEY = 'community';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [authKey, setAuthKey] = useState(0); // Add this
  const [logoHtml, setLogoHtml] = useState(null);
  const [newNotification, setNewNotification] = useState(null);
  const location = useLocation();

  const { user, logout, isAuthenticated } = useAuth();
  const { redirectToLogin, redirectToRegister } = useSharedAuth();
  const {
    unreadCount,
    connect: connectNotifications,
    disconnect: disconnectNotifications,
    addListener,
    setInitialUnreadCount,
    isConnected: notificationsConnected
  } = useNotifications();

  // Connect to notification hub when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      connectNotifications();
      // Fetch initial unread count from API
      notificationsApi.getUnreadCount()
        .then(res => {
          const count = res?.data?.count ?? res?.count ?? 0;
          setInitialUnreadCount(count);
        })
        .catch(err => console.error('Failed to get unread count:', err));
    } else {
      disconnectNotifications();
    }
  }, [isAuthenticated, user]);

  // Show toast for new notifications
  useEffect(() => {
    const removeListener = addListener((notification) => {
      setNewNotification(notification);
      // Auto-hide after 5 seconds
      setTimeout(() => setNewNotification(null), 5000);
    });
    return removeListener;
  }, [addListener]);

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

  // Primary navigation - most used
  const primaryNav = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Events', href: '/events', icon: Calendar },
    { name: 'Venues', href: '/venues', icon: MapPin },
    { name: 'Clubs', href: '/clubs', icon: Users },
  ];

  // Secondary navigation - less frequently used
  const secondaryNav = [
    { name: 'Blog', href: '/blog', icon: FileText },
    { name: 'FAQ', href: '/faq', icon: HelpCircle },
    { name: 'Feedback', href: '/feedback', icon: MessageSquarePlus },
  ];

  // Combined for desktop
  const navigation = [...primaryNav, ...secondaryNav];

  const isActive = (path) => location.pathname === path;
  const isHomePage = location.pathname === '/';

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
      setShowUserDropdown(false);
      setIsOpen(false);
      await logout(); // Use the logout function from AuthContext
      // ProtectedRoute will redirect to home if on a protected page
      // For non-protected pages, navigate to home
      window.location.href = '/';
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
    { name: 'Messages', href: '/messages', icon: MessageCircle },
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

  // Get user avatar URL (from Funtime-Shared)
  const getUserAvatarUrl = () => {
    if (!user?.profileImageUrl) return null;
    return getSharedAssetUrl(user.profileImageUrl);
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

  // No navbar for home page when not authenticated - hero section handles CTAs
  if (isHomePage && !isAuthenticated) {
    return null;
  }

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
                {/* Notification Bell Icon */}
                <Link
                  to="/notifications"
                  className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-medium px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

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
                              <div className="relative mr-3">
                                <item.icon className="w-4 h-4" />
                                {item.name === 'Notifications' && unreadCount > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-3.5 h-3.5 flex items-center justify-center font-medium text-[10px]">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                  </span>
                                )}
                              </div>
                              {item.name}
                              {item.name === 'Notifications' && unreadCount > 0 && (
                                <span className="ml-auto bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                                  {unreadCount} new
                                </span>
                              )}
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
          <div className="md:hidden flex items-center space-x-2">
            {/* Mobile Notification Bell */}
            {isAuthenticated && user && (
              <Link
                to="/notifications"
                className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-xl transition-colors"
                title="Notifications"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-medium px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
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
        <div className="md:hidden absolute top-16 inset-x-0 bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4">
            {isAuthenticated && user ? (
              <>
                {/* User section at top for logged-in users */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
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
                      <div className="font-semibold text-gray-900 text-sm">{getUserDisplayName()}</div>
                      <div className="text-xs text-gray-500 capitalize">{getUserRole()}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>

                {/* Quick user actions */}
                <div className="grid grid-cols-4 gap-2 pb-3 mb-3 border-b border-gray-200">
                  <Link
                    to="/member/dashboard"
                    className="flex flex-col items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <HomeIcon className="w-5 h-5" />
                    <span className="text-xs mt-1">Dashboard</span>
                  </Link>
                  <Link
                    to="/profile"
                    className="flex flex-col items-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-xs mt-1">Profile</span>
                  </Link>
                  <Link
                    to="/messages"
                    className="flex flex-col items-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-xs mt-1">Messages</span>
                  </Link>
                  <Link
                    to="/notifications"
                    className="flex flex-col items-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors relative"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="relative">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-xs mt-1">Alerts</span>
                  </Link>
                </div>

                {/* Admin link if admin */}
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    className="flex items-center space-x-2 px-3 py-2 mb-3 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors font-medium text-sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <School2Icon className="w-4 h-4" />
                    <span>Admin Dashboard</span>
                  </Link>
                )}
              </>
            ) : (
              /* Auth buttons for non-logged in users */
              <div className="flex space-x-2 pb-3 mb-3 border-b border-gray-200">
                <button
                  onClick={() => { setIsOpen(false); redirectToLogin(); }}
                  className="flex-1 text-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setIsOpen(false); redirectToRegister(); }}
                  className="flex-1 text-center px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-shadow text-sm"
                >
                  Enroll
                </button>
              </div>
            )}

            {/* Primary Navigation */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {primaryNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-2 px-3 py-3 rounded-lg font-medium transition-colors ${isActive(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon && <item.icon className="w-5 h-5" />}
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>

            {/* Secondary Navigation - smaller */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {secondaryNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon && <item.icon className="w-4 h-4" />}
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast notification for new notifications */}
      {newNotification && (
        <div className="fixed top-20 right-4 z-50 transition-all duration-300 transform translate-x-0">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm ring-2 ring-blue-500 ring-opacity-50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {newNotification.title}
                </p>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {newNotification.message}
                </p>
              </div>
              <button
                onClick={() => setNewNotification(null)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Link
              to="/notifications"
              className="mt-3 block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => setNewNotification(null)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;