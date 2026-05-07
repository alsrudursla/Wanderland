export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lat, lng, keyword } = req.query;

  if (!lat || !lng || !keyword) {
    return res.status(400).json({ error: '파라미터가 부족해요' });
  }

  const apiKey = process.env.GOOGLE_API_KEY;

  const response = await fetch(
    `https://places.googleapis.com/v1/places:searchText`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.googleMapsUri,places.regularOpeningHours,places.types'
      },
      body: JSON.stringify({
        textQuery: keyword,
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: 2000.0
          }
        },
        maxResultCount: 10,
        languageCode: 'ko'
      })
    }
  );

  const data = await response.json();
  return res.status(200).json(data);
}