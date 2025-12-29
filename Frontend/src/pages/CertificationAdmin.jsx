import { useState, useEffect } from 'react';
import { certificationApi } from '../services/api';
import {
  Settings, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp,
  GraduationCap, Target, AlertCircle, CheckCircle, Layers, Scale
} from 'lucide-react';

export default function CertificationAdmin() {
  const [knowledgeLevels, setKnowledgeLevels] = useState([]);
  const [skillGroups, setSkillGroups] = useState([]);
  const [skillAreas, setSkillAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('groups');

  // Modal states
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingSkill, setEditingSkill] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [levels, groups, areas] = await Promise.all([
        certificationApi.getKnowledgeLevels(false),
        certificationApi.getSkillGroups(false),
        certificationApi.getSkillAreas(false)
      ]);
      setKnowledgeLevels(levels);
      setSkillGroups(groups);
      setSkillAreas(areas);
    } catch (err) {
      console.error('Error loading certification config:', err);
      setError('Failed to load certification configuration');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessMessage = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Calculate total weight
  const totalWeight = skillGroups.filter(g => g.isActive).reduce((sum, g) => sum + g.weight, 0);

  // Knowledge Level handlers
  const handleSaveKnowledge = async (data) => {
    try {
      if (editingKnowledge?.id) {
        await certificationApi.updateKnowledgeLevel(editingKnowledge.id, data);
        showSuccessMessage('Knowledge level updated successfully');
      } else {
        await certificationApi.createKnowledgeLevel(data);
        showSuccessMessage('Knowledge level created successfully');
      }
      setShowKnowledgeModal(false);
      setEditingKnowledge(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save knowledge level');
    }
  };

  const handleDeleteKnowledge = async (id) => {
    if (!confirm('Are you sure you want to delete this knowledge level?')) return;
    try {
      await certificationApi.deleteKnowledgeLevel(id);
      showSuccessMessage('Knowledge level deleted successfully');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete knowledge level');
    }
  };

  // Skill Group handlers
  const handleSaveGroup = async (data) => {
    try {
      if (editingGroup?.id) {
        await certificationApi.updateSkillGroup(editingGroup.id, data);
        showSuccessMessage('Skill group updated successfully');
      } else {
        await certificationApi.createSkillGroup(data);
        showSuccessMessage('Skill group created successfully');
      }
      setShowGroupModal(false);
      setEditingGroup(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save skill group');
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('Are you sure you want to delete this skill group?')) return;
    try {
      await certificationApi.deleteSkillGroup(id);
      showSuccessMessage('Skill group deleted successfully');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete skill group');
    }
  };

  // Skill Area handlers
  const handleSaveSkill = async (data) => {
    try {
      if (editingSkill?.id) {
        await certificationApi.updateSkillArea(editingSkill.id, data);
        showSuccessMessage('Skill area updated successfully');
      } else {
        await certificationApi.createSkillArea(data);
        showSuccessMessage('Skill area created successfully');
      }
      setShowSkillModal(false);
      setEditingSkill(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save skill area');
    }
  };

  const handleDeleteSkill = async (id) => {
    if (!confirm('Are you sure you want to delete this skill area?')) return;
    try {
      await certificationApi.deleteSkillArea(id);
      showSuccessMessage('Skill area deleted successfully');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete skill area');
    }
  };

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
            <Settings className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">Certification Configuration</h1>
              <p className="text-primary-100 mt-1">
                Manage skill groups, weights, and evaluation criteria
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notifications */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'groups'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Layers className="w-5 h-5" />
            Skill Groups
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'skills'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Target className="w-5 h-5" />
            Skill Areas
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'knowledge'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            Knowledge Levels
          </button>
        </div>

        {/* Skill Groups Tab */}
        {activeTab === 'groups' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Skill Groups</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Group skills and assign weights for weighted scoring (0-100)
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingGroup(null);
                  setShowGroupModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                Add Group
              </button>
            </div>

            {/* Weight Summary */}
            <div className={`p-4 border-b flex items-center gap-3 ${totalWeight === 100 ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <Scale className={`w-5 h-5 ${totalWeight === 100 ? 'text-green-600' : 'text-yellow-600'}`} />
              <span className={`font-medium ${totalWeight === 100 ? 'text-green-700' : 'text-yellow-700'}`}>
                Total Weight: {totalWeight}/100
              </span>
              {totalWeight !== 100 && (
                <span className="text-yellow-600 text-sm">
                  (Weights should total 100 for proper scoring)
                </span>
              )}
            </div>

            <div className="divide-y">
              {skillGroups.map(group => (
                <div
                  key={group.id}
                  className={`p-4 ${!group.isActive ? 'bg-gray-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary-700">{group.weight}%</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{group.name}</span>
                          {!group.isActive && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-500">{group.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {group.skillAreas?.length || 0} skill(s) in this group
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingGroup(group);
                          setShowGroupModal(true);
                        }}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Show skills in this group */}
                  {group.skillAreas?.length > 0 && (
                    <div className="mt-3 ml-16 flex flex-wrap gap-2">
                      {group.skillAreas.map(skill => (
                        <span key={skill.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {skillGroups.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No skill groups configured. Add groups to organize skills and set weights.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Skill Areas Tab */}
        {activeTab === 'skills' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Skill Areas</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Define the skills that reviewers will rate (1-10)
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSkill(null);
                  setShowSkillModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                Add Skill
              </button>
            </div>

            <div className="divide-y">
              {skillAreas.map(skill => (
                <div
                  key={skill.id}
                  className={`p-4 flex items-center justify-between ${!skill.isActive ? 'bg-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700">
                      {skill.sortOrder}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{skill.name}</span>
                        {skill.skillGroupName && (
                          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                            {skill.skillGroupName}
                          </span>
                        )}
                        {skill.category && !skill.skillGroupName && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {skill.category}
                          </span>
                        )}
                        {!skill.isActive && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-sm text-gray-500">{skill.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingSkill(skill);
                        setShowSkillModal(true);
                      }}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSkill(skill.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {skillAreas.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No skill areas configured. Add one to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Knowledge Levels Tab */}
        {activeTab === 'knowledge' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Knowledge Levels</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Define how well reviewers might know the player
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingKnowledge(null);
                  setShowKnowledgeModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                Add Level
              </button>
            </div>

            <div className="divide-y">
              {knowledgeLevels.map(level => (
                <div
                  key={level.id}
                  className={`p-4 flex items-center justify-between ${!level.isActive ? 'bg-gray-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
                      {level.sortOrder}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{level.name}</span>
                        {!level.isActive && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      {level.description && (
                        <p className="text-sm text-gray-500">{level.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingKnowledge(level);
                        setShowKnowledgeModal(true);
                      }}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteKnowledge(level.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {knowledgeLevels.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No knowledge levels configured. Add one to get started.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Knowledge Level Modal */}
      {showKnowledgeModal && (
        <KnowledgeLevelModal
          level={editingKnowledge}
          onClose={() => {
            setShowKnowledgeModal(false);
            setEditingKnowledge(null);
          }}
          onSave={handleSaveKnowledge}
        />
      )}

      {/* Skill Group Modal */}
      {showGroupModal && (
        <SkillGroupModal
          group={editingGroup}
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
          }}
          onSave={handleSaveGroup}
        />
      )}

      {/* Skill Area Modal */}
      {showSkillModal && (
        <SkillAreaModal
          skill={editingSkill}
          skillGroups={skillGroups}
          onClose={() => {
            setShowSkillModal(false);
            setEditingSkill(null);
          }}
          onSave={handleSaveSkill}
        />
      )}
    </div>
  );
}

function KnowledgeLevelModal({ level, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: level?.name || '',
    description: level?.description || '',
    sortOrder: level?.sortOrder || 0,
    isActive: level?.isActive ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {level ? 'Edit Knowledge Level' : 'Add Knowledge Level'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Played together regularly"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SkillGroupModal({ group, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    weight: group?.weight ?? 100,
    sortOrder: group?.sortOrder || 0,
    isActive: group?.isActive ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {group ? 'Edit Skill Group' : 'Add Skill Group'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Groundstrokes, Net Play"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight (0-100) *
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 0 })}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              This weight determines how much this group contributes to the final score. All group weights should total 100.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SkillAreaModal({ skill, skillGroups, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: skill?.name || '',
    description: skill?.description || '',
    category: skill?.category || '',
    skillGroupId: skill?.skillGroupId || '',
    sortOrder: skill?.sortOrder || 0,
    isActive: skill?.isActive ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const dataToSave = {
      ...formData,
      skillGroupId: formData.skillGroupId ? parseInt(formData.skillGroupId) : null
    };
    await onSave(dataToSave);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {skill ? 'Edit Skill Area' : 'Add Skill Area'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Forehand Drive"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill Group
            </label>
            <select
              value={formData.skillGroupId}
              onChange={(e) => setFormData({ ...formData, skillGroupId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">No Group (Ungrouped)</option>
              {skillGroups.filter(g => g.isActive).map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.weight}%)
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Assign to a group for weighted scoring
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category (Legacy)
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Groundstrokes, Net Play"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
