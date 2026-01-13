import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Share2, QrCode, Play, Pause, Square,
  Users, Trophy, Clock, Settings, ChevronDown
} from 'lucide-react'
import { useInstaGame } from '../../hooks/useInstaGame'
import Scoreboard from '../../components/InstaGame/Scoreboard'
import PlayerList from '../../components/InstaGame/PlayerList'
import QueueDisplay from '../../components/InstaGame/QueueDisplay'
import TeamSelector from '../../components/InstaGame/TeamSelector'
import JoinCodeDisplay from '../../components/InstaGame/JoinCodeDisplay'

/**
 * InstaGame Main - Central game view with scoreboard and controls
 */
export default function InstaGameMain() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const {
    instaGame,
    players,
    currentMatch,
    recentMatches,
    queue,
    myPlayerInfo,
    loading,
    error,
    isConnected,
    isCreator,
    isOrganizer,
    isPlayer,
    refresh,
    createMatch,
    generateNextMatch,
    startMatch,
    updateScore,
    completeMatch,
    updateStatus,
    leave,
    startSession,
    pauseSession,
    endSession
  } = useInstaGame(parseInt(id))

  const [activeTab, setActiveTab] = useState('scoreboard')
  const [showTeamSelector, setShowTeamSelector] = useState(false)
  const [showJoinCode, setShowJoinCode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const handleShare = async () => {
    if (navigator.share && instaGame) {
      try {
        await navigator.share({
          title: instaGame.name,
          text: `${t('instaGame.joinGame')}: ${instaGame.joinCode}`,
          url: window.location.href
        })
      } catch (err) {
        // User cancelled or error
        setShowJoinCode(true)
      }
    } else {
      setShowJoinCode(true)
    }
  }

  const handleStartSession = async () => {
    try {
      setActionLoading(true)
      await startSession()
    } catch (err) {
      console.error('Error starting session:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePauseSession = async () => {
    try {
      setActionLoading(true)
      await pauseSession()
    } catch (err) {
      console.error('Error pausing session:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!confirm(t('instaGame.confirmEndSession'))) return
    try {
      setActionLoading(true)
      await endSession()
    } catch (err) {
      console.error('Error ending session:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateNextMatch = async () => {
    try {
      setActionLoading(true)
      const response = await generateNextMatch()
      if (!response.success && response.notEnoughPlayers) {
        alert(t('instaGame.notEnoughPlayers'))
      }
    } catch (err) {
      console.error('Error generating match:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateManualMatch = async (team1Ids, team2Ids) => {
    try {
      setActionLoading(true)
      await createMatch(team1Ids, team2Ids)
      setShowTeamSelector(false)
    } catch (err) {
      console.error('Error creating match:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!myPlayerInfo) return
    const newStatus = myPlayerInfo.status === 'Available' ? 'Resting' : 'Available'
    try {
      await updateStatus(newStatus)
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  const handleLeave = async () => {
    if (!confirm(t('instaGame.confirmLeave'))) return
    try {
      await leave()
      navigate('/instagame')
    } catch (err) {
      console.error('Error leaving game:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !instaGame) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-red-600 mb-4">{error || t('instaGame.notFound')}</p>
          <button
            onClick={() => navigate('/instagame')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('instaGame.backToList')}
          </button>
        </div>
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-green-500'
      case 'Lobby': return 'bg-blue-500'
      case 'Paused': return 'bg-yellow-500'
      case 'Completed': return 'bg-gray-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="bg-gray-800 shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/instagame')}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="font-bold text-lg truncate max-w-[200px]">
                  {instaGame.name}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(instaGame.status)}`}></div>
                  <span>{instaGame.status}</span>
                  {!isConnected && (
                    <span className="text-yellow-500">({t('instaGame.reconnecting')})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Share2 size={20} />
              </button>
              {isOrganizer && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Settings size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Join Code */}
          <div className="mt-2 flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-400">{t('instaGame.joinCode')}:</span>
            <span className="font-mono font-bold text-blue-400 tracking-wider">
              {instaGame.joinCode}
            </span>
          </div>
        </div>
      </div>

      {/* Organizer Controls */}
      {isOrganizer && (
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {instaGame.status === 'Lobby' && (
                <button
                  onClick={handleStartSession}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <Play size={16} />
                  {t('instaGame.startSession')}
                </button>
              )}
              {instaGame.status === 'Active' && (
                <>
                  <button
                    onClick={handlePauseSession}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Pause size={16} />
                    {t('instaGame.pause')}
                  </button>
                  {instaGame.schedulingMethod === 'Manual' ? (
                    <button
                      onClick={() => setShowTeamSelector(true)}
                      disabled={actionLoading || currentMatch}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Users size={16} />
                      {t('instaGame.createMatch')}
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateNextMatch}
                      disabled={actionLoading || currentMatch}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Play size={16} />
                      {t('instaGame.nextMatch')}
                    </button>
                  )}
                </>
              )}
              {instaGame.status === 'Paused' && (
                <button
                  onClick={handleStartSession}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <Play size={16} />
                  {t('instaGame.resume')}
                </button>
              )}
              {instaGame.status !== 'Completed' && (
                <button
                  onClick={handleEndSession}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <Square size={16} />
                  {t('instaGame.endSession')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-[120px] z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            {[
              { id: 'scoreboard', icon: Trophy, label: t('instaGame.scoreboard') },
              { id: 'players', icon: Users, label: t('instaGame.playersTab') },
              { id: 'queue', icon: Clock, label: t('instaGame.queueTab') }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <tab.icon size={18} />
                <span className="text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {activeTab === 'scoreboard' && (
          <Scoreboard
            instaGame={instaGame}
            currentMatch={currentMatch}
            recentMatches={recentMatches}
            players={players}
            isOrganizer={isOrganizer}
            onStartMatch={startMatch}
            onUpdateScore={updateScore}
            onCompleteMatch={completeMatch}
          />
        )}

        {activeTab === 'players' && (
          <PlayerList
            players={players}
            myPlayerInfo={myPlayerInfo}
            isOrganizer={isOrganizer}
            schedulingMethod={instaGame.schedulingMethod}
            onToggleStatus={handleToggleStatus}
            onLeave={handleLeave}
          />
        )}

        {activeTab === 'queue' && (
          <QueueDisplay
            queue={queue}
            players={players}
            isOrganizer={isOrganizer}
            schedulingMethod={instaGame.schedulingMethod}
          />
        )}
      </div>

      {/* Team Selector Modal */}
      {showTeamSelector && (
        <TeamSelector
          players={players.filter(p => p.status === 'Available')}
          teamSize={instaGame.teamSize}
          onSubmit={handleCreateManualMatch}
          onClose={() => setShowTeamSelector(false)}
        />
      )}

      {/* Join Code Modal */}
      {showJoinCode && (
        <JoinCodeDisplay
          joinCode={instaGame.joinCode}
          gameName={instaGame.name}
          onClose={() => setShowJoinCode(false)}
        />
      )}
    </div>
  )
}
