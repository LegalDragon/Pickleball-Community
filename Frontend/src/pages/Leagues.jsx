import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2, Search, ChevronRight, ChevronDown, Users, MapPin,
  Globe, Mail, ExternalLink, Shield, Crown, Plus, Settings,
  Building, Network, Loader2, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { leaguesApi, getAssetUrl } from '../services/api';

// Scope icons and colors
const SCOPE_CONFIG = {
  National: { icon: Globe, color: 'text-purple-600', bg: 'bg-purple-100' },
  Regional: { icon: Network, color: 'text-blue-600', bg: 'bg-blue-100' },
  State: { icon: Building2, color: 'text-green-600', bg: 'bg-green-100' },
  District: { icon: Building, color: 'text-orange-600', bg: 'bg-orange-100' },
  Local: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-100' }
};

const getScopeConfig = (scope) => SCOPE_CONFIG[scope] || SCOPE_CONFIG.Local;

// Tree node component for hierarchy display
function LeagueTreeNode({ node, level = 0, expandedNodes, toggleNode, onSelect }) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const config = getScopeConfig(node.scope);
  const Icon = config.icon;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${level > 0 ? 'ml-' + (level * 4) : ''}`}
        style={{ marginLeft: level * 16 }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
            className="p-1 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        )}

        <div className={`p-1.5 rounded ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{node.name}</div>
          <div className="text-xs text-gray-500">{node.scope}</div>
        </div>

        {node.clubCount > 0 && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {node.clubCount} club{node.clubCount !== 1 ? 's' : ''}
          </span>
        )}

        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <LeagueTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// League card for grid view
function LeagueCard({ league, onClick }) {
  const config = getScopeConfig(league.scope);
  const Icon = config.icon;

  return (
    <div
      onClick={() => onClick(league.id)}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {league.avatarUrl ? (
          <img
            src={getAssetUrl(league.avatarUrl)}
            alt={league.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className={`w-12 h-12 rounded-lg ${config.bg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{league.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
              {league.scope}
            </span>
            {league.state && (
              <span className="text-xs text-gray-500">{league.state}</span>
            )}
          </div>
        </div>
      </div>

      {league.description && (
        <p className="text-sm text-gray-600 mt-3 line-clamp-2">{league.description}</p>
      )}

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        {league.childLeagueCount > 0 && (
          <span className="flex items-center gap-1">
            <Network className="w-3.5 h-3.5" />
            {league.childLeagueCount} sub-league{league.childLeagueCount !== 1 ? 's' : ''}
          </span>
        )}
        {league.clubCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {league.clubCount} club{league.clubCount !== 1 ? 's' : ''}
          </span>
        )}
        {league.managerCount > 0 && (
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            {league.managerCount} manager{league.managerCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Leagues() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // View mode: 'tree' or 'grid'
  const [viewMode, setViewMode] = useState('tree');

  // Tree data
  const [tree, setTree] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Grid/search data
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 12;

  // Load tree on mount
  useEffect(() => {
    loadTree();
  }, []);

  // Load grid data when switching to grid view or filters change
  useEffect(() => {
    if (viewMode === 'grid') {
      loadLeagues();
    }
  }, [viewMode, page, scopeFilter]);

  const loadTree = async () => {
    try {
      setLoading(true);
      const response = await leaguesApi.getTree();
      if (response.success) {
        setTree(response.data || []);
        // Auto-expand first level
        const firstLevelIds = new Set((response.data || []).map(n => n.id));
        setExpandedNodes(firstLevelIds);
      }
    } catch (err) {
      console.error('Error loading league tree:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeagues = async () => {
    try {
      setLoading(true);
      const response = await leaguesApi.search({
        query: searchQuery,
        scope: scopeFilter,
        page,
        pageSize
      });
      if (response.success) {
        setLeagues(response.data?.items || []);
        setTotalPages(Math.ceil((response.data?.totalCount || 0) / pageSize));
      }
    } catch (err) {
      console.error('Error loading leagues:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    if (viewMode === 'grid') {
      loadLeagues();
    }
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelectLeague = (leagueId) => {
    navigate(`/leagues/${leagueId}`);
  };

  const isAdmin = user?.role === 'Admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-7 h-7 text-blue-600" />
                Leagues
              </h1>
              <p className="text-gray-600 mt-1">
                Browse pickleball leagues and organizations
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-3 py-2 text-sm font-medium ${
                    viewMode === 'tree'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Network className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm font-medium ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and filters for grid view */}
        {viewMode === 'grid' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leagues..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <select
                value={scopeFilter}
                onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Scopes</option>
                <option value="National">National</option>
                <option value="Regional">Regional</option>
                <option value="State">State</option>
                <option value="District">District</option>
                <option value="Local">Local</option>
              </select>

              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Search
              </button>
            </form>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Tree view */}
        {!loading && viewMode === 'tree' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">League Hierarchy</h2>
              <p className="text-sm text-gray-500 mt-1">
                Click on a league to view details, or expand to see sub-leagues
              </p>
            </div>

            <div className="p-4">
              {tree.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No leagues found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {tree.map(node => (
                    <LeagueTreeNode
                      key={node.id}
                      node={node}
                      expandedNodes={expandedNodes}
                      toggleNode={toggleNode}
                      onSelect={handleSelectLeague}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid view */}
        {!loading && viewMode === 'grid' && (
          <>
            {leagues.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No leagues found matching your criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leagues.map(league => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    onClick={handleSelectLeague}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
