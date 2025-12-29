import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useParams, useNavigate } from 'react-router-dom'
import { courseApi, materialApi, assetApi, ratingApi, getAssetUrl } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Upload, ArrowLeft, BookOpen, Loader2, Eye, EyeOff, Plus,
  GripVertical, Trash2, Video, Image, FileText, Link, X, Check, Star
} from 'lucide-react'
import StarRating, { RatingDisplay } from '../components/StarRating'
import TagSelector from '../components/TagSelector'

const CourseEditor = () => {
  const [course, setCourse] = useState(null)
  const [materials, setMaterials] = useState([])
  const [availableMaterials, setAvailableMaterials] = useState([])
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingPublish, setTogglingPublish] = useState(false)
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [ratingSummary, setRatingSummary] = useState(null)
  const [reviews, setReviews] = useState([])

  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: {
      title: '',
      description: '',
      price: 0
    }
  })

  useEffect(() => {
    loadCourse()
    loadAvailableMaterials()
    loadRatings()
  }, [id])

  const loadRatings = async () => {
    try {
      const summary = await ratingApi.getSummary('Course', id)
      setRatingSummary(summary)

      const allRatings = await ratingApi.getRatings('Course', id)
      setReviews(allRatings)
    } catch (error) {
      console.error('Failed to load ratings:', error)
    }
  }

  const loadCourse = async () => {
    try {
      setLoading(true)
      const data = await courseApi.getCourse(id)
      setCourse(data)
      setMaterials(data.materials || [])

      if (data.thumbnailUrl) {
        setThumbnailPreview(getAssetUrl(data.thumbnailUrl))
      }

      reset({
        title: data.title || '',
        description: data.description || '',
        price: data.price ?? 0
      })
    } catch (error) {
      console.error('Failed to load course:', error)
      alert('Failed to load course')
      navigate('/coach/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableMaterials = async () => {
    if (!user) return
    try {
      const data = await materialApi.getCoachMaterials(user.id)
      setAvailableMaterials(data || [])
    } catch (error) {
      console.error('Failed to load materials:', error)
    }
  }

  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setThumbnailFile(file)
      setThumbnailPreview(URL.createObjectURL(file))
    }
  }

  const handleTogglePublish = async () => {
    try {
      setTogglingPublish(true)
      const updated = await courseApi.togglePublish(id)
      setCourse(updated)
    } catch (error) {
      console.error('Failed to toggle publish:', error)
      alert('Failed to update publish status')
    } finally {
      setTogglingPublish(false)
    }
  }

  const handleAddMaterial = async (materialId) => {
    try {
      const nextOrder = materials.length
      const result = await courseApi.addMaterial(id, {
        materialId,
        sortOrder: nextOrder,
        isPreview: false
      })
      setMaterials([...materials, result])
      setShowAddMaterial(false)
    } catch (error) {
      console.error('Failed to add material:', error)
      alert(error.message || 'Failed to add material')
    }
  }

  const handleRemoveMaterial = async (courseMaterialId) => {
    if (!confirm('Remove this material from the course?')) return
    try {
      await courseApi.removeMaterial(id, courseMaterialId)
      setMaterials(materials.filter(m => m.id !== courseMaterialId))
    } catch (error) {
      console.error('Failed to remove material:', error)
      alert('Failed to remove material')
    }
  }

  const handleTogglePreview = async (courseMaterialId, currentIsPreview) => {
    try {
      const material = materials.find(m => m.id === courseMaterialId)
      const updated = await courseApi.updateMaterial(id, courseMaterialId, {
        sortOrder: material.sortOrder,
        isPreview: !currentIsPreview
      })
      setMaterials(materials.map(m => m.id === courseMaterialId ? updated : m))
    } catch (error) {
      console.error('Failed to toggle preview:', error)
      alert('Failed to update preview status')
    }
  }

  const handleReorder = async (fromIndex, toIndex) => {
    const newMaterials = [...materials]
    const [moved] = newMaterials.splice(fromIndex, 1)
    newMaterials.splice(toIndex, 0, moved)

    // Update sort orders
    const updatedMaterials = newMaterials.map((m, idx) => ({
      ...m,
      sortOrder: idx
    }))
    setMaterials(updatedMaterials)

    try {
      await courseApi.reorderMaterials(id, updatedMaterials.map(m => ({
        courseMaterialId: m.id,
        sortOrder: m.sortOrder,
        isPreview: m.isPreview
      })))
    } catch (error) {
      console.error('Failed to reorder:', error)
      // Reload to get correct order
      loadCourse()
    }
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      let thumbnailUrl = course?.thumbnailUrl || ''
      if (thumbnailFile) {
        const thumbResponse = await assetApi.upload(thumbnailFile, 'thumbnails', 'Course', id)
        if (thumbResponse.success && thumbResponse.data) {
          thumbnailUrl = thumbResponse.data.url
        }
      }

      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('description', data.description)
      formData.append('price', data.price.toString())
      if (thumbnailUrl) {
        formData.append('thumbnailUrl', thumbnailUrl)
      }

      const updated = await courseApi.updateCourse(id, formData)
      setCourse(updated)
      alert('Course updated successfully!')
    } catch (error) {
      console.error('Failed to update course:', error)
      alert('Failed to update course')
    } finally {
      setSaving(false)
    }
  }

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'Video': return <Video className="w-4 h-4" />
      case 'Image': return <Image className="w-4 h-4" />
      case 'Document': return <FileText className="w-4 h-4" />
      case 'Link': return <Link className="w-4 h-4" />
      default: return <Video className="w-4 h-4" />
    }
  }

  // Get materials not already in the course
  const getAddableMaterials = () => {
    const courseMatIds = materials.map(m => m.materialId)
    return availableMaterials.filter(m => !courseMatIds.includes(m.id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {/* Header with back button and publish toggle */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/coach/dashboard')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>

            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={togglingPublish}
              className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                course?.isPublished
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {togglingPublish ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : course?.isPublished ? (
                <Eye className="w-4 h-4 mr-2" />
              ) : (
                <EyeOff className="w-4 h-4 mr-2" />
              )}
              {course?.isPublished ? 'Published' : 'Unpublished'}
            </button>
          </div>

          <div className="flex items-center mb-6">
            <BookOpen className="w-8 h-8 text-primary-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Edit Course</h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Title *
                </label>
                <input
                  {...register('title', { required: 'Title is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter course title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  {...register('description', { required: 'Description is required' })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Describe your course"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('price', {
                  required: 'Price is required',
                  min: { value: 0, message: 'Price must be positive' }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
              />
              {errors.price && (
                <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
              )}
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course Thumbnail
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                {thumbnailPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="max-h-48 rounded-lg"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <label
                        htmlFor="thumbnail-upload"
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded cursor-pointer hover:bg-blue-700"
                      >
                        Change
                      </label>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                      id="thumbnail-upload"
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                      id="thumbnail-upload"
                    />
                    <label htmlFor="thumbnail-upload" className="cursor-pointer">
                      <span className="text-primary-600 hover:text-primary-700 font-medium">
                        Choose thumbnail
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-500 text-white px-6 py-2 rounded-md hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Course Materials Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Course Materials</h2>
            <button
              onClick={() => setShowAddMaterial(true)}
              className="flex items-center px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Material
            </button>
          </div>

          {/* Materials List */}
          {materials.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No materials added yet</p>
              <button
                onClick={() => setShowAddMaterial(true)}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Add your first material
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.sort((a, b) => a.sortOrder - b.sortOrder).map((cm, index) => (
                <div
                  key={cm.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  {/* Drag Handle */}
                  <div className="text-gray-400 cursor-move">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Order Number */}
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-sm font-medium">
                    {index + 1}
                  </div>

                  {/* Content Type Icon */}
                  <div className="text-gray-500">
                    {getContentTypeIcon(cm.material?.contentType)}
                  </div>

                  {/* Material Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {cm.material?.title || 'Untitled'}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {cm.material?.contentType}
                    </p>
                  </div>

                  {/* Preview Toggle */}
                  <button
                    onClick={() => handleTogglePreview(cm.id, cm.isPreview)}
                    className={`flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      cm.isPreview
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {cm.isPreview ? (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 mr-1" />
                        Locked
                      </>
                    )}
                  </button>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveMaterial(cm.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              <Eye className="w-4 h-4 inline mr-1" />
              <strong>Preview</strong> materials can be viewed by anyone without purchasing.
              <EyeOff className="w-4 h-4 inline ml-3 mr-1" />
              <strong>Locked</strong> materials require course purchase to view.
            </p>
          </div>
        </div>

        {/* Tags Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <TagSelector
            objectType="Course"
            objectId={parseInt(id)}
          />
        </div>

        {/* Ratings Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center mb-6">
            <Star className="w-6 h-6 text-yellow-400 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Course Ratings & Reviews</h2>
          </div>

          {ratingSummary && ratingSummary.totalRatings > 0 ? (
            <>
              <RatingDisplay summary={ratingSummary} />

              {/* Reviews List */}
              {reviews.filter(r => r.review).length > 0 && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Student Reviews</h3>
                  <div className="space-y-4">
                    {reviews.filter(r => r.review).map((review) => (
                      <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{review.userName}</p>
                            <StarRating rating={review.stars} size={14} />
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-2 text-gray-700">{review.review}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No ratings yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Ratings will appear here once students review your course
              </p>
            </div>
          )}
        </div>

        {/* Add Material Modal */}
        {showAddMaterial && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold">Add Material to Course</h3>
                <button
                  onClick={() => setShowAddMaterial(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-96">
                {getAddableMaterials().length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      {availableMaterials.length === 0
                        ? 'You have no materials yet.'
                        : 'All your materials are already in this course.'}
                    </p>
                    <button
                      onClick={() => {
                        setShowAddMaterial(false)
                        navigate('/coach/materials/create')
                      }}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Create a new material
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getAddableMaterials().map(material => (
                      <div
                        key={material.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleAddMaterial(material.id)}
                      >
                        <div className="text-gray-500">
                          {getContentTypeIcon(material.contentType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {material.title}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {material.contentType} • ${material.price?.toFixed(2)}
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-primary-600" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowAddMaterial(false)}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CourseEditor
