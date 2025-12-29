import { useState, useEffect } from 'react'
import { X, CreditCard, Check, Loader2, Lock, ShieldCheck } from 'lucide-react'

const MockPaymentModal = ({
  isOpen,
  onClose,
  onSuccess,
  itemName,
  itemType, // 'course' or 'material'
  price,
  coachName
}) => {
  const [step, setStep] = useState('form') // 'form', 'processing', 'success'
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242')
  const [expiry, setExpiry] = useState('12/25')
  const [cvc, setCvc] = useState('123')
  const [name, setName] = useState('Demo User')

  useEffect(() => {
    if (isOpen) {
      setStep('form')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Simulate payment processing
    setStep('processing')

    // Wait 2 seconds to simulate payment
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Show success
    setStep('success')

    // Wait 1.5 seconds then call onSuccess
    await new Promise(resolve => setTimeout(resolve, 1500))

    onSuccess()
  }

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    return parts.length ? parts.join(' ') : value
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <span className="font-semibold">Secure Checkout</span>
            </div>
            {step === 'form' && (
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 p-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 uppercase">{itemType}</p>
              <p className="font-medium text-gray-900">{itemName}</p>
              {coachName && (
                <p className="text-sm text-gray-500">by {coachName}</p>
              )}
            </div>
            <p className="text-2xl font-bold text-indigo-600">${price?.toFixed(2)}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Demo Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <strong>Demo Mode:</strong> This is a simulated payment. No real charges will be made.
              </div>

              {/* Card Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10"
                    placeholder="1234 5678 9012 3456"
                  />
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Expiry and CVC */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    maxLength={5}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="MM/YY"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVC
                  </label>
                  <input
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    maxLength={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="123"
                  />
                </div>
              </div>

              {/* Cardholder Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="John Doe"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-5 h-5" />
                Pay ${price?.toFixed(2)}
              </button>

              {/* Security Notice */}
              <p className="text-xs text-center text-gray-500">
                <Lock className="w-3 h-3 inline mr-1" />
                Your payment information is secure and encrypted
              </p>
            </form>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 mx-auto text-indigo-600 animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Payment</h3>
              <p className="text-gray-500">Please wait while we process your payment...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-gray-500">Thank you for your purchase. Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MockPaymentModal
