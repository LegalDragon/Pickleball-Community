import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { certificationApi, getSharedAssetUrl } from '../services/api';
import { getAssetUrl } from '../services/api';
import {
  User, Star, Copy, Check, Plus, Link as LinkIcon,
  Eye, EyeOff, Calendar, MessageSquare, ChevronDown, ChevronUp,
  Award, TrendingUp, Filter, BarChart3, Users, Lock, Globe, UserPlus,
  Bell, ArrowRight, Clock
} from 'lucide-react';
import HelpIcon from '../components/ui/HelpIcon';

export default function MyCertificate() {
  const [certificate, setCertificate] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedReview, setExpandedReview] = useState(null);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // Filter states
  const [showComparison, setShowComparison] = useState(false);
  const [knowledgeLevelFilter, setKnowledgeLevelFilter] = useState('all');
  const [timePeriodFilter, setTimePeriodFilter] = useState('all');
  const [expandedComparisonGroup, setExpandedComparisonGroup] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [certData, reqData, pendingData] = await Promise.all([
        certificationApi.getMyCertificate(),
        certificationApi.getActiveRequest(),
        certificationApi.getMyPendingReviews()
      ]);
      setCertificate(certData);
      setActiveRequest(reqData);
      setPendingReviews(pendingData || []);
    } catch (err) {
      console.error('Error loading certificate data:', err);
      setError('Failed to load certificate data');
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityChange = async (newVisibility) => {
    if (!activeRequest) return;
    try {
      setUpdatingVisibility(true);
      const updated = await certificationApi.updateRequest(activeRequest.id, { visibility: newVisibility });
      setActiveRequest(updated);
    } catch (err) {
      console.error('Error updating visibility:', err);
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const copyLink = async () => {
    if (!activeRequest) return;
    try {
      const url = `${window.location.origin}/review/${activeRequest.token}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    if (score >= 4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  // Letter grade based on 0-100 scale
  // Below 20: No grade, 20-70: F-A, 70-85: Semi-Pro, 85+: Pro
  const getLetterGrade = (score100) => {
    if (score100 >= 85) return { letter: 'P', label: 'Pro', color: 'text-purple-600 bg-purple-100', isPro: true };
    if (score100 >= 70) return { letter: 'SP', label: 'Semi-Pro', color: 'text-indigo-600 bg-indigo-100', isPro: true };
    if (score100 < 20) return { letter: 'NA', label: 'Not Rated', color: 'text-gray-400 bg-gray-100', isPro: false };

    // Scale 20-70 to letter grades F-A (50 point range)
    // F: 20-30, D-: 30-33.3, D: 33.3-36.7, D+: 36.7-40
    // C-: 40-43.3, C: 43.3-46.7, C+: 46.7-50
    // B-: 50-53.3, B: 53.3-56.7, B+: 56.7-60
    // A-: 60-63.3, A: 63.3-66.7, A+: 66.7-70
    if (score100 >= 66.7) return { letter: 'A+', color: 'text-green-600 bg-green-100', isPro: false };
    if (score100 >= 63.3) return { letter: 'A', color: 'text-green-600 bg-green-100', isPro: false };
    if (score100 >= 60) return { letter: 'A-', color: 'text-green-600 bg-green-100', isPro: false };
    if (score100 >= 56.7) return { letter: 'B+', color: 'text-blue-600 bg-blue-100', isPro: false };
    if (score100 >= 53.3) return { letter: 'B', color: 'text-blue-600 bg-blue-100', isPro: false };
    if (score100 >= 50) return { letter: 'B-', color: 'text-blue-600 bg-blue-100', isPro: false };
    if (score100 >= 46.7) return { letter: 'C+', color: 'text-yellow-600 bg-yellow-100', isPro: false };
    if (score100 >= 43.3) return { letter: 'C', color: 'text-yellow-600 bg-yellow-100', isPro: false };
    if (score100 >= 40) return { letter: 'C-', color: 'text-yellow-600 bg-yellow-100', isPro: false };
    if (score100 >= 36.7) return { letter: 'D+', color: 'text-orange-600 bg-orange-100', isPro: false };
    if (score100 >= 33.3) return { letter: 'D', color: 'text-orange-600 bg-orange-100', isPro: false };
    if (score100 >= 30) return { letter: 'D-', color: 'text-orange-600 bg-orange-100', isPro: false };
    return { letter: 'F', color: 'text-red-600 bg-red-100', isPro: false };
  };

  // Convert 0-10 score to 0-100 and get letter grade for a group
  const getGroupScore100 = (groupAverage) => {
    return Math.round(groupAverage * 10);
  };

  // Filter reviews based on selected filters
  const filteredReviews = useMemo(() => {
    if (!certificate?.reviews) return [];

    return certificate.reviews.filter(review => {
      // Exclude self-reviews from filtered view (they're shown separately)
      if (review.isSelfReview) return false;

      // Filter by knowledge level
      if (knowledgeLevelFilter !== 'all' && review.knowledgeLevelName !== knowledgeLevelFilter) {
        return false;
      }

      // Filter by time period
      if (timePeriodFilter !== 'all') {
        const reviewDate = new Date(review.createdAt);
        const now = new Date();
        const daysDiff = (now - reviewDate) / (1000 * 60 * 60 * 24);

        switch (timePeriodFilter) {
          case 'week':
            if (daysDiff > 7) return false;
            break;
          case 'month':
            if (daysDiff > 30) return false;
            break;
          case '3months':
            if (daysDiff > 90) return false;
            break;
          case 'year':
            if (daysDiff > 365) return false;
            break;
        }
      }

      return true;
    });
  }, [certificate?.reviews, knowledgeLevelFilter, timePeriodFilter]);

  // Get unique knowledge levels from reviews for filter dropdown
  const availableKnowledgeLevels = useMemo(() => {
    if (!certificate?.reviews) return [];
    const levels = new Set(
      certificate.reviews
        .filter(r => !r.isSelfReview)
        .map(r => r.knowledgeLevelName)
    );
    return Array.from(levels);
  }, [certificate?.reviews]);

  // Check if any filter is active
  const isFilterActive = knowledgeLevelFilter !== 'all' || timePeriodFilter !== 'all';

  // Calculate filtered skill averages when filters are active
  const filteredScores = useMemo(() => {
    if (!isFilterActive || filteredReviews.length === 0) return null;

    // Collect all scores from filtered reviews
    const allScores = filteredReviews.flatMap(r => r.scores || []);
    if (allScores.length === 0) return null;

    // Group scores by skill area and calculate averages
    const skillMap = new Map();
    allScores.forEach(score => {
      if (!skillMap.has(score.skillAreaId)) {
        skillMap.set(score.skillAreaId, {
          skillAreaId: score.skillAreaId,
          skillAreaName: score.skillAreaName,
          scores: []
        });
      }
      skillMap.get(score.skillAreaId).scores.push(score.score);
    });

    // Calculate averages
    const skillAverages = Array.from(skillMap.values()).map(skill => ({
      skillAreaId: skill.skillAreaId,
      skillAreaName: skill.skillAreaName,
      averageScore: skill.scores.reduce((a, b) => a + b, 0) / skill.scores.length
    }));

    // Calculate overall average
    const overallAverage = allScores.reduce((a, b) => a + b.score, 0) / allScores.length;

    // Group by skill group if available from certificate data
    const groupScores = certificate?.groupScores?.map(group => {
      const groupSkillAverages = skillAverages.filter(s =>
        group.skillAverages?.some(gs => gs.skillAreaId === s.skillAreaId)
      );
      if (groupSkillAverages.length === 0) return null;

      const groupAverage = groupSkillAverages.reduce((a, b) => a + b.averageScore, 0) / groupSkillAverages.length;
      return {
        ...group,
        averageScore: groupAverage,
        skillAverages: groupSkillAverages
      };
    }).filter(Boolean) || [];

    return {
      overallAverage,
      skillAverages,
      groupScores,
      reviewCount: filteredReviews.length
    };
  }, [filteredReviews, isFilterActive, certificate?.groupScores]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Award className="w-12 h-12" />
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                My Player Certificate
                <HelpIcon topicCode="profile.certification" size="md" className="text-white/80" />
              </h1>
              <p className="text-primary-100 mt-1">
                View your skill ratings and share review links
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Review Requests */}
            {pendingReviews.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Pending Review Requests ({pendingReviews.length})
                  </h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  These players have invited you to review their skills.
                </p>
                <div className="space-y-3">
                  {pendingReviews.map(invitation => (
                    <div
                      key={invitation.invitationId}
                      className="bg-white rounded-lg p-4 border border-amber-100 flex items-center gap-4"
                    >
                      {/* Player Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {invitation.studentProfileImageUrl ? (
                          <img
                            src={getSharedAssetUrl(invitation.studentProfileImageUrl)}
                            alt={invitation.studentName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{invitation.studentName}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          Invited {formatDate(invitation.invitedAt)}
                        </div>
                        {invitation.message && (
                          <div className="text-sm text-gray-600 mt-1 truncate">
                            "{invitation.message}"
                          </div>
                        )}
                      </div>

                      {/* Review Button */}
                      <Link
                        to={`/review/${invitation.reviewToken}`}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex-shrink-0 font-medium"
                      >
                        Review
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overall Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Skill Summary</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {certificate?.totalReviews || 0} reviews
                  </span>
                </div>
              </div>

              {certificate?.totalReviews > 0 ? (
                <>
                  {/* Overall Score with Letter Grade / Pro Badge */}
                  {(() => {
                    const totalScore100 = Math.round((certificate.weightedOverallScore || certificate.overallAverageScore) * 10);
                    const grade = getLetterGrade(totalScore100);
                    return (
                      <div className={`flex items-center gap-4 p-4 rounded-lg mb-6 ${grade.isPro ? 'bg-gradient-to-r from-purple-50 to-indigo-100' : 'bg-gradient-to-r from-primary-50 to-primary-100'}`}>
                        <div className="flex-shrink-0 flex items-center gap-3">
                          <div className={`${grade.isPro ? 'w-20 h-16 rounded-lg px-3' : 'w-16 h-16 rounded-full'} flex items-center justify-center text-2xl font-bold ${grade.color}`}>
                            {grade.letter}
                          </div>
                          <div className="text-3xl font-bold text-gray-900">
                            {totalScore100}
                            <span className="text-lg text-gray-500 font-normal">/100</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-lg font-semibold text-gray-900">
                            {grade.label || 'Overall Rating'}
                          </div>
                          <div className="text-sm text-gray-600">
                            Based on {certificate.totalReviews} review{certificate.totalReviews !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Group Scores with Weights */}
                  {certificate.groupScores?.length > 0 && (
                    <div className="space-y-5 mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Skill Groups</h3>
                      {certificate.groupScores.map(group => {
                        const groupScore100 = getGroupScore100(group.averageScore);
                        const groupGrade = getLetterGrade(groupScore100);
                        return (
                          <div key={group.groupId} className={`border rounded-lg p-4 ${groupGrade.isPro ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center justify-center ${groupGrade.isPro ? 'px-3 py-2' : 'w-10 h-10'} rounded-lg text-lg font-bold ${groupGrade.color}`}>
                                  {groupGrade.letter}
                                </span>
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {group.groupName}
                                    {groupGrade.isPro && <span className="ml-2 text-xs font-medium text-purple-600">({groupGrade.label})</span>}
                                  </div>
                                  <div className="text-xs text-gray-500">Weight: {group.weight}%</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-900">{groupScore100}<span className="text-sm text-gray-500 font-normal">/100</span></div>
                                <div className="text-xs text-gray-500">Contributes {group.weightedContribution.toFixed(1)} pts</div>
                              </div>
                            </div>
                            {/* Skills within this group */}
                            <div className="space-y-2 pt-3 border-t border-gray-100">
                              {group.skillAverages?.map(skill => (
                                <div key={skill.skillAreaId} className="flex items-center gap-3">
                                  <div className="w-32 flex-shrink-0">
                                    <span className="text-sm text-gray-600">{skill.skillAreaName}</span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary-500 rounded-full transition-all"
                                        style={{ width: `${(skill.averageScore / 10) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="w-16 text-right">
                                    <span className="text-sm font-medium text-gray-700">
                                      {getGroupScore100(skill.averageScore)}/100
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Flat Skill Breakdown (fallback if no groups) */}
                  {(!certificate.groupScores || certificate.groupScores.length === 0) && certificate.skillAverages?.length > 0 && (
                    <div className="space-y-3">
                      {certificate.skillAverages?.map(skill => (
                        <div key={skill.skillAreaId} className="flex items-center gap-4">
                          <div className="w-40 flex-shrink-0">
                            <span className="text-sm text-gray-700">{skill.skillAreaName}</span>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 rounded-full transition-all"
                                style={{ width: `${(skill.averageScore / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="w-12 text-right">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${getScoreColor(skill.averageScore)}`}>
                              {skill.averageScore.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No reviews yet.</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Share your review link to get feedback on your skills.
                  </p>
                </div>
              )}
            </div>

            {/* Self-Review Comparison */}
            {certificate?.hasSelfReview && certificate?.selfReview && certificate?.peerReviewCount > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Self vs Peer Comparison</h2>
                      {isFilterActive && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Filtered
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowComparison(!showComparison)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        showComparison
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {showComparison ? 'Hide Comparison' : 'Show Comparison'}
                    </button>
                  </div>

                  {/* Filter Controls - Above comparison */}
                  {showComparison && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      <select
                        value={knowledgeLevelFilter}
                        onChange={(e) => setKnowledgeLevelFilter(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="all">All Experience Levels</option>
                        {availableKnowledgeLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                      <select
                        value={timePeriodFilter}
                        onChange={(e) => setTimePeriodFilter(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="all">All Time</option>
                        <option value="week">Last Week</option>
                        <option value="month">Last Month</option>
                        <option value="3months">Last 3 Months</option>
                        <option value="year">Last Year</option>
                      </select>
                      {isFilterActive && (
                        <button
                          onClick={() => { setKnowledgeLevelFilter('all'); setTimePeriodFilter('all'); }}
                          className="text-sm text-gray-500 hover:text-gray-700 px-2"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {showComparison && (
                  <div className="space-y-4">
                    {/* Overall comparison - use filtered scores when active */}
                    {(() => {
                      const peerScore = isFilterActive && filteredScores
                        ? filteredScores.overallAverage
                        : certificate.weightedOverallScore;
                      const peerCount = isFilterActive && filteredScores
                        ? filteredScores.reviewCount
                        : certificate.peerReviewCount;

                      return (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                          <div className="text-center">
                            <div className="text-sm text-gray-500 mb-1">Your Self-Assessment</div>
                            <div className="text-2xl font-bold text-purple-600">
                              {getGroupScore100(certificate.selfReview.weightedOverallScore)}/100
                            </div>
                            <div className={`inline-block mt-1 px-2 py-0.5 rounded text-sm font-bold ${getLetterGrade(getGroupScore100(certificate.selfReview.weightedOverallScore)).color}`}>
                              {getLetterGrade(getGroupScore100(certificate.selfReview.weightedOverallScore)).letter}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-gray-500 mb-1">Peer Average ({peerCount} reviews)</div>
                            <div className="text-2xl font-bold text-primary-600">
                              {getGroupScore100(peerScore)}/100
                            </div>
                            <div className={`inline-block mt-1 px-2 py-0.5 rounded text-sm font-bold ${getLetterGrade(getGroupScore100(peerScore)).color}`}>
                              {getLetterGrade(getGroupScore100(peerScore)).letter}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Group-by-group comparison - use filtered scores when active */}
                    {certificate.selfReview.groupScores?.map(selfGroup => {
                      const peerGroup = isFilterActive && filteredScores
                        ? filteredScores.groupScores?.find(g => g.groupId === selfGroup.groupId)
                        : certificate.groupScores?.find(g => g.groupId === selfGroup.groupId);
                      if (!peerGroup) return null;

                      const selfScore100 = getGroupScore100(selfGroup.averageScore);
                      const peerScore100 = getGroupScore100(peerGroup.averageScore);
                      const diff = selfScore100 - peerScore100;
                      const isExpanded = expandedComparisonGroup === selfGroup.groupId;

                      return (
                        <div key={selfGroup.groupId} className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedComparisonGroup(isExpanded ? null : selfGroup.groupId)}
                            className="w-full p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="font-medium text-gray-900">{selfGroup.groupName}</span>
                              </div>
                              <span className={`text-sm font-medium ${
                                diff > 5 ? 'text-orange-600' : diff < -5 ? 'text-blue-600' : 'text-gray-500'
                              }`}>
                                {diff > 0 ? `+${diff}` : diff} pts difference
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-gray-500 mb-1 text-left">Self</div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${selfScore100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-purple-600 w-12 text-right">{selfScore100}</span>
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1 text-left">Peers</div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary-500 rounded-full"
                                      style={{ width: `${peerScore100}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-primary-600 w-12 text-right">{peerScore100}</span>
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Skill Area Drill-down */}
                          {isExpanded && (
                            <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Skill Breakdown
                              </div>
                              {selfGroup.skillAverages?.map(selfSkill => {
                                const peerSkill = peerGroup.skillAverages?.find(s => s.skillAreaId === selfSkill.skillAreaId);
                                const selfSkillScore = getGroupScore100(selfSkill.averageScore);
                                const peerSkillScore = peerSkill ? getGroupScore100(peerSkill.averageScore) : 0;
                                const skillDiff = selfSkillScore - peerSkillScore;

                                return (
                                  <div key={selfSkill.skillAreaId} className="bg-white rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-700">{selfSkill.skillAreaName}</span>
                                      <span className={`text-xs font-medium ${
                                        skillDiff > 10 ? 'text-orange-600' : skillDiff < -10 ? 'text-blue-600' : 'text-gray-400'
                                      }`}>
                                        {skillDiff > 0 ? `+${skillDiff}` : skillDiff}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-purple-400 rounded-full"
                                            style={{ width: `${selfSkillScore}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-purple-600 w-8 text-right">{selfSkillScore}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-primary-400 rounded-full"
                                            style={{ width: `${peerSkillScore}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-primary-600 w-8 text-right">{peerSkillScore}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Individual Reviews */}
            {certificate?.reviews?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Review Details</h2>
                  {isFilterActive && (
                    <span className="text-sm text-gray-500">
                      Showing {filteredReviews.length} of {certificate.peerReviewCount} reviews
                    </span>
                  )}
                </div>

                {filteredReviews.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    No reviews match the selected filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReviews.map(review => (
                    <div key={review.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            {review.reviewerDisplayName === 'Anonymous' ? (
                              <EyeOff className="w-5 h-5 text-gray-400" />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-gray-900">{review.reviewerDisplayName}</div>
                            <div className="text-sm text-gray-500">{review.knowledgeLevelName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
                          {expandedReview === review.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {expandedReview === review.id && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                          {/* Scores */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            {review.scores.map(score => {
                              const score100 = score.score * 10;
                              const scoreGrade = getLetterGrade(score100);
                              return (
                                <div key={score.id} className="flex items-center justify-between bg-white rounded p-2">
                                  <span className="text-sm text-gray-600">{score.skillAreaName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${scoreGrade.color}`}>
                                      {scoreGrade.letter}
                                    </span>
                                    <span className="text-sm font-medium text-gray-700">
                                      {score100}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Comments */}
                          {review.comments && (
                            <div className="flex items-start gap-2 mt-3">
                              <MessageSquare className="w-4 h-4 text-gray-400 mt-1" />
                              <p className="text-gray-600 text-sm">{review.comments}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Review Link & Settings */}
          <div className="space-y-6">
            {/* Single Review Link */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <LinkIcon className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Your Review Link</h2>
              </div>

              {activeRequest && (
                <>
                  {/* Stats */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{activeRequest.reviewCount}</div>
                      <div className="text-xs text-gray-500">Reviews</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{activeRequest.invitationCount}</div>
                      <div className="text-xs text-gray-500">Invited</div>
                    </div>
                    <div className="text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
                    </div>
                  </div>

                  {/* Copy Link Button */}
                  <button
                    onClick={copyLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors mb-4"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-5 h-5" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy Review Link
                      </>
                    )}
                  </button>

                  {/* Visibility Settings */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Who can review?
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'Anyone', label: 'Anyone with the link', icon: Globe, desc: 'Open to everyone' },
                        { value: 'Members', label: 'Community members only', icon: Users, desc: 'Must be logged in' },
                        { value: 'InvitedOnly', label: 'Invited users only', icon: Lock, desc: 'Only people you invite' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => handleVisibilityChange(option.value)}
                          disabled={updatingVisibility}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                            activeRequest.visibility === option.value
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <option.icon className={`w-5 h-5 ${activeRequest.visibility === option.value ? 'text-primary-600' : 'text-gray-400'}`} />
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${activeRequest.visibility === option.value ? 'text-primary-700' : 'text-gray-700'}`}>
                              {option.label}
                            </div>
                            <div className="text-xs text-gray-500">{option.desc}</div>
                          </div>
                          {activeRequest.visibility === option.value && (
                            <Check className="w-5 h-5 text-primary-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Invite Peers Button */}
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-primary-400 hover:text-primary-600 transition-colors"
                  >
                    <UserPlus className="w-5 h-5" />
                    Invite Peers to Review
                  </button>

                  <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Created {formatDate(activeRequest.createdAt)}
                  </div>
                </>
              )}
            </div>

            {/* How it works */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">How it works</h3>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">1</span>
                  Create a review link
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">2</span>
                  Share it with people who've seen you play
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">3</span>
                  They rate your skills (1-10)
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">4</span>
                  View aggregated results here
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Peers Modal */}
      {showInviteModal && activeRequest && (
        <InvitePeersModal
          requestId={activeRequest.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function InvitePeersModal({ requestId, onClose, onInvited }) {
  const [peers, setPeers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [inviting, setInviting] = useState(false);
  const [expandedClub, setExpandedClub] = useState(null);

  useEffect(() => {
    loadPeers();
  }, [requestId]);

  const loadPeers = async () => {
    try {
      setLoading(true);
      const data = await certificationApi.getInvitablePeers(requestId);
      setPeers(data);
    } catch (err) {
      console.error('Error loading peers:', err);
      setError('Failed to load peers');
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const selectAllFriends = () => {
    const newSelected = new Set(selectedUserIds);
    peers?.friends?.forEach(f => {
      if (!f.alreadyInvited && !f.hasReviewed) {
        newSelected.add(f.userId);
      }
    });
    setSelectedUserIds(newSelected);
  };

  const selectAllClubMembers = (clubId) => {
    const club = peers?.clubs?.find(c => c.clubId === clubId);
    if (!club) return;
    const newSelected = new Set(selectedUserIds);
    club.members.forEach(m => {
      if (!m.alreadyInvited && !m.hasReviewed) {
        newSelected.add(m.userId);
      }
    });
    setSelectedUserIds(newSelected);
  };

  const selectAll = () => {
    const newSelected = new Set();
    peers?.friends?.forEach(f => {
      if (!f.alreadyInvited && !f.hasReviewed) {
        newSelected.add(f.userId);
      }
    });
    peers?.clubs?.forEach(c => {
      c.members.forEach(m => {
        if (!m.alreadyInvited && !m.hasReviewed) {
          newSelected.add(m.userId);
        }
      });
    });
    setSelectedUserIds(newSelected);
  };

  const handleInvite = async () => {
    if (selectedUserIds.size === 0) return;
    try {
      setInviting(true);
      await certificationApi.invitePeers(requestId, Array.from(selectedUserIds));
      onInvited();
    } catch (err) {
      console.error('Error inviting peers:', err);
      setError('Failed to invite peers');
    } finally {
      setInviting(false);
    }
  };

  const renderUserRow = (user) => {
    const isDisabled = user.alreadyInvited || user.hasReviewed;
    const isSelected = selectedUserIds.has(user.userId);

    return (
      <label
        key={user.userId}
        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
          isDisabled
            ? 'bg-gray-50 opacity-60 cursor-not-allowed'
            : isSelected
              ? 'bg-primary-50 border border-primary-200'
              : 'hover:bg-gray-50 cursor-pointer'
        }`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => !isDisabled && toggleUser(user.userId)}
          disabled={isDisabled}
          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
        />
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
          {user.profileImageUrl ? (
            <img src={getSharedAssetUrl(user.profileImageUrl)} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{user.name}</div>
          {user.hasReviewed && (
            <div className="text-xs text-green-600">Already reviewed</div>
          )}
          {user.alreadyInvited && !user.hasReviewed && (
            <div className="text-xs text-gray-500">Already invited</div>
          )}
        </div>
        {user.hasReviewed && <Check className="w-4 h-4 text-green-500" />}
      </label>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Invite Peers to Review</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <EyeOff className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Select friends and club members to invite for your skill review
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* Select All Button */}
              <div className="mb-4">
                <button
                  onClick={selectAll}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Select All Available
                </button>
              </div>

              {/* Friends Section */}
              {peers?.friends?.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Friends ({peers.friends.length})
                    </h3>
                    <button
                      onClick={selectAllFriends}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Select all
                    </button>
                  </div>
                  <div className="space-y-2">
                    {peers.friends.map(renderUserRow)}
                  </div>
                </div>
              )}

              {/* Clubs Section */}
              {peers?.clubs?.map(club => (
                <div key={club.clubId} className="mb-6">
                  <button
                    onClick={() => setExpandedClub(expandedClub === club.clubId ? null : club.clubId)}
                    className="w-full flex items-center justify-between mb-3"
                  >
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {club.clubName} ({club.members.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllClubMembers(club.clubId);
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        Select all
                      </button>
                      {expandedClub === club.clubId ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>
                  {(expandedClub === club.clubId || peers.clubs.length === 1) && (
                    <div className="space-y-2">
                      {club.members.map(renderUserRow)}
                    </div>
                  )}
                </div>
              ))}

              {/* No peers message */}
              {(!peers?.friends?.length && !peers?.clubs?.length) && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No friends or club members to invite</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Add friends or join clubs to invite peers
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedUserIds.size} selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || selectedUserIds.size === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {inviting ? (
                  <>Inviting...</>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Invite Selected
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
