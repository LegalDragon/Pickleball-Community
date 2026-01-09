import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Settings, Loader2, Users, Calendar, Building2, Trophy, Eye, UserPlus
} from 'lucide-react'
import { userApi } from '../services/api'
import PublicProfileModal from '../components/ui/PublicProfileModal'

const MemberDashboard = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  const dashboardCards = [
    {
      title: 'Profile',
      description: 'Update your information and preferences',
      icon: Settings,
      color: 'blue',
      link: '/profile'
    },
    {
      title: 'Friends',
      description: 'Connect with other pickleball players',
      icon: Users,
      color: 'green',
      link: '/friends'
    },
    {
      title: 'Clubs',
      description: 'View and manage your club memberships',
      icon: Building2,
      color: 'purple',
      link: '/clubs?view=my'
    },
    {
      title: 'Events',
      description: 'See upcoming events you\'re registered for',
      icon: Calendar,
      color: 'orange',
      link: '/events?view=my'
    },
    {
      title: 'Reviews',
      description: 'Get certified through peer skill ratings',
      icon: UserPlus,
      color: 'teal',
      link: '/my-certificate'
    },
    {
      title: 'History',
      description: 'Games, awards, and rating history',
      icon: Trophy,
      color: 'yellow',
      link: '/history'
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
