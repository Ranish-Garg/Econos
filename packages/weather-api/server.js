const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY; // Get from openweathermap.org
// The sidecar will POST to this endpoint
app.post('/weather', async (req, res) => {
    let { city, topic } = req.body;

    // Fallback: Extract city from topic if not provided directly
    if (!city && topic) {
        console.log(`Extracting city from topic: "${topic}"`);
        // Simple regex to find the word before "city" or just the last word
        // Example: "get temperature for bhopal city" -> "bhopal"
        const match = topic.match(/for\s+([a-zA-Z]+)/i) || topic.match(/([a-zA-Z]+)\s+city/i);
        if (match) {
            city = match[1];
        } else {
            // Last resort: assume the topic IS the city or contains it
            city = topic.split(' ').pop();
        }
    }

    if (!city) {
        return res.status(400).json({ error: 'City is required' });
    }
    console.log(`Fetching weather for: ${city}`);
    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHER_API_KEY}&units=metric`
        );

        res.json({
            city: response.data.name,
            temperature: response.data.main.temp,
            description: response.data.weather[0].description,
            humidity: response.data.main.humidity
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch weather' });
    }
});
app.listen(8080, () => console.log('Weather API running on port 8080'));