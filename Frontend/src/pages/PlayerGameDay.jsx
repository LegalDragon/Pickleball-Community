import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle, XCircle, Play, Clock, MapPin,
  RefreshCw, AlertCircle, FileText, Trophy, Calendar,
  ChevronRight, User
} from 'lucide-react'
import { gameDayApi, checkInApi } from '../services/api'
import SignatureCanvas from '../components/SignatureCanvas'

export default function PlayerGameDay() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [gameDay, setGameDay] = useState(null)
  const [checkInStatus, setCheckInStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showWaiverModal, setShowWaiverModal] = useState(false)
  const [showScoreModal, setShowScoreModal] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true)
      const [gameDayRes, checkInRes] = await Promise.all([
        gameDayApi.getPlayerGameDay(eventId),
        checkInApi.getStatus(eventId)
      ])
      if (gameDayRes.success) setGameDay(gameDayRes.data)
      if (checkInRes.success) setCheckInStatus(checkInRes.data)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [eventId])

  useEffect(() => {
    loadData()
    // Auto-refresh every 15 seconds
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleCheckIn = async () => {
    try {
      // Check if waiver needs to be signed first
      if (checkInStatus?.pendingWaivers?.length > 0) {
        setShowWaiverModal(true)
        return
      }

      const result = await checkInApi.checkIn(eventId)
      if (result.success) {
        loadData()
      }
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
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!gameDay) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      {/* Clean Game Day Header - No back button */}
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
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

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Check-in Card */}
        <div className={`rounded-xl p-4 ${
          gameDay.isCheckedIn ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {gameDay.isCheckedIn ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              )}
              <div>
                <div className="font-semibold">
                  {gameDay.isCheckedIn ? 'Checked In' : 'Not Checked In'}
                </div>
                {gameDay.isCheckedIn && gameDay.checkedInAt && (
                  <div className="text-sm text-gray-600">
                    {new Date(gameDay.checkedInAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            {!gameDay.isCheckedIn && (
              <button
                onClick={handleCheckIn}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Check In
              </button>
            )}
          </div>

          {/* Waiver status - unsigned */}
          {checkInStatus && !gameDay.waiverSigned && checkInStatus.pendingWaivers?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-yellow-200">
              <button
                onClick={() => setShowWaiverModal(true)}
                className="flex items-center gap-2 text-yellow-700 hover:text-yellow-800"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">Waiver requires signature</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Waiver status - signed with PDF link */}
          {checkInStatus?.waiverSigned && checkInStatus.signedWaiverPdfUrl && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <a
                href={checkInStatus.signedWaiverPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-700 hover:text-green-800"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Waiver signed</span>
                <FileText className="w-4 h-4" />
                <span className="text-sm underline">View PDF</span>
              </a>
            </div>
          )}
        </div>

        {/* My Divisions */}
        {gameDay.myDivisions.length > 0 && (
          <div className="bg-white rounded-xl p-4 border">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" /> My Registrations
            </h2>
            <div className="space-y-2">
              {gameDay.myDivisions.map((div, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{div.divisionName}</div>
                    <div className="text-sm text-gray-500">{div.unitName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current/Upcoming Game Alert */}
        {gameDay.upcomingGame && (
          <div className="bg-blue-600 text-white rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-5 h-5" />
              <span className="font-semibold">
                {gameDay.upcomingGame.status === 'Playing' ? 'Game In Progress' : 'You\'re Up Next!'}
              </span>
            </div>
            <div className="text-lg font-bold mb-1">
              {gameDay.upcomingGame.unit1Name} vs {gameDay.upcomingGame.unit2Name}
            </div>
            {gameDay.upcomingGame.courtName && (
              <div className="flex items-center gap-1 text-blue-100">
                <MapPin className="w-4 h-4" />
                {gameDay.upcomingGame.courtName}
              </div>
            )}
            <div className="text-sm text-blue-100 mt-1">{gameDay.upcomingGame.divisionName}</div>

            {gameDay.upcomingGame.status === 'Playing' && (
              <div className="mt-3 text-center">
                <div className="text-3xl font-bold">
                  {gameDay.upcomingGame.unit1Score} - {gameDay.upcomingGame.unit2Score}
                </div>
                {gameDay.upcomingGame.canSubmitScore && (
                  <button
                    onClick={() => setShowScoreModal(gameDay.upcomingGame)}
                    className="mt-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium"
                  >
                    Submit Score
                  </button>
                )}
                {gameDay.upcomingGame.needsConfirmation && (
                  <button
                    onClick={() => setShowScoreModal(gameDay.upcomingGame)}
                    className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium"
                  >
                    Confirm Score
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* All My Games */}
        <div className="bg-white rounded-xl p-4 border">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> My Games
          </h2>
          <div className="space-y-3">
            {gameDay.myGames.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No games scheduled yet</p>
            ) : (
              gameDay.myGames.map(game => (
                <GameCard
                  key={game.gameId}
                  game={game}
                  onSubmitScore={() => setShowScoreModal(game)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Waiver Modal */}
      {showWaiverModal && checkInStatus?.pendingWaivers && (
        <WaiverModal
          waivers={checkInStatus.pendingWaivers}
          playerName={checkInStatus.playerName}
          onSign={handleSignWaiver}
          onClose={() => setShowWaiverModal(false)}
        />
      )}

      {/* Score Modal */}
      {showScoreModal && (
        <ScoreModal
          game={showScoreModal}
          onSubmit={handleSubmitScore}
          onClose={() => setShowScoreModal(null)}
        />
      )}
    </div>
  )
}

function GameCard({ game, onSubmitScore }) {
  const isMyUnit1 = game.myUnitId === game.unit1Id
  const myTeam = isMyUnit1 ? game.unit1Name : game.unit2Name
  const opponent = isMyUnit1 ? game.unit2Name : game.unit1Name
  const myScore = isMyUnit1 ? game.unit1Score : game.unit2Score
  const opponentScore = isMyUnit1 ? game.unit2Score : game.unit1Score

  const getStatusColor = (status) => {
    switch (status) {
      case 'Playing': return 'bg-green-100 text-green-700'
      case 'Queued': return 'bg-blue-100 text-blue-700'
      case 'Ready': return 'bg-yellow-100 text-yellow-700'
      case 'Finished': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(game.status)}`}>
          {game.status}
        </span>
        <span className="text-xs text-gray-500">{game.divisionName}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-blue-600">{myTeam}</div>
          <div className="text-sm text-gray-600">vs {opponent}</div>
        </div>

        {game.status === 'Finished' && (
          <div className="text-right">
            <div className={`text-xl font-bold ${myScore > opponentScore ? 'text-green-600' : myScore < opponentScore ? 'text-red-600' : ''}`}>
              {myScore} - {opponentScore}
            </div>
            {myScore > opponentScore && <Trophy className="w-4 h-4 text-yellow-500 ml-auto" />}
          </div>
        )}

        {game.status === 'Playing' && (
          <div className="text-right">
            <div className="text-xl font-bold">{myScore} - {opponentScore}</div>
            {game.canSubmitScore && (
              <button
                onClick={onSubmitScore}
                className="text-xs text-blue-600 hover:underline"
              >
                Submit Score
              </button>
            )}
          </div>
        )}
      </div>

      {game.courtName && (
        <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
          <MapPin className="w-3 h-3" />
          {game.courtName}
        </div>
      )}

      {game.roundName && (
        <div className="mt-1 text-xs text-gray-400">{game.roundName}</div>
      )}
    </div>
  )
}

