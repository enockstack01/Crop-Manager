// Currencies a user can choose for money values (default USD).
// Keep in sync with server/src/lib/currencies.js and client/src/lib/currencies.js.
export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'BIF', name: 'Burundian Franc' },
  { code: 'BWP', name: 'Botswana Pula' },
  { code: 'CDF', name: 'Congolese Franc' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'MWK', name: 'Malawian Kwacha' },
  { code: 'MZN', name: 'Mozambican Metical' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'XAF', name: 'Central African CFA Franc' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'ZMW', name: 'Zambian Kwacha' },
  { code: 'ZWG', name: 'Zimbabwe Gold' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
];

/** SelectField options: "USD — US Dollar". */
export const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));

// account types a new user can request (Administrator is granted, never requested)
export const REQUESTABLE_ACCOUNT_TYPES = ['Farmer', 'Farm Manager', 'Agronomist', 'Cooperative Manager'];
