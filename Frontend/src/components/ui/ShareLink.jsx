import { useState, useRef, useEffect } from 'react';
import { Copy, Check, QrCode, Download, X } from 'lucide-react';
import QRCode from 'qrcode';

/**
 * ShareLink component with copy link and QR code functionality
 *
 * @param {string} url - The URL to share
 * @param {string} title - Optional title for the QR code modal
 * @param {string} className - Optional className for the container
 * @param {boolean} showInput - Whether to show the URL input field (default: true)
 * @param {boolean} compact - Use compact button style (default: false)
 * @param {string} buttonColor - Button color class (default: 'bg-blue-600 hover:bg-blue-700')
 */
export default function ShareLink({
  url,
  title = 'Share Link',
  className = '',
  showInput = true,
  compact = false,
  buttonColor = 'bg-blue-600 hover:bg-blue-700'
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const canvasRef = useRef(null);

  // Generate QR code when modal opens
  useEffect(() => {
    if (showQrModal && url) {
      QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }).then(dataUrl => {
        setQrDataUrl(dataUrl);
      }).catch(err => {
        console.error('Error generating QR code:', err);
      });
    }
  }, [showQrModal, url]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const copyQrCode = async () => {
    try {
      // Convert data URL to blob
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();

      // Try to copy as image (modern browsers)
      if (navigator.clipboard && navigator.clipboard.write) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 2000);
      } else {
        // Fallback: download instead
        downloadQrCode();
      }
    } catch (err) {
      console.error('Error copying QR code:', err);
      // Fallback: download instead
      downloadQrCode();
    }
  };

  const downloadQrCode = () => {
    const link = document.createElement('a');
    link.download = `qr-code-${Date.now()}.png`;
    link.href = qrDataUrl;
    link.click();
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
  };

  if (compact) {
    return (
      <>
        <div className={`flex items-center gap-1 ${className}`}>
          <button
            onClick={copyLink}
            className="p-2 text-gray-400 hover:text-gray-600 flex items-center gap-1"
            title="Copy link"
          >
            {linkCopied ? (
              <>
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-xs text-green-600">Copied!</span>
              </>
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setShowQrModal(true)}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Show QR code"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Modal */}
        {showQrModal && (
          <QrModal
            qrDataUrl={qrDataUrl}
            title={title}
            url={url}
            qrCopied={qrCopied}
            onCopy={copyQrCode}
            onDownload={downloadQrCode}
            onClose={() => setShowQrModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={`${className}`}>
        {showInput && (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 border border-gray-300 rounded-lg p-2 bg-gray-50 text-sm"
            />
            <button
              onClick={copyLink}
              className={`px-4 py-2 ${buttonColor} text-white rounded-lg flex items-center gap-2`}
            >
              {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
              title="Show QR code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        )}
        {!showInput && (
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className={`px-4 py-2 ${buttonColor} text-white rounded-lg flex items-center gap-2`}
            >
              {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {linkCopied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
              title="Show QR code"
            >
              <QrCode className="w-4 h-4" />
              QR
            </button>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <QrModal
          qrDataUrl={qrDataUrl}
          title={title}
          url={url}
          qrCopied={qrCopied}
          onCopy={copyQrCode}
          onDownload={downloadQrCode}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </>
  );
}

// QR Code Modal Component
function QrModal({ qrDataUrl, title, url, qrCopied, onCopy, onDownload, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="w-64 h-64 border rounded-lg"
            />
          ) : (
            <div className="w-64 h-64 border rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3 text-center break-all px-4">
            {url}
          </p>

          <div className="flex gap-2 mt-4 w-full">
            <button
              onClick={onCopy}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
            >
              {qrCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {qrCopied ? 'Copied!' : 'Copy QR'}
            </button>
            <button
              onClick={onDownload}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Standalone QR Code Modal that handles its own state
 * Use this when you need independent control of showing/hiding the modal
 */
export function QrCodeModal({ url, title = 'QR Code', isOpen, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrCopied, setQrCopied] = useState(false);

  useEffect(() => {
    if (isOpen && url) {
      QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [isOpen, url]);

  const copyQrCode = async () => {
    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 2000);
      } else {
        downloadQrCode();
      }
    } catch {
      downloadQrCode();
    }
  };

  const downloadQrCode = () => {
    const link = document.createElement('a');
    link.download = `qr-code-${Date.now()}.png`;
    link.href = qrDataUrl;
    link.click();
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <QrModal
      qrDataUrl={qrDataUrl}
      title={title}
      url={url}
      qrCopied={qrCopied}
      onCopy={copyQrCode}
      onDownload={downloadQrCode}
      onClose={onClose}
    />
  );
}
