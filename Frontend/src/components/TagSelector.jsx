import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Tag, Loader2 } from 'lucide-react'
import { tagApi } from '../services/api'

/**
 * TagSelector component for managing tags on any object
 *
 * @param {string} objectType - The type of object (e.g., "Material", "Course", "Coach")
 * @param {number} objectId - The ID of the object
 * @param {boolean} readOnly - If true, tags cannot be added or removed
 * @param {function} onTagsChange - Callback when tags change (receives updated tags array)
 */
const TagSelector = ({
  objectType,
  objectId,
  readOnly = false,
  onTagsChange
}) => {
  const [tags, setTags] = useState([])
  const [commonTags, setCommonTags] = useState([])
  const [newTagInput, setNewTagInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingTagId, setRemovingTagId] = useState(null)

  // Load tags and common tags
  const loadData = useCallback(async () => {
    if (!objectType || !objectId) return

    setLoading(true)
    try {
      const [objectTags, suggestedTags] = await Promise.all([
        tagApi.getTags(objectType, objectId),
        tagApi.getCommonTags(objectType, objectId)
      ])

      setTags(objectTags || [])
      setCommonTags(suggestedTags || [])
    } catch (error) {
      console.error('Failed to load tags:', error)
    } finally {
      setLoading(false)
    }
  }, [objectType, objectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Add a new tag
  const handleAddTag = async (tagName) => {
    if (!tagName.trim() || readOnly) return

    setAdding(true)
    try {
      const newTag = await tagApi.addTag(objectType, objectId, tagName.trim())

      // Update local state
      const updatedTags = [...tags, newTag]
      setTags(updatedTags)

      // Remove from common tags if it was there
      setCommonTags(prev => prev.filter(t => t.tagName.toLowerCase() !== tagName.toLowerCase()))

      // Clear input
      setNewTagInput('')

      // Notify parent
      onTagsChange?.(updatedTags)
    } catch (error) {
      console.error('Failed to add tag:', error)
    } finally {
      setAdding(false)
    }
  }

  // Remove a tag
  const handleRemoveTag = async (tagId, tagName) => {
    if (readOnly) return

    setRemovingTagId(tagId)
    try {
      await tagApi.removeTag(objectType, objectId, tagId)

      // Update local state
      const updatedTags = tags.filter(t => t.tagId !== tagId)
      setTags(updatedTags)

      // Refresh common tags (the removed tag might now be suggested)
      const suggestedTags = await tagApi.getCommonTags(objectType, objectId)
      setCommonTags(suggestedTags || [])

      // Notify parent
      onTagsChange?.(updatedTags)
    } catch (error) {
      console.error('Failed to remove tag:', error)
    } finally {
      setRemovingTagId(null)
    }
  }

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault()
    handleAddTag(newTagInput)
  }

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag(newTagInput)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading tags...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Object Tags - Current tags with X to remove */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Tag className="w-4 h-4 inline mr-1" />
          Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <span className="text-sm text-gray-400 italic">No tags yet</span>
          ) : (
            tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
              >
                {tag.tagName}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.tagId, tag.tagName)}
                    disabled={removingTagId === tag.tagId}
                    className="ml-1 hover:text-red-600 transition-colors disabled:opacity-50"
                    aria-label={`Remove tag ${tag.tagName}`}
                  >
                    {removingTagId === tag.tagId ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                )}
              </span>
            ))
          )}
        </div>
      </div>

      {!readOnly && (
        <>
          {/* Add New Tag Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add New Tag
            </label>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a new tag..."
                maxLength={50}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
              <button
                type="submit"
                disabled={!newTagInput.trim() || adding}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </button>
            </form>
          </div>

          {/* Common/Suggested Tags */}
          {commonTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggested Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {commonTags.map((tag) => (
                  <button
                    key={tag.tagId}
                    type="button"
                    onClick={() => handleAddTag(tag.tagName)}
                    disabled={adding}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-primary-100 hover:text-primary-800 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    {tag.tagName}
                    <span className="text-xs text-gray-400">({tag.usageCount})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Compact TagDisplay component for showing tags in lists/cards
 */
export const TagDisplay = ({ tags = [], maxDisplay = 3 }) => {
  if (!tags || tags.length === 0) return null

  const displayTags = tags.slice(0, maxDisplay)
  const remaining = tags.length - maxDisplay

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map((tag) => (
        <span
          key={tag.id || tag.tagId}
          className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
        >
          {tag.tagName || tag.name}
        </span>
      ))}
      {remaining > 0 && (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">
          +{remaining} more
        </span>
      )}
    </div>
  )
}

export default TagSelector
