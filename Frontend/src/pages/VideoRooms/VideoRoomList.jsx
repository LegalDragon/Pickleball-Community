import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { videoRoomApi } from '../../services/videoRoomService'
import { Video, Plus, Users, Lock, Copy, Check, ExternalLink } from 'lucide-react'

export default function VideoRoomList() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createdRoom, setCreatedRoom] = useState(null)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    passcode: '',
    maxParticipants: 6,
  })

  useEffect(() => {
    loadRooms()
  }, [])

  const loadRooms = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await videoRoomApi.getActiveRooms()
      setRooms(Array.isArray(res) ? res : (res?.data || []))
    } catch (err) {
      console.error('Failed to load rooms:', err)
      const msg = typeof err === 'string' ? err : (err?.message || 'Unable to load video rooms. Please try again later.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      setCreating(true)
      const res = await videoRoomApi.createRoom({
        name: formData.name,
        passcode: formData.passcode || null,
        maxParticipants: formData.maxParticipants || 6,
      })
      setCreatedRoom(res?.data || res)
      loadRooms()
    } catch (err) {
      console.error('Failed to create room:', err)
      const msg = typeof err === 'string' ? err : (err?.message || 'Failed to create room. Please try again.')
      alert(msg)
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const joinRoom = (roomCode) => {
    navigate(`/rooms/${roomCode}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pt-20 pb-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Video className="w-8 h-8 text-blue-400" />
              Video Rooms
            </h1>
            <p className="text-gray-400 mt-1">Create or join a video chat room</p>
          </div>
          {isAuthenticated && (
            <button
              onClick={() => { setShowCreate(true); setCreatedRoom(null) }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Room
            </button>
          )}
        </div>

        {/* Create Room Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setShowCreate(false); setCreatedRoom(null) }}>
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
              {!createdRoom ? (
                <>
                  <h2 className="text-xl font-bold text-white mb-4">Create Video Room</h2>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Room Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Practice Session"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Passcode <span className="text-gray-500">(leave blank to auto-generate)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.passcode}
                        onChange={e => setFormData(prev => ({ ...prev, passcode: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Max Participants</label>
                      <select
                        value={formData.maxParticipants}
                        onChange={e => setFormData(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {[2, 3, 4, 5, 6].map(n => (
                          <option key={n} value={n}>{n} participants</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCreate(false)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {creating ? 'Creating...' : 'Create Room'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-4">🎉 Room Created!</h2>
                  <div className="space-y-4">
                    <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                      <div>
                        <span className="text-gray-400 text-sm">Room Name</span>
                        <p className="text-white font-medium">{createdRoom.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Passcode</span>
                        <p className="text-green-400 font-mono text-lg font-bold">{createdRoom.passcode}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Share Link</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-blue-400 text-sm bg-gray-900 rounded px-3 py-1.5 overflow-x-auto">
                            {window.location.origin}/rooms/{createdRoom.roomCode}
                          </code>
                          <button
                            onClick={() => copyLink(`${window.location.origin}/rooms/${createdRoom.roomCode}`)}
                            className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                            title="Copy link"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-300" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Share the link and passcode with others to let them join.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowCreate(false); setCreatedRoom(null) }}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-lg transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => joinRoom(createdRoom.roomCode)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Join Room
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Not authenticated message */}
        {!isAuthenticated && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8 text-center">
            <p className="text-gray-300 mb-3">Sign in to create rooms or browse active rooms.</p>
            <p className="text-gray-400 text-sm">You can still join a room using a share link and passcode.</p>
          </div>
        )}

        {/* Active Rooms */}
        {isAuthenticated && (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">Active Rooms</h2>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <Video className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 font-medium mb-2">Failed to load rooms</p>
                <p className="text-gray-400 text-sm mb-4">{error}</p>
                <button
                  onClick={loadRooms}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            ) : rooms.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
                <Video className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No active rooms right now.</p>
                <p className="text-gray-500 text-sm mt-1">Create one to get started!</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {rooms.map(room => (
                  <div
                    key={room.roomId}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors cursor-pointer group"
                    onClick={() => joinRoom(room.roomCode)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {room.name}
                      </h3>
                      {room.isLocked && (
                        <Lock className="w-4 h-4 text-yellow-400 mt-1" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {room.participantCount}{room.maxParticipants > 0 ? `/${room.maxParticipants}` : ''}
                      </span>
                      {room.creatorName && (
                        <span>by {room.creatorName}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
