// Reverse geocoding utility to get address from coordinates
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'MDVR GPS Tracking System'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    
    if (data && data.display_name) {
      return data.display_name;
    }
    
    return 'Address not found';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return 'Unable to fetch address';
  }
};
