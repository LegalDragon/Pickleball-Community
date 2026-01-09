import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Menu, X, User, LogOut, Video, BookOpen } from 'lucide-react'
import { useState } from 'react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Marketplace', href: '/marketplace', icon: BookOpen },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                Pickleball.Community
              </span>
              <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all duration-300 rounded-full"></div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`nav-link ${isActive(item.href) ? 'active' : ''} flex items-center space-x-2`}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* User Section */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                {/* Dashboard Links */}
                {user.role === 'Manager' && (
                  <Link
                    to="/manager/dashboard"
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Manager Dashboard
                  </Link>
                )}
                {user.role === 'Player' && (
                  <Link
                    to="/player/dashboard"
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Player Dashboard
                  </Link>
                )}

                {/* User Menu */}
                <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                    <div className="text-gray-500 capitalize">{user.role}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-primary-600 px-4 py-2 font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-gray-600 hover:text-primary-600 hover:bg-gray-50 transition-colors"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden absolute top-16 inset-x-0 bg-white/95 backdrop-blur-lg border-b border-gray-100 shadow-xl">
          <div className="px-4 py-6 space-y-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-lg font-medium transition-colors ${
                  isActive(item.href) 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                }`}
                onClick={() => setIsOpen(false)}
              >
                {item.icon && <item.icon className="w-5 h-5" />}
                <span>{item.name}</span>
              </Link>
            ))}
            
            {user ? (
              <>
                <div className="px-4 py-3 border-t border-gray-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-medium">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{user.firstName} {user.lastName}</div>
                      <div className="text-sm text-gray-500 capitalize">{user.role}</div>
                    </div>
                  </div>
                  {user.role === 'Manager' && (
                    <Link
                      to="/manager/dashboard"
                      className="block w-full text-center btn-primary mb-3"
                      onClick={() => setIsOpen(false)}
                    >
                      Manager Dashboard
                    </Link>
                  )}
                  {user.role === 'Player' && (
                    <Link
                      to="/player/dashboard"
                      className="block w-full text-center btn-primary mb-3"
                      onClick={() => setIsOpen(false)}
                    >
                      Player Dashboard
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      logout()
                      setIsOpen(false)
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4 pt-4 border-t border-gray-100 space-y-3">
                <Link
                  to="/login"
                  className="block w-full text-center btn-secondary"
                  onClick={() => setIsOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="block w-full text-center btn-primary"
                  onClick={() => setIsOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar 