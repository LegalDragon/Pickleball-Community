import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { materialApi, assetApi, contentTypesApi, getAssetUrl } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Upload, Video, Image, FileText, Link, Play, Music, Loader2 } from 'lucide-react'
import VideoUploadModal from '../components/ui/VideoUploadModal'

// Icon mapping from backend icon names to Lucide components
const iconMap = {
  Video: Video,
  Image: Image,
  FileText: FileText,
  Link: Link,
  Music: Music
}

const MaterialCreator = () => {
  const [contentTypes, setContentTypes] = useState([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoType, setVideoType] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      title: '',
      description: '',
      contentType: 'Video',
      externalLink: '',
      price: 0
    }
  })

  const contentType = watch('contentType')

  // Fetch content types from API
  useEffect(() => {
    const fetchContentTypes = async () => {
      try {
        const response = await contentTypesApi.getAll()
        if (response.success && response.data) {
          setContentTypes(response.data)
          // Set default to first content type if available
          if (response.data.length > 0) {
            setValue('contentType', response.data[0].code)
          }
        }
      } catch (error) {
        console.error('Error fetching content types:', error)
        // Fallback to default types if API fails
        setContentTypes([
          { id: 1, name: 'Video', code: 'Video', icon: 'Video', prompt: 'Upload a video file or paste a YouTube/TikTok link', allowedExtensions: ['.mp4', '.mov', '.webm'], maxFileSizeMB: 500 },
          { id: 2, name: 'Image', code: 'Image', icon: 'Image', prompt: 'Upload an image file', allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'], maxFileSizeMB: 10 },
          { id: 3, name: 'Document', code: 'Document', icon: 'FileText', prompt: 'Upload a document file', allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx'], maxFileSizeMB: 50 },
          { id: 4, name: 'Audio', code: 'Audio', icon: 'Music', prompt: 'Upload an audio file', allowedExtensions: ['.mp3', '.wav', '.m4a', '.ogg'], maxFileSizeMB: 100 },
          { id: 5, name: 'External Link', code: 'Link', icon: 'Link', prompt: 'Paste an external URL', allowedExtensions: [], maxFileSizeMB: 0 }
        ])
      } finally {
        setLoadingTypes(false)
      }
    }
    fetchContentTypes()
  }, [setValue])

  // Get current content type details
  const getCurrentTypeDetails = () => {
    return contentTypes.find(t => t.code === contentType) || null
  }

  // Get icon component for a content type
  const getContentTypeIcon = (iconName) => {
    const IconComponent = iconMap[iconName] || Video
    return <IconComponent className="w-5 h-5" />
  }

  // Handle video save from modal
  const handleVideoSave = ({ url, type }) => {
    setVideoUrl(url)
    setVideoType(type)
  }

  // Handle file upload using asset API
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const typeDetails = getCurrentTypeDetails()
    if (!typeDetails) return

    // Validate file extension
    const fileExt = '.' + file.name.split('.').pop().toLowerCase()
    if (typeDetails.allowedExtensions.length > 0 && !typeDetails.allowedExtensions.includes(fileExt)) {
      alert(`Invalid file type. Allowed types: ${typeDetails.allowedExtensions.join(', ')}`)
      return
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (typeDetails.maxFileSizeMB > 0 && fileSizeMB > typeDetails.maxFileSizeMB) {
      alert(`File too large. Maximum size: ${typeDetails.maxFileSizeMB}MB`)
      return
    }

    setUploadedFile(file)

    // For images, create preview
    if (contentType === 'Image') {
      setThumbnailPreview(URL.createObjectURL(file))
    }
  }

  // Handle thumbnail upload
  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setThumbnailFile(file)
      setThumbnailPreview(URL.createObjectURL(file))
    }
  }

  const onSubmit = async (data) => {
    if (!user) {
      alert('Please log in to create materials')
      return
    }

    const typeDetails = getCurrentTypeDetails()
    if (!typeDetails) {
      alert('Invalid content type selected')
      return
    }

    // Validate based on content type
    if (contentType === 'Video' && !videoUrl) {
      alert('Please add a video for Video content')
      return
    }
    if ((contentType === 'Image' || contentType === 'Document' || contentType === 'Audio') && !uploadedFile) {
      alert(`Please upload a file for ${typeDetails.name} content`)
      return
    }
    if (contentType === 'Link') {
      if (!data.externalLink) {
        alert('Please provide an external link')
        return
      }
      if (!isValidUrl(data.externalLink)) {
        alert('Please enter a valid URL')
        return
      }
    }

    setUploading(true)
    try {
      let contentUrl = ''

      // Upload content file using asset API (for non-video, non-link types)
      if (uploadedFile && contentType !== 'Video' && contentType !== 'Link') {
        const folder = contentType.toLowerCase() + 's' // images, documents, audios
        const uploadResponse = await assetApi.upload(uploadedFile, folder, 'CoachMaterial', null)
        if (uploadResponse.success && uploadResponse.data) {
          contentUrl = uploadResponse.data.url
        } else {
          throw new Error('Failed to upload content file')
        }
      }

      // Upload thumbnail if provided
      let thumbnailUrl = ''
      if (thumbnailFile && contentType !== 'Image') {
        const thumbResponse = await assetApi.upload(thumbnailFile, 'thumbnails', 'CoachMaterial', null)
        if (thumbResponse.success && thumbResponse.data) {
          thumbnailUrl = thumbResponse.data.url
        }
      }

      // Prepare form data for material creation
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
      } else if (contentUrl) {
        formData.append('externalLink', contentUrl)
      } else {
        formData.append('externalLink', '')
      }

      // Set thumbnail URL if we uploaded one via asset API
      if (thumbnailUrl) {
        formData.append('thumbnailUrl', thumbnailUrl)
      } else if (contentType === 'Image' && contentUrl) {
        // For image content, use the content as thumbnail
        formData.append('thumbnailUrl', contentUrl)
      }

      await materialApi.createMaterial(formData)
      alert('Material created successfully!')
      navigate('/coach/dashboard')
    } catch (error) {
      console.error('Error creating material:', error)
      alert('Failed to create material: ' + (error.message || 'Unknown error'))
    } finally {
      setUploading(false)
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

  const renderFileUpload = () => {
    const typeDetails = getCurrentTypeDetails()
    if (!typeDetails) return null

    switch (contentType) {
      case 'Video':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Content *
            </label>
            {videoUrl ? (
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
            ) : (
              <div
                onClick={() => setIsVideoModalOpen(true)}
                className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
              >
                <Video className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-primary-600 hover:text-primary-700 font-medium">
                  Add Video
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {typeDetails.prompt}
                </p>
              </div>
            )}
          </div>
        )

      case 'Image':
      case 'Document':
      case 'Audio':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {typeDetails.name} File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
              {contentType === 'Image' && thumbnailPreview ? (
                <div className="relative">
                  <img src={thumbnailPreview} alt="Preview" className="max-h-48 mx-auto rounded" />
                  <button
                    type="button"
                    onClick={() => { setUploadedFile(null); setThumbnailPreview(null) }}
                    className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    accept={typeDetails.allowedExtensions.join(',')}
                    onChange={handleFileUpload}
                    className="hidden"
                    id={`${contentType.toLowerCase()}-upload`}
                  />
                  <label htmlFor={`${contentType.toLowerCase()}-upload`} className="cursor-pointer">
                    <span className="text-primary-600 hover:text-primary-700 font-medium">
                      Choose {typeDetails.name.toLowerCase()} file
                    </span>
                  </label>
                  {uploadedFile && (
                    <p className="mt-2 text-sm text-gray-600">{uploadedFile.name}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {typeDetails.prompt}
                  </p>
                  <p className="text-xs text-gray-400">
                    Max size: {typeDetails.maxFileSizeMB}MB | Formats: {typeDetails.allowedExtensions.join(', ')}
                  </p>
                </>
              )}
            </div>
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
              <span>{typeDetails.prompt}</span>
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

  if (loadingTypes) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
          <p className="text-gray-500">Loading content types...</p>
        </div>
      </div>
    )
  }

  const currentTypeDetails = getCurrentTypeDetails()

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Create Training Material</h1>

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
                    // Reset uploaded files when changing type
                    setUploadedFile(null)
                    setUploadedFileUrl(null)
                    setVideoUrl(null)
                    setThumbnailPreview(null)
                  }}
                >
                  {contentTypes.map((type) => (
                    <option key={type.id} value={type.code}>
                      {type.name}
                    </option>
                  ))}
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
                {currentTypeDetails && getContentTypeIcon(currentTypeDetails.icon)}
                <span className="ml-2 text-lg font-medium text-gray-900">
                  {currentTypeDetails?.name || contentType} Content
                </span>
              </div>

              {renderFileUpload()}
            </div>

            {/* Optional Thumbnail Upload (not for Image type) */}
            {contentType !== 'Image' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thumbnail Image (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                  {thumbnailPreview && contentType !== 'Image' ? (
                    <div className="relative inline-block">
                      <img src={thumbnailPreview} alt="Thumbnail preview" className="max-h-32 rounded" />
                      <button
                        type="button"
                        onClick={() => { setThumbnailFile(null); setThumbnailPreview(null) }}
                        className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                      >
                        <span className="sr-only">Remove</span>
                        &times;
                      </button>
                    </div>
                  ) : (
                    <>
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
                      {thumbnailFile && (
                        <p className="mt-2 text-sm text-gray-600">{thumbnailFile.name}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Recommended for better presentation
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={uploading}
                className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Publishing...
                  </>
                ) : (
                  'Publish Material'
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
        objectId={null}
        title="Add Course Video"
        maxSizeMB={getCurrentTypeDetails()?.maxFileSizeMB || 500}
      />
    </div>
  )
}

export default MaterialCreator
