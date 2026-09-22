import { Router, Request, Response } from 'express';

const router = Router();

interface GeocodeResult {
  label: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

// In-memory cache for fast reverse geocode lookups
const reverseCache = new Map<string, GeocodeResult>();
const searchCache = new Map<string, GeocodeResult[]>();

/**
 * Reverse geocode latitude/longitude into human-readable street/locality/city address
 */
router.get('/reverse', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;
  const latitude = parseFloat(String(lat));
  const longitude = parseFloat(String(lon));

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ success: false, message: 'Valid latitude and longitude required' });
  }

  const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  if (reverseCache.has(cacheKey)) {
    return res.json({ success: true, data: reverseCache.get(cacheKey) });
  }

  try {
    // 1. Try Google Maps Geocoding API if key is available
    const gmapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (gmapsKey && !gmapsKey.startsWith('MY_')) {
      try {
        const gRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${gmapsKey}`
        );
        const gData: any = await gRes.json();
        if (gData.status === 'OK' && gData.results?.length > 0) {
          const first = gData.results[0];
          let route = '';
          let sublocality = '';
          let locality = '';
          let state = '';
          let postalCode = '';

          for (const comp of first.address_components || []) {
            if (comp.types.includes('route')) route = comp.long_name;
            if (comp.types.includes('sublocality') || comp.types.includes('sublocality_level_1')) sublocality = comp.long_name;
            if (comp.types.includes('locality')) locality = comp.long_name;
            if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
            if (comp.types.includes('postal_code')) postalCode = comp.long_name;
          }

          const label = [sublocality || route, locality].filter(Boolean).join(', ') || first.formatted_address.split(',')[0];
          const result: GeocodeResult = {
            label,
            addressLine: first.formatted_address,
            city: locality || 'Bengaluru',
            state: state || 'Karnataka',
            postalCode: postalCode || '560038',
            latitude,
            longitude,
            formattedAddress: first.formatted_address,
          };

          reverseCache.set(cacheKey, result);
          return res.json({ success: true, data: result });
        }
      } catch (gErr) {
        console.warn('Google reverse geocode call failed, attempting Nominatim fallback:', gErr);
      }
    }

    // 2. High-accuracy OpenStreetMap Nominatim reverse geocode
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'DrinkIt-QuickCommerce/2.0 (contact: support@drinkit.local)',
          'Accept-Language': 'en',
        },
      }
    );

    if (nomRes.ok) {
      const data: any = await nomRes.json();
      if (data && data.address) {
        const addr = data.address;
        const sublocality = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.village || addr.road;
        const city = addr.city || addr.town || addr.municipality || addr.county || 'Bengaluru';
        const state = addr.state || 'Karnataka';
        const postalCode = addr.postcode || '560038';

        const label = [sublocality, city].filter(Boolean).join(', ') || data.display_name.split(',')[0];
        const result: GeocodeResult = {
          label,
          addressLine: data.display_name,
          city,
          state,
          postalCode,
          latitude,
          longitude,
          formattedAddress: data.display_name,
        };

        reverseCache.set(cacheKey, result);
        return res.json({ success: true, data: result });
      }
    }

    // Fallback if network lookup times out
    return res.status(404).json({
      success: false,
      message: "We found your location, but couldn't determine the address.",
      data: {
        latitude,
        longitude,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Reverse geocoding failed: ' + (error.message || 'Unknown network error'),
      data: { latitude, longitude },
    });
  }
});

/**
 * Search places, streets, or landmarks (e.g. "LPU", "Indiranagar", "Sector 17 Chandigarh")
 */
router.get('/search', async (req: Request, res: Response) => {
  const query = String(req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const cacheKey = query.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return res.json({ success: true, data: searchCache.get(cacheKey) });
  }

  try {
    // 1. Check Google Places / Geocode if key is available
    const gmapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (gmapsKey && !gmapsKey.startsWith('MY_')) {
      try {
        const gRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${gmapsKey}`
        );
        const gData: any = await gRes.json();
        if (gData.status === 'OK' && gData.results?.length > 0) {
          const results: GeocodeResult[] = gData.results.slice(0, 5).map((item: any) => {
            let locality = '';
            let state = '';
            let postalCode = '';
            let sublocality = '';

            for (const comp of item.address_components || []) {
              if (comp.types.includes('sublocality') || comp.types.includes('sublocality_level_1')) sublocality = comp.long_name;
              if (comp.types.includes('locality')) locality = comp.long_name;
              if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
              if (comp.types.includes('postal_code')) postalCode = comp.long_name;
            }

            const label = [sublocality, locality].filter(Boolean).join(', ') || item.formatted_address.split(',')[0];
            return {
              label,
              addressLine: item.formatted_address,
              city: locality || 'Bengaluru',
              state: state || 'Karnataka',
              postalCode: postalCode || '560038',
              latitude: item.geometry.location.lat,
              longitude: item.geometry.location.lng,
              formattedAddress: item.formatted_address,
            };
          });

          searchCache.set(cacheKey, results);
          return res.json({ success: true, data: results });
        }
      } catch (e) {
        console.warn('Google Places search failed, falling back to Nominatim:', e);
      }
    }

    // 2. OpenStreetMap Nominatim Search
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=6&countrycodes=in`,
      {
        headers: {
          'User-Agent': 'DrinkIt-QuickCommerce/2.0 (contact: support@drinkit.local)',
          'Accept-Language': 'en',
        },
      }
    );

    if (nomRes.ok) {
      const items: any[] = await nomRes.json();
      const results: GeocodeResult[] = items.map(item => {
        const addr = item.address || {};
        const sublocality = addr.suburb || addr.neighbourhood || addr.residential || addr.road || '';
        const city = addr.city || addr.town || addr.municipality || addr.county || '';
        const state = addr.state || '';
        const postalCode = addr.postcode || '';

        const label = [sublocality, city].filter(Boolean).join(', ') || item.display_name.split(',')[0];
        return {
          label,
          addressLine: item.display_name,
          city,
          state,
          postalCode,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          formattedAddress: item.display_name,
        };
      });

      searchCache.set(cacheKey, results);
      return res.json({ success: true, data: results });
    }

    return res.json({ success: true, data: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Search failed: ' + err.message, data: [] });
  }
});

export default router;
