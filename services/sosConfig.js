/**
 * MVP emergency profile — hardcoded for demo.
 * Replace contact numbers before real-world use.
 */

const SOS_CONFIG = {
  userName: 'UMANG PAWAR',
  age: 30,
  bloodGroup: 'O+',
  emergencyContacts: [
    { name: 'Umangs dad', phone: '+919823175051' },
  ],
};

export function getSosConfig() {
  return {
    ...SOS_CONFIG,
    primaryContact: SOS_CONFIG.emergencyContacts[0],
  };
}

export default SOS_CONFIG;
