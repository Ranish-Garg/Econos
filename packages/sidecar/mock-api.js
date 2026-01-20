// A simple Express server acting as the "User's Existing Business"
const express = require('express');
const app = express();
app.use(express.json());

app.post('/execute-task', (req, res) => {
    console.log("🏢 [Web2 API] Received task:", req.body);
    
    // Simulate Business Logic
    const result = {
        message: "Hello from the Web2 World!",
        processedInput: req.body,
        timestamp: Date.now()
    };
    
    res.json(result);
});

app.listen(8080, () => console.log("🏢 Mock Web2 API running on 8080"));