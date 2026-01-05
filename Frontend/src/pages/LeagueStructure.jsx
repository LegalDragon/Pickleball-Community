import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, ChevronRight, ChevronDown, Users, MapPin, Globe, Network,
  Building, Loader2, ToggleLeft, ToggleRight, Shield, UserCircle,
  BarChart3, ArrowLeft
} from 'lucide-react';
import { leaguesApi, getSharedAssetUrl } from '../services/api';

// Scope config for styling
const SCOPE_CONFIG = {
  National: { icon: Globe, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
  Regional: { icon: Network, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  State: { icon: Building2, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  District: { icon: Building, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  Local: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' }
};

// Helper to calculate total clubs including all sub-leagues
const calculateTotalClubs = (node) => {
  let total = node.clubCount || 0;
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      total += calculateTotalClubs(child);
    });
  }
  return total;
};

// Tree node component
function LeagueTreeNode({ node, level = 0, showManagers, showStats, expandedNodes, toggleNode, leagueDetails, loadingDetails }) {
  const config = SCOPE_CONFIG[node.scope] || SCOPE_CONFIG.Local;
  const Icon = config.icon;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const details = leagueDetails[node.id];
  const isLoadingDetails = loadingDetails.has(node.id);

  // Calculate total clubs including sub-leagues
  const totalClubs = calculateTotalClubs(node);
  const directClubs = node.clubCount || 0;

  // Calculate indentation based on level
  const indentPx = level * 24;

  return (
    <div className="select-none">
      {/* Node row */}
      <div
        className={`flex items-start gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${
          level === 0 ? 'bg-gray-50' : ''
        }`}
        style={{ paddingLeft: `${12 + indentPx}px` }}
        onClick={() => toggleNode(node.id)}
      >
        {/* Expand/collapse icon */}
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>

        {/* League icon */}
        <div className={`p-1.5 rounded-lg ${config.bg} flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        {/* League info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{node.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
              {node.scope}
            </span>
          </div>

          {/* Stats row */}
          {showStats && (
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {totalClubs} clubs
                {hasChildren && directClubs !== totalClubs && (
                  <span className="text-gray-400">({directClubs} direct)</span>
                )}
              </span>
              {hasChildren && (
                <span className="flex items-center gap-1">
                  <Network className="w-3.5 h-3.5" />
                  {node.children.length} sub-leagues
                </span>
              )}
            </div>
          )}

          {/* Managers section */}
          {showManagers && isExpanded && (
            <div className="mt-2">
              {isLoadingDetails ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading managers...
                </div>
              ) : details?.managers && details.managers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {details.managers.map(manager => (
                    <div
                      key={manager.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-full text-xs"
                    >
                      {manager.userProfileImageUrl ? (
                        <img
                          src={getSharedAssetUrl(manager.userProfileImageUrl)}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover"
                        />
                      ) : (
                        <UserCircle className="w-4 h-4 text-indigo-400" />
                      )}
                      <span className="text-gray-700">{manager.userName}</span>
                      <span className="text-indigo-600 font-medium">{manager.role}</span>
                    </div>
                  ))}
                </div>
              ) : details ? (
                <span className="text-xs text-gray-400">No managers assigned</span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="border-l border-gray-200 ml-6">
          {node.children.map(child => (
            <LeagueTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              showManagers={showManagers}
              showStats={showStats}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              leagueDetails={leagueDetails}
              loadingDetails={loadingDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeagueStructure() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Toggle states
  const [showManagers, setShowManagers] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // Expanded nodes tracking
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Cached league details for manager info
  const [leagueDetails, setLeagueDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(new Set());

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await leaguesApi.getTree();
      if (response.success) {
        setTree(response.data || []);
        // Auto-expand root nodes
        const rootIds = new Set((response.data || []).map(n => n.id));
        setExpandedNodes(rootIds);
      } else {
        setError(response.message || 'Failed to load league structure');
      }
    } catch (err) {
      console.error('Error loading tree:', err);
      setError('Failed to load league structure');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = async (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
        // Load details if managers are shown and we don't have them yet
        if (showManagers && !leagueDetails[nodeId]) {
          loadLeagueDetails(nodeId);
        }
      }
      return next;
    });
  };

  const loadLeagueDetails = async (leagueId) => {
    if (loadingDetails.has(leagueId) || leagueDetails[leagueId]) return;

    setLoadingDetails(prev => new Set(prev).add(leagueId));
    try {
      const response = await leaguesApi.getLeague(leagueId);
      if (response.success) {
        setLeagueDetails(prev => ({
          ...prev,
          [leagueId]: response.data
        }));
      }
    } catch (err) {
      console.error('Error loading league details:', err);
    } finally {
      setLoadingDetails(prev => {
        const next = new Set(prev);
        next.delete(leagueId);
        return next;
      });
    }
  };

  // When managers toggle is turned on, load details for all expanded nodes
  useEffect(() => {
    if (showManagers) {
      expandedNodes.forEach(nodeId => {
        if (!leagueDetails[nodeId]) {
          loadLeagueDetails(nodeId);
        }
      });
    }
  }, [showManagers]);

  // Calculate total stats
  const calculateTotals = (nodes) => {
    let clubs = 0;
    let leagues = nodes.length;
    nodes.forEach(node => {
      clubs += node.clubCount || 0;
      if (node.children) {
        const childTotals = calculateTotals(node.children);
        clubs += childTotals.clubs;
        leagues += childTotals.leagues;
      }
    });
    return { clubs, leagues };
  };

  const totals = calculateTotals(tree);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Network className="w-7 h-7 text-indigo-600" />
                League Structure
              </h1>
              <p className="text-gray-600 mt-1">
                Explore the organizational hierarchy of pickleball leagues
              </p>
            </div>
          </div>

          {/* Toggle controls */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Show Managers Toggle */}
            <button
              onClick={() => setShowManagers(!showManagers)}
              className="flex items-center gap-2 text-sm"
            >
              {showManagers ? (
                <ToggleRight className="w-8 h-5 text-indigo-600" />
              ) : (
                <ToggleLeft className="w-8 h-5 text-gray-400" />
              )}
              <Shield className="w-4 h-4 text-gray-600" />
              <span className={showManagers ? 'text-gray-900 font-medium' : 'text-gray-600'}>
                Show Managers
              </span>
            </button>

            {/* Show Stats Toggle */}
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2 text-sm"
            >
              {showStats ? (
                <ToggleRight className="w-8 h-5 text-indigo-600" />
              ) : (
                <ToggleLeft className="w-8 h-5 text-gray-400" />
              )}
              <BarChart3 className="w-4 h-4 text-gray-600" />
              <span className={showStats ? 'text-gray-900 font-medium' : 'text-gray-600'}>
                Show Stats
              </span>
            </button>

            {/* Summary stats */}
            {!loading && tree.length > 0 && (
              <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Network className="w-4 h-4" />
                  {totals.leagues} leagues
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {totals.clubs} clubs
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-gray-500">Loading league structure...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={loadTree}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : tree.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Network className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Leagues Yet</h3>
            <p className="text-gray-500">
              The league structure will appear here once leagues are created.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Legend */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-gray-500 font-medium">Levels:</span>
                {Object.entries(SCOPE_CONFIG).map(([scope, cfg]) => {
                  const ScopeIcon = cfg.icon;
                  return (
                    <span key={scope} className="flex items-center gap-1">
                      <ScopeIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      {scope}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Tree */}
            <div className="p-2">
              {tree.map(node => (
                <LeagueTreeNode
                  key={node.id}
                  node={node}
                  level={0}
                  showManagers={showManagers}
                  showStats={showStats}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                  leagueDetails={leagueDetails}
                  loadingDetails={loadingDetails}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
