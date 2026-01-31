import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { videoRoomApi } from '../../services/videoRoomService'
import { Video, Lock, Users, ArrowLeft } from 'lucide-react'

export default function VideoRoomJoin() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState(null)
  const [passcode, setPasscode] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    loadRoom()
  }, [roomCode])

  useEffect(() => {
    if (user) {
      setDisplayName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email)
    }
  }, [user])

  const loadRoom = async () => {
    try {
      setLoading(true)
      const res = await videoRoomApi.getRoom(roomCode)
      setRoom(res?.data || res || null)
    } catch (err) {
      // Note: api interceptor transforms errors to error.response?.data || error.message
      // so err here is a string or data object, not a full axios error
      const msg = typeof err === 'string' ? err : (err?.message || 'Failed to load room information.')
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('ended')) {
        setError('Room not found or has ended.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setError(null)

    if (!passcode.trim()) {
      setError('Please enter the passcode')
      return
    }

    if (!isAuthenticated && !displayName.trim()) {
      setError('Please enter your display name')
      return
    }

    try {
      setJoining(true)
      const res = await videoRoomApi.joinRoom(roomCode, {
        passcode,
        displayName: isAuthenticated ? null : displayName,
      })

      const joinResult = res?.data || res
      if (joinResult?.success) {
        // Navigate to the actual video room
        navigate(`/rooms/${roomCode}/call`, {
          state: {
            room: joinResult.room,
            displayName: displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            isCreator: joinResult.room?.creatorName === displayName || user?.id === joinResult.room?.createdBy,
          }
        })
      } else {
        setError(joinResult?.error || 'Failed to join room')
      }
    } catch (err) {
      // api interceptor transforms errors: err is string or data object
      let msg = 'Failed to join room'
      if (typeof err === 'string') {
        msg = err
      } else if (err?.error || err?.Error) {
        msg = err.error || err.Error
      } else if (err?.message) {
        msg = err.message
      }
      setError(msg)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center border border-gray-700">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Room Not Found</h2>
          <p className="text-gray-400 mb-6">{error || 'This room may have ended or the link is invalid.'}</p>
          <button
            onClick={() => navigate('/rooms')}
            className="flex items-center gap-2 mx-auto text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Rooms
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl">
        {/* Room info */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{room.name}</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            {room.creatorName && <span>Hosted by {room.creatorName}</span>}
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {room.participantCount}{room.maxParticipants > 0 ? `/${room.maxParticipants}` : ''}
            </span>
          </div>
          {room.isLocked && (
            <div className="flex items-center justify-center gap-1 text-yellow-400 text-sm mt-2">
              <Lock className="w-4 h-4" />
              Room is locked
            </div>
          )}
        </div>

        {room.isLocked ? (
          <div className="text-center">
            <p className="text-gray-400 mb-4">This room is currently locked and not accepting new participants.</p>
            <button
              onClick={() => navigate('/rooms')}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Rooms
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            {/* Guest display name */}
            {!isAuthenticated && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your display name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Passcode</label>
              <input
                type="text"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-lg tracking-widest font-mono placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter passcode"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={joining}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {joining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Joining...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Join Video Call
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/rooms')}
              className="w-full text-gray-400 hover:text-gray-300 py-2 text-sm transition-colors"
            >
              Back to Rooms
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