function WaiverModal({ waivers, playerName, onSign, onClose }) {
  const [currentWaiver, setCurrentWaiver] = useState(waivers[0])
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState(playerName || '')
  const [signatureImage, setSignatureImage] = useState(null)
  const [signerType, setSignerType] = useState('Self') // Self or Guardian
  const [guardianRelationship, setGuardianRelationship] = useState('Parent') // Parent, Guardian, Legal Custodian
  const [guardianName, setGuardianName] = useState('')
  const [signing, setSigning] = useState(false)
  const [waiverContent, setWaiverContent] = useState('')

  const isGuardianSigning = signerType === 'Guardian'

  // Check if file is markdown or html based on extension
  const isRenderableFile = (fileName) => {
    if (!fileName) return false
    const ext = fileName.toLowerCase().split('.').pop()
    return ['md', 'html', 'htm'].includes(ext)
  }

  // Convert markdown to basic HTML (simple conversion)
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

  // Set waiver content - backend now fetches .md/.html content for us
  useEffect(() => {
    if (currentWaiver.content) {
      // Content provided by backend (for .md/.html files or legacy system)
      let content = currentWaiver.content
      // If it's markdown, convert to HTML
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
      // Map to backend format
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

          {/* Waiver Content Display */}
          {currentWaiver.fileUrl && !isRenderableFile(currentWaiver.fileName) ? (
            // Non-renderable file (PDF, etc.) - show link
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-sm text-gray-600 mb-3">
                Please review the waiver document before signing:
              </p>
              <a
                href={currentWaiver.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FileText className="w-4 h-4" />
                View Waiver Document
              </a>
              <p className="text-xs text-gray-500 mt-3">
                By signing below, you confirm that you have read and understood the waiver document.
              </p>
            </div>
          ) : waiverContent ? (
            // Renderable content (HTML from .md/.html file or legacy content)
            <div
              className="prose prose-sm text-gray-600 bg-gray-50 p-3 rounded-lg border max-h-48 overflow-auto text-xs"
              dangerouslySetInnerHTML={{ __html: waiverContent }}
            />
          ) : (
            // No content available
            <div className="bg-gray-50 p-3 rounded-lg border text-gray-500 text-sm">
              No waiver content available.
            </div>
          )}

          {/* Signature Section */}
          <div className="mt-4 space-y-3">
            {/* Signer Type Selection - Self or Guardian */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Who is signing this waiver?
              </label>
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

            {/* Guardian Details - Only shown when Guardian is signing */}
            {isGuardianSigning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <p className="text-sm text-amber-800">
                  Signing on behalf of the participant:
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Relationship to Participant *
                  </label>
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Your Full Name (Signer) *
                  </label>
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

            {/* Participant's Full Legal Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Participant's Full Legal Name *
              </label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Type participant's full legal name"
                className="w-full px-3 py-2 border rounded-lg font-medium"
                style={{ fontFamily: 'cursive, serif' }}
              />
            </div>

            {/* Drawn Signature */}
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
              <p className="text-xs text-gray-500 mt-1 text-center">
                {isGuardianSigning
                  ? `By signing above, you (${guardianRelationship}) are electronically signing this waiver on behalf of the participant`
                  : 'By signing above, you are electronically signing this waiver'}
              </p>
            </div>

            {/* Agreement Checkbox */}
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
