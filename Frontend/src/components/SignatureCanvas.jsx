import { useRef, useEffect, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { RotateCcw, Check } from 'lucide-react';

/**
 * SignatureCanvas - A component for capturing drawn signatures
 *
 * @param {Object} props
 * @param {function} props.onSignatureChange - Callback with base64 signature data when signature changes
 * @param {string} props.className - Additional CSS classes
 * @param {number} props.width - Canvas width (default: 400)
 * @param {number} props.height - Canvas height (default: 200)
 * @param {boolean} props.disabled - Whether the canvas is disabled
 */
export default function SignatureCanvas({
  onSignatureChange,
  className = '',
  width = 400,
  height = 200,
  disabled = false
}) {
  const canvasRef = useRef(null);
  const signaturePadRef = useRef(null);

  // Initialize SignaturePad
  useEffect(() => {
    if (canvasRef.current && !signaturePadRef.current) {
      const canvas = canvasRef.current;

      // Set canvas size for high DPI displays
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext('2d').scale(ratio, ratio);

      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
        minWidth: 0.5,
        maxWidth: 2.5,
      });

      // Listen for signature changes
      signaturePadRef.current.addEventListener('endStroke', () => {
        if (onSignatureChange) {
          const data = signaturePadRef.current.isEmpty()
            ? null
            : signaturePadRef.current.toDataURL('image/png');
          onSignatureChange(data);
        }
      });
    }

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
        signaturePadRef.current = null;
      }
    };
  }, [width, height, onSignatureChange]);

  // Handle disabled state
  useEffect(() => {
    if (signaturePadRef.current) {
      if (disabled) {
        signaturePadRef.current.off();
      } else {
        signaturePadRef.current.on();
      }
    }
  }, [disabled]);

  const handleClear = useCallback(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      if (onSignatureChange) {
        onSignatureChange(null);
      }
    }
  }, [onSignatureChange]);

  const isEmpty = useCallback(() => {
    return signaturePadRef.current ? signaturePadRef.current.isEmpty() : true;
  }, []);

  return (
    <div className={`signature-canvas-container ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`border-2 border-gray-300 rounded-lg touch-none ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-crosshair'
          }`}
          style={{ width: `${width}px`, height: `${height}px` }}
        />

        {/* Clear button */}
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clear signature"
        >
          <RotateCcw className="w-4 h-4 text-gray-600" />
        </button>

        {/* Instructions overlay when empty */}
        {!disabled && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <p className="text-gray-400 text-sm" style={{ opacity: 0.7 }}>
              Sign here
            </p>
          </div>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-500 text-center">
        Draw your signature above using your finger or mouse
      </p>
    </div>
  );
}
