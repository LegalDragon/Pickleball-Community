import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useParams, useNavigate } from 'react-router-dom'
import { materialApi, assetApi, getAssetUrl } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Upload, Video, Image, FileText, Link, ArrowLeft, Play, Eye, EyeOff, Loader2 } from 'lucide-react'
import VideoUploadModal from '../components/ui/VideoUploadModal'
import TagSelector from '../components/TagSelector'

const EditMaterial = () => {
  const [videoUrl, setVideoUrl] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loadingMaterial, setLoadingMaterial] = useState(true)
  const [currentMaterial, setCurrentMaterial] = useState(null)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [togglingPublish, setTogglingPublish] = useState(false)

  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm({
    defaultValues: {
      title: '',
      description: '',
      contentType: 'Video',
      externalLink: '',
      price: 0
    }
  })

  const contentType = watch('contentType')

  useEffect(() => {
    loadMaterial()
  }, [id])

  const loadMaterial = async () => {
    if (!user) {
      alert('Please log in to edit materials')
      navigate('/login')
      return
    }

    try {
      setLoadingMaterial(true)
      const material = await materialApi.getMaterial(id)

      console.log('EditMaterial - API response:', material)

      if (!material || !material.id) {
        throw new Error('Material not found')
      }

      // Check authorization
      if (material.coachId && material.coachId !== user.id && user.role !== 'Admin') {
        alert('You are not authorized to edit this material')
        navigate('/coach/dashboard')
        return
      }

      setCurrentMaterial(material)

      // Set video URL from externalLink or videoUrl
      if (material.externalLink) {
        setVideoUrl(material.externalLink)
      } else if (material.videoUrl) {
        setVideoUrl(material.videoUrl)
      }

      // Set thumbnail preview from existing material
      if (material.thumbnailUrl) {
        setThumbnailPreview(getAssetUrl(material.thumbnailUrl))
      }

      // Reset form with material data
      reset({
        title: material.title || '',
        description: material.description || '',
        contentType: material.contentType || 'Video',
        externalLink: material.externalLink || '',
        price: material.price ?? 0
      })

    } catch (error) {
      console.error('Failed to load material:', error)
      alert('Failed to load material: ' + (error.message || 'Unknown error'))
      navigate('/coach/dashboard')
    } finally {
      setLoadingMaterial(false)
    }
  }

  const isValidUrl = (url) => {
    try {
      new URL(url)
      return true
    } catch (err) {
      return false
    }
  }

  // Check if URL is external (YouTube, etc.)
  const isExternalVideoUrl = (url) => {
    if (!url) return false
    const patterns = ['youtube.com', 'youtu.be', 'tiktok.com', 'vimeo.com']
    return patterns.some(p => url.includes(p))
  }

  // Get YouTube embed URL
  const getVideoEmbedUrl = (url) => {
    if (!url) return null
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v')
      return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    return null
  }

  // Handle video save from modal
  const handleVideoSave = ({ url }) => {
    setVideoUrl(url)
    setValue('externalLink', url)
  }

  // Handle thumbnail upload
  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setThumbnailFile(file)
      setThumbnailPreview(URL.createObjectURL(file))
    }
  }

  // Remove thumbnail
  const handleRemoveThumbnail = () => {
    setThumbnailFile(null)
    setThumbnailPreview(currentMaterial?.thumbnailUrl ? getAssetUrl(currentMaterial.thumbnailUrl) : null)
  }

  // Toggle publish status
  const handleTogglePublish = async () => {
    try {
      setTogglingPublish(true)
      const updated = await materialApi.togglePublish(id)
      setCurrentMaterial(updated)
    } catch (error) {
      console.error('Failed to toggle publish:', error)
      alert('Failed to update publish status: ' + (error.message || 'Unknown error'))
    } finally {
      setTogglingPublish(false)
    }
  }

  const onSubmit = async (data) => {
    if (!user) {
      alert('Please log in to edit materials')
      return
    }

    // Validate based on content type
    if (contentType === 'Video' && !videoUrl) {
      alert('Please add a video for Video content')
      return
    }

    if (contentType === 'Link') {
      if (!data.externalLink) {
        alert('Please provide an external link for Link content')
        return
      }
      if (!isValidUrl(data.externalLink)) {
        alert('Please enter a valid URL')
        return
      }
    }

    setUploading(true)
    try {
      // Upload new thumbnail if provided
      let thumbnailUrl = currentMaterial?.thumbnailUrl || ''
      if (thumbnailFile) {
        const thumbResponse = await assetApi.upload(thumbnailFile, 'thumbnails', 'CoachMaterial', id)
        if (thumbResponse.success && thumbResponse.data) {
          thumbnailUrl = thumbResponse.data.url
        }
      }

      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('description', data.description)
      formData.append('contentType', data.contentType)
      formData.append('price', data.price.toString())

      // Set external link based on content type
      if (contentType === 'Video' && videoUrl) {
        formData.append('externalLink', videoUrl)
      } else if (contentType === 'Link') {
        formData.append('externalLink', data.externalLink || '')
      } else {
        formData.append('externalLink', '')
      }

      // Include thumbnail URL
      if (thumbnailUrl) {
        formData.append('thumbnailUrl', thumbnailUrl)
      }

      await materialApi.updateMaterial(id, formData)
      alert('Material updated successfully!')
      navigate('/coach/dashboard')
    } catch (error) {
      alert('Failed to update material: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'Video': return <Video className="w-5 h-5" />
      case 'Image': return <Image className="w-5 h-5" />
      case 'Document': return <FileText className="w-5 h-5" />
      case 'Link': return <Link className="w-5 h-5" />
      default: return <Video className="w-5 h-5" />
    }
  }

  const renderVideoPreview = () => {
    if (!videoUrl) {
      return (
        <div
          onClick={() => setIsVideoModalOpen(true)}
          className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
        >
          <Video className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-primary-600 hover:text-primary-700 font-medium">
            Add Video
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Upload a video file or paste a YouTube/TikTok link
          </p>
        </div>
      )
    }

    return (
      <div className="relative rounded-lg overflow-hidden bg-gray-100">
        {isExternalVideoUrl(videoUrl) && getVideoEmbedUrl(videoUrl) ? (
          <iframe
            src={getVideoEmbedUrl(videoUrl)}
            className="w-full aspect-video"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : isExternalVideoUrl(videoUrl) ? (
          <div className="w-full aspect-video flex items-center justify-center bg-gray-200">
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
              <Play className="w-5 h-5 mr-2" />
              Open Video Link
            </a>
          </div>
        ) : (
          <video src={getAssetUrl(videoUrl)} controls className="w-full aspect-video" />
        )}
        <button
          type="button"
          onClick={() => setIsVideoModalOpen(true)}
          className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Change Video
        </button>
      </div>
    )
  }

  const renderFileUpload = () => {
    switch (contentType) {
      case 'Video':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Content *
            </label>
            {renderVideoPreview()}
          </div>
        )

      case 'Link':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              External Link *
            </label>
            <div className="flex items-center mb-2 text-sm text-gray-500">
              <Link className="w-5 h-5 mr-2" />
              <span>Paste YouTube, TikTok, or other video links</span>
            </div>
            <input
              {...register('externalLink', {
                required: contentType === 'Link' ? 'External link is required' : false,
                validate: (value) => {
                  if (contentType === 'Link' && value && !isValidUrl(value)) {
                    return 'Please enter a valid URL'
                  }
                  return true
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {errors.externalLink && (
              <p className="mt-1 text-sm text-red-600">{errors.externalLink.message}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (loadingMaterial) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading material...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header with back button and publish toggle */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/coach/dashboard')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>

            {/* Publish Toggle */}
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={togglingPublish}
              className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                currentMaterial?.isPublished
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {togglingPublish ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : currentMaterial?.isPublished ? (
                <Eye className="w-4 h-4 mr-2" />
              ) : (
                <EyeOff className="w-4 h-4 mr-2" />
              )}
              {currentMaterial?.isPublished ? 'Published' : 'Unpublished'}
            </button>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Training Material</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  {...register('title', { required: 'Title is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter material title"
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
                  placeholder="Describe your training material"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>
            </div>

            {/* Content Type and Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Type *
                </label>
                <select
                  {...register('contentType', { required: 'Content type is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  onChange={(e) => {
                    setValue('contentType', e.target.value)
                    // Reset video URL when changing type
                    if (e.target.value !== 'Video') {
                      setVideoUrl(null)
                    }
                  }}
                >
                  <option value="Video">Video</option>
                  <option value="Image">Image</option>
                  <option value="Document">Document</option>
                  <option value="Link">External Link</option>
                </select>
                {errors.contentType && (
                  <p className="mt-1 text-sm text-red-600">{errors.contentType.message}</p>
                )}
              </div>

              <div>
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
            </div>

            {/* Content Type Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                {getContentTypeIcon(contentType)}
                <span className="ml-2 text-lg font-medium text-gray-900 capitalize">
                  {contentType === 'Link' ? 'External Link' : contentType} Content
                </span>
              </div>

              {renderFileUpload()}
            </div>

            {/* Thumbnail Upload with Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Thumbnail Image {thumbnailPreview ? '' : '(Optional)'}
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
                      {thumbnailFile && (
                        <button
                          type="button"
                          onClick={handleRemoveThumbnail}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                          Revert
                        </button>
                      )}
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
                    <p className="mt-1 text-xs text-gray-500">
                      Recommended for better presentation
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Tags Section */}
            {currentMaterial?.id && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <TagSelector
                  objectType="Material"
                  objectId={currentMaterial.id}
                />
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/coach/dashboard')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Material'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Video Upload Modal */}
      <VideoUploadModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onSave={handleVideoSave}
        currentVideo={videoUrl}
        objectType="CoachMaterial"
        objectId={id}
        title="Edit Course Video"
        maxSizeMB={500}
      />
    </div>
  )
}

export default EditMaterial
