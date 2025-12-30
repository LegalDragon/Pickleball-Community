import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, Link as LinkIcon, Video, Play, Trash2, ExternalLink } from 'lucide-react'
import { sharedAssetApi, getAssetUrl, SHARED_AUTH_URL } from '../../services/api'

/**
 * Reusable Video Upload Modal Component
 * Supports both URL input (YouTube, TikTok, etc.) and local file upload
 *
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onSave - Callback when video is saved, receives { url, type: 'url' | 'file' }
 * @param {string} currentVideo - Current video URL (if editing)
 * @param {string} objectType - Object type for asset tracking (e.g., 'UserIntro', 'CoachMaterial')
 * @param {number} objectId - Object ID for asset tracking
 * @param {string} title - Modal title (default: 'Add Video')
 * @param {number} maxSizeMB - Max file size in MB (default: 100)
 */
const VideoUploadModal = ({
  isOpen,
  onClose,
  onSave,
  currentVideo = null,
  objectType = 'video',
  objectId = null,
  title = 'Add Video',
  maxSizeMB = 100
}) => {
  const [uploadType, setUploadType] = useState('url') // 'url' or 'file'
  const [videoUrl, setVideoUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError('')
      setSelectedFile(null)
      setFilePreview(null)

      // If there's a current video, determine its type
      if (currentVideo) {
        if (isExternalUrl(currentVideo)) {
          setUploadType('url')
          setVideoUrl(currentVideo)
        } else {
          setUploadType('file')
          setFilePreview(getAssetUrl(currentVideo))
        }
      } else {
        setVideoUrl('')
        setUploadType('url')
      }
    }
  }, [isOpen, currentVideo])

  // Check if URL is from external platform
  const isExternalUrl = (url) => {
    if (!url) return false
    const externalPatterns = [
      'youtube.com', 'youtu.be',
      'tiktok.com',
      'vimeo.com',
      'facebook.com', 'fb.watch',
      'instagram.com',
      'twitter.com', 'x.com'
    ]
    return externalPatterns.some(pattern => url.includes(pattern))
  }

  // Extract video embed URL for preview
  const getEmbedUrl = (url) => {
    if (!url) return null

    // YouTube
    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v')
      return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }

    // For other platforms, just return the URL (they may not embed)
    return null
  }

  // Validate URL
  const validateUrl = (url) => {
    if (!url.trim()) {
      return 'Please enter a video URL'
    }
    try {
      new URL(url)
      return null
    } catch {
      return 'Please enter a valid URL'
    }
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file')
      return
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Video size must be less than ${maxSizeMB}MB`)
      return
    }

    setError('')
    setSelectedFile(file)
    setFilePreview(URL.createObjectURL(file))
  }

  // Handle save
  const handleSave = async () => {
    setError('')

    if (uploadType === 'url') {
      // Validate and save URL
      const urlError = validateUrl(videoUrl)
      if (urlError) {
        setError(urlError)
        return
      }

      onSave({ url: videoUrl.trim(), type: 'url' })
      onClose()
    } else {
      // Upload file
      if (!selectedFile) {
        setError('Please select a video file')
        return
      }

      setUploading(true)
      try {
        // Upload to Funtime-Shared asset service
        const response = await sharedAssetApi.upload(selectedFile, 'video', objectType || 'video')
        // Save only relative path to DB - use response.data.url directly
        // Response: { data: { success: true, url: "/asset/11", assetId: 11, ... } }
        if (response?.data?.url) {
          onSave({ url: response.data.url, type: 'file', fileId: response.data.assetId })
          onClose()
        } else if (response?.url) {
          onSave({ url: response.url, type: 'file', fileId: response.assetId })
          onClose()
        } else {
          setError(response.message || 'Upload failed')
        }
      } catch (err) {
        console.error('Video upload error:', err)
        setError(err.message || 'Failed to upload video')
      } finally {
        setUploading(false)
      }
    }
  }

  // Handle remove
  const handleRemove = () => {
    setVideoUrl('')
    setSelectedFile(null)
    setFilePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  const embedUrl = uploadType === 'url' ? getEmbedUrl(videoUrl) : null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Video className="w-5 h-5 mr-2 text-purple-500" />
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {/* Upload Type Toggle */}
            <div className="flex rounded-lg border border-gray-200 p-1 mb-4">
              <button
                type="button"
                onClick={() => setUploadType('url')}
                className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${
                  uploadType === 'url'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Paste URL
              </button>
              <button
                type="button"
                onClick={() => setUploadType('file')}
                className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${
                  uploadType === 'file'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </button>
            </div>

            {/* URL Input */}
            {uploadType === 'url' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Video URL
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supports YouTube, TikTok, Vimeo, and other video platforms
                  </p>
                </div>

                {/* URL Preview */}
                {videoUrl && embedUrl && (
                  <div className="rounded-lg overflow-hidden bg-black aspect-video">
                    <iframe
                      src={embedUrl}
                      title="Video preview"
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                )}

                {videoUrl && !embedUrl && isExternalUrl(videoUrl) && (
                  <div className="rounded-lg bg-gray-100 p-4 text-center">
                    <ExternalLink className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Preview not available. Video will open in a new tab.
                    </p>
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm mt-1 inline-block"
                    >
                      Test link
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* File Upload */}
            {uploadType === 'file' && (
              <div className="space-y-4">
                {filePreview ? (
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      src={filePreview}
                      controls
                      className="w-full aspect-video object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
                  >
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-1">
                      Click to select a video file
                    </p>
                    <p className="text-xs text-gray-500">
                      MP4, WebM, MOV (max {maxSizeMB}MB)
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="video/*"
                  className="hidden"
                />

                {selectedFile && (
                  <p className="text-sm text-gray-600">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                  </p>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={uploading || (uploadType === 'url' && !videoUrl) || (uploadType === 'file' && !selectedFile)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Save Video
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoUploadModal
