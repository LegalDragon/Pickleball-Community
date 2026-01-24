import { useState, useEffect } from 'react';
import { locationApi } from '../../services/api';

/**
 * AddressInput - Reusable address input component with country/state autocomplete
 *
 * Uses the global Countries and ProvinceStates tables for dropdown suggestions.
 * Country and state fields use datalist for autocomplete while still allowing
 * users to type new values not in the list. City is free-form text.
 *
 * Props:
 * - value: { country, state, city, address, postalCode } - Current address values
 * - onChange: (address) => void - Called when any field changes
 * - showAddress: boolean - Show street address field (default: true)
 * - showPostalCode: boolean - Show postal code field (default: false)
 * - showCity: boolean - Show city field (default: true)
 * - layout: 'stacked' | 'compact' - Layout mode (default: 'stacked')
 * - disabled: boolean - Disable all fields
 * - className: string - Additional CSS classes for the container
 */
export default function AddressInput({
  value = {},
  onChange,
  showAddress = true,
  showPostalCode = false,
  showCity = true,
  layout = 'stacked',
  disabled = false,
  className = ''
}) {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);

  // Load countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      setLoadingCountries(true);
      try {
        const response = await locationApi.getCountries();
        if (response.success) {
          setCountries(response.data || []);
        }
      } catch (err) {
        console.error('Error loading countries:', err);
      } finally {
        setLoadingCountries(false);
      }
    };
    loadCountries();
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!value.country) {
      setStates([]);
      return;
    }

    const loadStates = async () => {
      setLoadingStates(true);
      try {
        // Try to find country by name or code
        const country = countries.find(
          c => c.name === value.country ||
               c.code2 === value.country ||
               c.code3 === value.country
        );

        if (country) {
          const response = await locationApi.getStatesByCountry(country.code2 || country.name);
          if (response.success) {
            const sorted = (response.data || []).sort((a, b) => a.name.localeCompare(b.name));
            setStates(sorted);
          }
        } else {
          // Country not in our database, clear states
          setStates([]);
        }
      } catch (err) {
        console.error('Error loading states:', err);
        setStates([]);
      } finally {
        setLoadingStates(false);
      }
    };
    loadStates();
  }, [value.country, countries]);

  const handleChange = (field, fieldValue) => {
    const newValue = { ...value, [field]: fieldValue };

    // Clear dependent fields when parent changes
    if (field === 'country') {
      newValue.state = '';
      newValue.city = '';
    } else if (field === 'state') {
      newValue.city = '';
    }

    onChange(newValue);
  };

  const inputClass = "w-full border border-gray-300 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100";

  if (layout === 'compact') {
    return (
      <div className={`space-y-3 ${className}`}>
        {showAddress && (
          <input
            type="text"
            value={value.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            className={inputClass}
            placeholder="Street address"
            disabled={disabled}
          />
        )}
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            list="address-countries-list"
            value={value.country || ''}
            onChange={(e) => handleChange('country', e.target.value)}
            className={inputClass}
            placeholder="Country"
            disabled={disabled || loadingCountries}
          />
          <input
            type="text"
            list="address-states-list"
            value={value.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            className={inputClass}
            placeholder={value.country ? 'State' : 'Select country'}
            disabled={disabled || loadingStates}
          />
          {showCity && (
            <input
              type="text"
              value={value.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              className={inputClass}
              placeholder={value.state ? 'City' : 'Select state'}
              disabled={disabled}
            />
          )}
        </div>
        {showPostalCode && (
          <input
            type="text"
            value={value.postalCode || ''}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            className={inputClass}
            placeholder="Postal code"
            disabled={disabled}
          />
        )}
        <datalist id="address-countries-list">
          {countries.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <datalist id="address-states-list">
          {states.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </div>
    );
  }

  // Stacked layout (default)
  return (
    <div className={`space-y-4 ${className}`}>
      {showAddress && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            type="text"
            value={value.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            className={inputClass}
            placeholder="Street address"
            disabled={disabled}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
        <input
          type="text"
          list="address-countries-list"
          value={value.country || ''}
          onChange={(e) => handleChange('country', e.target.value)}
          className={inputClass}
          placeholder="Select or type country"
          disabled={disabled || loadingCountries}
        />
        <datalist id="address-countries-list">
          {countries.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
          <input
            type="text"
            list="address-states-list"
            value={value.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            className={inputClass}
            placeholder={value.country ? 'Select or type state' : 'Select country first'}
            disabled={disabled || loadingStates}
          />
          <datalist id="address-states-list">
            {states.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </div>

        {showCity && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={value.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              className={inputClass}
              placeholder={value.state ? 'Enter city' : 'Select state first'}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {showPostalCode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
          <input
            type="text"
            value={value.postalCode || ''}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            className={inputClass}
            placeholder="Postal code"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

/**
 * AddressDisplay - Read-only address display component
 *
 * Props:
 * - address: { country, state, city, address, postalCode } - Address to display
 * - layout: 'inline' | 'stacked' - Display layout (default: 'inline')
 * - className: string - Additional CSS classes
 */
export function AddressDisplay({
  address = {},
  layout = 'inline',
  className = ''
}) {
  const parts = [
    address.address,
    address.city,
    address.state,
    address.postalCode,
    address.country
  ].filter(Boolean);

  if (parts.length === 0) {
    return <span className={`text-gray-400 ${className}`}>No address</span>;
  }

  if (layout === 'stacked') {
    return (
      <div className={className}>
        {address.address && <div>{address.address}</div>}
        {(address.city || address.state || address.postalCode) && (
          <div>
            {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
          </div>
        )}
        {address.country && <div>{address.country}</div>}
      </div>
    );
  }

  // Inline layout (default)
  return <span className={className}>{parts.join(', ')}</span>;
}
