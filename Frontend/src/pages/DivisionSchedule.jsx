import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar, Users, Trophy, ChevronLeft, Loader2,
  AlertCircle, Printer, Download, Clock, MapPin, User, RotateCcw, Info, X, Edit2, Save
} from 'lucide-react';
import { tournamentApi, getSharedAssetUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import PublicProfileModal from '../components/ui/PublicProfileModal';

export default function DivisionSchedule() {
  const { eventId, divisionId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [resettingDrawing, setResettingDrawing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null); // For match details modal
  const [editingGame, setEditingGame] = useState(null); // { gameId, unit1Score, unit2Score }
  const [savingScore, setSavingScore] = useState(false);

  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    loadSchedule();
  }, [divisionId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tournamentApi.getSchedule(divisionId);
      if (response.success && response.data) {
        setSchedule(response.data);
      } else {
        setError(response.message || 'Failed to load schedule');
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
      setError(err?.response?.data?.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetDrawing = async () => {
    if (!confirm('Are you sure you want to reset the drawing? This will clear all pool assignments and you will need to redraw.')) {
      return;
    }
    try {
      setResettingDrawing(true);
      const response = await tournamentApi.cancelDrawing(divisionId);
      if (response.success) {
        alert('Drawing has been reset. You can now adjust registrations and redraw.');
        // Navigate back to drawing page
        window.location.href = `/event/${eventId}/drawing`;
      } else {
        alert(response.message || 'Failed to reset drawing');
      }
    } catch (err) {
      console.error('Error resetting drawing:', err);
      alert(err?.response?.data?.message || 'Failed to reset drawing');
    } finally {
      setResettingDrawing(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setDownloadingExcel(true);
      const response = await tournamentApi.downloadScoresheet(divisionId);

      // Create blob and download
      const blob = new Blob([response], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schedule?.divisionName || 'Division'}_Scoresheet.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading scoresheet:', err);
      alert('Failed to download scoresheet');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleOpenMatchDetails = (match) => {
    setSelectedMatch(match);
    setEditingGame(null);
  };

  const handleStartEditScore = (game) => {
    setEditingGame({
      gameId: game.gameId,
      unit1Score: game.unit1Score ?? 0,
      unit2Score: game.unit2Score ?? 0
    });
  };

  const handleCancelEditScore = () => {
    setEditingGame(null);
  };

  const handleSaveScore = async () => {
    if (!editingGame) return;

    try {
      setSavingScore(true);
      const response = await tournamentApi.adminUpdateScore(
        editingGame.gameId,
        editingGame.unit1Score,
        editingGame.unit2Score,
        true // markAsFinished
      );

      if (response.success) {
        toast.success('Score saved successfully');
        // Update the local state
        if (selectedMatch?.games) {
          const updatedGames = selectedMatch.games.map(g =>
            g.gameId === editingGame.gameId
              ? { ...g, unit1Score: editingGame.unit1Score, unit2Score: editingGame.unit2Score, status: 'Finished' }
              : g
          );
          setSelectedMatch({ ...selectedMatch, games: updatedGames });
        }
        setEditingGame(null);
        // Reload the schedule to get updated data
        await loadSchedule();
      } else {
        toast.error(response.message || 'Failed to save score');
      }
    } catch (err) {
      console.error('Error saving score:', err);
      toast.error(err?.response?.data?.message || 'Failed to save score');
    } finally {
      setSavingScore(false);
    }
  };

  const formatStatus = (status) => {
    const statusColors = {
      'New': 'bg-gray-100 text-gray-600',
      'Ready': 'bg-blue-100 text-blue-700',
      'Queued': 'bg-yellow-100 text-yellow-700',
      'Started': 'bg-green-100 text-green-700',
      'Playing': 'bg-green-100 text-green-700',
      'Finished': 'bg-purple-100 text-purple-700'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Event
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Print-friendly styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Header - Not printed */}
      <div className="no-print bg-gray-900 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/event/${eventId}/drawing`}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">{schedule?.divisionName}</h1>
                <p className="text-sm text-gray-400">{schedule?.eventName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetDrawing}
                disabled={resettingDrawing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                title="Reset drawing to adjust registrations and redraw"
              >
                {resettingDrawing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Reset Drawing
              </button>
              <button
                onClick={handleDownloadExcel}
                disabled={downloadingExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {downloadingExcel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download Scoresheet
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 print:px-2 print:py-4">
        {/* Header - Printed */}
        <div className="text-center mb-8 print:mb-4">
          <h1 className="text-3xl font-bold text-gray-900 print:text-2xl">{schedule?.eventName}</h1>
          <h2 className="text-2xl font-semibold text-orange-600 mt-2 print:text-xl">{schedule?.divisionName}</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Generated: {new Date(schedule?.exportedAt).toLocaleString()}
          </p>
        </div>

        {/* Drawing Results - Units with their numbers and members */}
        {schedule?.poolStandings && schedule.poolStandings.length > 0 && (
          <div className="mb-8 print:mb-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 print:text-lg">
              <Trophy className="w-5 h-5 text-orange-500" />
              Drawing Results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
              {schedule.poolStandings.map((pool) => (
                <div key={pool.poolNumber} className="bg-gray-50 rounded-lg p-4 border border-gray-200 print:p-2">
                  {pool.poolName && (
                    <h4 className="font-semibold text-gray-800 mb-3 print:text-sm">{pool.poolName}</h4>
                  )}
                  <div className="space-y-2">
                    {pool.standings.map((entry) => (
                      <div key={entry.unitNumber} className="flex items-start gap-2 text-sm">
                        <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-orange-500 text-white font-bold rounded print:w-6 print:h-6 print:text-xs">
                          {entry.unitNumber}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 print:text-xs">{entry.unitName}</div>
                          {entry.members && entry.members.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1 print:gap-1">
                              {entry.members.map((member) => (
                                <button
                                  key={member.userId}
                                  onClick={() => setProfileModalUserId(member.userId)}
                                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-orange-600 transition-colors no-print"
                                  title={`View ${member.firstName} ${member.lastName}'s profile`}
                                >
                                  {member.profileImageUrl ? (
                                    <img
                                      src={getSharedAssetUrl(member.profileImageUrl)}
                                      alt=""
                                      className="w-5 h-5 rounded-full object-cover border border-gray-200"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                      <User className="w-3 h-3 text-gray-400" />
                                    </div>
                                  )}
                                  <span className="hover:underline">
                                    {member.firstName} {member.lastName}
                                  </span>
                                </button>
                              ))}
                              {/* Print-only version without interactivity */}
                              <span className="hidden print:inline text-[10px] text-gray-500">
                                {entry.members.map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule by Round - Separate Pool and Playoff for RoundRobinPlayoff */}
        {schedule?.rounds && schedule.rounds.length > 0 && (
          <div className="mb-8 print:mb-4">
            {/* Pool Play Section */}
            {schedule.rounds.filter(r => r.roundType === 'Pool').length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 print:text-lg">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  Pool Play Schedule
                </h3>
                {schedule.rounds
                  .filter(r => r.roundType === 'Pool')
                  .map((round, roundIdx) => (
                    <div key={roundIdx} className="mb-6 print:mb-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3 bg-gray-100 px-4 py-2 rounded print:text-sm print:px-2 print:py-1">
                        {round.roundName || `Pool Round ${round.roundNumber}`}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 print:text-xs">
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">#</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Team 1</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1 w-16">Score</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1 w-16">Score</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Team 2</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Winner</th>
                            </tr>
                          </thead>
                          <tbody>
                            {round.matches
                              .filter(m => !m.isBye)
                              .map((match, matchIdx) => {
                                const unit1Wins = match.winnerUnitId === match.unit1Id;
                                const unit2Wins = match.winnerUnitId === match.unit2Id;
                                return (
                                  <tr key={matchIdx} className="hover:bg-gray-50 print:text-xs">
                                    <td className="border border-gray-300 px-3 py-2 text-gray-600 print:px-1 print:py-1">
                                      <div className="flex items-center gap-2">
                                        <span>{match.matchNumber}</span>
                                        <button
                                          onClick={() => handleOpenMatchDetails(match)}
                                          className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors print:hidden"
                                          title="Match details"
                                        >
                                          <Info className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                    <td className={`border border-gray-300 px-3 py-2 print:px-1 print:py-1 ${unit1Wins ? 'bg-green-50' : ''}`}>
                                      <div className="flex items-center gap-2">
                                        {match.unit1Number && (
                                          <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs print:w-4 print:h-4">
                                            {match.unit1Number}
                                          </span>
                                        )}
                                        <span className={`${unit1Wins ? 'text-green-700 font-semibold' : 'text-gray-900'}`}>
                                          {match.unit1Name || `Position ${match.unit1Number}`}
                                        </span>
                                      </div>
                                    </td>
                                    <td className={`border border-gray-300 px-3 py-2 text-center print:px-1 print:py-1 ${unit1Wins ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-600'}`}>
                                      {match.unit1Score ?? '—'}
                                    </td>
                                    <td className={`border border-gray-300 px-3 py-2 text-center print:px-1 print:py-1 ${unit2Wins ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-600'}`}>
                                      {match.unit2Score ?? '—'}
                                    </td>
                                    <td className={`border border-gray-300 px-3 py-2 print:px-1 print:py-1 ${unit2Wins ? 'bg-green-50' : ''}`}>
                                      <div className="flex items-center gap-2">
                                        {match.unit2Number && (
                                          <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs print:w-4 print:h-4">
                                            {match.unit2Number}
                                          </span>
                                        )}
                                        <span className={`${unit2Wins ? 'text-green-700 font-semibold' : 'text-gray-900'}`}>
                                          {match.unit2Name || `Position ${match.unit2Number}`}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-gray-900 font-medium print:px-1 print:py-1">
                                      {match.winnerName || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Playoff/Bracket Section */}
            {schedule.rounds.filter(r => r.roundType === 'Bracket').length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 print:text-lg">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Playoff Bracket
                  {schedule.playoffFromPools && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      (Top {schedule.playoffFromPools} from each pool advance)
                    </span>
                  )}
                </h3>
                {schedule.rounds
                  .filter(r => r.roundType === 'Bracket')
                  .map((round, roundIdx) => (
                    <div key={roundIdx} className="mb-6 print:mb-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded print:text-sm print:px-2 print:py-1">
                        {round.roundName || `Playoff Round ${round.roundNumber}`}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-yellow-50 print:text-xs">
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">#</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Team 1</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1">vs</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Team 2</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1">Score</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Winner</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:hidden w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {round.matches.map((match, matchIdx) => (
                              <tr
                                key={matchIdx}
                                className={`print:text-xs ${match.isBye ? 'bg-gray-100 text-gray-400' : 'hover:bg-yellow-50'}`}
                              >
                                <td className="border border-gray-300 px-3 py-2 text-gray-600 print:px-1 print:py-1">
                                  {match.matchNumber}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 print:px-1 print:py-1">
                                  {match.isBye && !match.unit1Name ? (
                                    <span className="italic text-gray-400">BYE</span>
                                  ) : match.unit1Name ? (
                                    <div>
                                      <div className="flex items-center gap-2">
                                        {match.unit1Number && (
                                          <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs print:w-4 print:h-4">
                                            {match.unit1Number}
                                          </span>
                                        )}
                                        <span className="text-gray-900">{match.unit1Name}</span>
                                      </div>
                                      {match.unit1SeedInfo && (
                                        <div className="text-xs text-gray-500 ml-8 print:ml-5">{match.unit1SeedInfo}</div>
                                      )}
                                    </div>
                                  ) : match.unit1SeedInfo ? (
                                    <span className="text-blue-600 font-medium">{match.unit1SeedInfo}</span>
                                  ) : (
                                    <span className="text-gray-400 italic">TBD</span>
                                  )}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center text-gray-400 print:px-1 print:py-1">
                                  {match.isBye ? '' : 'vs'}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 print:px-1 print:py-1">
                                  {match.isBye && !match.unit2Name ? (
                                    <span className="italic text-gray-400">BYE</span>
                                  ) : match.unit2Name ? (
                                    <div>
                                      <div className="flex items-center gap-2">
                                        {match.unit2Number && (
                                          <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs print:w-4 print:h-4">
                                            {match.unit2Number}
                                          </span>
                                        )}
                                        <span className="text-gray-900">{match.unit2Name}</span>
                                      </div>
                                      {match.unit2SeedInfo && (
                                        <div className="text-xs text-gray-500 ml-8 print:ml-5">{match.unit2SeedInfo}</div>
                                      )}
                                    </div>
                                  ) : match.unit2SeedInfo ? (
                                    <span className="text-blue-600 font-medium">{match.unit2SeedInfo}</span>
                                  ) : (
                                    <span className="text-gray-400 italic">TBD</span>
                                  )}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center text-gray-600 print:px-1 print:py-1">
                                  {match.isBye ? '—' : (match.score || '—')}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-900 font-medium print:px-1 print:py-1">
                                  {match.isBye ? (match.unit1Name || match.unit2Name || '—') : (match.winnerName || '—')}
                                </td>
                                <td className="border border-gray-300 px-2 py-2 text-center print:hidden">
                                  {!match.isBye && (
                                    <button
                                      onClick={() => handleOpenMatchDetails(match)}
                                      className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                      title="Match details"
                                    >
                                      <Info className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Other round types (not Pool or Bracket) */}
            {schedule.rounds.filter(r => r.roundType !== 'Pool' && r.roundType !== 'Bracket').length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 print:text-lg">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  Match Schedule
                </h3>
                {schedule.rounds
                  .filter(r => r.roundType !== 'Pool' && r.roundType !== 'Bracket')
                  .map((round, roundIdx) => (
                    <div key={roundIdx} className="mb-6 print:mb-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3 bg-gray-100 px-4 py-2 rounded print:text-sm print:px-2 print:py-1">
                        {round.roundName || `${round.roundType} Round ${round.roundNumber}`}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 print:text-xs">
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">#</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Team 1</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1">vs</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Team 2</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1">Score</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Winner</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:hidden w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {round.matches
                              .filter(m => !m.isBye)
                              .map((match, matchIdx) => (
                                <tr key={matchIdx} className="hover:bg-gray-50 print:text-xs">
                                  <td className="border border-gray-300 px-3 py-2 text-gray-600 print:px-1 print:py-1">
                                    {match.matchNumber}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 print:px-1 print:py-1">
                                    <div className="flex items-center gap-2">
                                      {match.unit1Number && (
                                        <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs print:w-4 print:h-4">
                                          {match.unit1Number}
                                        </span>
                                      )}
                                      <span className="text-gray-900">{match.unit1Name || `Position ${match.unit1Number}`}</span>
                                    </div>
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-center text-gray-400 print:px-1 print:py-1">vs</td>
                                  <td className="border border-gray-300 px-3 py-2 print:px-1 print:py-1">
                                    <div className="flex items-center gap-2">
                                      {match.unit2Number && (
                                        <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs print:w-4 print:h-4">
                                          {match.unit2Number}
                                        </span>
                                      )}
                                      <span className="text-gray-900">{match.unit2Name || `Position ${match.unit2Number}`}</span>
                                    </div>
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-center text-gray-600 print:px-1 print:py-1">
                                    {match.score || '—'}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-gray-900 font-medium print:px-1 print:py-1">
                                    {match.winnerName || '—'}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-2 text-center print:hidden">
                                    <button
                                      onClick={() => handleOpenMatchDetails(match)}
                                      className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                      title="Match details"
                                    >
                                      <Info className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm mt-8 pt-4 border-t border-gray-200 print:mt-4 print:pt-2">
          <p>pickleball.community</p>
        </div>
      </div>

      {/* Public Profile Modal */}
      {profileModalUserId && (
        <PublicProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Match #{selectedMatch.matchNumber} Details
              </h3>
              <button
                onClick={() => setSelectedMatch(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Teams */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {selectedMatch.unit1Number && (
                      <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                        {selectedMatch.unit1Number}
                      </span>
                    )}
                    <span className="font-medium text-gray-900">
                      {selectedMatch.unit1Name || `Position ${selectedMatch.unit1Number}`}
                    </span>
                  </div>
                </div>
                <div className="text-center text-gray-400 font-medium">vs</div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {selectedMatch.unit2Number && (
                      <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 font-semibold rounded text-xs">
                        {selectedMatch.unit2Number}
                      </span>
                    )}
                    <span className="font-medium text-gray-900">
                      {selectedMatch.unit2Name || `Position ${selectedMatch.unit2Number}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Match Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Encounter ID:</span>
                  <span className="text-gray-900">{selectedMatch.encounterId || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Overall Score:</span>
                  <span className="text-gray-900 font-medium">{selectedMatch.score || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Winner:</span>
                  <span className="text-gray-900 font-medium">{selectedMatch.winnerName || '—'}</span>
                </div>
                {selectedMatch.startedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started:</span>
                    <span className="text-gray-900">{new Date(selectedMatch.startedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedMatch.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Completed:</span>
                    <span className="text-gray-900">{new Date(selectedMatch.completedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Games */}
              {selectedMatch.games && selectedMatch.games.length > 0 ? (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Games</h4>
                  <div className="space-y-3">
                    {selectedMatch.games.map((game, idx) => (
                      <div key={game.gameId || idx} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-700">Game {game.gameNumber || idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${formatStatus(game.status)}`}>
                            {game.status || 'New'}
                          </span>
                        </div>

                        {editingGame?.gameId === game.gameId ? (
                          /* Score Editing UI */
                          <div className="space-y-3">
                            <div className="flex items-center gap-4 justify-center">
                              <div className="text-center">
                                <label className="text-xs text-gray-500 block mb-1">
                                  {selectedMatch.unit1Name || 'Team 1'}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={editingGame.unit1Score}
                                  onChange={(e) => setEditingGame({
                                    ...editingGame,
                                    unit1Score: parseInt(e.target.value) || 0
                                  })}
                                  className="w-16 text-center px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                />
                              </div>
                              <span className="text-gray-400">-</span>
                              <div className="text-center">
                                <label className="text-xs text-gray-500 block mb-1">
                                  {selectedMatch.unit2Name || 'Team 2'}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={editingGame.unit2Score}
                                  onChange={(e) => setEditingGame({
                                    ...editingGame,
                                    unit2Score: parseInt(e.target.value) || 0
                                  })}
                                  className="w-16 text-center px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                />
                              </div>
                            </div>
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={handleCancelEditScore}
                                disabled={savingScore}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveScore}
                                disabled={savingScore}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                              >
                                {savingScore ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Score Display */
                          <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold text-center flex-1">
                              <span className={game.unit1Score > game.unit2Score ? 'text-green-600' : 'text-gray-700'}>
                                {game.unit1Score ?? '—'}
                              </span>
                              <span className="text-gray-400 mx-2">-</span>
                              <span className={game.unit2Score > game.unit1Score ? 'text-green-600' : 'text-gray-700'}>
                                {game.unit2Score ?? '—'}
                              </span>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => handleStartEditScore(game)}
                                className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title="Edit score"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Game Details */}
                        <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs text-gray-500">
                          {game.courtLabel && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {game.courtLabel}
                            </div>
                          )}
                          {game.startedAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(game.startedAt).toLocaleTimeString()}
                            </div>
                          )}
                          {game.completedAt && (
                            <div className="col-span-2 text-gray-400">
                              Completed: {new Date(game.completedAt).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <p>No games recorded yet</p>
                  <p className="text-xs mt-1">Games will appear here once the match starts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
