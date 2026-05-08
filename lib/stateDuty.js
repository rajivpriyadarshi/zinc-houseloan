// State-wise stamp duty + registration + cess rates for property transactions in India
// These are approximate rates and may vary based on property value, gender, etc.

export const STATE_DUTY_RATES = {
  // Main Cities
  'Bangalore': 0.076,    // Karnataka: 5.6% stamp + 1% registration + 1% cess
  'Mumbai': 0.06,        // Maharashtra: 5% stamp + 1% registration (varies by area)
  'Delhi': 0.06,         // 5% stamp + 1% registration
  'Hyderabad': 0.075,    // Telangana: 6% stamp + 1.5% registration
  'Chennai': 0.07,       // Tamil Nadu: 7% stamp duty

  // All States
  'Andhra Pradesh': 0.055,      // 5% stamp + 0.5% registration
  'Arunachal Pradesh': 0.06,    // 6%
  'Assam': 0.06,                // 6%
  'Bihar': 0.063,               // 6.3%
  'Chhattisgarh': 0.05,         // 5%
  'Goa': 0.035,                 // 3.5%
  'Gujarat': 0.049,             // 4.9%
  'Haryana': 0.07,              // 5% stamp + 2% registration (varies by gender)
  'Himachal Pradesh': 0.06,     // 6%
  'Jharkhand': 0.06,            // 6%
  'Karnataka': 0.076,           // 5.6% stamp + 1% registration + 1% cess
  'Kerala': 0.08,               // 8%
  'Madhya Pradesh': 0.075,      // 7.5%
  'Maharashtra': 0.06,          // 5% stamp + 1% registration (varies by area)
  'Manipur': 0.07,              // 7%
  'Meghalaya': 0.05,            // 5%
  'Mizoram': 0.05,              // 5%
  'Nagaland': 0.05,             // 5%
  'Odisha': 0.05,               // 5%
  'Punjab': 0.07,               // 5% stamp + 2% registration
  'Rajasthan': 0.06,            // 5% stamp + 1% registration
  'Sikkim': 0.04,               // 4%
  'Tamil Nadu': 0.07,           // 7%
  'Telangana': 0.075,           // 6% stamp + 1.5% registration
  'Tripura': 0.05,              // 5%
  'Uttar Pradesh': 0.07,        // 5% stamp + 2% registration
  'Uttarakhand': 0.05,          // 5%
  'West Bengal': 0.07,          // 5% stamp + 2% registration
};

export function getTransactionDutyRate(cityOrState) {
  return STATE_DUTY_RATES[cityOrState] || 0.06; // Default 6% if not found
}
