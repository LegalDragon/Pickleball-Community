import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar, Users, Trophy, ChevronLeft, Loader2,
  AlertCircle, Printer, Download, Clock, MapPin, User, RotateCcw
} from 'lucide-react';
import { tournamentApi, getSharedAssetUrl } from '../services/api';
import PublicProfileModal from '../components/ui/PublicProfileModal';

export default function DivisionSchedule() {
  const { eventId, divisionId } = useParams();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const [resettingDrawing, setResettingDrawing] = useState(false);

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
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1">vs</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Team 2</th>
                              <th className="border border-gray-300 px-3 py-2 text-center text-gray-700 print:px-1 print:py-1">Score</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 print:px-1 print:py-1">Winner</th>
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
                                </tr>
                              ))}
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
    </div>
  );
}
