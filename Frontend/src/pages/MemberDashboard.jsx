import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Settings, Loader2, Users, Calendar, Building2, Trophy,
  Bell, ChevronDown, ChevronUp, Eye, UserPlus, Info, CheckCircle, AlertTriangle
} from 'lucide-react'
import { userApi } from '../services/api'
import PublicProfileModal from '../components/ui/PublicProfileModal'

const MemberDashboard = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [expandedNotifications, setExpandedNotifications] = useState({})

  // Sample system notifications - in a real app, these would come from an API
  const [notifications] = useState([
    {
      id: 1,
      type: 'info',
      title: 'Welcome to Pickleball Community!',
      message: 'Complete your profile to connect with other players in your area. Add your playing style, experience level, and equipment preferences.',
      date: new Date().toISOString(),
      icon: Info
    },
    {
      id: 2,
      type: 'success',
      title: 'Profile Setup Complete',
      message: 'Your profile is now visible to other players. Start connecting with friends and join local clubs!',
      date: new Date(Date.now() - 86400000).toISOString(),
      icon: CheckCircle
    },
    {
      id: 3,
      type: 'warning',
      title: 'Get Peer Certified',
      message: 'Request skill reviews from players who know you to get your official certification badge. Share your review link with friends!',
      date: new Date(Date.now() - 172800000).toISOString(),
      icon: AlertTriangle
    }
  ])

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const response = await userApi.getProfile()
      setProfile(response.data || response)
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleNotification = (id) => {
    setExpandedNotifications(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const getNotificationStyles = (type) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500 bg-green-50'
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50'
      case 'error':
        return 'border-l-red-500 bg-red-50'
      default:
        return 'border-l-blue-500 bg-blue-50'
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-blue-600'
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  const dashboardCards = [
    {
      title: 'Edit Profile',
      description: 'Update your information and preferences',
      icon: Settings,
      color: 'blue',
      link: '/profile'
    },
    {
      title: 'My Friends',
      description: 'Connect with other pickleball players',
      icon: Users,
      color: 'green',
      link: '/friends'
    },
    {
      title: 'My Clubs',
      description: 'View and manage your club memberships',
      icon: Building2,
      color: 'purple',
      link: '/clubs?view=my'
    },
    {
      title: 'My Events',
      description: 'See upcoming events you\'re registered for',
      icon: Calendar,
      color: 'orange',
      link: '/events?view=my'
    },
    {
      title: 'Peer Review',
      description: 'Get certified through peer skill ratings',
      icon: UserPlus,
      color: 'teal',
      link: '/my-certificate'
    },
    {
      title: 'Awards History',
      description: 'View your achievements and badges',
      icon: Trophy,
      color: 'yellow',
      link: '/awards'
    }
  ]

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
      teal: 'bg-teal-100 text-teal-600',
      yellow: 'bg-yellow-100 text-yellow-600'
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName || profile?.firstName || 'Member'}!
          </h1>
          <button
            onClick={() => setShowProfileModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
            View Public Profile
          </button>
        </div>

        {/* System Notifications - Accordion Style */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
              {notifications.length}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No notifications at this time
              </div>
            ) : (
              notifications.map((notification) => {
                const IconComponent = notification.icon
                const isExpanded = expandedNotifications[notification.id]

                return (
                  <div
                    key={notification.id}
                    className={`border-l-4 ${getNotificationStyles(notification.type)}`}
                  >
                    <button
                      onClick={() => toggleNotification(notification.id)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-opacity-75 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <IconComponent className={`w-5 h-5 flex-shrink-0 ${getIconColor(notification.type)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{notification.title}</p>
                          <p className="text-xs text-gray-500">{formatDate(notification.date)}</p>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-6 pb-4 pl-14">
                        <p className="text-gray-600 text-sm">{notification.message}</p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardCards.map((card) => {
            const IconComponent = card.icon
            return (
              <Link
                key={card.title}
                to={card.link}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getColorClasses(card.color)}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{card.title}</h3>
                    <p className="text-sm text-gray-600">{card.description}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Player Info - kept for those who have data */}
        {(profile?.playingStyle || profile?.paddleBrand || profile?.yearsPlaying) && (
          <div className="bg-white rounded-lg shadow mt-6 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Player Info</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {profile?.playingStyle && (
                <div>
                  <p className="text-xs text-gray-500">Playing Style</p>
                  <p className="font-medium text-gray-900">{profile.playingStyle}</p>
                </div>
              )}
              {profile?.paddleBrand && (
                <div>
                  <p className="text-xs text-gray-500">Paddle</p>
                  <p className="font-medium text-gray-900">
                    {profile.paddleBrand} {profile.paddleModel && `- ${profile.paddleModel}`}
                  </p>
                </div>
              )}
              {profile?.yearsPlaying && (
                <div>
                  <p className="text-xs text-gray-500">Years Playing</p>
                  <p className="font-medium text-gray-900">{profile.yearsPlaying}</p>
                </div>
              )}
              {profile?.handedness && (
                <div>
                  <p className="text-xs text-gray-500">Handedness</p>
                  <p className="font-medium text-gray-900">{profile.handedness}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Public Profile Modal */}
      {showProfileModal && user && (
        <PublicProfileModal
          userId={user.id}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  )
}

export default MemberDashboard
