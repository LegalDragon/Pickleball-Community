import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle, XCircle, Play, Clock, MapPin,
  RefreshCw, AlertCircle, FileText, Trophy, Calendar,
  ChevronRight, User, DollarSign, Users, Bell, History,
  ChevronDown, ChevronUp, Info
} from 'lucide-react'
import { gameDayApi, checkInApi, tournamentApi, getSharedAssetUrl } from '../services/api'
import { useNotifications } from '../hooks/useNotifications'
import SignatureCanvas from '../components/SignatureCanvas'
import PublicProfileModal from '../components/ui/PublicProfileModal'

export default function PlayerGameDay() {
  const { eventId } = useParams()
  const { connect, joinEvent, leaveEvent, addListener } = useNotifications()
  const [gameDay, setGameDay] = useState(null)
  const [checkInStatus, setCheckInStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showWaiverModal, setShowWaiverModal] = useState(false)
  const [showScoreModal, setShowScoreModal] = useState(null)
  const [activeTab, setActiveTab] = useState('myGames')
  const [schedule, setSchedule] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [selectedDivisionId, setSelectedDivisionId] = useState(null)
  const [profileModalUserId, setProfileModalUserId] = useState(null)
  const [expandedRounds, setExpandedRounds] = useState({})

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const [gameDayRes, checkInRes] = await Promise.all([
        gameDayApi.getPlayerGameDay(eventId),
        checkInApi.getStatus(eventId)
      ])
      if (gameDayRes.success) {
        setGameDay(gameDayRes.data)
        // Set default division for schedule
        if (!selectedDivisionId && gameDayRes.data?.myDivisions?.length > 0) {
          setSelectedDivisionId(gameDayRes.data.myDivisions[0].divisionId)
        }
      }
      if (checkInRes.success) setCheckInStatus(checkInRes.data)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [eventId, selectedDivisionId])

  const loadSchedule = useCallback(async (divisionId) => {
    if (!divisionId) return
    setLoadingSchedule(true)
    try {
      const response = await tournamentApi.getSchedule(divisionId)
      if (response.success) {
        setSchedule(response.data)
      }
    } catch (err) {
      console.error('Error loading schedule:', err)
    } finally {
      setLoadingSchedule(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  // SignalR connection for real-time updates from admin (court assignments, status changes)
  useEffect(() => {
    if (!eventId) return

    const setupSignalR = async () => {
      await connect()
      await joinEvent(parseInt(eventId))
    }

    setupSignalR()

    // Listen for game updates and refresh data
    const removeListener = addListener((notification) => {
      if (notification.Type === 'GameUpdate' || notification.Type === 'ScoreUpdate') {
        console.log('Player dashboard: Received game update, refreshing...', notification)
        loadData()
        if (activeTab === 'others' && selectedDivisionId) {
          loadSchedule(selectedDivisionId)
        }
      }
    })

    return () => {
      removeListener()
      leaveEvent(parseInt(eventId))
    }
  }, [eventId, connect, joinEvent, leaveEvent, addListener, activeTab, selectedDivisionId, loadData, loadSchedule])

  useEffect(() => {
    if (activeTab === 'others' && selectedDivisionId) {
      loadSchedule(selectedDivisionId)
    }
  }, [activeTab, selectedDivisionId, loadSchedule])

  const handleCheckIn = async () => {
    try {
      if (checkInStatus?.pendingWaivers?.length > 0) {
        setShowWaiverModal(true)
        return
      }
      const result = await checkInApi.checkIn(eventId)
      if (result.success) loadData()
    } catch (err) {
      if (err.response?.data?.error?.includes('waiver')) {
        setShowWaiverModal(true)
      } else {
        alert('Failed to check in: ' + (err.message || 'Unknown error'))
      }
    }
  }

  const handleSignWaiver = async (waiverId, signatureData) => {
    try {
      await checkInApi.signWaiver(eventId, waiverId, signatureData)
      setShowWaiverModal(false)
      loadData()
    } catch (err) {
      alert('Failed to sign waiver: ' + (err.response?.data?.message || err.message || 'Unknown error'))
    }
  }

  const handleSubmitScore = async (gameId, unit1Score, unit2Score) => {
    try {
      await gameDayApi.submitScore(gameId, unit1Score, unit2Score)
      setShowScoreModal(null)
      loadData()
    } catch (err) {
      alert('Failed to submit score: ' + (err.message || 'Unknown error'))
    }
  }

  // Categorize games
  const categorizeGames = () => {
    if (!gameDay?.myGames) return { current: null, past: [], future: [] }

    const current = gameDay.myGames.find(g => g.status === 'Playing' || g.status === 'InProgress') ||
                   gameDay.myGames.find(g => g.status === 'Queued' || g.status === 'Ready')
    const past = gameDay.myGames.filter(g => g.status === 'Finished' || g.status === 'Completed')
    const future = gameDay.myGames.filter(g =>
      g.status !== 'Playing' && g.status !== 'InProgress' &&
      g.status !== 'Queued' && g.status !== 'Ready' &&
      g.status !== 'Finished' && g.status !== 'Completed'
    )

    return { current, past, future }
  }

  const { current: currentGame, past: pastGames, future: futureGames } = categorizeGames()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!gameDay) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6" />
              <div>
                <h1 className="text-base font-semibold">{gameDay.eventName}</h1>
                <p className="text-xs text-green-100">Player Dashboard</p>
              </div>
            </div>
            <button
              onClick={loadData}
              disabled={refreshing}
              className="p-2 hover:bg-green-500 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-[52px] z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('myGames')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'myGames'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Games
            </button>
            <button
              onClick={() => setActiveTab('others')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'others'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Others
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'myGames' ? (
        <MyGamesTab
          gameDay={gameDay}
          checkInStatus={checkInStatus}
          currentGame={currentGame}
          pastGames={pastGames}
          futureGames={futureGames}
          onCheckIn={handleCheckIn}
          onShowWaiver={() => setShowWaiverModal(true)}
          onSubmitScore={setShowScoreModal}
          onPlayerClick={setProfileModalUserId}
        />
      ) : (
        <OthersTab
          gameDay={gameDay}
          schedule={schedule}
          loadingSchedule={loadingSchedule}
          selectedDivisionId={selectedDivisionId}
          onDivisionChange={setSelectedDivisionId}
          expandedRounds={expandedRounds}
          setExpandedRounds={setExpandedRounds}
          onPlayerClick={setProfileModalUserId}
        />
      )}

      {/* Modals */}
      {showWaiverModal && checkInStatus?.pendingWaivers && (
        <WaiverModal
          waivers={checkInStatus.pendingWaivers}
          playerName={checkInStatus.playerName}
          onSign={handleSignWaiver}
          onClose={() => setShowWaiverModal(false)}
        />
      )}

      {showScoreModal && (
        <ScoreModal
          game={showScoreModal}
          onSubmit={handleSubmitScore}
          onClose={() => setShowScoreModal(null)}
        />
      )}

      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </div>
  )
}

// ============================================
// My Games Tab
// ============================================
function MyGamesTab({
  gameDay,
  checkInStatus,
  currentGame,
  pastGames,
  futureGames,
  onCheckIn,
  onShowWaiver,
  onSubmitScore,
  onPlayerClick
}) {
  const myDiv = gameDay.myDivisions?.[0]

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Top Section: Division Info + Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Division & Partner Info */}
        <div className="space-y-4">
          {/* Division & Partner Card */}
          {myDiv && (
            <div className="bg-white rounded-xl p-4 border">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                My Division
              </h3>
              <div className="space-y-2">
                <div className="text-lg font-medium text-gray-900">{myDiv.divisionName}</div>
                <div className="text-sm text-gray-600">{myDiv.unitName}</div>
                {myDiv.partners && myDiv.partners.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-2">Partner(s):</div>
                    <div className="space-y-2">
                      {myDiv.partners.map((partner, idx) => (
                        <button
                          key={idx}
                          onClick={() => onPlayerClick(partner.userId)}
                          className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-1 -ml-1 transition-colors"
                        >
                          {partner.profileImageUrl ? (
                            <img
                              src={getSharedAssetUrl(partner.profileImageUrl)}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <span className="text-sm font-medium">
                            {partner.firstName} {partner.lastName}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Check-in & Payment Status */}
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {gameDay.isCheckedIn ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                    )}
                    <span className={`text-sm ${gameDay.isCheckedIn ? 'text-green-600' : 'text-yellow-600'}`}>
                      {gameDay.isCheckedIn ? 'Checked In' : 'Not Checked In'}
                    </span>
                  </div>
                  {!gameDay.isCheckedIn && (
                    <button
                      onClick={onCheckIn}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Check In
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className={`w-4 h-4 ${gameDay.hasPaid ? 'text-green-600' : 'text-red-500'}`} />
                  <span className={`text-sm ${gameDay.hasPaid ? 'text-green-600' : 'text-red-600'}`}>
                    {gameDay.hasPaid ? 'Payment received' : 'Payment pending'}
                  </span>
                </div>
                {checkInStatus && !gameDay.waiverSigned && checkInStatus.pendingWaivers?.length > 0 && (
                  <button
                    onClick={onShowWaiver}
                    className="flex items-center gap-2 text-yellow-700 hover:text-yellow-800 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Waiver requires signature</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Teams in Division */}
          {myDiv?.divisionUnits && myDiv.divisionUnits.length > 0 && (
            <div className="bg-white rounded-xl p-4 border">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Teams in Division ({myDiv.divisionUnits.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {myDiv.divisionUnits.map((unit, idx) => (
                  <div
                    key={unit.id || idx}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      unit.id === myDiv.unitId ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                      {unit.unitNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{unit.name}</div>
                      {unit.players && (
                        <div className="text-xs text-gray-500 truncate">{unit.players}</div>
                      )}
                    </div>
                    {unit.id === myDiv.unitId && (
                      <span className="text-xs text-green-600 font-medium">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: System Notifications */}
        <div className="bg-white rounded-xl p-4 border">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-500" />
            Notifications
          </h3>
          {gameDay.notifications && gameDay.notifications.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {gameDay.notifications.map((notif, idx) => (
                <div key={idx} className={`p-3 rounded-lg text-sm ${
                  notif.type === 'urgent' ? 'bg-red-50 border border-red-200' :
                  notif.type === 'info' ? 'bg-blue-50 border border-blue-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <div className="font-medium text-gray-900">{notif.title}</div>
                  <div className="text-gray-600 mt-1">{notif.message}</div>
                  {notif.createdAt && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          )}
        </div>
      </div>

      {/* Center: Current/Active Game */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl p-5">
        {currentGame ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              {currentGame.status === 'Playing' || currentGame.status === 'InProgress' ? (
                <>
                  <Play className="w-5 h-5" />
                  <span className="font-semibold">Game In Progress</span>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">Next Up</span>
                </>
              )}
              <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                currentGame.status === 'Playing' || currentGame.status === 'InProgress'
                  ? 'bg-green-500'
                  : 'bg-yellow-500'
              }`}>
                {currentGame.status}
              </span>
            </div>

            <div className="text-center py-4">
              <div className="text-lg font-bold mb-2">
                {currentGame.unit1Name} vs {currentGame.unit2Name}
              </div>
              {currentGame.courtName && (
                <div className="flex items-center justify-center gap-1 text-blue-100 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">{currentGame.courtName}</span>
                </div>
              )}
              <div className="text-sm text-blue-200">{currentGame.divisionName}</div>

              {(currentGame.status === 'Playing' || currentGame.status === 'InProgress') && (
                <div className="mt-4">
                  <div className="text-4xl font-bold">
                    {currentGame.unit1Score} - {currentGame.unit2Score}
                  </div>
                  {currentGame.canSubmitScore && (
                    <button
                      onClick={() => onSubmitScore(currentGame)}
                      className="mt-3 px-6 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Finished - Submit Score
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <div className="text-lg font-medium">No Active Game</div>
            <div className="text-sm text-blue-200 mt-1">Your next game will appear here</div>
          </div>
        )}
      </div>

      {/* Bottom: Past & Future Games */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Past Games */}
        <div className="bg-white rounded-xl p-4 border">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-500" />
            Past Games ({pastGames.length})
          </h3>
          {pastGames.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pastGames.map(game => (
                <PastGameCard key={game.gameId} game={game} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No completed games yet</p>
            </div>
          )}
        </div>

        {/* Future Games */}
        <div className="bg-white rounded-xl p-4 border">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Upcoming Games ({futureGames.length})
          </h3>
          {futureGames.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {futureGames.map(game => (
                <FutureGameCard key={game.gameId} game={game} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming games scheduled</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PastGameCard({ game }) {
  const isMyUnit1 = game.myUnitId === game.unit1Id
  const myScore = isMyUnit1 ? game.unit1Score : game.unit2Score
  const opponentScore = isMyUnit1 ? game.unit2Score : game.unit1Score
  const won = myScore > opponentScore

  return (
    <div className={`p-3 rounded-lg border ${won ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            vs {isMyUnit1 ? game.unit2Name : game.unit1Name}
          </div>
          <div className="text-xs text-gray-500">{game.roundName || game.divisionName}</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${won ? 'text-green-600' : 'text-gray-600'}`}>
            {myScore} - {opponentScore}
          </div>
          {won && <Trophy className="w-4 h-4 text-yellow-500 ml-auto" />}
        </div>
      </div>
    </div>
  )
}

function FutureGameCard({ game }) {
  const isMyUnit1 = game.myUnitId === game.unit1Id
  const opponent = isMyUnit1 ? game.unit2Name : game.unit1Name

  return (
    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            vs {opponent || 'TBD'}
          </div>
          <div className="text-xs text-gray-500">{game.roundName || game.divisionName}</div>
        </div>
        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
          {game.status || 'Scheduled'}
        </span>
      </div>
    </div>
  )
}

// ============================================
// Others Tab - Schedule View
// ============================================
function OthersTab({
  gameDay,
  schedule,
  loadingSchedule,
  selectedDivisionId,
  onDivisionChange,
  expandedRounds,
  setExpandedRounds,
  onPlayerClick
}) {
  const toggleRound = (roundIdx) => {
    setExpandedRounds(prev => ({
      ...prev,
      [roundIdx]: !prev[roundIdx]
    }))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Division Selector */}
      {gameDay.myDivisions?.length > 0 && (
        <div className="bg-white rounded-xl p-4 border">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Division</label>
          <select
            value={selectedDivisionId || ''}
            onChange={(e) => onDivisionChange(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-lg"
          >
            {gameDay.myDivisions.map(div => (
              <option key={div.divisionId} value={div.divisionId}>
                {div.divisionName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Schedule */}
      {loadingSchedule ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : schedule ? (
        <div className="space-y-4">
          {/* Pool Standings */}
          {schedule.poolStandings?.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden border">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-900">Pool Standings</h3>
              </div>
              <div className="p-4 space-y-4">
                {schedule.poolStandings.map((pool, poolIdx) => (
                  <div key={poolIdx}>
                    <h4 className="font-medium text-gray-800 mb-2">{pool.poolName}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="py-1 pr-2">#</th>
                            <th className="py-1">Team</th>
                            <th className="py-1 text-center">W</th>
                            <th className="py-1 text-center">L</th>
                            <th className="py-1 text-center">+/-</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pool.standings?.map((team, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="py-2 pr-2 font-medium">{team.rank || idx + 1}</td>
                              <td className="py-2">
                                <div className="font-medium text-gray-900">{team.unitName}</div>
                                {team.players && (
                                  <div className="text-xs text-gray-500">{team.players}</div>
                                )}
                              </td>
                              <td className="py-2 text-center text-green-600">{team.matchesWon || 0}</td>
                              <td className="py-2 text-center text-red-600">{team.matchesLost || 0}</td>
                              <td className="py-2 text-center">{(team.pointsFor || 0) - (team.pointsAgainst || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rounds */}
          {schedule.rounds?.map((round, roundIdx) => (
            <div key={roundIdx} className="bg-white rounded-xl overflow-hidden border">
              <button
                onClick={() => toggleRound(roundIdx)}
                className="w-full px-4 py-3 bg-gray-50 border-b flex items-center justify-between hover:bg-gray-100"
              >
                <h3 className="font-semibold text-gray-900">
                  {round.roundName || `${round.roundType} Round ${round.roundNumber}`}
                </h3>
                {expandedRounds[roundIdx] ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedRounds[roundIdx] !== false && (
                <div className="divide-y">
                  {round.matches?.map((match, matchIdx) => (
                    <ScheduleMatchRow key={matchIdx} match={match} onPlayerClick={onPlayerClick} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a division to view schedule</p>
        </div>
      )}
    </div>
  )
}

function ScheduleMatchRow({ match, onPlayerClick }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
      case 'Finished':
        return 'bg-green-100 text-green-700'
      case 'Playing':
      case 'InProgress':
        return 'bg-blue-100 text-blue-700'
      case 'Queued':
      case 'Ready':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  if (match.isBye) {
    return (
      <div className="px-4 py-3 text-sm text-gray-400">
        #{match.matchNumber} - {match.unit1Name || 'Team'} has a BYE
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-6">#{match.matchNumber}</span>
        <div className="flex-1 grid grid-cols-3 gap-2 items-center text-sm">
          <div className="text-right">
            <span className={match.winnerUnitId === match.unit1Id ? 'font-semibold text-green-600' : ''}>
              {match.unit1Name || match.unit1SeedInfo || 'TBD'}
            </span>
          </div>
          <div className="text-center">
            {match.score ? (
              <span className="font-medium">{match.score}</span>
            ) : (
              <span className="text-gray-400">vs</span>
            )}
          </div>
          <div className="text-left">
            <span className={match.winnerUnitId === match.unit2Id ? 'font-semibold text-green-600' : ''}>
              {match.unit2Name || match.unit2SeedInfo || 'TBD'}
            </span>
          </div>
        </div>
        <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(match.status)}`}>
          {match.status || 'Scheduled'}
        </span>
      </div>
      {match.courtLabel && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1 ml-9">
          <MapPin className="w-3 h-3" />
          {match.courtLabel}
        </div>
      )}
    </div>
  )
}

// ============================================
// Waiver Modal (unchanged)
// ============================================
function WaiverModal({ waivers, playerName, onSign, onClose }) {
  const [currentWaiver, setCurrentWaiver] = useState(waivers[0])
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState(playerName || '')
  const [signatureImage, setSignatureImage] = useState(null)
  const [signerType, setSignerType] = useState('Self')
  const [guardianRelationship, setGuardianRelationship] = useState('Parent')
  const [guardianName, setGuardianName] = useState('')
  const [signing, setSigning] = useState(false)
  const [waiverContent, setWaiverContent] = useState('')

  const isGuardianSigning = signerType === 'Guardian'

  const isRenderableFile = (fileName) => {
    if (!fileName) return false
    const ext = fileName.toLowerCase().split('.').pop()
    return ['md', 'html', 'htm'].includes(ext)
  }

  const markdownToHtml = (md) => {
    return md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>')
  }

  useEffect(() => {
    if (currentWaiver.content) {
      let content = currentWaiver.content
      if (currentWaiver.fileName?.toLowerCase().endsWith('.md')) {
        content = markdownToHtml(content)
      }
      setWaiverContent(content)
    } else {
      setWaiverContent('')
    }
  }, [currentWaiver])

  const handleSign = async () => {
    if (!signature.trim()) {
      alert('Please enter the participant\'s full legal name')
      return
    }
    if (!signatureImage) {
      alert('Please draw your signature in the box below')
      return
    }
    if (isGuardianSigning && !guardianName.trim()) {
      alert('Please enter the guardian/signer\'s name')
      return
    }

    setSigning(true)
    try {
      const signerRole = isGuardianSigning ? guardianRelationship : 'Participant'
      await onSign(currentWaiver.id, {
        signature: signature.trim(),
        signatureImage,
        signerRole,
        parentGuardianName: isGuardianSigning ? guardianName.trim() : null,
        guardianRelationship: isGuardianSigning ? guardianRelationship : null
      })
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl md:rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
          <h3 className="font-semibold">Release Waiver</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-auto flex-1">
          <h4 className="font-medium mb-2">{currentWaiver.title}</h4>

          {currentWaiver.fileUrl && !isRenderableFile(currentWaiver.fileName) ? (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-sm text-gray-600 mb-3">Please review the waiver document before signing:</p>
              <a
                href={currentWaiver.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FileText className="w-4 h-4" />
                View Waiver Document
              </a>
            </div>
          ) : waiverContent ? (
            <div
              className="prose prose-sm text-gray-600 bg-gray-50 p-3 rounded-lg border max-h-48 overflow-auto text-xs"
              dangerouslySetInnerHTML={{ __html: waiverContent }}
            />
          ) : (
            <div className="bg-gray-50 p-3 rounded-lg border text-gray-500 text-sm">
              No waiver content available.
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Who is signing this waiver?</label>
              <div className="flex gap-2">
                {[
                  { value: 'Self', label: 'Self (Participant)' },
                  { value: 'Guardian', label: 'Guardian/Parent' }
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSignerType(option.value)}
                    className={`flex-1 py-2 text-sm rounded-lg border ${
                      signerType === option.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {isGuardianSigning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <p className="text-sm text-amber-800">Signing on behalf of the participant:</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Relationship to Participant *</label>
                  <select
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Guardian">Legal Guardian</option>
                    <option value="Legal Custodian">Legal Custodian</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Your Full Name (Signer) *</label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Guardian/Parent's full legal name"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Participant's Full Legal Name *</label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Type participant's full legal name"
                className="w-full px-3 py-2 border rounded-lg font-medium"
                style={{ fontFamily: 'cursive, serif' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isGuardianSigning ? "Guardian's Signature *" : "Your Signature *"}
              </label>
              <div className="flex justify-center">
                <SignatureCanvas
                  onSignatureChange={setSignatureImage}
                  width={Math.min(350, window.innerWidth - 60)}
                  height={150}
                  disabled={signing}
                />
              </div>
            </div>

            <label className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                I have read this release waiver, fully understand its terms, understand that I have given up substantial rights by signing it, and sign it freely and voluntarily.
              </span>
            </label>
          </div>
        </div>

        <div className="p-4 border-t flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              disabled={signing}
            >
              Cancel
            </button>
            <button
              onClick={handleSign}
              disabled={!agreed || !signature.trim() || !signatureImage || signing || (isGuardianSigning && !guardianName.trim())}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {signing ? 'Signing...' : 'Sign Waiver'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Score Modal (unchanged)
// ============================================
function ScoreModal({ game, onSubmit, onClose }) {
  const [unit1Score, setUnit1Score] = useState(game.unit1Score || 0)
  const [unit2Score, setUnit2Score] = useState(game.unit2Score || 0)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    await onSubmit(game.gameId, unit1Score, unit2Score)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl md:rounded-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">
            {game.needsConfirmation ? 'Confirm Score' : 'Submit Score'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <div className="font-medium mb-2">{game.unit1Name}</div>
              <input
                type="number"
                min="0"
                value={unit1Score}
                onChange={(e) => setUnit1Score(parseInt(e.target.value) || 0)}
                className="w-20 h-16 text-2xl font-bold text-center border rounded-lg mx-auto"
              />
            </div>

            <div className="text-center text-2xl font-bold text-gray-400">vs</div>

            <div className="text-center">
              <div className="font-medium mb-2">{game.unit2Name}</div>
              <input
                type="number"
                min="0"
                value={unit2Score}
                onChange={(e) => setUnit2Score(parseInt(e.target.value) || 0)}
                className="w-20 h-16 text-2xl font-bold text-center border rounded-lg mx-auto"
              />
            </div>
          </div>

          {game.needsConfirmation && (
            <p className="text-sm text-gray-500 text-center mt-4">
              Opponent submitted: {game.unit1Score} - {game.unit2Score}
            </p>
          )}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : game.needsConfirmation ? 'Confirm' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
