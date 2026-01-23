import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { playerHistoryApi, getSharedAssetUrl } from '../services/api'
import PublicProfileModal from '../components/ui/PublicProfileModal'
import {
  Trophy,
  Gamepad2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Medal,
  Star,
  Award,
  Target,
  Users,
  Search,
  X,
  CreditCard,
  DollarSign,
  CheckCircle,
  Clock,
  ExternalLink,
  Image,
  AlertCircle
} from 'lucide-react'

export default function PlayerHistory() {
  const { user, isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState('games')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)

  // Game History State
  const [games, setGames] = useState([])
  const [gamesStats, setGamesStats] = useState({})
  const [gameFilters, setGameFilters] = useState({
    partnerName: '',
    opponentName: '',
    dateFrom: '',
    dateTo: '',
    eventType: '',
    winsOnly: false
  })
  const [showGameFilters, setShowGameFilters] = useState(false)
  const [expandedGames, setExpandedGames] = useState({})
  const [eventTypes, setEventTypes] = useState([])
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null)

  // Awards State
  const [awards, setAwards] = useState([])
  const [awardsStats, setAwardsStats] = useState({})
  const [awardFilters, setAwardFilters] = useState({
    awardType: '',
    dateFrom: '',
    dateTo: '',
    activeOnly: true
  })
  const [showAwardFilters, setShowAwardFilters] = useState(false)
  const [awardTypes, setAwardTypes] = useState([])

  // Ratings State
  const [ratings, setRatings] = useState([])
  const [ratingsStats, setRatingsStats] = useState({})
  const [ratingFilters, setRatingFilters] = useState({
    ratingType: '',
    dateFrom: '',
    dateTo: ''
  })
  const [showRatingFilters, setShowRatingFilters] = useState(false)
  const [ratingTypes, setRatingTypes] = useState([])

  // Payments State
  const [payments, setPayments] = useState([])
  const [paymentsStats, setPaymentsStats] = useState({})
  const [paymentFilters, setPaymentFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: ''
  })
  const [showPaymentFilters, setShowPaymentFilters] = useState(false)
  const [paymentStatuses, setPaymentStatuses] = useState([])
  const [expandedPayments, setExpandedPayments] = useState({})
  const [selectedProofImage, setSelectedProofImage] = useState(null)

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadInitialData()
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    if (user?.id) {
      if (activeTab === 'games') loadGames()
      else if (activeTab === 'awards') loadAwards()
      else if (activeTab === 'ratings') loadRatings()
      else if (activeTab === 'payments') loadPayments()
    }
  }, [activeTab, user])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [summaryRes, eventTypesRes, awardTypesRes, ratingTypesRes, paymentStatusesRes] = await Promise.all([
        playerHistoryApi.getSummary(user.id),
        playerHistoryApi.getEventTypes(),
        playerHistoryApi.getAwardTypes(),
        playerHistoryApi.getRatingTypes(),
        playerHistoryApi.getPaymentStatuses()
      ])

      if (summaryRes?.success) setSummary(summaryRes.data)
      if (eventTypesRes?.success) setEventTypes(eventTypesRes.data || [])
      if (awardTypesRes?.success) setAwardTypes(awardTypesRes.data || [])
      if (ratingTypesRes?.success) setRatingTypes(ratingTypesRes.data || [])
      if (paymentStatusesRes?.success) setPaymentStatuses(paymentStatusesRes.data || [])

      // Load initial tab data
      loadGames()
    } catch (err) {
      console.error('Error loading initial data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGames = async () => {
    if (!user?.id) return
    try {
      const params = {
        pageSize: 50,
        ...gameFilters,
        winsOnly: gameFilters.winsOnly || undefined
      }
      // Remove empty values
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined) delete params[key]
      })

      const response = await playerHistoryApi.getGames(user.id, params)
      if (response?.success) {
        setGames(response.data?.games || [])
        setGamesStats({
          totalGames: response.data?.totalGames || 0,
          totalWins: response.data?.totalWins || 0,
          totalLosses: response.data?.totalLosses || 0,
          winPercentage: response.data?.winPercentage || 0
        })
      }
    } catch (err) {
      console.error('Error loading games:', err)
    }
  }

  const loadAwards = async () => {
    if (!user?.id) return
    try {
      const params = {
        pageSize: 50,
        ...awardFilters
      }
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined) delete params[key]
      })

      const response = await playerHistoryApi.getAwards(user.id, params)
      if (response?.success) {
        setAwards(response.data?.awards || [])
        setAwardsStats({
          totalBadges: response.data?.totalBadges || 0,
          totalLeaguePoints: response.data?.totalLeaguePoints || 0,
          notableFinishes: response.data?.notableFinishes || 0
        })
      }
    } catch (err) {
      console.error('Error loading awards:', err)
    }
  }

  const loadRatings = async () => {
    if (!user?.id) return
    try {
      const params = {
        pageSize: 100,
        ...ratingFilters
      }
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined) delete params[key]
      })

      const response = await playerHistoryApi.getRatings(user.id, params)
      if (response?.success) {
        setRatings(response.data?.ratings || [])
        setRatingsStats({
          currentRating: response.data?.currentRating,
          highestRating: response.data?.highestRating,
          lowestRating: response.data?.lowestRating,
          ratingTrend: response.data?.ratingTrend
        })
      }
    } catch (err) {
      console.error('Error loading ratings:', err)
    }
  }

  const loadPayments = async () => {
    if (!user?.id) return
    try {
      const params = {
        pageSize: 50,
        ...paymentFilters
      }
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined) delete params[key]
      })

      const response = await playerHistoryApi.getPayments(user.id, params)
      if (response?.success) {
        setPayments(response.data?.payments || [])
        setPaymentsStats({
          totalAmountPaid: response.data?.totalAmountPaid || 0,
          totalVerified: response.data?.totalVerified || 0,
          totalPending: response.data?.totalPending || 0
        })
      }
    } catch (err) {
      console.error('Error loading payments:', err)
    }
  }

  const toggleGameExpand = (gameId) => {
    setExpandedGames(prev => ({
      ...prev,
      [gameId]: !prev[gameId]
    }))
  }

  const clearGameFilters = () => {
    setGameFilters({
      partnerName: '',
      opponentName: '',
      dateFrom: '',
      dateTo: '',
      eventType: '',
      winsOnly: false
    })
  }

  const clearAwardFilters = () => {
    setAwardFilters({
      awardType: '',
      dateFrom: '',
      dateTo: '',
      activeOnly: true
    })
  }

  const clearRatingFilters = () => {
    setRatingFilters({
      ratingType: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const clearPaymentFilters = () => {
    setPaymentFilters({
      status: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const togglePaymentExpand = (paymentId) => {
    setExpandedPayments(prev => ({
      ...prev,
      [paymentId]: !prev[paymentId]
    }))
  }

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'Verified': return 'bg-green-100 text-green-700'
      case 'Pending': return 'bg-yellow-100 text-yellow-700'
      case 'PendingVerification': return 'bg-blue-100 text-blue-700'
      case 'Rejected': return 'bg-red-100 text-red-700'
      case 'Refunded': return 'bg-purple-100 text-purple-700'
      case 'Cancelled': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getPaymentStatusIcon = (status) => {
    switch (status) {
      case 'Verified': return <CheckCircle className="w-4 h-4" />
      case 'Pending': return <Clock className="w-4 h-4" />
      case 'PendingVerification': return <Clock className="w-4 h-4" />
      default: return <CreditCard className="w-4 h-4" />
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getBadgeColorClass = (color) => {
    const colors = {
      gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      silver: 'bg-gray-100 text-gray-800 border-gray-300',
      bronze: 'bg-orange-100 text-orange-800 border-orange-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      green: 'bg-green-100 text-green-800 border-green-300',
      purple: 'bg-purple-100 text-purple-800 border-purple-300'
    }
    return colors[color] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getAwardIcon = (awardType) => {
    switch (awardType) {
      case 'Badge': return <Medal className="w-5 h-5" />
      case 'LeaguePoints': return <Star className="w-5 h-5" />
      case 'NotableFinish': return <Trophy className="w-5 h-5" />
      case 'Achievement': return <Award className="w-5 h-5" />
      case 'Milestone': return <Target className="w-5 h-5" />
      default: return <Award className="w-5 h-5" />
    }
  }

  const getPlacementLabel = (rank) => {
    if (rank === 1) return '1st Place'
    if (rank === 2) return '2nd Place'
    if (rank === 3) return '3rd Place'
    return `${rank}th Place`
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Please log in to view your history</h2>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Trophy className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">Player History</h1>
              <p className="text-yellow-100 mt-1">
                View your game history, awards, and ratings over time
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Gamepad2 className="w-4 h-4" />
                <span className="text-sm">Games Played</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalGamesPlayed}</div>
              <div className="text-sm text-gray-500">
                {summary.totalWins}W - {summary.totalLosses}L ({summary.winPercentage}%)
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-sm">Awards</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalAwards}</div>
              <div className="text-sm text-gray-500">
                {summary.totalBadges} badges, {summary.notableFinishes} finishes
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Star className="w-4 h-4" />
                <span className="text-sm">League Points</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalLeaguePoints}</div>
              <div className="text-sm text-gray-500">Total accumulated</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Current Rating</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.currentRating?.toFixed(2) || '-'}
              </div>
              <div className="text-sm text-gray-500">
                {summary.ratingTrend > 0 ? '+' : ''}{summary.ratingTrend?.toFixed(2) || '0'} last 30 days
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Payments</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">${summary.totalAmountPaid?.toFixed(2) || '0.00'}</div>
              <div className="text-sm text-gray-500">
                {summary.totalPayments || 0} total, {summary.pendingPayments || 0} pending
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'games'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
            Games
            {gamesStats.totalGames > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'games' ? 'bg-amber-500' : 'bg-gray-200'
              }`}>
                {gamesStats.totalGames}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('awards')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'awards'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <Trophy className="w-5 h-5" />
            Awards
            {awardsStats.totalBadges > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'awards' ? 'bg-amber-500' : 'bg-gray-200'
              }`}>
                {awards.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ratings')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'ratings'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            Ratings
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            Payments
            {paymentsStats.totalPending > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'payments' ? 'bg-amber-500' : 'bg-yellow-200 text-yellow-800'
              }`}>
                {paymentsStats.totalPending}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {/* Game History Tab */}
        {activeTab === 'games' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Game History</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {gamesStats.totalGames || 0} games found
                  {gamesStats.totalGames > 0 && ` (${gamesStats.winPercentage}% win rate)`}
                </p>
              </div>
              <button
                onClick={() => setShowGameFilters(!showGameFilters)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showGameFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-6">
              {/* Game Filters */}
              {showGameFilters && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name</label>
                        <input
                          type="text"
                          value={gameFilters.partnerName}
                          onChange={(e) => setGameFilters({...gameFilters, partnerName: e.target.value})}
                          placeholder="Search partner..."
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opponent Name</label>
                        <input
                          type="text"
                          value={gameFilters.opponentName}
                          onChange={(e) => setGameFilters({...gameFilters, opponentName: e.target.value})}
                          placeholder="Search opponent..."
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                        <select
                          value={gameFilters.eventType}
                          onChange={(e) => setGameFilters({...gameFilters, eventType: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="">All Types</option>
                          {eventTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                        <input
                          type="date"
                          value={gameFilters.dateFrom}
                          onChange={(e) => setGameFilters({...gameFilters, dateFrom: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                        <input
                          type="date"
                          value={gameFilters.dateTo}
                          onChange={(e) => setGameFilters({...gameFilters, dateTo: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={gameFilters.winsOnly}
                            onChange={(e) => setGameFilters({...gameFilters, winsOnly: e.target.checked})}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Wins Only</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={loadGames}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                      >
                        <Search className="w-4 h-4 inline mr-1" />
                        Apply Filters
                      </button>
                      <button
                        onClick={() => { clearGameFilters(); setTimeout(loadGames, 100); }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                      >
                        <X className="w-4 h-4 inline mr-1" />
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Games List */}
                {games.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No games found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {games.map(game => (
                      <div key={game.gameId} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleGameExpand(game.gameId)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-16 text-center py-1 rounded text-sm font-medium ${
                              game.isWin ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {game.result}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{game.eventName}</div>
                              <div className="text-sm text-gray-500">
                                {game.divisionName} - {game.roundName || game.roundType} - Game {game.gameNumber}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-bold text-lg">{game.scoreDisplay}</div>
                              <div className="text-sm text-gray-500">{formatDate(game.gameDate)}</div>
                            </div>
                            {expandedGames[game.gameId] ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedGames[game.gameId] && (
                          <div className="border-t bg-gray-50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Partner */}
                              {game.partnerName && (
                                <div>
                                  <div className="text-sm font-medium text-gray-600 mb-2">Partner</div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (game.partnerId) setSelectedProfileUserId(game.partnerId)
                                    }}
                                    className={`flex items-center gap-3 ${game.partnerId ? 'hover:bg-gray-100 rounded-lg p-1 -m-1 cursor-pointer' : ''}`}
                                    disabled={!game.partnerId}
                                  >
                                    {game.partnerProfileImageUrl ? (
                                      <img
                                        src={getSharedAssetUrl(game.partnerProfileImageUrl)}
                                        alt={game.partnerName}
                                        className="w-10 h-10 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-emerald-600" />
                                      </div>
                                    )}
                                    <span className={`font-medium ${game.partnerId ? 'text-blue-600 hover:underline' : ''}`}>{game.partnerName}</span>
                                  </button>
                                </div>
                              )}

                              {/* Opponents */}
                              <div>
                                <div className="text-sm font-medium text-gray-600 mb-2">Opponents</div>
                                <div className="space-y-2">
                                  {game.opponents.map((opp, idx) => (
                                    <button
                                      key={idx}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (opp.userId) setSelectedProfileUserId(opp.userId)
                                      }}
                                      className={`flex items-center gap-3 ${opp.userId ? 'hover:bg-gray-100 rounded-lg p-1 -m-1 cursor-pointer' : ''}`}
                                      disabled={!opp.userId}
                                    >
                                      {opp.profileImageUrl ? (
                                        <img
                                          src={getSharedAssetUrl(opp.profileImageUrl)}
                                          alt={opp.name}
                                          className="w-10 h-10 rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                          <Users className="w-5 h-5 text-gray-600" />
                                        </div>
                                      )}
                                      <span className={`font-medium ${opp.userId ? 'text-blue-600 hover:underline' : ''}`}>{opp.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Awards Tab */}
        {activeTab === 'awards' && (
          <div className="bg-white rounded-xl shadow-sm">
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Awards & Achievements</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {awards.length} awards
                  {awardsStats.totalLeaguePoints > 0 && ` (${awardsStats.totalLeaguePoints} league points)`}
                </p>
              </div>
              <button
                onClick={() => setShowAwardFilters(!showAwardFilters)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showAwardFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-6">
                {/* Award Filters */}
                {showAwardFilters && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Award Type</label>
                        <select
                          value={awardFilters.awardType}
                          onChange={(e) => setAwardFilters({...awardFilters, awardType: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="">All Types</option>
                          {awardTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                        <input
                          type="date"
                          value={awardFilters.dateFrom}
                          onChange={(e) => setAwardFilters({...awardFilters, dateFrom: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                        <input
                          type="date"
                          value={awardFilters.dateTo}
                          onChange={(e) => setAwardFilters({...awardFilters, dateTo: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={awardFilters.activeOnly}
                            onChange={(e) => setAwardFilters({...awardFilters, activeOnly: e.target.checked})}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Active Only</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={loadAwards}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                      >
                        <Search className="w-4 h-4 inline mr-1" />
                        Apply Filters
                      </button>
                      <button
                        onClick={() => { clearAwardFilters(); setTimeout(loadAwards, 100); }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                      >
                        <X className="w-4 h-4 inline mr-1" />
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Awards List */}
                {awards.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No awards found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {awards.map(award => (
                      <div
                        key={award.id}
                        className={`border rounded-lg p-4 ${getBadgeColorClass(award.badgeColor)} ${award.isExpired ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm">
                            {getAwardIcon(award.awardType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{award.title}</h3>
                              {award.placementRank && (
                                <span className="text-xs px-2 py-0.5 bg-white rounded-full">
                                  {getPlacementLabel(award.placementRank)}
                                </span>
                              )}
                            </div>
                            {award.description && (
                              <p className="text-sm mt-1 opacity-80">{award.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2 text-xs">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(award.awardedAt)}
                              </span>
                              {award.eventName && (
                                <span className="bg-white px-2 py-0.5 rounded">{award.eventName}</span>
                              )}
                              {award.leagueName && (
                                <span className="bg-white px-2 py-0.5 rounded">{award.leagueName}</span>
                              )}
                              {award.pointsValue && (
                                <span className="bg-white px-2 py-0.5 rounded font-medium">
                                  +{award.pointsValue} pts
                                </span>
                              )}
                            </div>
                            {award.isExpired && (
                              <div className="text-xs mt-2 text-red-600">Expired</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Ratings Tab */}
        {activeTab === 'ratings' && (
          <div className="bg-white rounded-xl shadow-sm">
            {/* Header */}
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Rating History</h2>
              <p className="text-gray-500 text-sm mt-1">Track your skill rating changes over time</p>
            </div>

            <div className="p-6">
              {/* Rating Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-600">Current</div>
                    <div className="text-xl font-bold text-gray-900">
                      {ratingsStats.currentRating?.toFixed(2) || '-'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-600">Highest</div>
                    <div className="text-xl font-bold text-green-600">
                      {ratingsStats.highestRating?.toFixed(2) || '-'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-600">Lowest</div>
                    <div className="text-xl font-bold text-red-600">
                      {ratingsStats.lowestRating?.toFixed(2) || '-'}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-600">30-Day Trend</div>
                    <div className={`text-xl font-bold ${
                      (ratingsStats.ratingTrend || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {ratingsStats.ratingTrend > 0 ? '+' : ''}{ratingsStats.ratingTrend?.toFixed(2) || '0'}
                    </div>
                  </div>
                </div>

                {/* Filter Toggle */}
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-600">{ratings.length} rating entries</div>
                  <button
                    onClick={() => setShowRatingFilters(!showRatingFilters)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                    {showRatingFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Rating Filters */}
                {showRatingFilters && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rating Type</label>
                        <select
                          value={ratingFilters.ratingType}
                          onChange={(e) => setRatingFilters({...ratingFilters, ratingType: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="">All Types</option>
                          {ratingTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                        <input
                          type="date"
                          value={ratingFilters.dateFrom}
                          onChange={(e) => setRatingFilters({...ratingFilters, dateFrom: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                        <input
                          type="date"
                          value={ratingFilters.dateTo}
                          onChange={(e) => setRatingFilters({...ratingFilters, dateTo: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={loadRatings}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                      >
                        <Search className="w-4 h-4 inline mr-1" />
                        Apply Filters
                      </button>
                      <button
                        onClick={() => { clearRatingFilters(); setTimeout(loadRatings, 100); }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                      >
                        <X className="w-4 h-4 inline mr-1" />
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Ratings List */}
                {ratings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No rating history found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Rating</th>
                          <th className="text-left p-3 font-medium">Change</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-left p-3 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratings.map(rating => (
                          <tr key={rating.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">{formatDate(rating.effectiveDate)}</td>
                            <td className="p-3 font-bold">{rating.rating.toFixed(2)}</td>
                            <td className="p-3">
                              {rating.ratingChange !== null && (
                                <span className={`font-medium ${
                                  rating.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {rating.ratingChange > 0 ? '+' : ''}{rating.ratingChange.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                {rating.ratingType}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600">
                              {rating.source || rating.eventName || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow-sm">
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Payment History</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {payments.length} payments found
                  {paymentsStats.totalAmountPaid > 0 && ` (${paymentsStats.totalVerified} verified)`}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentFilters(!showPaymentFilters)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showPaymentFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-6">
              {/* Payment Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-sm text-green-600">Verified</div>
                  <div className="text-xl font-bold text-green-700">
                    ${paymentsStats.totalAmountPaid?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-sm text-yellow-600">Pending</div>
                  <div className="text-xl font-bold text-yellow-700">
                    {paymentsStats.totalPending || 0}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-sm text-gray-600">Verified Count</div>
                  <div className="text-xl font-bold text-gray-700">
                    {paymentsStats.totalVerified || 0}
                  </div>
                </div>
              </div>

              {/* Payment Filters */}
              {showPaymentFilters && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={paymentFilters.status}
                        onChange={(e) => setPaymentFilters({...paymentFilters, status: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">All Statuses</option>
                        {paymentStatuses.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                      <input
                        type="date"
                        value={paymentFilters.dateFrom}
                        onChange={(e) => setPaymentFilters({...paymentFilters, dateFrom: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                      <input
                        type="date"
                        value={paymentFilters.dateTo}
                        onChange={(e) => setPaymentFilters({...paymentFilters, dateTo: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={loadPayments}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                    >
                      <Search className="w-4 h-4 inline mr-1" />
                      Apply Filters
                    </button>
                    <button
                      onClick={() => { clearPaymentFilters(); setTimeout(loadPayments, 100); }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                    >
                      <X className="w-4 h-4 inline mr-1" />
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Payments List */}
              {payments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No payments found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map(payment => (
                    <div key={payment.id} className="border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => togglePaymentExpand(payment.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">{payment.eventName}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${getPaymentStatusColor(payment.status)}`}>
                              {getPaymentStatusIcon(payment.status)}
                              {payment.status === 'PendingVerification' ? 'Pending Verification' : payment.status}
                            </span>
                            {payment.registrations?.length > 0 && !payment.feesMatch && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Fee mismatch
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 space-y-1">
                            {payment.divisionName && (
                              <div>Division: {payment.divisionName}</div>
                            )}
                            {payment.paymentMethod && (
                              <div>Method: {payment.paymentMethod}</div>
                            )}
                            {payment.paymentReference && (
                              <div>Reference: {payment.paymentReference}</div>
                            )}
                            {payment.referenceId && (
                              <div className="text-xs text-gray-400">ID: {payment.referenceId}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              ${payment.amount?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-gray-500">{formatDate(payment.createdAt)}</div>
                          </div>
                          {expandedPayments[payment.id] ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedPayments[payment.id] && (
                        <div className="border-t bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Payment Proof */}
                            {payment.paymentProofUrl && (
                              <div>
                                <div className="text-sm font-medium text-gray-600 mb-2">Payment Proof</div>
                                <div className="bg-white rounded-lg border p-2">
                                  <img
                                    src={getSharedAssetUrl(payment.paymentProofUrl)}
                                    alt="Payment proof"
                                    className="max-w-full max-h-64 object-contain rounded cursor-pointer hover:opacity-90"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedProofImage(getSharedAssetUrl(payment.paymentProofUrl))
                                    }}
                                  />
                                  <a
                                    href={getSharedAssetUrl(payment.paymentProofUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Open in new tab
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Registrations Applied */}
                            <div>
                              <div className="text-sm font-medium text-gray-600 mb-2">
                                Registrations Applied ({payment.registrations?.length || 0})
                              </div>
                              {payment.registrations?.length > 0 ? (
                                <div className="bg-white rounded-lg border divide-y">
                                  {payment.registrations.map((reg, idx) => (
                                    <div key={idx} className="p-3 text-sm">
                                      <div className="font-medium text-gray-900">{reg.playerName}</div>
                                      <div className="text-gray-500">
                                        {reg.eventName} - {reg.divisionName}
                                      </div>
                                      <div className="flex justify-between mt-1">
                                        <span className="text-gray-500">{reg.feeName || 'Registration Fee'}</span>
                                        <span className="font-medium">${reg.feeAmount?.toFixed(2) || '0.00'}</span>
                                      </div>
                                    </div>
                                  ))}
                                  <div className="p-3 bg-gray-50 flex justify-between font-medium">
                                    <span>Total Registration Fees</span>
                                    <span className={payment.feesMatch ? 'text-green-600' : 'text-amber-600'}>
                                      ${payment.totalRegistrationFees?.toFixed(2) || '0.00'}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-white rounded-lg border p-3 text-sm text-gray-500 italic">
                                  No registrations linked to this payment
                                </div>
                              )}

                              {/* Fee Comparison */}
                              {payment.registrations?.length > 0 && (
                                <div className={`mt-3 p-3 rounded-lg text-sm ${
                                  payment.feesMatch
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-amber-50 border border-amber-200'
                                }`}>
                                  <div className="flex justify-between mb-1">
                                    <span>Payment Amount:</span>
                                    <span className="font-medium">${payment.amount?.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between mb-1">
                                    <span>Total Fees:</span>
                                    <span className="font-medium">${payment.totalRegistrationFees?.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 border-t">
                                    <span>Difference:</span>
                                    <span className={`font-bold ${payment.feesMatch ? 'text-green-600' : 'text-amber-600'}`}>
                                      {payment.feesMatch ? (
                                        <span className="flex items-center gap-1">
                                          <CheckCircle className="w-4 h-4" />
                                          Matches
                                        </span>
                                      ) : (
                                        `$${Math.abs(payment.amount - payment.totalRegistrationFees).toFixed(2)} ${
                                          payment.amount > payment.totalRegistrationFees ? 'overpaid' : 'underpaid'
                                        }`
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Additional Info */}
                          <div className="mt-4 pt-4 border-t text-sm text-gray-500 space-y-1">
                            {payment.verifiedAt && (
                              <div>
                                Verified {formatDate(payment.verifiedAt)}
                                {payment.verifiedByName && ` by ${payment.verifiedByName}`}
                              </div>
                            )}
                            {payment.notes && (
                              <div className="italic">{payment.notes}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Public Profile Modal */}
      {selectedProfileUserId && (
        <PublicProfileModal
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
        />
      )}

      {/* Payment Proof Image Modal */}
      {selectedProofImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[1100]"
          onClick={() => setSelectedProofImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setSelectedProofImage(null)}
              className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedProofImage}
              alt="Payment proof"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
