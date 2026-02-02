import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Users, Link, Copy, Check, Loader2 } from 'lucide-react';
import { videoRoomApi } from '../../services/videoRoomService';
import InviteToRoomModal from './InviteToRoomModal';

export default function ClubRoom({ clubId, clubName, isMember, isAdmin }) {
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [participants, setParticipants] = useState([]);

  const loadRoom = useCallback(async () => {
    if (!isMember) return;
    setLoading(true);
    setError(null);
    try {
      const response = await videoRoomApi.getClubRoom(clubId);
      const data = response.data || response;
      setRoom(data);

      // Load participants
      if (data.roomCode) {
        try {
          const partResponse = await videoRoomApi.getParticipants(data.roomCode);
          setParticipants(partResponse.data || partResponse || []);
        } catch {
          setParticipants([]);
        }
      }
    } catch (err) {
      console.error('Error loading club room:', err);
      setError('Failed to load club room');
    } finally {
      setLoading(false);
    }
  }, [clubId, isMember]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  // Poll for participant count every 15 seconds
  useEffect(() => {
    if (!room?.roomCode) return;
    const interval = setInterval(async () => {
      try {
        const response = await videoRoomApi.getParticipants(room.roomCode);
        setParticipants(response.data || response || []);
      } catch {
        // Ignore polling errors
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [room?.roomCode]);

  const handleJoinRoom = async () => {
    if (!room?.roomCode) return;
    // Navigate to the video room page
    navigate(`/rooms/${room.roomCode}?club=true`);
  };

  const handleCopyLink = async () => {
    if (!room?.roomCode) return;
    const link = `${window.location.origin}/rooms/${room.roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for clipboard
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isMember) return null;

  if (loading && !room) {
    return (
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 text-teal-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading video room...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4">
        <div className="text-center text-sm text-red-500">{error}</div>
      </div>
    );
  }

  const participantCount = participants.length || room?.participantCount || 0;

  return (
    <>
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Video className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Club Video Room</h3>
              {participantCount > 0 && (
                <p className="text-xs text-teal-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  {participantCount} {participantCount === 1 ? 'person' : 'people'} in room
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Participants Preview */}
        {participants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {participants.slice(0, 8).map((p, idx) => (
              <span
                key={p.connectionId || idx}
                className="px-2 py-0.5 bg-white/80 border border-teal-200 text-teal-700 text-xs rounded-full"
              >
                {p.displayName}
              </span>
            ))}
            {participants.length > 8 && (
              <span className="px-2 py-0.5 bg-white/80 border border-teal-200 text-teal-700 text-xs rounded-full">
                +{participants.length - 8} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleJoinRoom}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors text-sm"
          >
            <Video className="w-4 h-4" />
            Join Club Room
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-teal-300 text-teal-700 rounded-lg font-medium hover:bg-teal-50 transition-colors text-sm"
          >
            <Users className="w-4 h-4" />
            Invite
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-teal-300 text-teal-700 rounded-lg font-medium hover:bg-teal-50 transition-colors text-sm"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && room && (
        <InviteToRoomModal
          clubId={clubId}
          clubName={clubName}
          roomCode={room.roomCode}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </>
  );
}
